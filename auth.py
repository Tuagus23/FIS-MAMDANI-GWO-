from __future__ import annotations

import json
import os
import re
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


_LOGIN_EMAIL_DOMAIN = "auth.fuzzy-ch-wsn-dashboard.vercel.app"


def _login_directory() -> tuple[
    dict[str, dict[str, str]],
    set[str],
    dict[str, dict[str, str]],
]:
    raw_users = os.environ.get("DASHBOARD_LOGIN_USERS", "").strip()
    if not raw_users:
        return {}, set(), {}

    try:
        configured_users = json.loads(raw_users)
    except json.JSONDecodeError as error:
        raise AuthConfigurationError("Daftar akun login belum valid.") from error
    if not isinstance(configured_users, list):
        raise AuthConfigurationError("Daftar akun login belum valid.")

    users_by_email: dict[str, dict[str, str]] = {}
    aliases: dict[str, dict[str, str]] = {}
    ambiguous_aliases: set[str] = set()
    seen_ids: set[str] = set()

    for configured_user in configured_users:
        if not isinstance(configured_user, dict):
            raise AuthConfigurationError("Daftar akun login belum valid.")
        login_id = str(configured_user.get("nim") or configured_user.get("login_id") or "").strip().casefold()
        name = str(configured_user.get("name") or "").strip()
        role = str(configured_user.get("role") or "member").strip().casefold()
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,31}", login_id) or not name or role not in {"member", "super_admin"}:
            raise AuthConfigurationError("Daftar akun login belum valid.")
        if login_id in seen_ids:
            raise AuthConfigurationError("ID akun login duplikat.")
        seen_ids.add(login_id)

        user = {
            "id": login_id,
            "email": f"{login_id}@{_LOGIN_EMAIL_DOMAIN}",
            "name": name,
            "role": role,
        }
        users_by_email[user["email"]] = user

        user_aliases = {login_id}
        final_name = name.split()[-1].casefold()
        if final_name:
            user_aliases.add(final_name)
        for alias in user_aliases:
            if alias in ambiguous_aliases:
                continue
            existing = aliases.get(alias)
            if existing and existing["email"] != user["email"]:
                aliases.pop(alias)
                ambiguous_aliases.add(alias)
            else:
                aliases[alias] = user

    return aliases, ambiguous_aliases, users_by_email


def _settings() -> tuple[str, str, set[str]]:
    base_url = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    publishable_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip()
    allowed_emails = {
        email.strip().casefold()
        for email in os.environ.get("DASHBOARD_ALLOWED_EMAILS", "").split(",")
        if email.strip()
    }
    _, _, roster_users = _login_directory()
    allowed_emails.update(roster_users)

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


def sign_in_with_identifier(identifier: str, password: str) -> dict[str, str]:
    base_url, publishable_key, _ = _settings()
    aliases, ambiguous_aliases, _ = _login_directory()
    normalized_identifier = identifier.strip().casefold()
    if normalized_identifier in ambiguous_aliases:
        raise AuthDenied("Nama akhir digunakan oleh beberapa akun. Gunakan NIM.")
    user = aliases.get(normalized_identifier)
    if not user or not password or len(password) > 256:
        raise AuthDenied("Nama akhir/NIM atau kata sandi belum benar.")

    request = Request(
        f"{base_url}/auth/v1/token?grant_type=password",
        data=json.dumps({"email": user["email"], "password": password}).encode("utf-8"),
        headers={
            "apikey": publishable_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )
    try:
        with urlopen(request, timeout=8) as response:
            session = json.loads(response.read())
    except HTTPError as error:
        if error.code in {400, 401, 422}:
            raise AuthDenied("Nama akhir/NIM atau kata sandi belum benar.") from error
        raise AuthProviderUnavailable from error
    except (URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
        raise AuthProviderUnavailable from error

    if not isinstance(session, dict):
        raise AuthProviderUnavailable
    access_token = session.get("access_token")
    refresh_token = session.get("refresh_token")
    if not isinstance(access_token, str) or not isinstance(refresh_token, str):
        raise AuthProviderUnavailable
    return {"access_token": access_token, "refresh_token": refresh_token}


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
        raise AuthForbidden("Akun ini belum diberi akses. Hubungi administrator.")

    _, _, roster_users = _login_directory()
    roster_user = roster_users.get(email)
    return {
        "id": str(user["id"]),
        "email": email,
        "name": roster_user["name"] if roster_user else email,
        "role": roster_user["role"] if roster_user else "member",
    }
