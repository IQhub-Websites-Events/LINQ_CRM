from rest_framework.routers import DefaultRouter
from .views import EventPerformanceViewSet

router = DefaultRouter()
router.register(r"", EventPerformanceViewSet, basename="event-performance")

urlpatterns = router.urls
