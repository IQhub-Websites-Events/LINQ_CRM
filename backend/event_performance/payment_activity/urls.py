from rest_framework.routers import DefaultRouter
from .views import PaymentActivityViewSet

router = DefaultRouter()
router.register(r"", PaymentActivityViewSet, basename="payment-activity")

urlpatterns = router.urls
