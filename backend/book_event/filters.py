import django_filters
from .models import BookEvent

class BookEventFilter(django_filters.FilterSet):
    event_code        = django_filters.CharFilter(lookup_expr="icontains")
    payment_status    = django_filters.ChoiceFilter(choices=BookEvent.PaymentStatus.choices)
    company_name      = django_filters.CharFilter(lookup_expr="icontains")
    sales_executive   = django_filters.NumberFilter(field_name="sales_executive__id")
    event_date_from   = django_filters.DateFilter(field_name="event_date", lookup_expr="gte")
    event_date_to     = django_filters.DateFilter(field_name="event_date", lookup_expr="lte")

    class Meta:
        model  = BookEvent
        fields = [
            "event_code", "payment_status", "company_name",
            "sales_executive", "event_date_from", "event_date_to",
        ]
