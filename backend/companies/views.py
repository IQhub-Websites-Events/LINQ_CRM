from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsSalesOrAdmin, IsAdminRole
from .models import Company
from .serializers import CompanySerializer
from .filters import CompanyFilter


class CompanyViewSet(viewsets.ModelViewSet):
    """All authenticated users can read; admin-only write."""
    serializer_class = CompanySerializer
    filterset_class  = CompanyFilter
    search_fields    = ["name", "city", "country", "website"]
    ordering_fields  = ["name", "city", "country", "created_at"]
    ordering         = ["name"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsAdminRole()]
        return [IsSalesOrAdmin()]

    def get_queryset(self):
        return Company.objects.annotate(_delegate_count=Count("delegates", distinct=True))

    @action(detail=True, methods=["get"])
    def delegates(self, request, pk=None):
        """GET /api/companies/{id}/delegates/ — all delegates for this company."""
        company = self.get_object()
        from book_delegate.models import BookDelegate
        from book_delegate.serializers import BookDelegateListSerializer
        qs = BookDelegate.objects.filter(company=company).select_related("invoice", "company")
        return Response(BookDelegateListSerializer(qs, many=True).data)
