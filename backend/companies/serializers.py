from rest_framework import serializers
from .models import Company


class CompanySerializer(serializers.ModelSerializer):
    delegate_count = serializers.SerializerMethodField()

    class Meta:
        model  = Company
        fields = [
            "id", "name", "address", "city", "state", "country",
            "postal_code", "website", "notes", "delegate_count",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_delegate_count(self, obj):
        return getattr(obj, "_delegate_count", None)


class CompanyMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Company
        fields = ["id", "name", "city", "country"]
