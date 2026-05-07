from rest_framework import viewsets
from .models import Team
from .serializers import TeamSerializer
from accounts.permissions import IsAdminRole

class TeamViewSet(viewsets.ModelViewSet):
    queryset = Team.objects.all().order_by('name')
    serializer_class = TeamSerializer
    permission_classes = [IsAdminRole]

    def get_queryset(self):
        # Allow read-only for all authenticated users, but CRUD only for admins
        # Wait, the prompt says ONLY admins can create/delete/move.
        # Sales users: read-only access.
        return super().get_queryset()

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            from rest_framework.permissions import IsAuthenticated
            return [IsAuthenticated()]
        return [IsAdminRole()]
