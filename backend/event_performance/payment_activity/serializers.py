from rest_framework import serializers


class EventPaymentActivitySerializer(serializers.Serializer):
    """Per-event row for the Payment Activity table."""
    event_code         = serializers.CharField()
    event_name         = serializers.CharField()
    event_date         = serializers.DateField(allow_null=True)
    status             = serializers.CharField()
    sub_company        = serializers.CharField()
    city               = serializers.CharField()
    sales_rep          = serializers.CharField()

    total_paid         = serializers.IntegerField()
    paid_7d            = serializers.IntegerField()
    paid_15d           = serializers.IntegerField()
    paid_30d           = serializers.IntegerField()
    prev_7d            = serializers.IntegerField()

    last_payment_date  = serializers.DateField(allow_null=True)
    last_booking_date  = serializers.DateField(allow_null=True)

    trend              = serializers.CharField()
    trend_color        = serializers.CharField()
    activity_color     = serializers.CharField()


class PaidBookingSerializer(serializers.Serializer):
    """Invoice-level row for the Payment Activity drawer."""
    invoice_number  = serializers.CharField()
    company_name    = serializers.CharField()
    contact_name    = serializers.CharField()
    contact_email   = serializers.CharField()
    payment_type    = serializers.CharField()
    payment_status  = serializers.CharField()
    payment_date    = serializers.DateField(allow_null=True)
    total_amount    = serializers.FloatField(allow_null=True)
    currency        = serializers.CharField()
    delegate_count  = serializers.IntegerField()
    created_at      = serializers.DateTimeField()
    sales_rep       = serializers.CharField()
