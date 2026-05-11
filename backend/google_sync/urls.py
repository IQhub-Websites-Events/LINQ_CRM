from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    GoogleSyncLogViewSet,
    GoogleSyncStatusView,
    GoogleSyncRunView,
    GoogleSyncRetryView,
)

router = DefaultRouter()
router.register(r"logs", GoogleSyncLogViewSet, basename="google-sync-logs")

urlpatterns = [
    path("",              include(router.urls)),
    path("status/",       GoogleSyncStatusView.as_view(), name="google-sync-status"),
    path("run/",          GoogleSyncRunView.as_view(),    name="google-sync-run"),
    path("retry/<int:pk>/", GoogleSyncRetryView.as_view(), name="google-sync-retry"),
]
