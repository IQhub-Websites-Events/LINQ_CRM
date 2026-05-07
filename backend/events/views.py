from decimal import Decimal
from django.db.models import Count, Q, Sum, DecimalField
from django.db.models.functions import Coalesce
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import RBACMixin, IsAdminRole, IsSalesOrAdmin
from .models import Event
from .serializers import EventListSerializer, EventDetailSerializer, EventWriteSerializer
from .filters import EventFilter


class EventViewSet(RBACMixin, viewsets.ModelViewSet):
    filterset_class = EventFilter
    search_fields   = ["event_code", "name", "city", "sub_company"]
    ordering_fields = ["event_date", "name", "event_code"]
    ordering        = ["-event_date"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminRole()]
        return [IsSalesOrAdmin()]

    def get_queryset(self):
        user = self.request.user
        qs = Event.objects.select_related("sales_executive").prefetch_related("assigned_users")
        if user.is_admin:
            return qs
        return qs.filter(Q(assigned_users=user) | Q(sales_executive=user)).distinct()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return EventDetailSerializer
        if self.action in ("create", "update", "partial_update"):
            return EventWriteSerializer
        return EventListSerializer

    def create(self, request, *args, **kwargs):
        ser = EventWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        event = ser.save()
        return Response(EventListSerializer(event).data, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        ser = EventWriteSerializer(instance, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        return Response(EventListSerializer(ser.save()).data)

    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        """GET /api/events/{id}/stats/ — booking and revenue breakdown."""
        event = self.get_object()
        from book_event.models import BookEvent
        from book_delegate.models import BookDelegate
        from django.db.models import DecimalField

        bookings = BookEvent.objects.filter(event_code=event.event_code)

        rev_by_status = list(
            bookings.values("payment_status").annotate(
                count=Count("id"),
                total=Coalesce(
                    Sum("total_amount"),
                    Decimal("0"),
                    output_field=DecimalField(max_digits=14, decimal_places=2),
                ),
            )
        )

        return Response({
            "event_code":     event.event_code,
            "event_name":     event.name,
            "booking_count":  bookings.count(),
            "delegate_count": BookDelegate.objects.filter(event_code=event.event_code).count(),
            "by_payment_status": [
                {"status": r["payment_status"], "count": r["count"], "revenue": float(r["total"])}
                for r in rev_by_status
            ],
        })
