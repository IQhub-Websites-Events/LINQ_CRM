"""
accounts/tests_bulk_update.py
──────────────────────────────
Tests for BulkUpdateMixin against a throwaway ViewSet defined here — not any
real one. Phase 2 deliberately wires the mixin into nothing, so the suite
supplies its own subject.

BookDelegate is used as the model because its save() has observable side
effects (delegate_count is forced to 0 when delegate_payment_status becomes
"Cancelled", book_delegate/models.py:56-59). That gives a direct assertion that
per-object save() ran rather than a queryset .update().
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import viewsets

from accounts.bulk_update import BulkUpdateMixin
from book_delegate.models import BookDelegate
from book_event.models import BookEvent

User = get_user_model()


# ── Throwaway subject ─────────────────────────────────────────────────────────
class _DelegateBulkViewSet(BulkUpdateMixin, viewsets.GenericViewSet):
    """Test-only. Never routed, never imported by application code."""
    permission_classes = []
    authentication_classes = []
    queryset = BookDelegate.objects.all()

    bulk_update_label = "delegates"
    bulk_update_parent_path = "invoice"
    bulk_update_max = 5
    bulk_update_fields = {
        "delegate_payment_status": {
            "type": "choice",
            "choices": ["Pending", "Paid", "Cancelled"],
            "group": "row",
            "label": "Payment Status",
        },
        "delegate_payment_date": {
            "type": "date", "group": "row", "label": "Payment Date",
            "nullable": True,
        },
        # deliberately NOT nullable — used to prove a null is refused
        "attendance": {
            "type": "choice", "choices": ["Pending", "Confirmed"],
            "group": "row", "label": "Attendance",
        },
        "invoice.currency": {
            "type": "choice", "choices": ["USD", "GBP"],
            "group": "parent", "label": "Currency",
        },
    }
    bulk_update_side_effects = {
        ("delegate_payment_status", "Cancelled"):
            "Cancelled delegates are excluded from headcounts (delegate_count set to 0).",
    }


class _ScopedViewSet(_DelegateBulkViewSet):
    """Only ever exposes delegates whose first_name is 'Visible'."""
    def get_queryset(self):
        return BookDelegate.objects.filter(first_name="Visible")


BULK = _DelegateBulkViewSet.as_view({"post": "bulk_update"})
SCOPED = _ScopedViewSet.as_view({"post": "bulk_update"})
SCHEMA = _DelegateBulkViewSet.as_view({"get": "bulk_update_schema"})


class BulkUpdateMixinTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            username="bulk_tester", password="x", role="admin",
        )

    def setUp(self):
        self.factory = APIRequestFactory()
        self.inv = BookEvent.objects.create(
            invoice_number="BULK-TEST-001", event_code="TST - AA", currency="USD",
        )
        self.d1 = self._delegate("a@example.com", "Visible")
        self.d2 = self._delegate("b@example.com", "Visible")
        self.d3 = self._delegate("c@example.com", "Hidden")

    def _delegate(self, email, first_name):
        return BookDelegate.objects.create(
            invoice=self.inv, event_code="TST - AA",
            first_name=first_name, last_name="Person", email=email,
        )

    def _post(self, body, view=BULK):
        req = self.factory.post("/bulk_update/", body, format="json")
        force_authenticate(req, user=self.user)
        return view(req)

    def _preview(self, ids, field, value, view=BULK):
        return self._post({"ids": ids, "field": field, "value": value, "commit": False}, view)

    def _preview_no_value(self, ids, field, view=BULK):
        return self._post({"ids": ids, "field": field, "commit": False}, view)

    # ── Validation ────────────────────────────────────────────────────────────
    def test_unknown_field_rejected(self):
        r = self._preview([self.d1.id], "notes", "x")
        self.assertEqual(r.status_code, 400)
        self.assertIn("not bulk-editable", r.data["detail"])

    def test_value_outside_choices_rejected(self):
        r = self._preview([self.d1.id], "delegate_payment_status", "Banana")
        self.assertEqual(r.status_code, 400)
        self.assertIn("not a valid choice", r.data["detail"])

    def test_bad_date_rejected(self):
        r = self._preview([self.d1.id], "delegate_payment_date", "not-a-date")
        self.assertEqual(r.status_code, 400)
        self.assertIn("not a valid ISO date", r.data["detail"])

    def test_empty_ids_rejected(self):
        r = self._preview([], "delegate_payment_status", "Paid")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.data["detail"], "ids list required")

    def test_over_max_rejected(self):
        r = self._preview(list(range(1, 7)), "delegate_payment_status", "Paid")
        self.assertEqual(r.status_code, 400)
        self.assertIn("Maximum 5", r.data["detail"])

    def test_parent_field_rejected_when_path_disabled(self):
        class _NoParent(_DelegateBulkViewSet):
            bulk_update_parent_path = None
        view = _NoParent.as_view({"post": "bulk_update"})
        r = self._preview([self.d1.id], "invoice.currency", "GBP", view)
        self.assertEqual(r.status_code, 400)
        self.assertIn("not editable", r.data["detail"])

    # ── Preview writes nothing ────────────────────────────────────────────────
    def test_preview_reports_plan_and_changes_nothing(self):
        r = self._preview([self.d1.id, self.d2.id], "delegate_payment_status", "Paid")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["requested"], 2)
        self.assertEqual(r.data["permitted"], 2)
        self.assertEqual(r.data["updated"], 0)
        self.assertEqual(r.data["no_op"], 0)
        self.assertEqual(r.data["distribution"], {None: 2})
        self.assertTrue(r.data["plan_hash"])

        self.d1.refresh_from_db(); self.d2.refresh_from_db()
        self.assertIsNone(self.d1.delegate_payment_status)
        self.assertIsNone(self.d2.delegate_payment_status)

    def test_no_op_counted_separately(self):
        self.d1.delegate_payment_status = "Paid"
        self.d1.save()
        r = self._preview([self.d1.id, self.d2.id], "delegate_payment_status", "Paid")
        self.assertEqual(r.data["no_op"], 1)
        self.assertEqual(r.data["distribution"], {"Paid": 1, None: 1})

    # ── Value optional on preview, required on commit ─────────────────────────
    def test_preview_without_value_returns_distribution_and_writes_nothing(self):
        r = self._preview_no_value([self.d1.id, self.d2.id], "delegate_payment_status")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["permitted"], 2)
        self.assertEqual(r.data["requested"], 2)
        self.assertEqual(r.data["distribution"], {None: 2})
        self.assertTrue(r.data["plan_hash"])
        # value-dependent keys must be absent, not zero
        self.assertNotIn("no_op", r.data)
        self.assertNotIn("side_effects", r.data)

        self.d1.refresh_from_db(); self.d2.refresh_from_db()
        self.assertIsNone(self.d1.delegate_payment_status)
        self.assertIsNone(self.d2.delegate_payment_status)

    def test_preview_without_value_skips_choice_validation(self):
        # A date field with no value must not trip the date parser either.
        r = self._preview_no_value([self.d1.id], "delegate_payment_date")
        self.assertEqual(r.status_code, 200)

    def test_commit_without_value_rejected(self):
        r = self._post({
            "ids": [self.d1.id], "field": "delegate_payment_status",
            "commit": True, "plan_hash": "whatever",
        })
        self.assertEqual(r.status_code, 400)
        self.assertIn("value is required", r.data["detail"])
        self.d1.refresh_from_db()
        self.assertIsNone(self.d1.delegate_payment_status)

    def test_valueless_plan_hash_cannot_be_replayed_as_commit(self):
        vl = self._preview_no_value([self.d1.id], "delegate_payment_status")
        r = self._post({
            "ids": [self.d1.id], "field": "delegate_payment_status",
            "value": "Paid", "commit": True, "plan_hash": vl.data["plan_hash"],
        })
        self.assertEqual(r.status_code, 409)
        self.d1.refresh_from_db()
        self.assertIsNone(self.d1.delegate_payment_status)

    # ── Explicit null clears a nullable field ─────────────────────────────────
    def test_explicit_null_clears_a_nullable_field(self):
        import datetime
        self.d1.delegate_payment_date = datetime.date(2026, 1, 15)
        self.d1.save()
        # key PRESENT with null -> clear
        plan = self._post({
            "ids": [self.d1.id], "field": "delegate_payment_date",
            "value": None, "commit": False,
        })
        self.assertEqual(plan.status_code, 200, plan.data)
        r = self._post({
            "ids": [self.d1.id], "field": "delegate_payment_date",
            "value": None, "commit": True, "plan_hash": plan.data["plan_hash"],
        })
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["updated"], 1)
        self.d1.refresh_from_db()
        self.assertIsNone(self.d1.delegate_payment_date)

    def test_explicit_null_on_non_nullable_field_rejected(self):
        r = self._post({
            "ids": [self.d1.id], "field": "attendance",
            "value": None, "commit": False,
        })
        self.assertEqual(r.status_code, 400)
        self.assertIn("cannot be cleared", r.data["detail"])

    def test_absent_key_and_null_value_are_different_plans(self):
        # Same field, same ids: omitting the key must not produce the same hash
        # as sending null, or a preview could be replayed as a clear.
        absent = self._preview_no_value([self.d1.id], "delegate_payment_date")
        explicit = self._post({
            "ids": [self.d1.id], "field": "delegate_payment_date",
            "value": None, "commit": False,
        })
        self.assertEqual(absent.status_code, 200)
        self.assertEqual(explicit.status_code, 200)
        self.assertNotEqual(absent.data["plan_hash"], explicit.data["plan_hash"])
        self.assertNotIn("no_op", absent.data)     # no target chosen
        self.assertIn("no_op", explicit.data)      # null IS a target

    # ── Stale plan ────────────────────────────────────────────────────────────
    def test_stale_plan_hash_returns_409_and_writes_nothing(self):
        r = self._post({
            "ids": [self.d1.id], "field": "delegate_payment_status",
            "value": "Paid", "commit": True, "plan_hash": "deadbeef",
        })
        self.assertEqual(r.status_code, 409)
        self.assertFalse(r.data["success"])
        self.assertTrue(r.data["plan_hash"])
        self.d1.refresh_from_db()
        self.assertIsNone(self.d1.delegate_payment_status)

    # ── Scoping ───────────────────────────────────────────────────────────────
    def test_get_queryset_scoping_excludes_out_of_scope_ids(self):
        r = self._preview(
            [self.d1.id, self.d2.id, self.d3.id],
            "delegate_payment_status", "Paid", SCOPED,
        )
        self.assertEqual(r.data["requested"], 3)
        self.assertEqual(r.data["permitted"], 2)   # d3 is "Hidden"

    def test_commit_never_touches_out_of_scope_rows(self):
        plan = self._preview(
            [self.d1.id, self.d2.id, self.d3.id],
            "delegate_payment_status", "Paid", SCOPED,
        )
        r = self._post({
            "ids": [self.d1.id, self.d2.id, self.d3.id],
            "field": "delegate_payment_status", "value": "Paid",
            "commit": True, "plan_hash": plan.data["plan_hash"],
        }, SCOPED)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["updated"], 2)
        self.d3.refresh_from_db()
        self.assertIsNone(self.d3.delegate_payment_status)

    # ── Per-object save() actually runs ───────────────────────────────────────
    def test_commit_runs_per_object_save_not_queryset_update(self):
        self.assertEqual(self.d1.delegate_count, 1)
        plan = self._preview([self.d1.id], "delegate_payment_status", "Cancelled")
        self.assertEqual(plan.data["side_effects"], [
            "Cancelled delegates are excluded from headcounts (delegate_count set to 0)."
        ])
        r = self._post({
            "ids": [self.d1.id], "field": "delegate_payment_status",
            "value": "Cancelled", "commit": True, "plan_hash": plan.data["plan_hash"],
        })
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["updated"], 1)

        self.d1.refresh_from_db()
        self.assertEqual(self.d1.delegate_payment_status, "Cancelled")
        # Only BookDelegate.save() sets this. A queryset .update() would leave it at 1.
        self.assertEqual(self.d1.delegate_count, 0)

    def test_commit_writes_one_actionlog_with_full_id_list(self):
        from accounts.models import ActionLog
        plan = self._preview([self.d1.id, self.d2.id], "delegate_payment_status", "Paid")
        before = ActionLog.objects.count()
        self._post({
            "ids": [self.d1.id, self.d2.id], "field": "delegate_payment_status",
            "value": "Paid", "commit": True, "plan_hash": plan.data["plan_hash"],
        })
        self.assertEqual(ActionLog.objects.count(), before + 1)
        log = ActionLog.objects.latest("created_at")
        self.assertEqual(log.action, "Bulk updated delegate_payment_status on 2 delegates")
        self.assertIn(str(sorted([self.d1.id, self.d2.id])), log.details)

    # ── Parent group ──────────────────────────────────────────────────────────
    def test_parent_field_reports_collateral(self):
        # d3 shares the invoice but is not selected
        r = self._preview([self.d1.id, self.d2.id], "invoice.currency", "GBP")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["collateral"]["count"], 1)
        self.assertEqual(r.data["collateral"]["sample"][0]["id"], self.d3.id)
        self.assertEqual(r.data["collateral"]["hidden_count"], 0)

    def test_collateral_counts_but_never_names_rows_outside_scope(self):
        # SCOPED viewset cannot see d3 ("Hidden"), but writing the invoice still
        # hits it — so it must be counted and must NOT appear in the sample.
        r = self._preview([self.d1.id, self.d2.id], "invoice.currency", "GBP", SCOPED)
        c = r.data["collateral"]
        self.assertEqual(c["count"], 1)          # true blast radius
        self.assertEqual(c["sample"], [])        # nothing nameable
        self.assertEqual(c["hidden_count"], 1)   # disclosed as a number only
        self.assertNotIn(self.d3.id, [s["id"] for s in c["sample"]])

    def test_parent_commit_writes_the_parent_once(self):
        plan = self._preview([self.d1.id, self.d2.id], "invoice.currency", "GBP")
        r = self._post({
            "ids": [self.d1.id, self.d2.id], "field": "invoice.currency",
            "value": "GBP", "commit": True, "plan_hash": plan.data["plan_hash"],
        })
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["updated"], 1)   # one invoice, not two delegates
        self.inv.refresh_from_db()
        self.assertEqual(self.inv.currency, "GBP")

    # ── Schema ────────────────────────────────────────────────────────────────
    def test_schema_lists_declared_fields_only(self):
        req = self.factory.get("/bulk_update_schema/")
        force_authenticate(req, user=self.user)
        r = SCHEMA(req)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(
            set(r.data["fields"].keys()),
            {"delegate_payment_status", "delegate_payment_date",
             "attendance", "invoice.currency"},
        )
        self.assertEqual(r.data["max"], 5)
        self.assertEqual(r.data["label"], "delegates")
        self.assertTrue(r.data["parent_enabled"])
