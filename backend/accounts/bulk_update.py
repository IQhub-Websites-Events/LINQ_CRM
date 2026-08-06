"""
accounts/bulk_update.py
────────────────────────
Shared mass-update infrastructure: select rows → pick one field → apply one
value to all of them.

Mix `BulkUpdateMixin` into a ModelViewSet and declare `bulk_update_fields`.
Nothing is editable unless it is declared there — the endpoint denies by
default, so adding the mixin to a ViewSet grants no write surface on its own.

Two actions are exposed:

    GET  {resource}/bulk_update_schema/   what may be edited
    POST {resource}/bulk_update/          preview (commit=false) or apply

Preview and commit run the SAME resolution path; `commit` only decides whether
the write block at the end executes. That is deliberate — a preview that took a
different path would not be a preview.

Writes go through `obj.save()` one object at a time, never `queryset.update()`.
Model `save()` is load-bearing here: BookDelegate.save() derives delegate_count,
edition and event_code (book_delegate/models.py:56-70), and Event.save() derives
nine fields (events/models.py:79-106). A queryset update would silently skip all
of it.
"""
import hashlib
import json
import logging

from django.db import transaction
from django.utils.dateparse import parse_date
from rest_framework.decorators import action
from rest_framework.response import Response

logger = logging.getLogger(__name__)


class BulkUpdateMixin:
    """
    Mixin for ViewSets. Adds bulk_update_schema() and bulk_update() actions
    driven entirely by the `bulk_update_fields` declaration below.

    Field config shape:

        bulk_update_fields = {
            "delegate_payment_status": {
                "type":     "choice",         # "choice" | "date" | "text" | "boolean"
                "choices":  ["Paid", "Cancelled"],
                "group":    "row",            # "row" | "parent"
                "label":    "Payment Status",
                "nullable": True,             # model field is null=True — may be cleared
            },
            "invoice.currency": {             # parent keys are dotted
                "type":    "choice",
                "choices": ["USD", "GBP"],
                "group":   "parent",
                "label":   "Currency",
            },
        }
    """

    bulk_update_fields = {}
    bulk_update_parent_path = None      # e.g. "invoice"; None disables parent writes
    bulk_update_max = 1000
    bulk_update_side_effects = {}       # {(field, value): "human-readable consequence"}
    bulk_update_label = "records"       # PLURAL. Implementers should set their own.

    # ── Schema ────────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="bulk_update_schema")
    def bulk_update_schema(self, request):
        """
        GET {resource}/bulk_update_schema/ — the single source of truth for what
        is editable. The frontend renders from this and hardcodes no field list.
        """
        return Response({
            "fields":         self.bulk_update_fields,
            "max":            self.bulk_update_max,
            "label":          self.bulk_update_label,
            "parent_enabled": self.bulk_update_parent_path is not None,
        })

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _parent_attr(self, field):
        """'invoice.currency' -> 'currency' (the attribute on the parent object)."""
        return field.split(".", 1)[1] if "." in field else field

    def _read_current(self, obj, field, config):
        """Current value of `field` on `obj`, following the parent path if needed."""
        if config.get("group") == "parent":
            parent = getattr(obj, self.bulk_update_parent_path, None)
            return getattr(parent, self._parent_attr(field), None) if parent else None
        return getattr(obj, field, None)

    def _coerce(self, value, config):
        """Validate + coerce a submitted value. Returns (coerced, error_or_None)."""
        ftype = config.get("type", "text")

        # An empty date input is the browser's way of saying "cleared".
        if ftype == "date" and value == "":
            value = None

        # An explicit null is a real operation — clear the field — but only
        # where the column allows it. Declared per-field via `nullable`, which
        # must mirror null=True on the model.
        if value is None:
            if config.get("nullable"):
                return None, None
            return None, "This field cannot be cleared."

        if ftype == "boolean":
            # The browser sends select values as strings; coerce to a real bool
            # so a BooleanField never receives the truthy string "false".
            if isinstance(value, bool):
                return value, None
            if value in ("true", "True", 1, "1"):
                return True, None
            if value in ("false", "False", 0, "0"):
                return False, None
            return None, f"'{value}' is not a valid true/false value."

        if ftype == "choice":
            choices = config.get("choices") or []
            if value not in choices:
                return None, f"'{value}' is not a valid choice for this field."
            return value, None

        if ftype == "date":
            if not isinstance(value, str):
                return None, "Date must be an ISO date string (YYYY-MM-DD)."
            parsed = parse_date(value)
            if parsed is None:
                return None, f"'{value}' is not a valid ISO date (YYYY-MM-DD)."
            return parsed, None

        # "text"
        if not isinstance(value, str):
            return None, "Value must be a string."
        return value, None

    def get_bulk_update_side_effects(self, field, raw_value):
        """
        Consequences to surface in the preview. Defaults to an exact
        (field, value) lookup in `bulk_update_side_effects`.

        Override where a field's model save() derives other fields for ANY
        value — Event.location overwrites city/country/venue whatever you set
        it to, so it cannot be keyed by value.
        """
        effect = self.bulk_update_side_effects.get((field, raw_value))
        return [effect] if effect else []

    def _plan_hash(self, permitted_ids, field, raw_value, parent_count, has_value):
        """
        Fingerprint of the plan the user was shown. Uses the RAW submitted value
        (not the coerced one) so the client can echo back exactly what it sent.

        `has_value` is part of the digest so the hash from a value-less preview
        can never be replayed as a commit — the two describe different plans.
        """
        payload = json.dumps(
            {
                "ids":       sorted(permitted_ids),
                "field":     field,
                "value":     raw_value if isinstance(raw_value, (str, int, float, bool, type(None))) else str(raw_value),
                "parents":   parent_count,
                "has_value": bool(has_value),
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    # ── Main action ───────────────────────────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="bulk_update")
    def bulk_update(self, request):
        """
        POST {resource}/bulk_update/
        Body: {ids, field, value, commit, plan_hash}
        """
        ids        = request.data.get("ids")
        field      = request.data.get("field")
        raw_value  = request.data.get("value")
        commit     = bool(request.data.get("commit", False))
        client_hash = request.data.get("plan_hash")

        # KEY PRESENCE, not truthiness. Omitting "value" means "not chosen yet";
        # sending it as null means "clear this field" — a real operation on a
        # nullable column. Conflating the two would make clearing impossible.
        has_value = "value" in request.data

        # 1. ids
        if not isinstance(ids, list) or not ids:
            # This 400 is indistinguishable between "wrong type", "empty list"
            # and "key missing" from the client side — all three produce the
            # same 30-byte body — so log what actually arrived.
            logger.warning(
                "bulk_update rejected: ids=%r (type=%s) field=%r commit=%r on %s",
                ids, type(ids).__name__, field, commit, self.__class__.__name__,
            )
            return Response({"detail": "ids list required"}, status=400)
        if len(ids) > self.bulk_update_max:
            return Response(
                {"detail": f"Maximum {self.bulk_update_max} IDs per request"},
                status=400,
            )

        # 2. field must be declared — deny by default
        config = self.bulk_update_fields.get(field)
        if config is None:
            return Response(
                {"detail": f"Field '{field}' is not bulk-editable on this resource."},
                status=400,
            )

        # 3. value — the key must be present to commit, optional to preview
        value = None
        if commit and not has_value:
            return Response({"detail": "A value is required to apply changes."}, status=400)
        if has_value:
            value, err = self._coerce(raw_value, config)
            if err:
                return Response({"detail": err}, status=400)

        group = config.get("group", "row")

        # 4. parent writes must be enabled
        if group == "parent" and not self.bulk_update_parent_path:
            return Response(
                {"detail": "Parent-level fields are not editable on this resource."},
                status=400,
            )

        # 5. RBAC-scoped — never Model.objects
        permitted = list(self.get_queryset().filter(id__in=ids))
        permitted_ids = [o.id for o in permitted]

        # 6/7. current value distribution, plus no-op vs will-change once a
        #      target value is known
        distribution = {}
        no_op_ids, change_ids = [], []
        for obj in permitted:
            current = self._read_current(obj, field, config)
            key = current if current is None else str(current)
            distribution[key] = distribution.get(key, 0) + 1
            if has_value:
                (no_op_ids if current == value else change_ids).append(obj.id)

        # 8. parent resolution + collateral blast radius
        parent_ids = []
        collateral = {"count": 0, "sample": [], "hidden_count": 0, "overflow": 0}
        if group == "parent":
            parents = {}
            for obj in permitted:
                p = getattr(obj, self.bulk_update_parent_path, None)
                if p is not None:
                    parents[p.pk] = p
            parent_ids = list(parents.keys())

            if parent_ids:
                parent_filter = {f"{self.bulk_update_parent_path}__in": list(parents.values())}
                model = self.get_queryset().model

                # COUNT is unscoped: the write lands on these rows whether or not
                # the caller can see them, so understating it would defeat the
                # warning.
                total = (
                    model.objects.filter(**parent_filter)
                    .exclude(id__in=permitted_ids).count()
                )

                # SAMPLE is scoped: naming rows outside the caller's access would
                # turn a safety warning into an enumeration channel — select one
                # row, read the preview, learn about other teams' delegates.
                visible = (
                    self.get_queryset().filter(**parent_filter)
                    .exclude(id__in=permitted_ids)
                )
                visible_count = visible.count()

                sample = []
                for row in visible[:20]:
                    parent = getattr(row, self.bulk_update_parent_path, None)
                    sample.append({
                        "id":     row.id,
                        "label":  str(row),
                        "parent": str(parent) if parent else None,
                    })

                collateral = {
                    "count":        total,
                    "sample":       sample,
                    # affected but outside the caller's access — counted, never named
                    "hidden_count": max(0, total - visible_count),
                    # visible but beyond the 20 we render
                    "overflow":     max(0, visible_count - len(sample)),
                }

        # 9. plan fingerprint
        plan_hash = self._plan_hash(
            permitted_ids, field, raw_value, len(parent_ids), has_value
        )

        # 10. declared consequences
        side_effects = []
        if has_value:
            side_effects = self.get_bulk_update_side_effects(field, raw_value)

        plan = {
            "success":      True,
            "updated":      0,
            "permitted":    len(permitted_ids),
            "requested":    len(ids),
            "distribution": distribution,
            "plan_hash":    plan_hash,
            "collateral":   collateral,
            "errors":       [],
        }
        # no_op and side_effects only mean something once a target value exists.
        if has_value:
            plan["no_op"] = len(no_op_ids)
            plan["side_effects"] = side_effects

        # 11. preview — write nothing
        if not commit:
            return Response(plan)

        # 12a. stale plan → refuse, hand back the fresh one
        if client_hash != plan_hash:
            stale = dict(plan)
            stale["success"] = False
            stale["detail"] = (
                "The underlying data changed since this plan was generated. "
                "Review the refreshed plan and confirm again."
            )
            return Response(stale, status=409)

        # 12b. apply
        #
        # Known gap, accepted at current concurrency: permitted_ids was resolved
        # from get_queryset() BEFORE this transaction opened, and the rows are
        # locked only now. If a row leaves the caller's scope in between — an
        # event reassigned to another rep, say — it is still written here.
        # plan_hash covers the field, the value and the ID set; it does NOT
        # cover scope. Closing this would mean re-running the scoped query
        # inside the lock and intersecting. Left explicit rather than implicit.
        updated = 0
        with transaction.atomic():
            if group == "parent":
                parent_model = type(next(iter(
                    p for p in (getattr(o, self.bulk_update_parent_path, None) for o in permitted)
                    if p is not None
                )))
                attr = self._parent_attr(field)
                # Re-select from a clean manager: get_queryset() may carry
                # select_related joins, and Postgres refuses FOR UPDATE on the
                # nullable side of an outer join. permitted_ids is already
                # RBAC-scoped, so scoping is preserved.
                locked = parent_model.objects.select_for_update().filter(pk__in=parent_ids)
                for parent in locked:
                    setattr(parent, attr, value)
                    parent.save()
                    updated += 1
            else:
                model = self.get_queryset().model
                locked = model.objects.select_for_update().filter(pk__in=permitted_ids)
                for obj in locked:
                    setattr(obj, field, value)
                    obj.save()      # full save() — derived fields are the point
                    updated += 1

            from accounts.models import ActionLog
            ActionLog.objects.create(
                user=request.user,
                action=f"Bulk updated {field} on {updated} {self.bulk_update_label}",
                details=(
                    f"{field} → {raw_value!r} (group={group})\n"
                    f"requested={len(ids)} permitted={len(permitted_ids)} "
                    f"changed={len(change_ids)} no-op={len(no_op_ids)}\n"
                    f"parents_written={len(parent_ids)} collateral={collateral['count']}\n"
                    f"side_effects={side_effects}\n"
                    # Full list, not truncated: bulk_delete caps at ids[:50] and
                    # loses up to 950 records from the audit trail. details is a
                    # TextField and comfortably holds 1000 ints.
                    f"ids={sorted(permitted_ids)}"
                ),
            )

        plan["updated"] = updated
        return Response(plan)
