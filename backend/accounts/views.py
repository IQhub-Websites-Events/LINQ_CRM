"""
accounts/views.py
──────────────────
User management — admin only.
"""
from django.contrib.auth import get_user_model
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .permissions import IsAdminRole
from .serializers import UserListSerializer, UserWriteSerializer, AssignEventsSerializer

from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token

class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data,
                                           context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'email': user.email,
            'role': user.role
        })

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """Admin-only CRUD + event assignment actions."""
    permission_classes = [IsAdminRole]
    queryset = User.objects.prefetch_related("assigned_events").order_by("-date_joined")
    filterset_fields = ["role", "status", "team"]
    search_fields = ["username", "first_name", "last_name", "email"]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return UserWriteSerializer
        return UserListSerializer

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user == request.user:
            return Response({"detail": "You cannot delete your own admin account."}, status=400)
        
        # Check if last admin
        if user.role == User.Role.ADMIN and User.objects.filter(role=User.Role.ADMIN).count() <= 1:
            return Response({"detail": "Cannot delete the last administrator."}, status=400)
            
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="assign_events")
    def assign_events(self, request, pk=None):
        """Replace all event assignments for this user."""
        user = self.get_object()
        ser = AssignEventsSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        from events.models import Event
        events = Event.objects.filter(id__in=ser.validated_data["event_ids"])
        user.assigned_events.set(events)
        return Response({
            "user": user.username,
            "assigned_events": list(events.values("id", "event_code", "name")),
        })

    @action(detail=True, methods=["post"], url_path="add_event")
    def add_event(self, request, pk=None):
        """Add a single event to this user's assignments."""
        user = self.get_object()
        from events.models import Event
        try:
            event = Event.objects.get(id=request.data.get("event_id"))
        except Event.DoesNotExist:
            return Response({"detail": "Event not found."}, status=404)
        user.assigned_events.add(event)
        return Response({"user": user.username, "added": event.event_code})

    @action(detail=True, methods=["post"], url_path="remove_event")
    def remove_event(self, request, pk=None):
        """Remove a single event from this user's assignments."""
        user = self.get_object()
        from events.models import Event
        try:
            event = Event.objects.get(id=request.data.get("event_id"))
        except Event.DoesNotExist:
            return Response({"detail": "Event not found."}, status=404)
        user.assigned_events.remove(event)
        return Response({"user": user.username, "removed": event.event_code})

    @action(detail=True, methods=["get"])
    def logs(self, request, pk=None):
        """GET /api/users/{id}/logs/ — fetch action logs for the user."""
        user = self.get_object()
        from .models import ActionLog
        logs = ActionLog.objects.filter(user=user)[:50]
        return Response([
            {
                "id": log.id,
                "action": log.action,
                "details": log.details,
                "created_at": log.created_at
            } for log in logs
        ])

    @action(detail=True, methods=["get"])
    def events_stats(self, request, pk=None):
        """GET /api/users/{id}/events_stats/ — fetch events assigned and their expected/current revenue."""
        user = self.get_object()
        codes = user.assigned_event_codes()
        if not codes:
            return Response([])

        from events.models import Event
        events = Event.objects.filter(event_code__in=codes)

        stats = []
        for e in events:
            rev = 0
            stats.append({
                "event_code": e.event_code,
                "name": e.name,
                "expected_revenue": float(e.expected_revenue),
                "current_revenue": float(rev),
                "event_status": e.event_status
            })

        return Response(stats)

    @action(detail=True, methods=["patch"], url_path="move-team")
    def move_team(self, request, pk=None):
        """PATCH /api/users/{id}/move-team/ — Move user to a new team."""
        user = self.get_object()
        team_id = request.data.get("team_id")
        if team_id is None:
             user.team = None
             user.save()
             return Response({"user": user.username, "team": None})
        
        from teams.models import Team
        try:
            team = Team.objects.get(id=team_id)
        except Team.DoesNotExist:
            return Response({"detail": "Team not found."}, status=404)
        
        user.team = team
        user.save()
        return Response({
            "user": user.username,
            "team": team.name,
            "team_id": team.id
        })

    @action(detail=True, methods=["patch"], url_path="toggle-status")
    def toggle_status(self, request, pk=None):
        """PATCH /api/users/{id}/toggle-status/ — Toggle status."""
        user = self.get_object()
        if user == request.user:
            return Response({"detail": "You cannot deactivate your own account."}, status=400)
            
        new_status = request.data.get("status")
        if new_status not in User.Status.values:
            return Response({"detail": f"Invalid status. Choose from {User.Status.values}"}, status=400)
            
        user.status = new_status
        user.save()
        return Response({"user": user.username, "status": user.status})

    @action(detail=True, methods=["patch"], url_path="reset-password")
    def reset_password(self, request, pk=None):
        """PATCH /api/users/{id}/reset-password/ — Reset user password."""
        user = self.get_object()
        password = request.data.get("password")
        confirm = request.data.get("confirm_password")
        
        if not password:
            return Response({"detail": "Password is required."}, status=400)
        if password != confirm:
            return Response({"detail": "Passwords do not match."}, status=400)
            
        user.set_password(password)
        user.save()
        return Response({"detail": "Password reset successfully."})


class TeamViewSet(viewsets.ViewSet):
    """Admin-only aggregated view of sales team performance."""
    permission_classes = [IsAdminRole]

    def list(self, request):
        from django.db.models import Sum, DecimalField
        from django.db.models.functions import Coalesce
        from decimal import Decimal
        from book_event.models import BookEvent

        users = list(User.objects.filter(role=User.Role.SALES).prefetch_related(
            "assigned_events", "assigned_events_list"
        ).order_by("username"))

        # Build a mapping from event_code to total revenue
        # since a BookEvent might not have sales_executive populated
        all_event_codes = set()
        for u in users:
            all_event_codes.update(u.assigned_event_codes())
        
        event_sales_map = {}

        data = []
        for u in users:
            codes = u.assigned_event_codes()
            u_sales = sum(event_sales_map.get(c, 0.0) for c in codes)
            data.append({
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "total_events": len(codes),
                "total_sales": u_sales
            })
        
        return Response(data)

    def retrieve(self, request, pk=None):
        from django.shortcuts import get_object_or_404
        from django.db.models import Count, Sum, Q, DecimalField
        from django.db.models.functions import Coalesce
        from decimal import Decimal
        from events.models import Event
        from book_event.models import BookEvent

        user = get_object_or_404(User, pk=pk)
        
        events = list(Event.objects.filter(
            Q(assigned_users=user) | Q(sales_executive=user)
        ).distinct())

        event_codes = [e.event_code for e in events]
        
        aggregates = BookEvent.objects.filter(
            event_code__in=event_codes
        ).values("event_code").annotate(
            total_invoices=Count("id"),
            paid_invoices=Count("id", filter=Q(payment_status="Paid")),
            pending_invoices=Count("id", filter=~Q(payment_status="Paid"))
        )

        agg_map = { a["event_code"]: a for a in aggregates }

        event_data = []
        for e in events:
            agg = agg_map.get(e.event_code, {})
            event_data.append({
                "event_id": e.id,
                "event_name": e.name,
                "event_code": e.event_code,
                "event_status": e.event_status,
                "total_invoices": agg.get("total_invoices", 0),
                "paid_invoices": agg.get("paid_invoices", 0),
                "pending_invoices": agg.get("pending_invoices", 0)
            })

        return Response({
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": user.role
            },
            "events": event_data
        })

