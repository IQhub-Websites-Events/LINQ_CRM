from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import RBACMixin
from accounts.crm_permissions import crm_permission
from .models import BookDelegate
from .serializers import (
    BookDelegateListSerializer, BookDelegateDetailSerializer, BookDelegateWriteSerializer,
)
from .filters import BookDelegateFilter


from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

class BookDelegateViewSet(RBACMixin, viewsets.ModelViewSet):
    permission_classes = [crm_permission("bookings")]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = BookDelegateFilter
    search_fields   = [
        "first_name", "last_name", "email", "position",
        "invoice__invoice_number", "event_code", "company_name_raw",
    ]
    ordering_fields = [
        "_sort_invoice", "_sort_status", "_sort_date", "_sort_name", "_sort_request_date",
        "first_name", "last_name", "email", "event_code", "attendance", "created_at",
        "position", "company_name_raw",
    ]
    ordering        = ["-_sort_request_date"]

    def get_queryset(self):
        from django.db.models import F, Value
        from django.db.models.functions import Concat
        qs = BookDelegate.objects.select_related("invoice__sales_executive", "company")
        qs = qs.annotate(
            _sort_invoice=F("invoice__invoice_number"),
            _sort_status=F("invoice__payment_status"),
            _sort_date=F("invoice__invoice_date"),
            _sort_request_date=F("invoice__request_date"),
            _sort_name=Concat(F("first_name"), Value(" "), F("last_name")),
        )
        return self.rbac_filter_invoice(qs)

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return BookDelegateWriteSerializer
        if self.action == "retrieve":
            return BookDelegateDetailSerializer
        return BookDelegateListSerializer

    @action(detail=False, methods=["get"], url_path=r"by_invoice/(?P<invoice_number>[^/.]+)")
    def by_invoice(self, request, invoice_number=None):
        """GET /api/delegates/by_invoice/{invoice_number}/"""
        qs = self.get_queryset().filter(invoice__invoice_number=invoice_number)
        return Response(BookDelegateListSerializer(qs, many=True).data)

    @action(detail=True, methods=["patch"], url_path="update_attendance")
    def update_attendance(self, request, pk=None):
        """PATCH /api/delegates/{id}/update_attendance/"""
        delegate   = self.get_object()
        attendance = request.data.get("attendance")
        choices    = dict(BookDelegate.Attendance.choices)
        if attendance not in choices:
            return Response({"detail": f"Invalid attendance: {attendance}"}, status=400)
        delegate.attendance = attendance
        delegate.save(update_fields=["attendance", "updated_at"])
        return Response({"id": delegate.id, "attendance": delegate.attendance})
