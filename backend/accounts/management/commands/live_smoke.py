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

SURFACES = [
    ("Bookings",       BookDelegateViewSet, "/api/delegates/"),
    ("Ticket Central", TicketViewSet,       "/api/tickets/"),
    ("Events",         EventViewSet,        "/api/events/"),
]


class Command(BaseCommand):
    help = "Read-only smoke test of the list, filter and bulk-update endpoints."

    def add_arguments(self, parser):
        parser.add_argument("--pages", type=int, default=3,
                            help="How many pages to walk per surface (default 3).")
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
        for label, viewset, path in SURFACES:
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

    def _pagination(self, pages, page_size):
        """
        Walk the first N pages and assert the union is exactly the number of
        rows those pages should have covered.

        Checking only for duplicates is not enough: LIMIT/OFFSET over a
        non-unique sort loses a row for every one it repeats, and the losses
        are invisible. Comparing the union size to min(total, pages*size)
        catches both halves at once.
        """
        self.stdout.write(f"\npagination (first {pages} pages of {page_size})")
        for label, viewset, path in SURFACES:
            seen, total, ok = set(), None, True
            for page in range(1, pages + 1):
                code, body = self._call(
                    viewset, {"get": "list"},
                    f"{path}?page={page}&page_size={page_size}")
                if code == 404:
                    break            # ran past the end; not an error
                if code != 200:
                    self._check(f"{label} page {page}", code, 200)
                    ok = False
                    break
                total = body["count"]
                seen |= {r["id"] for r in body["results"]}
            if not ok:
                continue
            expected = min(total or 0, pages * page_size)
            self._check(f"{label} distinct ids over {pages} pages", len(seen), expected)
            self._note(f"{label} total rows", total)

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
        for label, viewset, path in SURFACES:
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
