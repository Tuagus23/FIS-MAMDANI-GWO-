from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


class AuthConfigurationError(Exception):
    pass


class AuthDenied(Exception):
    pass


class AuthForbidden(Exception):
    pass


class AuthProviderUnavailable(Exception):
    pass


def _settings() -> tuple[str, str, set[str]]:
    base_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    publishable_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip()
    allowed_emails = {
        email.strip().casefold()
        for email in os.environ.get("DASHBOARD_ALLOWED_EMAILS", "").split(",")
        if email.strip()
    }

    parsed = urlparse(base_url)
    local_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1"}
    if (parsed.scheme != "https" and not local_http) or not parsed.netloc:
        raise AuthConfigurationError("Login belum dikonfigurasi oleh administrator.")
    if not publishable_key or not allowed_emails:
        raise AuthConfigurationError("Login belum dikonfigurasi oleh administrator.")
    return base_url, publishable_key, allowed_emails


def public_auth_config() -> dict[str, str]:
    base_url, publishable_key, _ = _settings()
    return {"url": base_url, "publishableKey": publishable_key}


def verify_authorization_header(value: str) -> dict[str, str]:
    base_url, publishable_key, allowed_emails = _settings()
    scheme, separator, token = value.partition(" ")
    if scheme.casefold() != "bearer" or not separator or not 32 <= len(token) <= 16_384:
        raise AuthDenied("Sesi tidak berlaku. Silakan masuk kembali.")

    request = Request(
        f"{base_url}/auth/v1/user",
        headers={
            "apikey": publishable_key,
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=8) as response:
            user = json.loads(response.read())
    except HTTPError as error:
        if error.code in {400, 401, 403}:
            raise AuthDenied("Sesi tidak berlaku. Silakan masuk kembali.") from error
        raise AuthProviderUnavailable from error
    except (URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
        raise AuthProviderUnavailable from error

    if not isinstance(user, dict) or not user.get("id") or not user.get("email"):
        raise AuthDenied("Sesi tidak berlaku. Silakan masuk kembali.")

    email = str(user["email"]).strip().casefold()
    if email not in allowed_emails:
        raise AuthForbidden("Email ini belum diberi akses. Hubungi administrator.")
    return {"id": str(user["id"]), "email": email}
