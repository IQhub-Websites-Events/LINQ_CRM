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

    @action(detail=False, methods=["get"], url_path="active-editions")
    def active_editions(self, request):
        """
        GET /api/event-performance/active-editions/
        Returns one row per master event (DDU, WSE, BNZ…) showing only the
        current/latest active edition. Historical editions are hidden from this view.
        Supports ?status= ?sub_company= ?search=
        """
        from .active_edition_service import CurrentActiveEditionResolver

        filters = {
            "status":      request.query_params.get("status"),
            "sub_company": request.query_params.get("sub_company"),
            "search":      request.query_params.get("search", ""),
        }

        resolver = CurrentActiveEditionResolver()
        groups   = resolver.resolve(filters)

        # Bulk-compute metrics for ALL editions across every master group so
        # historical editions' paid delegates are not silently excluded.
        all_codes = [
            e.event_code
            for g in groups
            for e in g["all_events"]
        ]
        metrics = bulk_event_metrics(all_codes)

        def _sum_group(group_events: list, key: str, default=0):
            return sum(metrics.get(e.event_code, {}).get(key, default) or default
                       for e in group_events)

        rows = []
        for group in groups:
            event        = group["current"]
            all_events   = group["all_events"]

            # Aggregate numeric metrics across every edition in this master group
            m = {
                "total_delegates":     _sum_group(all_events, "total_delegates"),
                "paid_count":          _sum_group(all_events, "paid_count"),
                "pending_count":       _sum_group(all_events, "pending_count"),
                "free_count":          _sum_group(all_events, "free_count"),
                "cancelled_count":     _sum_group(all_events, "cancelled_count"),
                "confirmed_delegates": _sum_group(all_events, "confirmed_delegates"),
                "noshow_delegates":    _sum_group(all_events, "noshow_delegates"),
                "vip_count":           _sum_group(all_events, "vip_count"),
                "speaker_count":       _sum_group(all_events, "speaker_count"),
                "sponsor_count":       _sum_group(all_events, "sponsor_count"),
                "complimentary_count": _sum_group(all_events, "complimentary_count"),
                "paid_pof_count":      _sum_group(all_events, "paid_pof_count"),
                "free_pof_count":      _sum_group(all_events, "free_pof_count"),
                "today_paid":          _sum_group(all_events, "today_paid"),
                "yesterday_paid":      _sum_group(all_events, "yesterday_paid"),
                "d7_paid":             _sum_group(all_events, "d7_paid"),
                "d14_paid":            _sum_group(all_events, "d14_paid"),
                "d21_paid":            _sum_group(all_events, "d21_paid"),
                "total_revenue":       _sum_group(all_events, "total_revenue", 0.0),
                "pending_value":       _sum_group(all_events, "pending_value", 0.0),
                "today_revenue":       _sum_group(all_events, "today_revenue", 0.0),
                "yesterday_revenue":   _sum_group(all_events, "yesterday_revenue", 0.0),
                "d7_revenue":          _sum_group(all_events, "d7_revenue", 0.0),
                "d14_revenue":         _sum_group(all_events, "d14_revenue", 0.0),
                "d21_revenue":         _sum_group(all_events, "d21_revenue", 0.0),
                "total_invoices":      _sum_group(all_events, "total_invoices"),
            }

            health = compute_health(m["paid_count"], event.capacity)
            rows.append({
                "master_code":         event.event_code,
                "current_event_code":  event.event_code,
                "current_event_name":  event.name,
                "current_year":        event.event_date.year if event.event_date else None,
                "current_city":        event.city or "",
                "current_event_date":  event.event_date,
                "event_status":        event.status,
                "sub_company":         event.sub_company or "",
                "edition_count":       group["edition_count"],
                **m,
                "benchmark":  health["benchmark"],
                "health":     health["health"],
                "health_color": health["color"],
            })

        return Response(rows)

    @action(detail=True, methods=["get"], url_path="master-history")
    def master_history(self, request, pk=None):
        """
        GET /api/event-performance/{master_code}/master-history/
        Returns complete edition history for a master event (DDU, WSE…).
        Includes: all editions with per-edition metrics, YoY growth timeline,
        performance insights, reps, follow-ups, mailshots, notes.
        """
        from .active_edition_service import (
            CurrentActiveEditionResolver, EventPerformanceInsightEngine
        )

        resolver = CurrentActiveEditionResolver()
        events   = resolver.events_for_master(pk)

        if not events:
            return Response({"detail": "Master event not found."}, status=status.HTTP_404_NOT_FOUND)

        event_codes = [e.event_code for e in events]
        metrics_map = bulk_event_metrics(event_codes)
        current     = events[0]  # newest first

        # Build per-edition list (ascending for growth calc, then reverse for UI)
        editions_asc = list(reversed(events))
        edition_rows = []
        prev_revenue: float = None

        for event in editions_asc:
            m          = metrics_map.get(event.event_code, {})
            health     = compute_health(m.get("paid_count", 0), event.capacity)
            rev        = m.get("total_revenue", 0) or 0
            growth_pct = None
            if prev_revenue is not None and prev_revenue > 0:
                growth_pct = round((rev - prev_revenue) / prev_revenue * 100, 1)

            edition_rows.append({
                "event_code": event.event_code,
                "event_name": event.name,
                "year":       event.event_date.year if event.event_date else None,
                "city":       event.city or "",
                "event_date": event.event_date.isoformat() if event.event_date else None,
                "status":     event.status,
                "sub_company": event.sub_company or "",
                "is_current": event.event_code == current.event_code,
                **m,
                "benchmark":  health["benchmark"],
                "health":     health["health"],
                "health_color": health["color"],
                "growth_pct": growth_pct,
            })
            prev_revenue = rev

        editions_desc = list(reversed(edition_rows))  # newest first for UI

        # Growth timeline (ascending for chart readability)
        growth_timeline = [
            {
                "year":          ed["year"],
                "paid_count":    ed.get("paid_count", 0),
                "total_revenue": ed.get("total_revenue", 0),
                "growth_pct":    ed["growth_pct"],
                "is_current":    ed["is_current"],
            }
            for ed in edition_rows
        ]

        # Generate intelligence insights
        insight_engine = EventPerformanceInsightEngine()
        insights       = insight_engine.generate(events, metrics_map)

        # Operational records — across all event codes in the master group
        follow_ups = FollowUpRecord.objects.filter(event_code__in=event_codes).order_by("-follow_up_date")
        mailshots  = MailshotRecord.objects.filter(event_code__in=event_codes).order_by("-sent_at")
        notes      = EventPerformanceNote.objects.filter(event_code__in=event_codes).order_by("-created_at")
        reps       = reps_performance(event_codes)

        return Response({
            "master_code":      pk,
            "total_editions":   len(events),
            "current_event_code": current.event_code,
            "editions":         editions_desc,
            "growth_timeline":  growth_timeline,
            "insights":         insights,
            "follow_ups":       FollowUpSerializer(follow_ups, many=True).data,
            "mailshots":        MailshotSerializer(mailshots, many=True).data,
            "notes":            EventPerformanceNoteSerializer(notes, many=True).data,
            "reps":             reps,
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
