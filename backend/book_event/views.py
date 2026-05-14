"""
book_event/views.py
────────────────────
Invoice CRUD + payment update + website intake.
"""
import logging
from datetime import datetime
from django.db import transaction, IntegrityError
from django.db.models import Count
from rest_framework import viewsets, status
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import RBACMixin, IsSalesOrAdmin, IsAdminRole
from .authentication import ApiKeyAuthentication, OriginAuthentication, HasApiKey
from .models import BookEvent, WebhookLog
from .serializers import (
    BookEventListSerializer, BookEventDetailSerializer,
    PaymentUpdateSerializer, WebsiteBookingSerializer,
)
from .filters import BookEventFilter
from webhooks.utils import unwrap_payload

logger = logging.getLogger(__name__)


class BookEventViewSet(RBACMixin, viewsets.ModelViewSet):
    filterset_class = BookEventFilter
    search_fields   = [
        "invoice_number", "event_code", "contact_name",
        "contact_email", "company_name", "reference",
    ]
    ordering_fields = ["created_at", "payment_status", "event_date", "company_name"]
    ordering        = ["-created_at"]

    def get_queryset(self):
        qs = BookEvent.objects.select_related("sales_executive")
        qs = self.rbac_filter(qs)
        if self.action == "list":
            qs = qs.annotate(_delegate_count_actual=Count("delegates", distinct=True))
        elif self.action in ("retrieve", "update", "partial_update"):
            qs = qs.prefetch_related("delegates__company")
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "retrieve", "update", "partial_update"):
            return BookEventDetailSerializer
        return BookEventListSerializer

    def retrieve(self, request, *args, **kwargs):
        logger.info("RETRIEVE invoice: %s", kwargs.get("pk"))
        try:
            return super().retrieve(request, *args, **kwargs)
        except Exception as e:
            logger.error("RETRIEVE ERROR: %s", str(e), exc_info=True)
            raise

    def partial_update(self, request, *args, **kwargs):
        logger.info("UPDATE invoice: %s | data: %s", kwargs.get("pk"), request.data)
        try:
            return super().partial_update(request, *args, **kwargs)
        except Exception as e:
            logger.error("UPDATE ERROR: %s", str(e), exc_info=True)
            raise

    def perform_create(self, serializer):
        invoice = serializer.save()
        from accounts.models import ActionLog
        ActionLog.objects.create(
            user=self.request.user,
            action=f"Created booking {invoice.invoice_number}",
            details=f"For event {invoice.event_code}"
        )

    def perform_update(self, serializer):
        invoice = serializer.save()
        from accounts.models import ActionLog
        ActionLog.objects.create(
            user=self.request.user,
            action=f"Updated booking {invoice.invoice_number}",
            details=f"Payment status: {invoice.payment_status}"
        )

    @action(detail=True, methods=["patch"], url_path="update_payment")
    def update_payment(self, request, pk=None):
        """PATCH /api/invoices/{id}/update_payment/ — payment-only update."""
        invoice = self.get_object()
        ser = PaymentUpdateSerializer(invoice, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()

        from accounts.models import ActionLog
        ActionLog.objects.create(
            user=request.user,
            action=f"Updated payment for {invoice.invoice_number}",
            details=f"New status: {invoice.payment_status}"
        )
        return Response({
            "invoice_number": invoice.invoice_number,
            "payment_status": invoice.payment_status,
            "payment_type":   invoice.payment_type,
            "payment_date":   str(invoice.payment_date) if invoice.payment_date else None,
            "paid_or_free":   invoice.paid_or_free,
            "ticket_tier":    invoice.ticket_tier,
        })

    @action(detail=False, methods=["get"])
    def pending(self, request):
        """GET /api/invoices/pending/ — shortcut for pending invoices."""
        qs = self.filter_queryset(self.get_queryset().filter(payment_status="Pending"))
        page = self.paginate_queryset(qs)
        ser = BookEventListSerializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page else Response(ser.data)

    @action(detail=False, methods=["get"])
    def stats(self, request):
        """
        GET /api/invoices/stats/?period=today|month|total
        Returns volume stats for the specified period.
        """
        from django.utils import timezone
        from django.db.models import Q
        from book_delegate.models import BookDelegate

        period = request.query_params.get("period", "total")
        qs = self.get_queryset()

        now = timezone.now()
        if period == "today":
            qs = qs.filter(created_at__date=now.date())
        elif period == "month":
            qs = qs.filter(created_at__year=now.year, created_at__month=now.month)

        del_qs = BookDelegate.objects.filter(invoice__in=qs)
        
        stats = del_qs.aggregate(
            total=Count("id"),
            paid=Count("id", filter=Q(invoice__payment_status="Paid")),
            confirmed=Count("id", filter=Q(attendance="Confirmed")),
            free=Count("id", filter=Q(invoice__paid_or_free="Free")),
        )

        return Response({
            "total": stats["total"] or 0,
            "paid": stats["paid"] or 0,
            "confirmed": stats["confirmed"] or 0,
            "free": stats["free"] or 0,
        })

    @action(
        detail=False, methods=["post"], url_path="create_from_website",
        authentication_classes=[ApiKeyAuthentication, OriginAuthentication, TokenAuthentication, SessionAuthentication],
        permission_classes=[HasApiKey | IsSalesOrAdmin],
    )
    def create_from_website(self, request):
        """
        POST /api/invoices/create_from_website/
        Accepts X-API-KEY from external websites OR a CRM session/token for manual testing.
        """
        source_ip = (
            request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
            or request.META.get("REMOTE_ADDR", "")
        )
        safe_headers = {
            k: v for k, v in request.META.items()
            if k.startswith("HTTP_") and k != "HTTP_X_API_KEY"
        }

        payload = unwrap_payload(request.data)
        ser = WebsiteBookingSerializer(data=payload)
        if not ser.is_valid():
            log = WebhookLog.objects.create(
                source_ip=source_ip, payload=request.data, headers=safe_headers,
                response={"errors": ser.errors}, status=WebhookLog.Status.FAILED,
                http_status=400, error_message=str(ser.errors),
            )
            return Response({"success": False, "errors": ser.errors}, status=status.HTTP_400_BAD_REQUEST)

        d = ser.validated_data
        invoice_number = d["InvoiceNumber"]
        event_code     = d["Eventcode"]

        # Duplicate check
        if BookEvent.objects.filter(invoice_number=invoice_number).exists():
            resp = {"success": False, "detail": f"Invoice '{invoice_number}' already exists."}
            WebhookLog.objects.create(
                source_ip=source_ip, payload=request.data, headers=safe_headers,
                response=resp, status=WebhookLog.Status.DUPLICATE,
                http_status=409, invoice_number=invoice_number, event_code=event_code,
                error_message="Duplicate invoice number",
            )
            return Response(resp, status=status.HTTP_409_CONFLICT)

        from companies.models import Company
        from book_delegate.models import BookDelegate

        try:
            company, company_created = Company.get_or_create_from_payload(d)
            sales_exec = BookEvent.auto_assign_sales(event_code)

            # Map PaymentStatus string from payload to choices
            payment_status_map = {v.lower(): v for v in BookEvent.PaymentStatus.values}
            incoming_ps = d.get("PaymentStatus", "").strip().lower()
            payment_status = payment_status_map.get(incoming_ps, BookEvent.PaymentStatus.PENDING)

            tier_map     = {v.lower(): v for v in BookEvent.TicketTier.values}
            pof_map      = {v.lower(): v for v in BookEvent.PaidOrFree.values}
            ticket_tier  = tier_map.get(d.get("TicketTier", "").strip().lower(), "")
            paid_or_free = pof_map.get(d.get("PaidOrFree",  "").strip().lower(), "")

            with transaction.atomic():
                invoice = BookEvent.objects.create(
                    invoice_number         = invoice_number,
                    event_code             = event_code,
                    event_name             = d.get("Eventname", ""),
                    event_date             = d.get("Date"),
                    company_name           = d.get("DelegateCompanyName", ""),
                    accounts_contact_email = d.get("AccountsContactEmail", ""),
                    discount               = d["Discount"],
                    discount_code          = d.get("DiscountCode", ""),
                    pre_tax_amount         = d.get("PreTaxAmount"),
                    tax_amount             = d.get("TaxAmount"),
                    total_amount           = d.get("TotalAmount"),
                    add_ons_total_amount   = d.get("AddOnsTotalAmount"),
                    currency               = d.get("Currency", "USD"),
                    payment_status         = payment_status,
                    ticket_tier            = ticket_tier,
                    paid_or_free           = paid_or_free,
                    sales_executive        = sales_exec,
                    source                 = BookEvent.Source.WEBSITE,
                    form_name              = d.get("FormName", ""),
                    form_url               = d.get("FormURL", ""),
                    packages               = d.get("Packages", []),
                )

                delegates_payload = d.get("Delegates", [])
                created, skipped  = [], 0

                for i, dp in enumerate(delegates_payload):
                    email = dp["Email"].strip().lower()
                    if BookDelegate.objects.filter(invoice=invoice, email=email).exists():
                        skipped += 1
                        continue
                    d_tier = tier_map.get(dp.get("TicketTier", "").strip().lower(), "") or None
                    d_pof  = pof_map.get(dp.get("PaidOrFree",  "").strip().lower(), "") or None
                    delegate = BookDelegate.objects.create(
                        invoice              = invoice,
                        event_code           = event_code,
                        company              = company,
                        company_name_raw     = d.get("DelegateCompanyName", ""),
                        first_name           = dp["FirstName"].strip(),
                        last_name            = dp.get("LastName", "").strip(),
                        email                = email,
                        phone_number         = dp.get("PhoneNumber", "").strip(),
                        position             = dp.get("Position", "").strip(),
                        ticket_package       = dp.get("TicketPackage", "").strip(),
                        sponsorship_level    = dp.get("SponsorshipLevel", "").strip(),
                        delegate_ticket_tier = d_tier,
                        delegate_paid_or_free= d_pof,
                    )
                    created.append(delegate)
                    if i == 0:
                        invoice.contact_name  = delegate.full_name
                        invoice.contact_email = email

                invoice.delegate_count = len(created)
                invoice.save(update_fields=["contact_name", "contact_email", "delegate_count"])

        except Exception as exc:
            err_msg = str(exc)
            logger.error("Website intake error: %s", err_msg, exc_info=True)
            resp = {"success": False, "detail": "Internal server error during intake."}
            WebhookLog.objects.create(
                source_ip=source_ip, payload=request.data, headers=safe_headers,
                response=resp, status=WebhookLog.Status.FAILED,
                http_status=500, invoice_number=invoice_number, event_code=event_code,
                error_message=err_msg,
            )
            return Response(resp, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.info(
            "Website intake: %s | event: %s | delegates: %d | sales: %s",
            invoice_number, event_code, len(created),
            sales_exec.username if sales_exec else "unassigned",
        )

        if sales_exec:
            from accounts.models import ActionLog
            ActionLog.objects.create(
                user=sales_exec,
                action=f"Auto-assigned to new booking {invoice.invoice_number}",
                details=f"Created from website for event {event_code}",
            )

        resp_body = {
            "success":           True,
            "invoice_number":    invoice.invoice_number,
            "booking_id":        invoice.id,
            "event_code":        invoice.event_code,
            "company":           {"id": company.id, "name": company.name} if company else None,
            "company_created":   company_created,
            "delegates_created": len(created),
            "delegates_skipped": skipped,
            "sales_executive":   sales_exec.username if sales_exec else None,
            "payment_status":    invoice.payment_status,
        }
        WebhookLog.objects.create(
            source_ip=source_ip, payload=request.data, headers=safe_headers,
            response=resp_body, status=WebhookLog.Status.SUCCESS,
            http_status=201, invoice_number=invoice_number, event_code=event_code,
        )
        return Response(resp_body, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="bulk_import")
    def bulk_import(self, request):
        """
        POST /api/invoices/bulk_import/
        Bulk-insert up to 500 BookEvent rows per call.
        Body: { rows: [...], duplicate_strategy: "skip"|"upsert", batch_number: int }
        """
        rows               = request.data.get("rows", [])
        strategy           = request.data.get("duplicate_strategy", "skip")
        batch_number       = request.data.get("batch_number", 1)

        if not rows:
            return Response({"success": False, "detail": "No rows provided."}, status=400)

        # ── helpers ───────────────────────────────────────────────────────────
        DATE_FMTS = ["%d %b %Y", "%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y",
                     "%d-%b-%Y", "%d %B %Y"]

        def _parse_date(val):
            if not val:
                return None
            s = str(val).strip()
            for fmt in DATE_FMTS:
                try:
                    return datetime.strptime(s, fmt).date()
                except ValueError:
                    continue
            return None

        def _clean(d, key, default=""):
            return str(d.get(key) or default).strip()

        def _delegate_fields(row, ev_code):
            name_raw = _clean(row, "contact_name")
            parts    = name_raw.split(" ", 1) if name_raw else []
            return dict(
                event_code=ev_code,
                first_name=parts[0] if parts else "",
                last_name=parts[1] if len(parts) > 1 else "",
                email=_clean(row, "contact_email").lower(),
                phone_number=_clean(row, "contact_phone"),
                company_name_raw=_clean(row, "company_name"),
            )

        def _safe_create_delegate(book_event, fields):
            """
            Create a BookDelegate inside a savepoint so an IntegrityError
            never aborts the outer PostgreSQL transaction.
            If (invoice, email) already exists, assign a placeholder email
            so the person is saved rather than silently dropped.
            """
            import uuid as _uuid
            from book_delegate.models import BookDelegate
            try:
                with transaction.atomic():   # savepoint — isolates the IntegrityError
                    return BookDelegate.objects.create(invoice=book_event, **fields)
            except IntegrityError:
                fields = dict(fields)
                fields["email"] = f"dup-{_uuid.uuid4().hex[:8]}@import.local"
                with transaction.atomic():
                    return BookDelegate.objects.create(invoice=book_event, **fields)

        def _save_delegate(book_event, row, ev_code, nth=1):
            """
            Save a delegate row.
            - nth=1 (first time this invoice+email appears in the batch):
                update existing delegate if found, otherwise create.
            - nth>1 (same invoice+email seen again → different person sharing email):
                always create a new delegate with a placeholder email so both
                people are stored (e.g. Oz Ruiz / Austin Ali both with jen@accelhealth.ai,
                or two TBA rows with tba@turboden.com).
            """
            from book_delegate.models import BookDelegate
            fields = _delegate_fields(row, ev_code)
            if nth > 1:
                # Different person sharing an email — must use placeholder to satisfy
                # the unique_together (invoice, email) constraint.
                f = dict(fields)
                f["email"] = f"dup-{__import__('uuid').uuid4().hex[:8]}@import.local"
                _safe_create_delegate(book_event, f)
                return
            # First occurrence: look up by (invoice, email)
            email    = fields["email"]
            delegate = BookDelegate.objects.filter(invoice=book_event, email=email).first()
            if delegate:
                for k, v in fields.items():
                    if v:
                        setattr(delegate, k, v)
                with transaction.atomic():
                    delegate.save()
            else:
                _safe_create_delegate(book_event, fields)

        ps_map   = {v.lower(): v for v in BookEvent.PaymentStatus.values}
        tier_map = {v.lower(): v for v in BookEvent.TicketTier.values}
        pof_map  = {v.lower(): v for v in BookEvent.PaidOrFree.values}
        pt_map   = {v.lower(): v for v in BookEvent.PaymentType.values}
        cur_map  = {v.lower(): v for v in BookEvent.Currency.values}

        inserted       = 0
        skipped        = 0
        errors         = []
        skipped_rows   = []
        auto_inv_rows  = []
        # Tracks how many times each (invoice, email) pair appears in THIS batch.
        # nth > 1 means a different person sharing the same email on the same invoice.
        from collections import defaultdict
        invoice_email_seen = defaultdict(int)

        for i, row in enumerate(rows):
            event_code_val = _clean(row, "event_code")   # empty is allowed — never skip

            inv_no = _clean(row, "invoice_number")
            auto_generated_inv = False
            if not inv_no:
                import uuid
                inv_no = f"IMP-{uuid.uuid4().hex[:10].upper()}"
                auto_generated_inv = True

            _email_key = (inv_no, _clean(row, "contact_email").lower())
            invoice_email_seen[_email_key] += 1
            _nth = invoice_email_seen[_email_key]

            # Each row is wrapped in its own savepoint so a failure never
            # aborts the outer PostgreSQL transaction for subsequent rows.
            try:
                with transaction.atomic():
                    existing = BookEvent.objects.filter(invoice_number=inv_no).first()

                    if existing:
                        # Upsert: update BookEvent fields when strategy requests it
                        if strategy == "upsert":
                            existing.event_code             = _clean(row, "event_code") or existing.event_code
                            existing.event_name             = _clean(row, "event_name") or existing.event_name
                            existing.booking_code           = _clean(row, "booking_code") or existing.booking_code
                            existing.company_name           = _clean(row, "company_name") or existing.company_name
                            existing.contact_name           = _clean(row, "contact_name") or existing.contact_name
                            existing.contact_email          = _clean(row, "contact_email").lower() or existing.contact_email
                            existing.contact_phone          = _clean(row, "contact_phone") or existing.contact_phone
                            existing.accounts_contact_email = _clean(row, "accounts_contact_email") or existing.accounts_contact_email
                            existing.payment_status         = ps_map.get(_clean(row, "payment_status").lower(), existing.payment_status)
                            existing.paid_or_free           = pof_map.get(_clean(row, "paid_or_free").lower(), existing.paid_or_free)
                            existing.payment_type           = pt_map.get(_clean(row, "payment_type").lower(), existing.payment_type)
                            existing.ticket_tier            = tier_map.get(_clean(row, "ticket_tier").lower(), existing.ticket_tier)
                            existing.discount_code          = _clean(row, "discount_code") or existing.discount_code
                            existing.add_ons                = _clean(row, "add_ons") or existing.add_ons
                            existing.reference              = _clean(row, "reference") or existing.reference
                            pd = _parse_date(row.get("payment_date"))
                            if pd: existing.payment_date = pd
                            rd = _parse_date(row.get("request_date"))
                            if rd: existing.request_date = rd
                            id_ = _parse_date(row.get("invoice_date"))
                            if id_: existing.invoice_date = id_
                            existing.save()

                        # Always save delegate — never skip regardless of strategy
                        _save_delegate(existing, row, event_code_val, nth=_nth)

                    else:
                        # New BookEvent
                        sales_exec = None
                        se_name = _clean(row, "sales_executive")
                        if se_name:
                            from accounts.models import User
                            sales_exec = (
                                User.objects.filter(first_name__icontains=se_name).first()
                                or User.objects.filter(last_name__icontains=se_name).first()
                                or User.objects.filter(username__iexact=se_name).first()
                            )
                        try:
                            dc = max(1, int(row.get("delegate_count") or 1))
                        except (ValueError, TypeError):
                            dc = 1

                        book_event = BookEvent.objects.create(
                            invoice_number         = inv_no,
                            event_code             = event_code_val,
                            event_name             = _clean(row, "event_name"),
                            booking_code           = _clean(row, "booking_code"),
                            request_date           = _parse_date(row.get("request_date")),
                            invoice_date           = _parse_date(row.get("invoice_date")),
                            company_name           = _clean(row, "company_name"),
                            contact_name           = _clean(row, "contact_name"),
                            contact_email          = _clean(row, "contact_email").lower(),
                            contact_phone          = _clean(row, "contact_phone"),
                            accounts_contact_email = _clean(row, "accounts_contact_email"),
                            payment_status         = ps_map.get(_clean(row, "payment_status").lower(), BookEvent.PaymentStatus.PENDING),
                            paid_or_free           = pof_map.get(_clean(row, "paid_or_free").lower(), ""),
                            payment_date           = _parse_date(row.get("payment_date")),
                            payment_type           = pt_map.get(_clean(row, "payment_type").lower(), ""),
                            ticket_tier            = tier_map.get(_clean(row, "ticket_tier").lower(), ""),
                            currency               = cur_map.get(_clean(row, "currency").lower(), BookEvent.Currency.USD),
                            discount_code          = _clean(row, "discount_code"),
                            add_ons                = _clean(row, "add_ons"),
                            reference              = _clean(row, "reference"),
                            delegate_count         = dc,
                            sales_executive        = sales_exec,
                            source                 = BookEvent.Source.MANUAL,
                        )
                        _save_delegate(book_event, row, event_code_val, nth=_nth)

                        if auto_generated_inv:
                            se_display = _clean(row, "sales_executive") or (
                                f"{sales_exec.get_full_name() or sales_exec.username}" if sales_exec else "Unknown"
                            )
                            auto_inv_rows.append({
                                "invoice_number": inv_no,
                                "event_code":     event_code_val,
                                "sales_executive": se_display,
                                "contact_name":   _clean(row, "contact_name"),
                            })

                inserted += 1

            except Exception as exc:
                errors.append({"row_index": i, "invoice_number": inv_no, "message": str(exc)})

        # Send alert email for any auto-generated invoice numbers
        if auto_inv_rows:
            try:
                from django.core.mail import send_mail
                from django.conf import settings as django_settings
                recipient = getattr(django_settings, "IMPORT_ALERT_EMAIL", "harrison.peck@iq-hub.com")
                lines = []
                for entry in auto_inv_rows:
                    lines.append(
                        f"  • Auto-Invoice: {entry['invoice_number']}"
                        f"  |  Event Code: {entry['event_code']}"
                        f"  |  Added by: @{entry['sales_executive']}"
                        + (f"  |  Contact: {entry['contact_name']}" if entry['contact_name'] else "")
                    )
                body = (
                    f"Hi Harrison,\n\n"
                    f"{len(auto_inv_rows)} new booking entr{'y was' if len(auto_inv_rows) == 1 else 'ies were'} "
                    f"imported without an Invoice Number — auto-generated IDs assigned:\n\n"
                    + "\n".join(lines)
                    + "\n\nThese entries were created via the Smart Import tool and may need manual invoice numbers assigned.\n\n"
                    f"— Linq CRM"
                )
                send_mail(
                    subject=f"[Linq CRM] {len(auto_inv_rows)} Import{'s' if len(auto_inv_rows) != 1 else ''} Without Invoice Number",
                    message=body,
                    from_email=django_settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[recipient],
                    fail_silently=True,
                )
            except Exception:
                pass  # never block the response over an email failure

        return Response({
            "success":            len(errors) == 0,
            "batch_number":       batch_number,
            "inserted":           inserted,
            "skipped_duplicates": skipped,
            "errors":             errors[:20],
            "skipped_rows":       skipped_rows,
        })

    @action(detail=False, methods=["get"], url_path="webhook_logs",
            permission_classes=[IsAdminRole])
    def webhook_logs(self, request):
        """GET /api/invoices/webhook_logs/ — paginated webhook activity (admin only)."""
        from .models import WebhookLog as WL
        qs = WL.objects.all()
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        page = self.paginate_queryset(qs)
        data = [
            {
                "id":             log.id,
                "status":         log.status,
                "http_status":    log.http_status,
                "invoice_number": log.invoice_number,
                "event_code":     log.event_code,
                "source_ip":      log.source_ip,
                "error_message":  log.error_message,
                "payload":        log.payload,
                "response":       log.response,
                "created_at":     log.created_at,
            }
            for log in (page if page is not None else qs)
        ]
        return self.get_paginated_response(data) if page is not None else Response(data)
