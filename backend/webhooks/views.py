"""
webhooks/views.py
──────────────────
POST /api/webhooks/ingest/          — live booking ingestion  (X-CRM-API-KEY or X-WEBHOOK-SECRET)
GET  /api/webhooks/logs/            — paginated log list       (admin only)
GET  /api/webhooks/logs/{id}/       — full log detail          (admin only)
POST /api/webhooks/logs/{id}/retry/ — re-process a failed log  (admin only)
GET  /api/webhooks/keys/            — list API keys            (admin only)
POST /api/webhooks/keys/            — create API key           (admin only)
PATCH/DELETE /api/webhooks/keys/{id}/         — update / delete
POST /api/webhooks/keys/{id}/regenerate/      — regenerate secret
"""
import logging
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdminRole
from .models import WebhookApiKey, WebhookLog
from .serializers import (
    WebhookApiKeySerializer, WebhookApiKeyCreateSerializer,
    WebhookLogSerializer, WebhookLogListSerializer,
)
from .services import WebhookProcessor
from .utils import authenticate_request, extract_ip, safe_headers, unwrap_payload

logger = logging.getLogger(__name__)


# ── Ingestion ─────────────────────────────────────────────────────────────────

class WebhookIngestionView(APIView):
    """
    POST /api/webhooks/ingest/
    Accepts X-CRM-API-KEY (DB-backed) or X-WEBHOOK-SECRET (legacy static).
    """
    authentication_classes = []
    permission_classes     = [AllowAny]

    def post(self, request):
        try:
            recv_at = timezone.now()
            ip      = extract_ip(request)
            hdrs    = safe_headers(request.META)

            api_key_obj, auth_err = authenticate_request(request)

            if auth_err:
                WebhookLog.objects.create(
                    ip_address=ip, payload=request.data, headers=hdrs,
                    response={"error": auth_err},
                    status=WebhookLog.Status.FAILED,
                    http_status=401,
                    error_message=auth_err,
                    processing_status=WebhookLog.ProcessingStatus.ERROR,
                    received_at=recv_at,
                )
                return Response({"success": False, "error": auth_err}, status=status.HTTP_401_UNAUTHORIZED)

            raw_payload    = request.data if isinstance(request.data, dict) else {}
            payload        = unwrap_payload(raw_payload)
            invoice_number = payload.get("InvoiceNumber", "")
            event_code     = payload.get("Eventcode", "")
            event_name     = payload.get("Eventname", "")
            source         = (
                request.META.get("HTTP_X_WEBHOOK_SOURCE", "")
                or (api_key_obj.name if api_key_obj else "legacy-secret")
            )

            log = WebhookLog.objects.create(
                api_key=api_key_obj,
                source=source,
                ip_address=ip,
                request_method="POST",
                payload=request.data,
                headers=hdrs,
                response={},
                status=WebhookLog.Status.RECEIVED,
                http_status=202,
                invoice_number=invoice_number,
                event_code=event_code,
                event_name=event_name,
                processing_status=WebhookLog.ProcessingStatus.PENDING,
                received_at=recv_at,
            )

            processor       = WebhookProcessor(log)
            success, result = processor.process()

            log.refresh_from_db()
            resp_body = {"success": success, "log_id": log.id, **result}
            log.response = resp_body
            log.save(update_fields=["response"])

            if success:
                resp_status = status.HTTP_201_CREATED if result.get("db_action") == "inserted" else status.HTTP_200_OK
            elif log.status == WebhookLog.Status.DUPLICATE:
                resp_status = status.HTTP_409_CONFLICT
            elif log.http_status == 400:
                resp_status = status.HTTP_400_BAD_REQUEST
            else:
                resp_status = status.HTTP_500_INTERNAL_SERVER_ERROR

            return Response(resp_body, status=resp_status)
        except Exception as e:
            logger.exception("CRITICAL Webhook Ingestion Failure")
            return Response({
                "success": False, 
                "error": "Internal Server Error",
                "detail": str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ── Webhook Logs ──────────────────────────────────────────────────────────────

class WebhookLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdminRole]

    def get_serializer_class(self):
        return WebhookLogSerializer if self.action == "retrieve" else WebhookLogListSerializer

    def get_queryset(self):
        qs = WebhookLog.objects.select_related("created_booking", "api_key")

        if st := self.request.query_params.get("status"):
            qs = qs.filter(status=st)
        if ps := self.request.query_params.get("processing_status"):
            qs = qs.filter(processing_status=ps)
        if ds := self.request.query_params.get("db_insert_status"):
            qs = qs.filter(db_insert_status=ds)
        if ev := self.request.query_params.get("event_code"):
            qs = qs.filter(event_code=ev)
        if ak := self.request.query_params.get("api_key"):
            qs = qs.filter(api_key_id=ak)

        if search := self.request.query_params.get("search", "").strip():
            qs = qs.filter(
                Q(invoice_number__icontains=search) |
                Q(event_code__icontains=search)     |
                Q(source__icontains=search)         |
                Q(ip_address__icontains=search)
            )

        return qs

    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        """POST /api/webhooks/logs/{id}/retry/"""
        original = self.get_object()

        if original.status == WebhookLog.Status.SUCCESS:
            return Response(
                {"error": "Cannot retry a successful webhook."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        retry_log = WebhookLog.objects.create(
            api_key=original.api_key,
            source=original.source,
            ip_address=original.ip_address,
            request_method=original.request_method,
            payload=original.payload,
            headers=original.headers,
            response={},
            status=WebhookLog.Status.RECEIVED,
            http_status=202,
            invoice_number=original.invoice_number,
            event_code=original.event_code,
            event_name=original.event_name,
            retry_count=original.retry_count + 1,
            processing_status=WebhookLog.ProcessingStatus.PENDING,
            received_at=timezone.now(),
        )

        original.retry_count += 1
        original.save(update_fields=["retry_count"])

        processor       = WebhookProcessor(retry_log)
        success, result = processor.process()

        retry_log.refresh_from_db()
        resp_body          = {"success": success, "log_id": retry_log.id, **result}
        retry_log.response = resp_body
        retry_log.save(update_fields=["response"])

        resp_status = status.HTTP_200_OK if success else status.HTTP_422_UNPROCESSABLE_ENTITY
        return Response({"success": success, "retry_log_id": retry_log.id, **result}, status=resp_status)


# ── API Key Management ────────────────────────────────────────────────────────

class WebhookApiKeyViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminRole]
    queryset = WebhookApiKey.objects.select_related("created_by").all()

    def get_serializer_class(self):
        if self.action == "create":
            return WebhookApiKeyCreateSerializer
        return WebhookApiKeySerializer

    def get_queryset(self):
        qs = WebhookApiKey.objects.select_related("created_by")
        if active := self.request.query_params.get("is_active"):
            qs = qs.filter(is_active=active.lower() == "true")
        if search := self.request.query_params.get("search", "").strip():
            qs = qs.filter(Q(name__icontains=search) | Q(event__icontains=search))
        return qs

    @action(detail=True, methods=["post"])
    def regenerate(self, request, pk=None):
        """POST /api/webhooks/keys/{id}/regenerate/ — issue a new key string."""
        api_key = self.get_object()
        new_key = api_key.regenerate()
        return Response({"api_key": new_key, "id": api_key.id})

    @action(detail=True, methods=["post"])
    def toggle(self, request, pk=None):
        """POST /api/webhooks/keys/{id}/toggle/ — flip is_active."""
        api_key          = self.get_object()
        api_key.is_active = not api_key.is_active
        api_key.save(update_fields=["is_active"])
        return Response({"id": api_key.id, "is_active": api_key.is_active})
