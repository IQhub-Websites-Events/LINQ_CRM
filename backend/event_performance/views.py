from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q

from events.models import Event
from .models import FollowUpRecord, MailshotRecord, EventPerformanceNote
from .serializers import (
    EventMetricsSerializer, FollowUpSerializer,
    MailshotSerializer, EventPerformanceNoteSerializer,
)
from .services import bulk_event_metrics, compute_health, reps_performance


def _build_event_row(event: Event, metrics: dict) -> dict:
    m = metrics.get(event.event_code, {})
    paid_count = m.get("paid_count", 0)
    health = compute_health(paid_count, event.capacity)
    return {
        "event_code":          event.event_code,
        "event_name":          event.name,
        "event_date":          event.event_date,
        "status":              event.status,
        "sub_company":         event.sub_company,
        "city":                event.city,
        "capacity":            event.capacity,
        **m,
        "benchmark":           health["benchmark"],
        "health":              health["health"],
        "health_color":        health["color"],
    }


class EventPerformanceViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """
        GET /api/event-performance/
        Returns all events with full metrics. Supports ?status=, ?sub_company=, ?search=
        """
        qs = Event.objects.all().order_by("-event_date")

        status_filter      = request.query_params.get("status")
        sub_company_filter = request.query_params.get("sub_company")
        search             = request.query_params.get("search", "").strip()

        if status_filter:
            qs = qs.filter(status=status_filter)
        if sub_company_filter:
            qs = qs.filter(sub_company=sub_company_filter)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(event_code__icontains=search))

        events      = list(qs)
        event_codes = [e.event_code for e in events]
        metrics     = bulk_event_metrics(event_codes)

        rows = [_build_event_row(e, metrics) for e in events]
        serializer = EventMetricsSerializer(rows, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """
        GET /api/event-performance/{event_code}/
        Single event detail with full metrics + follow-ups + mailshots + notes.
        """
        try:
            event = Event.objects.get(event_code=pk)
        except Event.DoesNotExist:
            return Response({"detail": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        metrics    = bulk_event_metrics([event.event_code])
        row        = _build_event_row(event, metrics)
        follow_ups = FollowUpRecord.objects.filter(event_code=pk)
        mailshots  = MailshotRecord.objects.filter(event_code=pk)
        notes      = EventPerformanceNote.objects.filter(event_code=pk)
        reps       = reps_performance([pk])

        return Response({
            "event":      EventMetricsSerializer(row).data,
            "follow_ups": FollowUpSerializer(follow_ups, many=True).data,
            "mailshots":  MailshotSerializer(mailshots, many=True).data,
            "notes":      EventPerformanceNoteSerializer(notes, many=True).data,
            "reps":       reps,
        })

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """
        GET /api/event-performance/summary/
        Aggregated KPIs across all non-cancelled events.
        """
        events      = Event.objects.exclude(status="Cancelled")
        event_codes = list(events.values_list("event_code", flat=True))
        metrics     = bulk_event_metrics(event_codes)

        totals = {
            "event_count":     len(event_codes),
            "total_bookings":  0,
            "paid_count":      0,
            "pending_count":   0,
            "total_revenue":   0.0,
            "pending_value":   0.0,
            "today_paid":      0,
            "today_revenue":   0.0,
            "d7_paid":         0,
            "d7_revenue":      0.0,
        }
        for m in metrics.values():
            for k in totals:
                if k != "event_count":
                    totals[k] = totals[k] + (m.get(k) or 0)

        return Response(totals)

    @action(detail=True, methods=["get"], url_path="reps")
    def reps(self, request, pk=None):
        """GET /api/event-performance/{event_code}/reps/"""
        data = reps_performance([pk])
        return Response(data)

    # ── Follow-ups ────────────────────────────────────────────────────────────

    @action(detail=True, methods=["get", "post"], url_path="follow-ups")
    def follow_ups(self, request, pk=None):
        if request.method == "GET":
            qs = FollowUpRecord.objects.filter(event_code=pk)
            return Response(FollowUpSerializer(qs, many=True).data)

        serializer = FollowUpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(event_code=pk, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"follow-ups/(?P<fu_id>\d+)")
    def follow_up_detail(self, request, pk=None, fu_id=None):
        try:
            obj = FollowUpRecord.objects.get(id=fu_id, event_code=pk)
        except FollowUpRecord.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            obj.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = FollowUpSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # ── Mailshots ─────────────────────────────────────────────────────────────

    @action(detail=True, methods=["get", "post"], url_path="mailshots")
    def mailshots(self, request, pk=None):
        if request.method == "GET":
            qs = MailshotRecord.objects.filter(event_code=pk)
            return Response(MailshotSerializer(qs, many=True).data)

        serializer = MailshotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(event_code=pk, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch", "delete"], url_path=r"mailshots/(?P<ms_id>\d+)")
    def mailshot_detail(self, request, pk=None, ms_id=None):
        try:
            obj = MailshotRecord.objects.get(id=ms_id, event_code=pk)
        except MailshotRecord.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        if request.method == "DELETE":
            obj.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = MailshotSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    # ── Notes ─────────────────────────────────────────────────────────────────

    @action(detail=True, methods=["get", "post"], url_path="notes")
    def notes(self, request, pk=None):
        if request.method == "GET":
            qs = EventPerformanceNote.objects.filter(event_code=pk)
            return Response(EventPerformanceNoteSerializer(qs, many=True).data)

        serializer = EventPerformanceNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(event_code=pk, created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"notes/(?P<note_id>\d+)")
    def note_delete(self, request, pk=None, note_id=None):
        try:
            obj = EventPerformanceNote.objects.get(id=note_id, event_code=pk)
        except EventPerformanceNote.DoesNotExist:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
