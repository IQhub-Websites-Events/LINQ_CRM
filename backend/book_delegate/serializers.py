from rest_framework import serializers
from .models import BookDelegate
from companies.serializers import CompanyMiniSerializer


class BookDelegateInlineSerializer(serializers.ModelSerializer):
    full_name       = serializers.ReadOnlyField()
    payment_status  = serializers.CharField(source="invoice.payment_status", read_only=True)
    company_display = serializers.ReadOnlyField()

    class Meta:
        model  = BookDelegate
        fields = [
            "id", "first_name", "last_name", "full_name",
            "email", "phone_number", "position",
            "company_display", "attendance", "payment_status",
            "dietary_requirements",
        ]


class BookDelegateListSerializer(serializers.ModelSerializer):
    full_name       = serializers.ReadOnlyField()
    payment_status  = serializers.CharField(source="invoice.payment_status", read_only=True)
    payment_date    = serializers.DateField(source="invoice.payment_date",   read_only=True)
    invoice_number  = serializers.CharField(source="invoice.invoice_number", read_only=True)
    book_event_id   = serializers.IntegerField(source="invoice.id", read_only=True)
    invoice_date    = serializers.DateField(source="invoice.invoice_date", read_only=True)
    booking_code    = serializers.CharField(source="invoice.booking_code", read_only=True)

    currency        = serializers.CharField(source="invoice.currency", read_only=True)
    delegate_count  = serializers.IntegerField(source="invoice.delegate_count", read_only=True)
    paid_free       = serializers.CharField(source="invoice.paid_free", read_only=True)
    add_ons         = serializers.CharField(source="invoice.add_ons", read_only=True)
    reference       = serializers.CharField(source="invoice.reference", read_only=True)
    event_name      = serializers.CharField(source="invoice.event_name", read_only=True)
    accounts_contact_email = serializers.EmailField(source="invoice.accounts_contact_email", read_only=True)
    sales_executive_name = serializers.SerializerMethodField()
    company_display = serializers.ReadOnlyField()

    class Meta:
        model  = BookDelegate
        fields = [
            "id", "book_event_id", "invoice_number", "event_code", "booking_code",
            "invoice_date", "first_name", "last_name", "full_name",
            "email", "phone_number", "position", "delegate_number",
            "company_display", "attendance", "payment_status", "payment_date",
            "currency", "delegate_count", "sales_executive_name",
            "paid_free", "add_ons", "reference", "event_name", "accounts_contact_email",
            "created_at", "updated_at",
        ]

    def get_sales_executive_name(self, obj):
        if obj.invoice.sales_executive_id:
            u = obj.invoice.sales_executive
            return u.get_full_name() or u.username
        return None


class BookDelegateDetailSerializer(serializers.ModelSerializer):
    full_name       = serializers.ReadOnlyField()
    payment_status  = serializers.CharField(source="invoice.payment_status", read_only=True)
    payment_date    = serializers.DateField(source="invoice.payment_date",   read_only=True)
    invoice_number  = serializers.CharField(source="invoice.invoice_number", read_only=True)
    company_display = serializers.ReadOnlyField()
    company_detail  = CompanyMiniSerializer(source="company", read_only=True)
    event_name      = serializers.SerializerMethodField()

    class Meta:
        model  = BookDelegate
        fields = [
            "id", "invoice_number", "event_code", "event_name",
            "first_name", "last_name", "full_name",
            "email", "phone_number", "position",
            "company", "company_detail", "company_name_raw", "company_display",
            "attendance", "payment_status", "payment_date",
            "dietary_requirements", "notes",
            "created_at", "updated_at",
        ]

    def get_event_name(self, obj):
        from events.models import Event
        try:
            return Event.objects.get(event_code=obj.event_code).name
        except Event.DoesNotExist:
            return ""


class BookDelegateWriteSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(write_only=True)

    class Meta:
        model  = BookDelegate
        fields = [
            "invoice_number", "event_code",
            "first_name", "last_name", "email", "phone_number", "position",
            "company", "attendance", "dietary_requirements", "notes",
        ]

    def validate_invoice_number(self, value):
        from book_event.models import BookEvent
        try:
            self._invoice = BookEvent.objects.get(invoice_number=value)
        except BookEvent.DoesNotExist:
            raise serializers.ValidationError(f"Invoice '{value}' not found.")
        return value

    def create(self, validated_data):
        invoice_number = validated_data.pop("invoice_number")
        invoice = getattr(self, "_invoice", None)
        if not invoice:
            from book_event.models import BookEvent
            invoice = BookEvent.objects.get(invoice_number=invoice_number)
        validated_data["invoice"]    = invoice
        validated_data["event_code"] = validated_data.get("event_code") or invoice.event_code
        return BookDelegate.objects.create(**validated_data)

    def update(self, instance, validated_data):
        validated_data.pop("invoice_number", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
