import django_filters
from django.utils import timezone
from django.db.models import Q
from .models import Event

class EventFilter(django_filters.FilterSet):
    status          = django_filters.CharFilter(method='filter_status')
    sub_company     = django_filters.CharFilter(lookup_expr="iexact")
    event_date_from = django_filters.DateFilter(field_name="event_date", lookup_expr="gte")
    event_date_to   = django_filters.DateFilter(field_name="event_date", lookup_expr="lte")
    city            = django_filters.CharFilter(lookup_expr="icontains")
    event_code      = django_filters.CharFilter(lookup_expr="icontains")
    year            = django_filters.NumberFilter(field_name="event_date", lookup_expr="year")

    class Meta:
        model  = Event
        fields = ["status", "sub_company", "event_date_from", "event_date_to", "city", "event_code", "year"]

    def filter_status(self, queryset, name, value):
        today = timezone.now().date()
        if value.lower() == "completed":
            return queryset.filter(event_date__lt=today)
        elif value.lower() == "live":
            return queryset.filter(Q(event_date__gte=today) | Q(event_date__isnull=True))
        return queryset
