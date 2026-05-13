from django.urls import path
from .views import HistoricalEventReferenceListView

urlpatterns = [
    path("", HistoricalEventReferenceListView.as_view(), name="historical-events-list"),
]
