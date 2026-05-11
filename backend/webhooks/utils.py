"""
webhooks/utils.py
──────────────────
Shared helpers: IP extraction, header sanitisation, key validation.
"""
from urllib.parse import urlparse

from django.conf import settings


def extract_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
    return forwarded or request.META.get("REMOTE_ADDR", "")


def safe_headers(meta: dict) -> dict:
    """HTTP_* headers from request.META, stripping all secret/key values."""
    skip = {"HTTP_X_WEBHOOK_SECRET", "HTTP_X_API_KEY", "HTTP_X_CRM_API_KEY"}
    return {
        k: v for k, v in meta.items()
        if k.startswith("HTTP_") and k not in skip
    }


def validate_api_key(request):
    """
    Validates X-CRM-API-KEY against the WebhookApiKey database table.
    Returns (api_key_obj, None) on success or (None, error_str) on failure.
    Does NOT fall back to static key — caller handles that separately.
    """
    from .models import WebhookApiKey

    key_value = request.META.get("HTTP_X_CRM_API_KEY", "").strip()
    if not key_value:
        return None, "missing"

    try:
        api_key = WebhookApiKey.objects.get(api_key=key_value)
    except WebhookApiKey.DoesNotExist:
        return None, "Invalid API key."

    if not api_key.is_active:
        return None, "This API key has been deactivated."

    if api_key.allowed_domains:
        origin = (
            request.META.get("HTTP_ORIGIN", "") or
            request.META.get("HTTP_REFERER", "")
        )
        if origin:
            domain = urlparse(origin).netloc.split(":")[0]
            if domain and domain not in api_key.allowed_domains:
                return None, f"Domain '{domain}' is not authorised for this API key."

    api_key.record_usage()
    return api_key, None


def validate_webhook_secret(request):
    """
    Legacy static-secret validation via X-WEBHOOK-SECRET header.
    Returns (True, "") or (False, error_message).
    """
    incoming = request.META.get("HTTP_X_WEBHOOK_SECRET", "").strip()
    if not incoming:
        return False, "missing"

    expected = getattr(settings, "WEBHOOK_SECRET_KEY", "").strip()
    if not expected:
        return False, "Webhook authentication is not configured on this server."

    if incoming != expected:
        return False, "Invalid webhook secret."

    return True, ""


def authenticate_request(request):
    """
    Try X-CRM-API-KEY (DB) first, then X-WEBHOOK-SECRET (legacy).
    Fallback to Origin/Referer check against CORS_ALLOWED_ORIGINS if headers are missing.
    Returns (api_key_obj_or_None, error_str_or_None).
    """
    api_key_obj, api_key_err = validate_api_key(request)
    if api_key_obj is not None:
        return api_key_obj, None

    # api_key_err == "missing" means header wasn't present; try legacy
    if api_key_err == "missing":
        ok, secret_err = validate_webhook_secret(request)
        if ok:
            return None, None
        
        # Final fallback: Origin check
        origin = request.META.get("HTTP_ORIGIN", "") or request.META.get("HTTP_REFERER", "")
        if origin:
            from urllib.parse import urlparse
            domain = urlparse(origin).netloc.split(":")[0]
            allowed = [urlparse(o).netloc.split(":")[0] for o in getattr(settings, "CORS_ALLOWED_ORIGINS", [])]
            if domain in allowed:
                return None, None # Authenticated via domain whitelist

    # Both headers absent and origin not allowed
    if api_key_err == "missing":
        return None, "Authentication required: provide X-CRM-API-KEY or authorised Origin."

    return None, api_key_err


def unwrap_payload(data: dict) -> dict:
    """
    Handles Zoho Flow style wrapping where the actual data is inside
    webhookTrigger -> payload.
    Returns the inner payload if it exists, otherwise the original data.
    """
    if not isinstance(data, dict):
        return {}
    if "webhookTrigger" in data and isinstance(data["webhookTrigger"], dict):
        return data["webhookTrigger"].get("payload", data)
    return data
