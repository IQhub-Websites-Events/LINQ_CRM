import django_filters
from .models import BookDelegate

class BookDelegateFilter(django_filters.FilterSet):
    event_code     = django_filters.CharFilter(lookup_expr="iexact")
    invoice_number = django_filters.CharFilter(field_name="invoice__invoice_number", lookup_expr="iexact")
    payment_status = django_filters.CharFilter(field_name="invoice__payment_status", lookup_expr="iexact")
    attendance     = django_filters.ChoiceFilter(choices=BookDelegate.Attendance.choices)
    company        = django_filters.NumberFilter(field_name="company__id")
    country        = django_filters.CharFilter(field_name="company__country", lookup_expr="icontains")

    class Meta:
        model  = BookDelegate
        fields = ["event_code", "invoice_number", "payment_status", "attendance", "company", "country"]
