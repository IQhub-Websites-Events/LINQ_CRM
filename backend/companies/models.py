"""
companies/models.py
────────────────────
Reusable company registry. Deduped by (name, city).
"""
from django.db import models
from django.utils import timezone


class Company(models.Model):
    name        = models.CharField(max_length=255, db_index=True)
    address     = models.CharField(max_length=500, blank=True, default="")
    city        = models.CharField(max_length=100, blank=True, default="")
    state       = models.CharField(max_length=100, blank=True, default="")
    country     = models.CharField(max_length=100, blank=True, default="")
    postal_code = models.CharField(max_length=20, blank=True, default="")
    website     = models.URLField(blank=True, default="")
    notes       = models.TextField(blank=True, default="")
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "companies"
        ordering = ["name"]
        indexes  = [
            models.Index(fields=["name"]),
            models.Index(fields=["name", "city"]),
            models.Index(fields=["country"]),
        ]
        verbose_name_plural = "companies"

    def __str__(self):
        parts = [self.name]
        if self.city:    parts.append(self.city)
        if self.country: parts.append(self.country)
        return ", ".join(parts)

    @classmethod
    def get_or_create_from_payload(cls, data: dict):
        """
        Upsert by (name, city) using case-insensitive matching.
        Updates empty fields on existing records with richer data from payload.
        Returns (company, created: bool).
        """
        name = (data.get("DelegateCompanyName") or data.get("name") or "").strip()
        city = (data.get("City") or data.get("city") or "").strip()
        if not name:
            return None, False

        existing = cls.objects.filter(name__iexact=name, city__iexact=city).first()

        field_map = {
            "address":     data.get("Address") or data.get("address") or "",
            "state":       data.get("StateRegion") or data.get("state") or "",
            "country":     data.get("Country") or data.get("country") or "",
            "postal_code": data.get("PostalCode") or data.get("postal_code") or "",
            "website":     data.get("CompanyWebAddress") or data.get("website") or "",
        }

        if existing:
            updated_fields = []
            for field, value in field_map.items():
                if value and not getattr(existing, field):
                    setattr(existing, field, value)
                    updated_fields.append(field)
            if updated_fields:
                existing.save(update_fields=updated_fields + ["updated_at"])
            return existing, False

        company = cls.objects.create(name=name, city=city, **field_map)
        return company, True
