from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from accounts.permissions import IsSalesOrAdmin
from .models import HistoricalEventReference
from .serializers import HistoricalEventReferenceSerializer


class HistoricalEventReferenceListView(APIView):
    permission_classes = [IsSalesOrAdmin]

    def get(self, request):
        qs = HistoricalEventReference.objects.select_related("event").all()

        event_id = request.query_params.get("event_id")
        if event_id:
            qs = qs.filter(event__id=event_id)

        event_code = request.query_params.get("event_code")
        if event_code:
            qs = qs.filter(normalized_event_code=event_code.strip().upper())

        serializer = HistoricalEventReferenceSerializer(qs, many=True)
        return Response({"count": qs.count(), "results": serializer.data})
