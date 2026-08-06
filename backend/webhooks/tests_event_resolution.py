"""
webhooks/tests_event_resolution.py
──────────────────────────────────
Anchored boundary matching for inbound event codes.

THE BUG: a payload carrying "BIU" attached to `BIUK - PM`, because resolution
used istartswith/icontains with no boundary check and -event_date picked the
winner. The one hard requirement these tests exist to hold is that a code
followed by an alphanumeric character never matches.

The trailing segment of an event code is dynamic, so Set 4 parametrises over
shapes rather than asserting against the two codes that happen to exist today.
"""
from datetime import date

from django.db import transaction
from django.test import TestCase
from django.urls import reverse

from book_delegate.models import BookDelegate
from book_event.models import BookEvent
from events.models import Event
from webhooks.event_resolver import Outcome, resolve_event_code
from webhooks.models import WebhookApiKey


def make_event(code, *, web_bookings, event_date=date(2026, 2, 11), name=None):
    """
    Event.save() derives accepting_web_bookings from web_bookings and derives
    name from official_event_name — setting accepting_web_bookings directly is
    silently overwritten, so fixtures must go through web_bookings.
    """
    return Event.objects.create(
        event_code          = code,
        official_event_name = name or f"Event {code}",
        event_date          = event_date,
        web_bookings        = web_bookings,
    )


def resolve(raw):
    """Resolve exactly as the processor does: raw plus its normalised form."""
    from webhooks.services import WebhookProcessor
    from webhooks.models import WebhookLog
    proc = WebhookProcessor(WebhookLog(payload={}))     # unsaved; no DB write
    return resolve_event_code(raw, proc.normalize_event_code(raw))


class ResolverSet1Tests(TestCase):
    """Fixtures: BIU/GS - PM (ON), BIUK - PM (ON), BIUK - PM26 (OFF)."""

    @classmethod
    def setUpTestData(cls):
        cls.biu_gs = make_event("BIU/GS - PM",  web_bookings=True,
                                event_date=date(2026, 2, 9))
        cls.biuk   = make_event("BIUK - PM",    web_bookings=True,
                                event_date=date(2026, 2, 11))
        cls.biuk26 = make_event("BIUK - PM26",  web_bookings=False,
                                event_date=date(2026, 3, 1))

    def test_biu_does_not_select_biuk(self):
        """The reported bug. 'BIU' must never reach `BIUK - PM`."""
        r = resolve("BIU")
        self.assertEqual(r.outcome, Outcome.BOUNDARY)
        self.assertEqual(r.event.event_code, "BIU/GS - PM")
        self.assertNotEqual(r.event.event_code, "BIUK - PM")
        self.assertNotIn("BIUK - PM", r.matched_codes)
        # BIUK - PM was offered by the prefilter and rejected by the rule —
        # that is the difference the fix makes, so assert it explicitly.
        self.assertIn("BIUK - PM", r.candidates)

    def test_biuk_resolves_to_biuk(self):
        r = resolve("BIUK")
        self.assertEqual(r.event.event_code, "BIUK - PM")

    def test_biu_gs_resolves(self):
        r = resolve("BIU/GS")
        self.assertEqual(r.event.event_code, "BIU/GS - PM")

    def test_case_insensitive(self):
        r = resolve("biuk - pm")
        self.assertEqual(r.outcome, Outcome.EXACT)
        self.assertEqual(r.event.event_code, "BIUK - PM")

    def test_bookings_off_is_distinct_from_no_match(self):
        """
        Raw-exact hits BIUK - PM26, which is closed. The tier wins outright: it
        must NOT fall through to normalised-exact and quietly book onto the open
        BIUK - PM edition.
        """
        r = resolve("BIUK - PM26")
        self.assertEqual(r.outcome, Outcome.BOOKINGS_OFF)
        self.assertIsNone(r.event)
        self.assertEqual(r.http_status, 400)
        self.assertIn("BIUK - PM26", r.matched_codes)
        self.assertNotEqual(r.outcome, Outcome.NO_MATCH)
        self.assertIn("web bookings is disabled", r.error_message)

    def test_unknown_code_is_no_match(self):
        r = resolve("ZZZ")
        self.assertEqual(r.outcome, Outcome.NO_MATCH)
        self.assertIsNone(r.event)
        self.assertEqual(r.http_status, 400)
        self.assertIn("anchored boundary matching", r.error_message)


class ResolverSet2Tests(TestCase):
    """Single fixture BIUK - PM (ON): 'BIU' has nothing legitimate to match."""

    @classmethod
    def setUpTestData(cls):
        cls.biuk = make_event("BIUK - PM", web_bookings=True)

    def test_biu_alone_is_no_match(self):
        r = resolve("BIU")
        self.assertEqual(r.outcome, Outcome.NO_MATCH)
        self.assertIsNone(r.event)
        self.assertEqual(r.http_status, 400)
        # The prefilter DID offer it; the boundary rule is what rejected it.
        self.assertIn("BIUK - PM", r.candidates)
        self.assertEqual(r.matched_codes, [])


class ResolverSet3Tests(TestCase):
    """Two open editions, both boundary-matching: refuse to guess."""

    @classmethod
    def setUpTestData(cls):
        cls.a = make_event("BIU - PM", web_bookings=True,
                           event_date=date(2026, 2, 9))
        cls.b = make_event("BIU - RS", web_bookings=True,
                           event_date=date(2027, 2, 9))   # later: the old tiebreak

    def test_ambiguous_is_409_and_never_tiebroken(self):
        r = resolve("BIU")
        self.assertEqual(r.outcome, Outcome.AMBIGUOUS)
        self.assertIsNone(r.event)
        self.assertEqual(r.http_status, 409)
        self.assertCountEqual(r.matched_codes, ["BIU - PM", "BIU - RS"])
        self.assertIn("Disambiguate at source", r.error_message)

    def test_ambiguity_ignores_closed_editions(self):
        """A closed third edition does not make an open single match ambiguous."""
        make_event("BIU - XX", web_bookings=False)
        r = resolve("BIU")
        self.assertEqual(r.outcome, Outcome.AMBIGUOUS)
        self.assertNotIn("BIU - XX", r.matched_codes)


class ResolverSet4BoundaryShapeTests(TestCase):
    """
    The actual requirement, parametrised over dynamic trailing segments.

    Each case gets its own Event inside a savepoint that is rolled back, so the
    codes never collide with each other and no row is deleted.
    """

    RESOLVES = ["BIU - XX", "BIU/AB - PM", "BIU_EU", "BIU.2"]
    REJECTS  = ["BIUK", "BIU9", "BIUX - PM"]

    def _one_case(self, code, expect_resolved):
        sid = transaction.savepoint()
        try:
            make_event(code, web_bookings=True)
            r = resolve("BIU")
            if expect_resolved:
                self.assertEqual(r.event.event_code if r.event else None, code)
                self.assertEqual(r.outcome, Outcome.BOUNDARY)
            else:
                self.assertEqual(r.outcome, Outcome.NO_MATCH)
                self.assertIsNone(r.event)
                self.assertIn(code, r.candidates)   # prefiltered, then rejected
            return r
        finally:
            transaction.savepoint_rollback(sid)

    def test_non_alphanumeric_next_char_resolves(self):
        for code in self.RESOLVES:
            with self.subTest(event_code=code):
                self._one_case(code, expect_resolved=True)

    def test_alphanumeric_next_char_rejected(self):
        for code in self.REJECTS:
            with self.subTest(event_code=code):
                self._one_case(code, expect_resolved=False)

    def test_underscore_is_a_boundary_not_a_word_char(self):
        """
        Guards the choice of [A-Za-z0-9] over \\b: \\b treats '_' as a word
        character, so BIU_EU would not resolve. It must.
        """
        self._one_case("BIU_EU", expect_resolved=True)


class IngestEndpointTests(TestCase):
    """
    End-to-end through POST /api/webhooks/ingest/, so the HTTP status mapping
    and the no-rows-written guarantee are exercised, not just the resolver.
    """

    @classmethod
    def setUpTestData(cls):
        cls.biu_gs = make_event("BIU/GS - PM", web_bookings=True,
                                event_date=date(2026, 2, 9))
        cls.biuk   = make_event("BIUK - PM",   web_bookings=True,
                                event_date=date(2026, 2, 11))
        cls.biuk26 = make_event("BIUK - PM26", web_bookings=False,
                                event_date=date(2026, 3, 1))
        cls.raw_key = WebhookApiKey.generate_key()
        WebhookApiKey.objects.create(name="test-suite", api_key=cls.raw_key)

    def _payload(self, code, invoice="INV-TEST-001"):
        return {
            "InvoiceNumber": invoice,
            "Eventcode":     code,
            "Eventname":     "whatever",
            "Date":          "2026-02-11",
            "InvoiceDate":   "2026-02-01",
            "Discount":      0,
            "PreTaxAmount":  100,
            "TaxAmount":     0,
            "TotalAmount":   100,
            "AddOnsTotalAmount": 0,
            "Delegates": [{
                "FirstName": "Test",
                "LastName":  "Person",
                "Email":     "test.person@example.com",
            }],
        }

    def _post(self, code, invoice="INV-TEST-001"):
        return self.client.post(
            reverse("webhook-ingest"), data=self._payload(code, invoice),
            content_type="application/json", HTTP_X_CRM_API_KEY=self.raw_key,
        )

    def test_biu_routes_to_biu_gs_not_biuk(self):
        resp = self._post("BIU")
        self.assertIn(resp.status_code, (200, 201), resp.content)
        booking = BookEvent.objects.get(invoice_number="INV-TEST-001")
        self.assertEqual(booking.event_code, "BIU/GS - PM")
        self.assertNotEqual(booking.event_code, "BIUK - PM")

    def test_no_match_is_400_and_writes_nothing(self):
        resp = self._post("ZZZ")
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(BookEvent.objects.count(), 0)
        self.assertEqual(BookDelegate.objects.count(), 0)

    def test_bookings_off_is_400_and_writes_nothing(self):
        resp = self._post("BIUK - PM26")
        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertEqual(BookEvent.objects.count(), 0)
        self.assertEqual(BookDelegate.objects.count(), 0)

    def test_failure_log_is_diagnosable(self):
        """A 400 must be explainable from the WebhookLog alone."""
        from webhooks.models import WebhookLog
        self._post("ZZZ")
        log = WebhookLog.objects.latest("id")
        self.assertEqual(log.http_status, 400)
        self.assertIn("DIAG-A-NO-MATCH", log.processing_notes)
        self.assertIn("raw code received", log.processing_notes)
        self.assertIn("normalized code", log.processing_notes)
        self.assertIn("prefilter candidates", log.processing_notes)

    def test_bookings_off_log_names_its_own_rule(self):
        from webhooks.models import WebhookLog
        self._post("BIUK - PM26")
        log = WebhookLog.objects.latest("id")
        self.assertIn("DIAG-B-BOOKINGS-OFF", log.processing_notes)
        self.assertNotIn("DIAG-A-NO-MATCH", log.processing_notes)


class AmbiguousIngestTests(TestCase):
    """409 must survive the view's status mapping rather than becoming a 500."""

    @classmethod
    def setUpTestData(cls):
        make_event("BIU - PM", web_bookings=True, event_date=date(2026, 2, 9))
        make_event("BIU - RS", web_bookings=True, event_date=date(2027, 2, 9))
        cls.raw_key = WebhookApiKey.generate_key()
        WebhookApiKey.objects.create(name="test-suite", api_key=cls.raw_key)

    def test_ambiguous_returns_409_and_writes_nothing(self):
        resp = self.client.post(
            reverse("webhook-ingest"),
            data={
                "InvoiceNumber": "INV-AMB-001", "Eventcode": "BIU",
                "Eventname": "x", "Date": "2026-02-11", "InvoiceDate": "2026-02-01",
                "Discount": 0, "PreTaxAmount": 100, "TaxAmount": 0,
                "TotalAmount": 100, "AddOnsTotalAmount": 0,
                "Delegates": [{"FirstName": "A", "LastName": "B",
                               "Email": "a.b@example.com"}],
            },
            content_type="application/json", HTTP_X_CRM_API_KEY=self.raw_key,
        )
        self.assertEqual(resp.status_code, 409, resp.content)
        self.assertEqual(BookEvent.objects.count(), 0)
        self.assertEqual(BookDelegate.objects.count(), 0)


class UpdateBookingEventCodeTests(TestCase):
    """
    The double-normalisation fix: an update must write the resolved Event code
    verbatim, never a re-normalised copy of it.
    """

    @classmethod
    def setUpTestData(cls):
        cls.event = make_event("ACU - RS", web_bookings=True)
        cls.raw_key = WebhookApiKey.generate_key()
        WebhookApiKey.objects.create(name="test-suite", api_key=cls.raw_key)

    def _post(self, code, total):
        return self.client.post(
            reverse("webhook-ingest"),
            data={
                "InvoiceNumber": "INV-UPD-001", "Eventcode": code,
                "Eventname": "x", "Date": "2026-02-11", "InvoiceDate": "2026-02-01",
                "Discount": 0, "PreTaxAmount": total, "TaxAmount": 0,
                "TotalAmount": total, "AddOnsTotalAmount": 0,
                "Delegates": [{"FirstName": "A", "LastName": "B",
                               "Email": "a.b@example.com"}],
            },
            content_type="application/json", HTTP_X_CRM_API_KEY=self.raw_key,
        )

    def test_update_path_keeps_the_resolved_code_verbatim(self):
        first = self._post("ACU - RS", 100)
        self.assertIn(first.status_code, (200, 201), first.content)
        self.assertEqual(
            BookEvent.objects.get(invoice_number="INV-UPD-001").event_code,
            "ACU - RS")

        # Second post on the same invoice takes the UPDATE path, which is where
        # the code used to be re-normalised. "ACU" maps to "ACU - RS" and the
        # year-strip rule fires on suffixed codes; neither may touch it now.
        second = self._post("ACU - RS", 200)
        self.assertIn(second.status_code, (200, 201), second.content)
        self.assertEqual(
            BookEvent.objects.get(invoice_number="INV-UPD-001").event_code,
            "ACU - RS")
