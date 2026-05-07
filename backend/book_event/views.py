"""
book_event/views.py
────────────────────
Invoice CRUD + payment update + website intake.
"""
import logging
from django.db import transaction
from django.db.models import Count
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import RBACMixin, IsSalesOrAdmin
from .models import BookEvent
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

    @action(detail=False, methods=["post"], url_path="create_from_website",
            permission_classes=[IsSalesOrAdmin])
    def create_from_website(self, request):
        """
        POST /api/invoices/create_from_website/
        Primary intake for data pushed from the Zoho-compatible event website.
        """
        ser = WebsiteBookingSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        invoice_number = d["InvoiceNumber"]
        event_code     = d["Eventcode"]

        # 1. Unique check
        if BookEvent.objects.filter(invoice_number=invoice_number).exists():
            return Response(
                {"detail": f"Invoice '{invoice_number}' already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        # 2. Upsert company
        from companies.models import Company
        company, company_created = Company.get_or_create_from_payload(d)

        # 3. Auto-assign sales executive
        sales_exec = BookEvent.auto_assign_sales(event_code)

        # 4. Create invoice + delegates atomically
        with transaction.atomic():
            invoice = BookEvent.objects.create(
                invoice_number = invoice_number,
                event_code     = event_code,
                event_name     = d.get("Eventname", ""),
                event_date     = d.get("Date"),
                company_name   = d.get("DelegateCompanyName", ""),

                discount       = d["Discount"],
                currency       = d.get("Currency", "USD"),
                payment_status = BookEvent.PaymentStatus.PENDING,
                sales_executive= sales_exec,
            )

            from book_delegate.models import BookDelegate
            delegates_payload = d.get("Delegates", [])
            created, skipped  = [], 0

            for i, dp in enumerate(delegates_payload):
                email = dp["Email"].strip().lower()
                if BookDelegate.objects.filter(invoice=invoice, email=email).exists():
                    skipped += 1
                    continue
                delegate = BookDelegate.objects.create(
                    invoice          = invoice,
                    event_code       = event_code,
                    company          = company,
                    company_name_raw = d.get("DelegateCompanyName", ""),
                    first_name       = dp["FirstName"].strip(),
                    last_name        = dp.get("LastName", "").strip(),
                    email            = email,
                    phone_number     = dp.get("PhoneNumber", "").strip(),
                    position         = dp.get("Position", "").strip(),
                )
                created.append(delegate)
                if i == 0:
                    invoice.contact_name  = delegate.full_name
                    invoice.contact_email = email

            invoice.delegate_count = len(created)
            invoice.save(update_fields=["contact_name", "contact_email", "delegate_count"])

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
                details=f"Created from website for event {event_code}"
            )

        return Response({
            "invoice_number":    invoice.invoice_number,
            "event_code":        invoice.event_code,
            "company":           {"id": company.id, "name": company.name} if company else None,
            "company_created":   company_created,
            "delegates_created": len(created),
            "delegates_skipped": skipped,
            "sales_executive":   sales_exec.username if sales_exec else None,
            "payment_status":    invoice.payment_status,
        }, status=status.HTTP_201_CREATED)
