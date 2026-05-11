"""
book_event/authentication.py
─────────────────────────────
API key authentication for external website integrations.
Websites send X-API-KEY header; this class validates it against
settings.WEBSITE_API_KEY without requiring a real Django user.
"""
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import BasePermission


class ApiKeyUser:
    """Sentinel object used as request.user when authenticated via API key."""
    is_authenticated = True
    is_anonymous = False
    is_admin = False
    is_active = True
    role = "api"
    username = "website_api"
    id = None
    pk = None

    def __str__(self):
        return "website_api"


_API_KEY_USER = ApiKeyUser()


class ApiKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        key = request.META.get("HTTP_X_API_KEY", "").strip()
        if not key:
            return None  # Let other authenticators try

        expected = getattr(settings, "WEBSITE_API_KEY", "")
        if not expected:
            raise AuthenticationFailed("API key authentication is not configured on this server.")

        if key != expected:
            raise AuthenticationFailed("Invalid API key.")

        return (_API_KEY_USER, key)

    def authenticate_header(self, request):
        return "X-API-KEY"



class OriginAuthentication(BaseAuthentication):
    """
    Allows requests without an API key if the Origin or Referer matches
    settings.CORS_ALLOWED_ORIGINS.
    """
    def authenticate(self, request):
        origin = request.META.get("HTTP_ORIGIN", "") or request.META.get("HTTP_REFERER", "")
        if not origin:
            return None

        from urllib.parse import urlparse
        domain = urlparse(origin).netloc.split(":")[0]
        
        allowed = [urlparse(o).netloc.split(":")[0] for o in getattr(settings, "CORS_ALLOWED_ORIGINS", [])]
        
        if domain in allowed:
            return (_API_KEY_USER, f"origin:{domain}")
        
        return None

class HasApiKey(BasePermission):
    """Passes for requests authenticated with ApiKeyAuthentication or OriginAuthentication."""
    message = "Valid X-API-KEY header or authorised Origin required."

    def has_permission(self, request, view):
        return isinstance(request.user, ApiKeyUser)
