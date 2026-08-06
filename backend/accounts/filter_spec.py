"""
accounts/filter_spec.py
────────────────────────
Compound filter engine: N criteria, ANDed, each (field, operator, value(s)).

Sibling to BulkUpdateMixin and deliberately the same shape — declare a registry
on the ViewSet, get a schema endpoint plus a deny-by-default validator. Nothing
is filterable unless it is registered.

COEXISTENCE WITH THE EXISTING FilterSets
The spec is applied by overriding `filter_queryset`, calling super() FIRST:

    def filter_queryset(self, queryset):
        qs = super().filter_queryset(queryset)   # DjangoFilterBackend, Search, Ordering
        return self.apply_filter_spec(qs)

So DjangoFilterBackend, SearchFilter and OrderingFilter all run exactly as they
did — their WHERE clauses and ORDER BY are untouched — and the spec ANDs onto the
result. Pagination happens later in paginate_queryset and is unaffected, so
page/page_size/ordering and the frontend's infinite scroll keep working.

The queryset handed to filter_queryset is already self.get_queryset() output, so
RBAC scoping is inherited rather than re-implemented. This module never touches
Model.objects.

RESOLVED (person-level) FIELDS
On Bookings, payment_status and friends display the delegate override if one is
set, else the invoice's value. Filtering the raw override column would miss every
inheriting row. Those fields are annotated as

    COALESCE(NULLIF(<override>, ''), <invoice field>)

and the operators run against the annotation, so every operator — not just
equality — matches what the table actually shows.
"""
import json
import logging

from django.db.models import BooleanField, DateField, DateTimeField, Q, TextField, Value
from django.db.models.functions import Cast, Coalesce, NullIf
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# ── Registry builder ─────────────────────────────────────────────────────────
# Django field class name -> our filter type. Anything unmapped is skipped, so
# an unrecognised field is silently non-filterable rather than wrongly typed.
_DJANGO_TYPE_MAP = {
    "CharField": "text",
    "TextField": "text",
    "EmailField": "text",
    "URLField": "text",
    "SlugField": "text",
    "BooleanField": "boolean",
    "IntegerField": "number",
    "PositiveIntegerField": "number",
    "PositiveSmallIntegerField": "number",
    "SmallIntegerField": "number",
    "BigIntegerField": "number",
    "FloatField": "number",
    "DecimalField": "number",
    "DateField": "date",
    "DateTimeField": "date",
    "ForeignKey": "user_fk",
}

# Never filterable on any module: surrogate keys, import provenance, and
# timestamps that carry no business meaning to a user building a filter.
DEFAULT_EXCLUDES = {
    "id", "created_at", "updated_at", "external_id", "idempotency_key",
    "source_spreadsheet_id", "source_tab", "source_row_number",
}


def _is_user_fk(field):
    """True when this ForeignKey points at the configured auth user model."""
    from django.contrib.auth import get_user_model
    try:
        return field.related_model is get_user_model()
    except Exception:                                    # noqa: BLE001
        return False


def active_user_choices():
    """
    [{value: <pk>, label: <name or email or username>}] for active users.

    Object-shaped choices, unlike the scalar lists that come off model enums —
    a user FK stores an id but must display a name. `_choice_values` normalises
    both shapes for validation.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    out = []
    for u in User.objects.filter(is_active=True).order_by("first_name", "username"):
        label = (f"{u.first_name} {u.last_name}".strip()
                 or getattr(u, "email", "") or u.get_username())
        out.append({"value": u.pk, "label": label})
    return out


def _choice_values(cfg):
    """Comparable values from either choice shape (scalars or {value,label})."""
    choices = cfg.get("choices")
    if not choices:
        return None
    if isinstance(choices[0], dict):
        return [c["value"] for c in choices]
    return list(choices)


def build_filter_spec_fields(model, exclude=(), extra=None, labels=None):
    """
    Derive a registry from the model's concrete fields, then subtract
    exclusions. Reverse relations and M2M are skipped — filtering across them
    can duplicate rows, and nothing in v1 needs it.
    """
    exclude = set(exclude) | DEFAULT_EXCLUDES
    labels = labels or {}
    out = {}

    for f in model._meta.get_fields():
        if not getattr(f, "concrete", False) or f.many_to_many or f.one_to_many:
            continue
        name = f.name
        if name in exclude:
            continue
        ftype = _DJANGO_TYPE_MAP.get(type(f).__name__)
        if ftype is None:
            continue

        cfg = {
            "type": ftype,
            "label": labels.get(name, name.replace("_", " ").title()),
            "nullable": bool(getattr(f, "null", False)),
        }
        choices = getattr(f, "choices", None)
        if choices:
            cfg["choices"] = [c[0] for c in choices]
        elif ftype == "user_fk":
            # Only USER foreign keys get a populated picker. `company` is also a
            # ForeignKey and lands in this type — the mapping is coarse — but it
            # points at 7,671 companies, so inlining them would bloat every
            # schema response. It is left without choices and the UI falls back
            # to raw id entry; a proper async lookup belongs to a later phase.
            # TODO: the type key "user_fk" is really "fk"; renaming is churn for
            # no behaviour change, so it is flagged rather than done here.
            if _is_user_fk(f):
                cfg["choices_source"] = "active_users"
        out[name] = cfg

    if extra:
        out.update(extra)
    return out

# ── Operator registry, by field type ─────────────────────────────────────────
# NOTE: number carries contains/not_contains, which the original brief listed
# only for text. It is required by the worked example ("delegate_count contains
# 0") and is implemented by casting the column to text. Flagged, not silent.
_LIST_OPS = {"any_of", "none_of"}
_NO_VALUE_OPS = {"is_empty", "is_not_empty"}
_PAIR_OPS = {"between"}

# Operators whose operand is not required to be a member of the field's choice
# list: substring matches work on fragments, and ordinal comparisons take
# bounds that may sit outside the set of stored values.
_UNCONSTRAINED_VALUE_OPS = {
    "contains", "not_contains",
    "gt", "gte", "lt", "lte", "between", "before", "after",
}

OPERATORS_BY_TYPE = {
    "text": [
        "is", "is_not", "contains", "not_contains", "starts_with", "ends_with",
        "any_of", "none_of", "is_empty", "is_not_empty",
    ],
    "choice": ["is", "is_not", "any_of", "none_of", "is_empty", "is_not_empty"],
    "boolean": ["is", "is_empty", "is_not_empty"],
    "number": [
        "is", "is_not", "gt", "gte", "lt", "lte", "between",
        "contains", "not_contains", "is_empty", "is_not_empty",
    ],
    "date": ["is", "is_not", "before", "after", "between", "is_empty", "is_not_empty"],
    "user_fk": ["is", "is_not", "any_of", "none_of", "is_empty", "is_not_empty"],
}

# Types whose column can meaningfully hold '' as well as NULL. Drives is_empty.
_TEXTISH = {"text", "choice"}


class FilterSpecError(Exception):
    """Validation failure — carries the message returned to the caller."""


class FilterSpecMixin:
    """
    Mixin for ViewSets. Adds `filter_schema` and applies `?filter_spec=<json>`
    on the list endpoint.

    Field config shape:

        filter_spec_fields = {
            "purpose": {"type": "text", "label": "Purpose"},
            "status":  {"type": "choice", "label": "Status", "choices": [...]},
            "payment_status": {
                "type": "choice", "label": "Payment Status", "choices": [...],
                # person-level: override if set, else invoice
                "resolved": {"override": "delegate_payment_status",
                             "invoice": "invoice__payment_status"},
            },
            "company_name": {"type": "text", "label": "Company",
                             "source": "invoice__company_name"},
        }
    """

    filter_spec_fields = {}
    filter_spec_max_criteria = 20

    # ── Schema ────────────────────────────────────────────────────────────────
    @action(detail=False, methods=["get"], url_path="filter_schema")
    def filter_schema(self, request):
        """
        GET {resource}/filter_schema/ — single source of truth so the frontend
        hardcodes neither fields nor operators. Same wrapper convention as
        bulk_update_schema.
        """
        fields = {}
        for key, cfg in self.get_filter_spec_fields().items():
            entry = {
                "type": cfg["type"],
                "label": cfg.get("label", key),
                "operators": self.allowed_operators(cfg),
                "nullable": bool(cfg.get("nullable", False)),
                "resolved": bool(cfg.get("resolved")),
                "empty_shape": self._empty_shape_name(cfg),
            }
            if cfg.get("choices") is not None:
                entry["choices"] = list(cfg["choices"])
            fields[key] = entry

        return Response({
            "fields": fields,
            "operators_by_type": OPERATORS_BY_TYPE,
            "max_criteria": self.filter_spec_max_criteria,
            "match_modes": ["all"],
        })

    # ── Registry access (overridable for per-request choices) ─────────────────
    def get_filter_spec_fields(self):
        """
        Resolves `choices_source` markers into real choice lists per request, so
        a user picker reflects who is active now rather than who was active at
        import time. Mirrors the dynamic assigned_mr choices on TicketViewSet.
        """
        fields = self.filter_spec_fields
        if not any(isinstance(c, dict) and c.get("choices_source") for c in fields.values()):
            return fields
        users = None
        resolved = {}
        for key, cfg in fields.items():
            if cfg.get("choices_source") == "active_users":
                if users is None:
                    users = active_user_choices()
                resolved[key] = {**cfg, "choices": users}
            else:
                resolved[key] = cfg
        return resolved

    @staticmethod
    def allowed_operators(cfg):
        """
        Per-FIELD operator list, not merely per-type. A NOT NULL boolean can
        never be empty, so offering is_empty there would be an operator that
        silently matches nothing.
        """
        ops = list(OPERATORS_BY_TYPE.get(cfg["type"], []))
        if cfg["type"] == "boolean" and not cfg.get("nullable"):
            ops = [o for o in ops if o not in _NO_VALUE_OPS]
        return ops

    # ── is_empty shape ────────────────────────────────────────────────────────
    @staticmethod
    def _empty_shape_name(cfg):
        """
        Three shapes, driven by the field definition rather than one generic rule:

          "resolved"       — override is unset AND the invoice value is unset;
                             evaluated on the COALESCE annotation.
          "null_or_blank"  — text-ish column: '' or NULL both count as empty.
          "null_only"      — date/number/boolean/fk: only NULL is empty; a ''
                             comparison would be a database type error.
        """
        if cfg.get("resolved"):
            return "resolved"
        if cfg["type"] in _TEXTISH:
            return "null_or_blank"
        return "null_only"

    def _empty_q(self, path, cfg):
        shape = self._empty_shape_name(cfg)
        if shape == "null_only":
            return Q(**{f"{path}__isnull": True})
        # resolved and null_or_blank share the predicate; for resolved, `path` is
        # the annotation, so NULL there already means "neither side had a value".
        return Q(**{f"{path}__isnull": True}) | Q(**{path: ""})

    # ── Path resolution + annotations ─────────────────────────────────────────
    def _annotation_name(self, key):
        return f"_fs_{key}"

    def _resolved_expression(self, cfg):
        """COALESCE(NULLIF(override, ''), invoice) — '' on the override inherits."""
        override = cfg["resolved"]["override"]
        invoice = cfg["resolved"]["invoice"]
        if cfg["type"] == "date":
            # A DateField cannot hold '', so NULLIF would be a type error.
            return Coalesce(override, invoice)
        return Coalesce(NullIf(override, Value("")), invoice)

    def _prepare(self, queryset, criteria):
        """Attach annotations for any resolved or text-cast field in play."""
        annotations = {}
        for c in criteria:
            key = c["field"]
            cfg = self.get_filter_spec_fields()[key]
            if cfg.get("resolved"):
                annotations[self._annotation_name(key)] = self._resolved_expression(cfg)
            elif cfg["type"] == "number" and c["op"] in ("contains", "not_contains"):
                src = cfg.get("source", key)
                annotations[self._annotation_name(key)] = Cast(src, TextField())
        return queryset.annotate(**annotations) if annotations else queryset

    def _path_for(self, key, cfg, op):
        if cfg.get("resolved"):
            return self._annotation_name(key)
        if cfg["type"] == "number" and op in ("contains", "not_contains"):
            return self._annotation_name(key)
        return cfg.get("source", key)

    # ── Validation ────────────────────────────────────────────────────────────
    def _validate(self, spec):
        if not isinstance(spec, dict):
            raise FilterSpecError("filter_spec must be a JSON object.")

        match = spec.get("match", "all")
        if match != "all":
            raise FilterSpecError(
                f"match='{match}' is not supported. Only 'all' is accepted in this version."
            )

        criteria = spec.get("criteria", [])
        if not isinstance(criteria, list):
            raise FilterSpecError("criteria must be a list.")
        if len(criteria) > self.filter_spec_max_criteria:
            raise FilterSpecError(
                f"Too many criteria: {len(criteria)} (maximum {self.filter_spec_max_criteria})."
            )

        registry = self.get_filter_spec_fields()
        cleaned = []
        for i, c in enumerate(criteria):
            where = f"criterion {i + 1}"
            if not isinstance(c, dict):
                raise FilterSpecError(f"{where} must be an object.")

            key = c.get("field")
            cfg = registry.get(key)
            if cfg is None:
                raise FilterSpecError(f"{where}: field '{key}' is not filterable on this resource.")

            op = c.get("op")
            allowed = self.allowed_operators(cfg)
            if op not in allowed:
                raise FilterSpecError(
                    f"{where}: operator '{op}' is not valid for a {cfg['type']} field. "
                    f"Allowed: {', '.join(allowed)}."
                )

            values = self._validate_arity(where, c, op, cfg)
            cleaned.append({"field": key, "op": op, "values": values})
        return cleaned

    def _validate_arity(self, where, c, op, cfg):
        """Returns the normalised value list for the operator."""
        if op in _NO_VALUE_OPS:
            return []

        if op in _LIST_OPS:
            values = c.get("values")
            if not isinstance(values, list) or len(values) < 1:
                raise FilterSpecError(f"{where}: '{op}' needs a non-empty 'values' list.")
        elif op in _PAIR_OPS:
            values = c.get("values")
            if not isinstance(values, list) or len(values) != 2:
                raise FilterSpecError(f"{where}: 'between' needs exactly 2 values.")
        elif op in ("contains", "not_contains"):
            # Single value OR a list. A list means "contains any of" /
            # "contains none of" — the worked example uses the list form.
            if "values" in c and c.get("values") is not None:
                values = c["values"]
                if not isinstance(values, list) or len(values) < 1:
                    raise FilterSpecError(f"{where}: '{op}' needs a non-empty 'values' list.")
            elif "value" in c:
                values = [c["value"]]
            else:
                raise FilterSpecError(f"{where}: '{op}' needs 'value' or 'values'.")
        else:
            if "value" not in c:
                raise FilterSpecError(f"{where}: '{op}' needs a 'value'.")
            values = [c["value"]]

        # Membership operators must name a real choice. Ordinal and substring
        # operators must NOT be checked against the choice list: a range BOUND
        # need not itself be a stored value — "delegate_count between 0 and 5"
        # is legitimate even though the model only declares choices 0 and 1.
        choices = _choice_values(cfg)
        if choices is not None and op not in _UNCONSTRAINED_VALUE_OPS:
            for v in values:
                if v not in choices:
                    raise FilterSpecError(
                        f"{where}: '{v}' is not a valid value for this field."
                    )
        return values

    # ── Q construction ────────────────────────────────────────────────────────
    def _q_for(self, criterion):
        key, op, values = criterion["field"], criterion["op"], criterion["values"]
        cfg = self.get_filter_spec_fields()[key]
        path = self._path_for(key, cfg, op)

        if op == "is_empty":
            return self._empty_q(path, cfg)
        if op == "is_not_empty":
            return ~self._empty_q(path, cfg)

        v = values[0] if values else None

        if op == "is":
            if cfg["type"] in ("text", "choice"):
                return Q(**{f"{path}__iexact": v})
            return Q(**{path: v})
        if op == "is_not":
            if cfg["type"] in ("text", "choice"):
                return ~Q(**{f"{path}__iexact": v})
            return ~Q(**{path: v})

        if op == "contains":
            q = Q()
            for item in values:
                q |= Q(**{f"{path}__icontains": item})
            return q
        if op == "not_contains":
            # "contains none of these" — NOT(any of them appears).
            q = Q()
            for item in values:
                q |= Q(**{f"{path}__icontains": item})
            return ~q

        if op == "starts_with":
            return Q(**{f"{path}__istartswith": v})
        if op == "ends_with":
            return Q(**{f"{path}__iendswith": v})

        if op == "any_of":
            q = Q()
            for item in values:
                q |= (Q(**{f"{path}__iexact": item})
                      if cfg["type"] in ("text", "choice") else Q(**{path: item}))
            return q
        if op == "none_of":
            q = Q()
            for item in values:
                q |= (Q(**{f"{path}__iexact": item})
                      if cfg["type"] in ("text", "choice") else Q(**{path: item}))
            return ~q

        if op == "gt":     return Q(**{f"{path}__gt": v})
        if op == "gte":    return Q(**{f"{path}__gte": v})
        if op == "lt":     return Q(**{f"{path}__lt": v})
        if op == "lte":    return Q(**{f"{path}__lte": v})
        if op == "before": return Q(**{f"{path}__lt": v})
        if op == "after":  return Q(**{f"{path}__gt": v})
        if op == "between":
            return Q(**{f"{path}__gte": values[0], f"{path}__lte": values[1]})

        raise FilterSpecError(f"Unhandled operator '{op}'.")

    # ── Entry point ───────────────────────────────────────────────────────────
    def apply_filter_spec(self, queryset):
        raw = self.request.query_params.get("filter_spec")
        if not raw:
            return queryset
        try:
            spec = json.loads(raw)
        except (TypeError, ValueError):
            raise FilterSpecError("filter_spec is not valid JSON.")

        criteria = self._validate(spec)
        if not criteria:
            # An empty criteria list is a no-op, not an error.
            return queryset

        queryset = self._prepare(queryset, criteria)
        combined = Q()
        for c in criteria:
            combined &= self._q_for(c)     # match=all
        return queryset.filter(combined)

    def filter_queryset(self, queryset):
        """
        super() first so DjangoFilterBackend / SearchFilter / OrderingFilter run
        exactly as before; the spec then ANDs onto their result.
        """
        qs = super().filter_queryset(queryset)
        try:
            return self.apply_filter_spec(qs)
        except FilterSpecError as exc:
            # ParseError renders as 400 {"detail": "..."} — the same shape the
            # rest of the codebase returns for bad input.
            raise ParseError(detail=str(exc))
