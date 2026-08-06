"""
Linq CRM — Django Settings
Production-ready configuration with environment variable overrides.
"""
import os
from pathlib import Path
import dj_database_url
from django.core.exceptions import ImproperlyConfigured
from dotenv import load_dotenv
from decouple import AutoConfig

BASE_DIR = Path(__file__).resolve().parent.parent

# Resolve .env from the project layout rather than the current working
# directory, so `manage.py` works from backend/ or from the repo root.
load_dotenv(BASE_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")
config = AutoConfig(search_path=BASE_DIR)

# ── Security ──────────────────────────────────────────────────────────────────
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default="False", cast=lambda v: v.lower() in ("true", "1"))
ALLOWED_HOSTS = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

CORS_ALLOWED_ORIGINS = [
    o.strip() for o in
    os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

# ── Applications ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework.authtoken",
    "django_filters",
    "corsheaders",
    "django_crontab",
    # Local — order matters for FK migrations
    "teams",
    "accounts",
    "companies",
    "events",
    "book_event",
    "book_delegate",
    "webhooks",
    "google_sync",
    "reports",
    "event_performance",
    "historical_event_registry",
    "ticket_central",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates", BASE_DIR.parent / "frontend" / "build"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# ── Database ──────────────────────────────────────────────────────────────────
# Resolved in order:
#   1. DATABASE_URL — single connection string, used by most hosting platforms
#   2. DB_NAME/DB_USER/DB_PASSWORD/… — explicit PostgreSQL credentials
#   3. SQLite under BASE_DIR — local development only, refused when DEBUG is off
DATABASE_URL = config("DATABASE_URL", default="")
DB_NAME = config("DB_NAME", default="")

if DATABASE_URL:
    DATABASES = {"default": dj_database_url.parse(DATABASE_URL, conn_max_age=600)}
elif DB_NAME:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": DB_NAME,
            "USER": config("DB_USER"),
            "PASSWORD": config("DB_PASSWORD"),
            "HOST": config("DB_HOST", default="localhost"),
            "PORT": config("DB_PORT", default="5432"),
        }
    }
elif DEBUG:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    raise ImproperlyConfigured(
        "No database configured. Set DATABASE_URL, or DB_NAME/DB_USER/DB_PASSWORD."
    )

# ── Custom Auth ───────────────────────────────────────────────────────────────
AUTH_USER_MODEL = "accounts.User"

# ── REST Framework ────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "config.pagination.StandardPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        # Appends the pk as a final tiebreaker so paginated lists cannot
        # duplicate or skip rows across pages. See accounts/ordering.py.
        "accounts.ordering.StableOrderingFilter",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}

if DEBUG:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"].append(
        "rest_framework.renderers.BrowsableAPIRenderer"
    )

# ── Internationalisation ──────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# ── Static ────────────────────────────────────────────────────────────────────
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Only present once the React app has been built (`npm run build` in frontend/).
_frontend_static = BASE_DIR.parent / "frontend" / "build" / "static"
STATICFILES_DIRS = [_frontend_static] if _frontend_static.is_dir() else []
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "root": {"handlers": ["console"], "level": "INFO"},
    "loggers": {
        "book_event": {"handlers": ["console"], "level": "INFO", "propagate": False},
    },
}

# ── Email ─────────────────────────────────────────────────────────────────────
EMAIL_BACKEND   = os.environ.get("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
EMAIL_HOST      = os.environ.get("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT      = int(os.environ.get("EMAIL_PORT", 587))
EMAIL_USE_TLS   = os.environ.get("EMAIL_USE_TLS", "True") == "True"
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL  = os.environ.get("DEFAULT_FROM_EMAIL", EMAIL_HOST_USER)
IMPORT_ALERT_EMAIL  = os.environ.get("IMPORT_ALERT_EMAIL", "")

# ── Website Integration ───────────────────────────────────────────────────────
WEBSITE_API_KEY     = os.environ.get("WEBSITE_API_KEY", "")
WEBHOOK_SECRET_KEY  = os.environ.get("WEBHOOK_SECRET_KEY", "")

# ── Google Sheets Sync ────────────────────────────────────────────────────────
# Look for credentials relative to project root
_creds_path = os.environ.get("GOOGLE_SHEETS_CREDENTIALS", "config/credentials/google-sheets.json")
GOOGLE_SHEETS_CREDENTIALS = os.path.join(BASE_DIR.parent, _creds_path)
GOOGLE_SHEET_ID = os.environ.get("GOOGLE_SHEET_ID", "1x69V6G_qY6H5W_m6P9V6G_qY6H5W_m6P")
GOOGLE_SHEET_EVENTS_TAB = "Events"
GOOGLE_SHEET_BOOKINGS_TAB = "Bookings"


# ── Ticket Central: scheduled ticket-number backfill (D5) ───────────────────
# 07:00 AM IST == 01:30 UTC. cron string uses server time; activate on the
# Linux server with `python manage.py crontab add` (no-op on Windows dev).
CRONJOBS = [
    ("30 1 * * *", "django.core.management.call_command", ["backfill_ticket_numbers"]),
]
CRONTAB_LOCK_JOBS = True  # prevent overlap if a previous run is still going
