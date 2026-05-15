"""
config/views.py
────────────────
Global search + dashboard stats — RBAC-scoped per user role.
"""
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from book_delegate.models import BookDelegate
from book_delegate.serializers import BookDelegateListSerializer
from book_event.models import BookEvent
from book_event.serializers import BookEventListSerializer
from companies.models import Company
from companies.serializers import CompanySerializer
from events.models import Event
from events.serializers import EventListSerializer


def _event_codes(user):
    """None = unrestricted (admin). List = allowed codes (sales)."""
    if user.is_admin:
        return None
    return user.assigned_event_codes() or []


class GlobalSearchView(APIView):
    """
    GET /api/search/?q=<term>[&type=all|invoice|delegate|event|company][&limit=20]

    Searches across all modules. Results are RBAC-scoped for sales users.
    Company search is admin-only.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        search_type = request.query_params.get("type", "all")
        limit = min(int(request.query_params.get("limit", 20)), 100)

        if not q or len(q) < 2:
            return Response({"detail": "Query must be at least 2 characters."}, status=400)

        codes = _event_codes(request.user)
        results = {}

        if search_type in ("all", "invoice"):
            qs = BookEvent.objects.filter(
                Q(invoice_number__icontains=q)
                | Q(event_code__icontains=q)
                | Q(contact_name__icontains=q)
                | Q(contact_email__icontains=q)
                | Q(company_name__icontains=q)
            )
            if codes is not None:
                qs = qs.filter(event_code__in=codes)
            items = list(qs[:limit])
            results["invoices"] = {
                "count": len(items),
                "items": BookEventListSerializer(items, many=True).data,
            }

        if search_type in ("all", "delegate"):
            qs = BookDelegate.objects.select_related("invoice", "company").filter(
                Q(first_name__icontains=q)
                | Q(last_name__icontains=q)
                | Q(email__icontains=q)
                | Q(invoice__invoice_number__icontains=q)
                | Q(company__name__icontains=q)
            )
            if codes is not None:
                qs = qs.filter(event_code__in=codes)
            items = list(qs[:limit])
            results["delegates"] = {
                "count": len(items),
                "items": BookDelegateListSerializer(items, many=True).data,
            }

        if search_type in ("all", "event"):
            qs = Event.objects.filter(
                Q(event_code__icontains=q) | Q(name__icontains=q) | Q(city__icontains=q)
            )
            if codes is not None:
                qs = qs.filter(event_code__in=codes)
            items = list(qs[:limit])
            results["events"] = {
                "count": len(items),
                "items": EventListSerializer(items, many=True).data,
            }

        if search_type in ("all", "company") and request.user.is_admin:
            qs = Company.objects.filter(
                Q(name__icontains=q) | Q(city__icontains=q) | Q(country__icontains=q)
            )[:limit]
            results["companies"] = {
                "count": len(qs),
                "items": CompanySerializer(qs, many=True).data,
            }

        total = sum(v.get("count", 0) for v in results.values())
        return Response({"query": q, "total": total, "results": results})


class DashboardStatsView(APIView):
    """
    GET /api/stats/dashboard/

    Revenue and volume stats. RBAC-scoped for sales users.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        codes = _event_codes(request.user)

        inv_qs = BookEvent.objects.all()
        del_qs = BookDelegate.objects.all()
        ev_qs  = Event.objects.all()

        if codes is not None:
            inv_qs = inv_qs.filter(event_code__in=codes)
            del_qs = del_qs.filter(event_code__in=codes)
            ev_qs  = ev_qs.filter(event_code__in=codes)

        inv_stats = inv_qs.aggregate(
            total=Count("id"),
            paid=Count("id", filter=Q(payment_status="Paid")),
            pending=Count("id", filter=Q(payment_status="Pending")),
            cancelled=Count("id", filter=Q(payment_status="Cancelled")),
            revenue_paid=Coalesce(Sum("total_amount", filter=Q(payment_status="Paid")), Decimal("0")),
            revenue_pending=Coalesce(Sum("total_amount", filter=Q(payment_status="Pending")), Decimal("0")),
        )

        from django.utils import timezone
        today = timezone.now().date()

        ev_stats = ev_qs.aggregate(
            total=Count("id"),
            live=Count("id", filter=Q(event_date__gte=today)),
            upcoming=Count("id", filter=Q(event_date__lt=today)), # Misnamed in frontend but keeping for compat
        )

        top_events = (
            inv_qs.filter(payment_status="Paid")
            .values("event_code")
            .annotate(bookings=Count("id"))
            .order_by("-bookings")[:5]
        )

        return Response({
            "events": ev_stats,
            "invoices": {
                **inv_stats,
            },
            "delegates": {"total": del_qs.count()},
            "companies": Company.objects.count() if request.user.is_admin else None,
            "top_events_by_revenue": [
                {
                    "event_code": e["event_code"],
                    "bookings":  e["bookings"],
                }
                for e in top_events
            ],
        })
