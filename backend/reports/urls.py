from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    GoogleSheetSourceViewSet,
    ReportDefinitionViewSet,
    ReportRowViewSet,
    ReportSyncLogViewSet,
    ReportDocsListView,
    ReportDocDetailView,
)

router = DefaultRouter()
router.register(r"sources",     GoogleSheetSourceViewSet, basename="report-sources")
router.register(r"definitions", ReportDefinitionViewSet,  basename="report-definitions")
router.register(r"rows",        ReportRowViewSet,         basename="report-rows")
router.register(r"sync-logs",   ReportSyncLogViewSet,     basename="report-sync-logs")

urlpatterns = [
    path("",              include(router.urls)),
    path("docs/",         ReportDocsListView.as_view(),          name="report-docs-list"),
    path("docs/<str:filename>/", ReportDocDetailView.as_view(),  name="report-doc-detail"),
]
