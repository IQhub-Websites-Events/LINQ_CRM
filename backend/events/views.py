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
        if not user.is_admin:
            qs = qs.filter(Q(assigned_users=user) | Q(sales_executive=user)).distinct()

        # For the list action only: the suffixed format (e.g. "AFS - JS") is canonical.
        # When both "AFS" and "AFS - JS" exist, hide the plain "AFS" entry so
        # each event concept appears exactly once.
        if getattr(self, "action", None) == "list":
            suffixed_base_codes = set(
                code.split(" - ")[0].strip()
                for code in Event.objects.filter(event_code__contains=" - ")
                .values_list("event_code", flat=True)
            )
            if suffixed_base_codes:
                legacy_plain_codes = [
                    code for code in
                    Event.objects.exclude(event_code__contains=" - ")
                    .values_list("event_code", flat=True)
                    if code in suffixed_base_codes
                ]
                if legacy_plain_codes:
                    qs = qs.exclude(event_code__in=legacy_plain_codes)

        return qs

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

    @action(detail=False, methods=["get"])
    def years(self, request):
        """GET /api/events/years/ — distinct years from event_date, sorted descending."""
        from django.db.models.functions import ExtractYear
        qs = self.get_queryset().filter(event_date__isnull=False)
        years = (
            qs.annotate(year=ExtractYear("event_date"))
            .values_list("year", flat=True)
            .distinct()
            .order_by("-year")
        )
        return Response(list(years))

    @action(detail=False, methods=["get"])
    def all_edition_growth(self, request):
        """
        GET /api/events/all_edition_growth/
        Returns YoY growth data for every event that has historical editions
        or multi-year bookings. Used to populate the Reports › Growth table.
        """
        from historical_event_registry.models import HistoricalEventReference
        from historical_event_registry.growth_service import YearOnYearGrowthCalculator
        from book_event.models import BookEvent
        from django.db.models.functions import ExtractYear

        # Collect event codes with historical references
        hist_codes = set(
            HistoricalEventReference.objects
            .values_list("normalized_event_code", flat=True)
            .distinct()
        )

        # Also include events with bookings from 2+ distinct years
        multi_year_codes = set()
        from django.db.models import Count as _Count
        multi = (
            BookEvent.objects.exclude(event_date__isnull=True)
            .annotate(yr=ExtractYear("event_date"))
            .values("event_code")
            .annotate(year_count=_Count("yr", distinct=True))
            .filter(year_count__gte=2)
            .values_list("event_code", flat=True)
        )
        multi_year_codes.update(multi)

        all_codes = hist_codes | multi_year_codes
        if not all_codes:
            return Response([])

        # Build event map: code → Event instance
        event_map = {e.event_code: e for e in self.get_queryset().filter(event_code__in=all_codes)}

        results = []
        for code in sorted(all_codes):
            event = event_map.get(code)
            calc  = YearOnYearGrowthCalculator(event_code=code, event=event)
            results.append(calc.calculate())

        # Sort by total_sales_all_years descending
        results.sort(key=lambda r: r["total_sales_all_years"], reverse=True)
        return Response(results)

    @action(detail=True, methods=["get"])
    def edition_growth(self, request, pk=None):
        """GET /api/events/{id}/edition_growth/ — full YoY growth for one event."""
        from historical_event_registry.growth_service import YearOnYearGrowthCalculator, EditionGrowthValidator
        event  = self.get_object()
        result = EditionGrowthValidator(event_code=event.event_code, event=event).validate_and_fix()
        return Response(result)

    @action(detail=True, methods=["get"])
    def historical_editions(self, request, pk=None):
        """GET /api/events/{id}/historical_editions/ — all historical editions with live metrics."""
        event = self.get_object()
        from historical_event_registry.edition_service import HistoricalEditionDataService
        service  = HistoricalEditionDataService(event_code=event.event_code)
        editions = service.get_editions()

        # Exclude the current event's own year so it doesn't appear as a past edition
        current_year = event.event_date.year if event.event_date else None
        if current_year:
            editions = [e for e in editions if e["year"] != current_year]

        return Response({"event_code": event.event_code, "editions": editions})

    @action(detail=True, methods=["get"])
    def edition_bookings(self, request, pk=None):
        """
        GET /api/events/{id}/edition_bookings/         → all editions with invoice-date metrics
        GET /api/events/{id}/edition_bookings/?year=N  → full booking list for edition year N
        """
        from historical_event_registry.booking_engine import EventEditionBookingEngine
        event  = self.get_object()
        engine = EventEditionBookingEngine(event_code=event.event_code, event=event)

        year_param = request.query_params.get("year")
        if year_param:
            try:
                year = int(year_param)
            except ValueError:
                return Response({"error": "Invalid year parameter"}, status=400)
            return Response(engine.get_edition_bookings(year))

        return Response(engine.get_summary())

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
