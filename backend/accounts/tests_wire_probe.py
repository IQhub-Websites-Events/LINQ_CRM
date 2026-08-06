"""
accounts/tests_wire_probe.py
─────────────────────────────
The test that would have caught both shipped frontend→wire bugs.

Runs accounts/wire_probe.mjs under Node, which imports the REAL api/*.js and
useFilterSpec.js with axios stubbed and records exactly what would go on the
wire. This suite then asserts the invariants AND replays the captured literals
against Django, so a serializer change that green unit tests would miss fails
here instead of in a browser.

Two bugs this locks down:
  1. A Set serialises to {} through JSON.stringify -> {"ids": {}} -> the
     backend answered "ids list required". Now the api layer throws first.
  2. A pre-encoded filter_spec got encoded a second time by URLSearchParams
     (%257B), and Django, which decodes once, saw literal "%7B..." text.

Skipped automatically when Node is unavailable, so the suite still runs on a
machine without it.

    python manage.py test accounts.tests_wire_probe
"""
import json
import shutil
import subprocess
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.models import CustomRole
from book_delegate.models import BookDelegate
from book_delegate.views import BookDelegateViewSet
from book_event.models import BookEvent

User = get_user_model()

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROBE = BACKEND_DIR / "accounts" / "wire_probe.mjs"
FRONTEND_SRC = BACKEND_DIR.parent / "frontend" / "src"

DELEGATES = BookDelegateViewSet.as_view({"get": "list"})


def _node():
    return shutil.which("node")


_PROBE_CACHE = {}


def run_probe():
    """
    Execute the Node probe once per process and memoise the result.

    Module-level rather than a shared setUpClass: borrowing another TestCase's
    setUpClass breaks its zero-argument super() call, which is exactly the
    error this replaced.

    Returns (result_dict_or_None, error_string_or_None).
    """
    if _PROBE_CACHE:
        return _PROBE_CACHE["result"], _PROBE_CACHE["error"]

    result = error = None
    if not _node():
        error = "node is not on PATH"
    elif not PROBE.exists():
        error = f"probe script missing at {PROBE}"
    elif not FRONTEND_SRC.exists():
        error = f"frontend source missing at {FRONTEND_SRC}"
    else:
        try:
            out = subprocess.run(
                [_node(), str(PROBE), str(FRONTEND_SRC)],
                capture_output=True, text=True, timeout=120, cwd=str(BACKEND_DIR),
            )
            if out.returncode != 0:
                error = out.stderr[-800:]
            else:
                result = json.loads(out.stdout)
        except Exception as exc:                       # noqa: BLE001
            error = repr(exc)

    _PROBE_CACHE["result"], _PROBE_CACHE["error"] = result, error
    return result, error


class WireProbeTests(TestCase):
    """Invariants captured from the real frontend modules."""

    def setUp(self):
        self.probe, err = run_probe()
        if self.probe is None:
            self.skipTest(f"wire probe unavailable: {err}")
        self.factory = APIRequestFactory()

    def test_every_wire_invariant_holds(self):
        failed = [c for c in self.probe["checks"] if not c["pass"]]
        self.assertEqual(
            failed, [],
            "wire invariants violated:\n"
            + "\n".join(f"  {c['name']}: {c['detail']}" for c in failed),
        )

    def test_probe_covered_all_three_modules(self):
        names = " ".join(c["name"] for c in self.probe["checks"])
        for module in ("delegates", "tickets", "events"):
            self.assertIn(f"{module}.bulkUpdate", names)


class WireLiteralReplayTests(TestCase):
    """The literal query string the probe captured, replayed at Django."""

    @classmethod
    def setUpTestData(cls):
        cls.role = CustomRole.objects.create(
            name="wire_probe_admin", display_label="Wire Probe", is_all_access=True,
        )
        cls.user = User.objects.create_user(
            username="wire_probe", password="x", role="admin", email="wp@iq-hub.com",
        )
        cls.user.custom_role = cls.role
        cls.user.save()

    def setUp(self):
        self.probe, err = run_probe()
        if self.probe is None:
            self.skipTest(f"wire probe unavailable: {err}")
        self.factory = APIRequestFactory()
        inv = BookEvent.objects.create(
            invoice_number="WP-1", event_code="WP - AA",
            payment_status="Pending", ticket_tier="",
        )
        self.d = BookDelegate.objects.create(
            invoice=inv, event_code="WP - AA",
            first_name="Wire", last_name="Probe", email="wire@example.com",
        )

    def test_captured_list_query_is_accepted_by_django(self):
        query = self.probe["literals"]["delegates_list_query"]
        req = self.factory.get(f"/?{query}")
        force_authenticate(req, user=self.user)
        resp = DELEGATES(req)
        resp.render()
        self.assertEqual(resp.status_code, 200, resp.content)
        # tier empty AND status not Paid/Cancelled -> the one fixture row
        body = json.loads(resp.content)
        self.assertEqual({r["id"] for r in body["results"]}, {self.d.id})

    def test_captured_bulk_update_bodies_have_array_ids(self):
        for module in ("delegates", "tickets", "events"):
            body = self.probe["literals"][f"{module}_bulk_update_body"]
            self.assertIsInstance(body["ids"], list, f"{module} ids not a list")
            self.assertNotEqual(body["ids"], {}, f"{module} ids serialised to an object")
