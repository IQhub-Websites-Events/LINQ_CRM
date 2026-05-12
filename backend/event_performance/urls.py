from rest_framework.routers import DefaultRouter

from .views import EventPerformanceViewSet
from .payment_activity.views import PaymentActivityViewSet

# Main event-performance router
router = DefaultRouter()
router.register(r"", EventPerformanceViewSet, basename="event-performance")

# Payment-activity sub-router (mounted at payment-activity/)
pa_router = DefaultRouter()
pa_router.register(r"payment-activity", PaymentActivityViewSet, basename="payment-activity")

urlpatterns = router.urls + pa_router.urls
