from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WebhookIngestionView, WebhookLogViewSet, WebhookApiKeyViewSet

router = DefaultRouter()
router.register(r"logs",  WebhookLogViewSet,    basename="webhook-logs")
router.register(r"keys",  WebhookApiKeyViewSet, basename="webhook-keys")

urlpatterns = [
    path("ingest/",   WebhookIngestionView.as_view(), name="webhook-ingest"),
    path("bookings/", WebhookIngestionView.as_view(), name="webhook-ingest-legacy"),
    path("",          include(router.urls)),
]
