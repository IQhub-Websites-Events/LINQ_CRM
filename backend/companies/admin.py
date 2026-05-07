from django.contrib import admin
from .models import Company

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display  = ["name", "city", "country", "website", "created_at"]
    list_filter   = ["country"]
    search_fields = ["name", "city", "country"]
    ordering      = ["name"]
