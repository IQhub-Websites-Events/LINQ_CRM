import django_filters
from django.db.models import Q
from .models import BookDelegate

class BookDelegateFilter(django_filters.FilterSet):
    event_code     = django_filters.CharFilter(lookup_expr="iexact")
    invoice_number = django_filters.CharFilter(field_name="invoice__invoice_number", lookup_expr="iexact")
    payment_status = django_filters.CharFilter(method="filter_payment_status")
    attendance     = django_filters.ChoiceFilter(choices=BookDelegate.Attendance.choices)
    company        = django_filters.NumberFilter(field_name="company__id")
    country        = django_filters.CharFilter(field_name="company__country", lookup_expr="icontains")

    def filter_payment_status(self, queryset, name, value):
        # Match delegates where their own override equals the filter value,
        # OR where they have no override and the invoice status equals the filter value.
        return queryset.filter(
            Q(delegate_payment_status__iexact=value) |
            Q(delegate_payment_status__isnull=True, invoice__payment_status__iexact=value) |
            Q(delegate_payment_status="", invoice__payment_status__iexact=value)
        )

    class Meta:
        model  = BookDelegate
        fields = ["event_code", "invoice_number", "payment_status", "attendance", "company", "country"]
