"""
book_event/views.py
────────────────────
Invoice CRUD + payment update + website intake.
"""
import logging
from django.db import transaction
from django.db.models import Count
from rest_framework import viewsets, status
from rest_framework.authentication import TokenAuthentication, SessionAuthentication
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import RBACMixin, IsSalesOrAdmin, IsAdminRole
from .authentication import ApiKeyAuthentication, HasApiKey
from .models import BookEvent, WebhookLog
from .serializers import (
    BookEventListSerializer, BookEventDetailSerializer,
    PaymentUpdateSerializer, WebsiteBookingSerializer,
)
from .filters import BookEventFilter

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
        })

    @action(detail=False, methods=["get"])
    def pending(self, request):
        """GET /api/invoices/pending/ — shortcut for pending invoices."""
        qs = self.filter_queryset(self.get_queryset().filter(payment_status="Pending"))
        page = self.paginate_queryset(qs)
        ser = BookEventListSerializer(page if page is not None else qs, many=True)
        return self.get_paginated_response(ser.data) if page else Response(ser.data)

    @action(
        detail=False, methods=["post"], url_path="create_from_website",
        authentication_classes=[ApiKeyAuthentication, TokenAuthentication, SessionAuthentication],
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

        ser = WebsiteBookingSerializer(data=request.data)
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
                    delegate = BookDelegate.objects.create(
                        invoice           = invoice,
                        event_code        = event_code,
                        company           = company,
                        company_name_raw  = d.get("DelegateCompanyName", ""),
                        first_name        = dp["FirstName"].strip(),
                        last_name         = dp.get("LastName", "").strip(),
                        email             = email,
                        phone_number      = dp.get("PhoneNumber", "").strip(),
                        position          = dp.get("Position", "").strip(),
                        ticket_package    = dp.get("TicketPackage", "").strip(),
                        sponsorship_level = dp.get("SponsorshipLevel", "").strip(),
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
