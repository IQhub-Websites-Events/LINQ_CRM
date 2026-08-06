"""
manage.py live_smoke — read-only smoke test against whatever database is
configured, including production.

The unit suite runs on fixtures of a few dozen rows. Two of the bugs found
while building the filter and mass-update features only appeared at real
volume: pagination duplicated and skipped rows because the sort key was
non-unique, and an axios array serialisation that django-filter ignored
returned every row instead of erroring. Neither is reproducible on a fixture
of five records, so this exists to exercise the same endpoints against real
data after a deploy or a restore.

Read-only by construction:
  * every list / schema call is a GET
  * bulk_update is only ever called with commit=false, which returns before
    the write block (accounts/bulk_update.py:324)
  * row counts are re-read at the end and compared against the start
No transaction is opened, so there is no rollback to assert.

Assertions are invariants, not the counts from any one snapshot — a partition
identity, a pagination identity, zero drift. Absolute numbers are printed but
never asserted, so this does not go stale when the data moves.

    python manage.py live_smoke
    python manage.py live_smoke --pages 5 --page-size 100

Exit status is 1 if any check fails, so it can gate a deploy script.
"""
import json
from urllib.parse import quote

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from rest_framework.test import APIRequestFactory, force_authenticate

from book_delegate.models import BookDelegate
from book_delegate.views import BookDelegateViewSet
from book_event.models import BookEvent
from events.models import Event
from events.views import EventViewSet
from ticket_central.models import Ticket
from ticket_central.views import TicketViewSet

User = get_user_model()

# (label, viewset, path, most-tied ordering the UI offers as a column header)
#
# The tied ordering matters as much as the default. Measured on this data,
# tickets.created_at (the default sort) has 7,853 distinct values over 35,690
# rows and drifts little, while tickets.status — one click on the Status header
# — has TWO distinct values over the same 35,690 rows. Sampling only the default
# ordering is blind to the case that actually breaks.
SURFACES = [
    ("Bookings",       BookDelegateViewSet, "/api/delegates/", "_sort_status"),
    ("Ticket Central", TicketViewSet,       "/api/tickets/",   "status"),
    ("Events",         EventViewSet,        "/api/events/",    "event_date"),
]


class Command(BaseCommand):
    help = "Read-only smoke test of the list, filter and bulk-update endpoints."

    def add_arguments(self, parser):
        parser.add_argument("--pages", type=int, default=20,
                            help="How many pages to sample per surface at each of "
                                 "the shallow and deep ends (default 20).")
        parser.add_argument("--page-size", type=int, default=50,
                            help="Rows per page (default 50).")
        parser.add_argument("--user", default=None,
                            help="Username to act as. Defaults to HP, then any "
                                 "all-access user.")

    # ── plumbing ──────────────────────────────────────────────────────────────

    def _check(self, label, got, want):
        ok = got == want
        self.results.append(ok)
        if ok:
            self.stdout.write(self.style.SUCCESS(f"  ok    {label}: {got!r}"))
        else:
            self.failures.append(f"{label}: got {got!r}, want {want!r}")
            self.stdout.write(self.style.ERROR(f"  FAIL  {label}: {got!r} (want {want!r})"))

    def _note(self, label, value):
        self.stdout.write(f"        {label}: {value!r}")

    def _call(self, viewset, mapping, path, data=None, method="get"):
        view = viewset.as_view(mapping)
        factory = getattr(self.factory, method)
        req = factory(path, data, format="json") if data is not None else factory(path)
        force_authenticate(req, user=self.user)
        resp = view(req)
        resp.render()
        return resp.status_code, (json.loads(resp.content) if resp.content else None)

    def _counts(self):
        return {
            "delegates": BookDelegate.objects.count(),
            "invoices":  BookEvent.objects.count(),
            "tickets":   Ticket.objects.count(),
            "events":    Event.objects.count(),
            "assigned":  Event.assigned_users.through.objects.count(),
        }

    # ── entry point ───────────────────────────────────────────────────────────

    def handle(self, *args, **opts):
        self.factory  = APIRequestFactory()
        self.results  = []
        self.failures = []

        # Paginated responses build an absolute next/previous URL from the Host
        # header and APIRequestFactory sends "testserver". Process-local only —
        # this is a management command, not a running server.
        if "testserver" not in settings.ALLOWED_HOSTS:
            settings.ALLOWED_HOSTS = list(settings.ALLOWED_HOSTS) + ["testserver"]

        self.user = self._resolve_user(opts["user"])
        self.stdout.write(f"acting as: {self.user.username}\n")

        before = self._counts()
        self.stdout.write(f"row counts before: {before}\n")

        self._schemas()
        self._pagination(opts["pages"], opts["page_size"])
        self._filter_spec()
        self._bulk_update_preview()

        self.stdout.write("\nrow counts after")
        after = self._counts()
        for key in before:
            self._check(f"{key} unchanged", after[key], before[key])

        self.stdout.write("\n" + "=" * 62)
        if self.failures:
            for f in self.failures:
                self.stdout.write(self.style.ERROR(f"  - {f}"))
            raise CommandError(f"{len(self.failures)} of {len(self.results)} checks failed")
        self.stdout.write(self.style.SUCCESS(f"all {len(self.results)} checks passed"))

    def _resolve_user(self, username):
        if username:
            user = User.objects.filter(username=username).first()
            if user is None:
                raise CommandError(f"no such user: {username}")
            return user
        user = (User.objects.filter(username="HP").first()
                or User.objects.filter(custom_role__is_all_access=True).first())
        if user is None:
            raise CommandError("no all-access user to act as; pass --user")
        return user

    # ── checks ────────────────────────────────────────────────────────────────

    def _schemas(self):
        self.stdout.write("\nfilter_schema / bulk_update_schema")
        for label, viewset, path, _tied in SURFACES:
            code, body = self._call(viewset, {"get": "filter_schema"},
                                    f"{path}filter_schema/")
            self._check(f"{label} filter_schema", code, 200)
            if code == 200:
                self._check(f"{label} match_modes", body["match_modes"], ["all"])
                self._note(f"{label} filterable fields", len(body["fields"]))
            code, body = self._call(viewset, {"get": "bulk_update_schema"},
                                    f"{path}bulk_update_schema/")
            self._check(f"{label} bulk_update_schema", code, 200)
            if code == 200:
                self._note(f"{label} editable fields", len(body["fields"]))

    def _page_plan(self, pages, page_size, total):
        """
        Which page numbers to sample: the first N, plus N more spread across
        the deep end and always including the last full page.

        Depth is the whole point. OFFSET drift grows with the offset — a
        non-unique sort lets Postgres reshuffle tied rows, and the window
        slides over rows it has already returned. Walking pages 1-3 of 266
        found nothing when this surface was provably losing 494 rows; the
        damage lives in the pages nobody samples.

        Deep samples are taken as ADJACENT PAIRS (p, p+1), which matters more
        than how many of them there are. A duplicated row shows up as the same
        id on two consecutive pages, so an isolated deep page cannot reveal it
        — there is nothing to collide with. Sampling pages 240 and 241 catches
        the drift at offset 12,000; sampling 240 alone catches nothing.

        Only full pages are sampled, so the expected union size is exactly
        len(plan) * page_size with no partial-page special case.
        """
        full_pages = (total or 0) // page_size
        if full_pages <= 0:
            return []
        head = list(range(1, min(pages, full_pages) + 1))
        deep = []
        if full_pages > pages:
            for i in range(max(1, pages // 2)):
                frac = (i + 1) / max(1, pages // 2)
                p = int(round(pages + frac * (full_pages - pages)))
                p = min(max(p, pages + 1), full_pages)
                deep.append(p)
                if p + 1 <= full_pages:
                    deep.append(p + 1)      # its neighbour, so overlap can show
                elif p - 1 > pages:
                    deep.append(p - 1)
        return sorted(set(head + deep))

    def _pagination(self, pages, page_size):
        """
        Sample shallow AND deep pages, and assert the union is exactly the
        number of rows those pages should have covered.

        Checking only for duplicates is not enough: LIMIT/OFFSET over a
        non-unique sort loses a row for every one it repeats, and the losses
        are invisible. Comparing the union size to len(plan)*size catches both
        halves at once.

        This is still a SAMPLE, not a proof. `manage.py pagination_walk` walks
        every page of every surface and is the exhaustive check; this one is
        sized to gate a deploy in seconds.
        """
        self.stdout.write(
            f"\npagination (sample: up to {pages} shallow + {pages} deep pages "
            f"of {page_size}; exhaustive proof is `manage.py pagination_walk`)")
        for label, viewset, path, tied in SURFACES:
            # Both the default ordering and the most-tied column the UI offers.
            # A tiebreaker that only reaches the default path leaves the bug
            # live the moment a rep clicks a column header.
            for sort_label, ordering in (("default sort", None),
                                         (f"sort={tied}", tied)):
                self._pagination_one(label, viewset, path, sort_label, ordering,
                                     pages, page_size)

    def _pagination_one(self, label, viewset, path, sort_label, ordering,
                        pages, page_size):
        suffix = f"&ordering={quote(ordering)}" if ordering else ""
        code, body = self._call(
            viewset, {"get": "list"}, f"{path}?page=1&page_size={page_size}{suffix}")
        if code != 200:
            self._check(f"{label} [{sort_label}] page 1", code, 200)
            return
        total = body["count"]
        plan = self._page_plan(pages, page_size, total)
        if not plan:
            self._note(f"{label} [{sort_label}] pagination",
                       f"skipped - fewer than {page_size} rows")
            self._note(f"{label} total rows", total)
            return

        seen = set()
        for page in plan:
            code, body = self._call(
                viewset, {"get": "list"},
                f"{path}?page={page}&page_size={page_size}{suffix}")
            if code != 200:
                self._check(f"{label} [{sort_label}] page {page}", code, 200)
                return
            seen |= {r["id"] for r in body["results"]}
        self._check(f"{label} [{sort_label}] distinct ids over {len(plan)} sampled pages",
                    len(seen), len(plan) * page_size)
        self._note(f"{label} [{sort_label}] pages sampled",
                   f"{plan[:3]}..{plan[-3:]} of {total // page_size}")

    def _filter_spec(self):
        """
        any_of(X) and none_of(X) must partition the unfiltered total exactly.

        This is the check that would have caught the array-serialisation bug:
        a silently dropped filter returns every row, so the two halves sum to
        twice the total instead of once.
        """
        self.stdout.write("\nfilter_spec partition identity")
        code, schema = self._call(BookDelegateViewSet, {"get": "filter_schema"},
                                  "/api/delegates/filter_schema/")
        if code != 200:
            self._check("filter_schema for partition check", code, 200)
            return
        cfg = schema["fields"].get("payment_status")
        if not cfg or not cfg.get("choices"):
            self._note("partition check", "skipped - payment_status has no choices")
            return
        choices = [c["value"] if isinstance(c, dict) else c for c in cfg["choices"]]
        half = choices[:max(1, len(choices) // 2)]

        def count_for(op):
            spec = quote(json.dumps({"match": "all", "criteria": [
                {"field": "payment_status", "op": op, "values": half}]}))
            code, body = self._call(
                BookDelegateViewSet, {"get": "list"},
                f"/api/delegates/?page=1&page_size=1&filter_spec={spec}")
            if code != 200:
                self._check(f"payment_status {op}", code, 200)
                return None
            return body["count"]

        code, body = self._call(BookDelegateViewSet, {"get": "list"},
                                "/api/delegates/?page=1&page_size=1")
        total = body["count"] if code == 200 else None
        inside, outside = count_for("any_of"), count_for("none_of")
        self._note("payment_status values tested", half)
        self._note("any_of / none_of / total", (inside, outside, total))
        if None not in (inside, outside, total):
            self._check("any_of + none_of == total", inside + outside, total)
            self._check("any_of actually filtered", inside < total, True)

        # The single-key column filter must agree with the spec engine.
        one = half[0]
        code, body = self._call(
            BookDelegateViewSet, {"get": "list"},
            f"/api/delegates/?page=1&page_size=1&payment_status={quote(one)}")
        column = body["count"] if code == 200 else None
        spec = quote(json.dumps({"match": "all", "criteria": [
            {"field": "payment_status", "op": "is", "value": one}]}))
        code, body = self._call(
            BookDelegateViewSet, {"get": "list"},
            f"/api/delegates/?page=1&page_size=1&filter_spec={spec}")
        self._check(f"column filter == filter_spec for {one!r}",
                    body["count"] if code == 200 else None, column)

    def _bulk_update_preview(self):
        """
        commit=false on every surface. Proves the mixin still resolves ids and
        builds a plan, without writing anything.
        """
        self.stdout.write("\nbulk_update preview (commit=false)")
        for label, viewset, path, _tied in SURFACES:
            code, schema = self._call(viewset, {"get": "bulk_update_schema"},
                                      f"{path}bulk_update_schema/")
            if code != 200:
                continue
            code, listing = self._call(viewset, {"get": "list"}, f"{path}?page=1&page_size=3")
            ids = [r["id"] for r in listing["results"]] if code == 200 else []
            if not ids:
                self._note(f"{label} preview", "skipped - no rows")
                continue

            code, _ = self._call(viewset, {"post": "bulk_update"}, f"{path}bulk_update/",
                                 data={"ids": ids, "field": "definitely_not_a_field",
                                       "commit": False}, method="post")
            self._check(f"{label} rejects an unknown field", code, 400)

            code, _ = self._call(viewset, {"post": "bulk_update"}, f"{path}bulk_update/",
                                 data={"ids": "not-a-list", "field": next(iter(schema["fields"])),
                                       "commit": False}, method="post")
            self._check(f"{label} rejects a non-list ids", code, 400)

            field = next(iter(schema["fields"]))
            code, plan = self._call(viewset, {"post": "bulk_update"}, f"{path}bulk_update/",
                                    data={"ids": ids, "field": field, "commit": False},
                                    method="post")
            self._check(f"{label} value-less preview on {field!r}", code, 200)
            if code == 200:
                self._check(f"{label} preview requested", plan["requested"], len(ids))
                self._check(f"{label} preview permitted", plan["permitted"], len(ids))
                self._check(f"{label} preview wrote nothing", plan["updated"], 0)
                self._check(f"{label} preview returned a plan_hash",
                            bool(plan.get("plan_hash")), True)
