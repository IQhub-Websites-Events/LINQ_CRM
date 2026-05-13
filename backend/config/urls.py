"""
Linq CRM — Root URL configuration
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from rest_framework.routers import DefaultRouter

from accounts.views import UserViewSet, CustomAuthToken, TeamViewSet
from companies.views import CompanyViewSet
from events.views import EventViewSet
from book_event.views import BookEventViewSet
from book_delegate.views import BookDelegateViewSet
from teams.views import TeamViewSet as TeamManagementViewSet
from config.views import GlobalSearchView, DashboardStatsView

router = DefaultRouter()
router.register(r"users",     UserViewSet,         basename="users")
router.register(r"team",      TeamViewSet,         basename="team")
router.register(r"teams",     TeamManagementViewSet, basename="teams")
router.register(r"companies", CompanyViewSet,      basename="companies")
router.register(r"events",    EventViewSet,        basename="events")
router.register(r"invoices",  BookEventViewSet,    basename="invoices")
router.register(r"delegates", BookDelegateViewSet, basename="delegates")

urlpatterns = [
    path("admin/",               admin.site.urls),
    path("api/",                 include(router.urls)),
    path("api/webhooks/",        include("webhooks.urls")),
    path("api/google-sync/",     include("google_sync.urls")),
    path("api/reports/",         include("reports.urls")),
    path("api/event-performance/", include("event_performance.urls")),
    path("api/historical-events/", include("historical_event_registry.urls")),
    path("api/search/",          GlobalSearchView.as_view(),    name="global-search"),
    path("api/stats/dashboard/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("api/auth/token/",      CustomAuthToken.as_view(), name="api-token"),
    path("api-auth/",            include("rest_framework.urls")),
    # Serve React frontend for all non-API routes
    re_path(r"^(?!api/|admin/|api-auth/|static/).*$",
            TemplateView.as_view(template_name="index.html"),
            name="react-frontend"),
]
