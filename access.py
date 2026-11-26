from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from uuid import UUID
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from auth import AuthDenied, AuthForbidden, AuthKicked, AuthProviderUnavailable, _login_directory, _settings


class AccessConflict(Exception):
    pass


DASHBOARD_PAGES = frozenset({"/", "/dasar-proyek", "/validasi", "/membership", "/gwo", "/fis", "/simulasi", "/anggota", "/motto", "/pengguna"})


def _request(path: str, token: str, payload: dict | None = None) -> object:
    base_url, key, _ = _settings()
    request = Request(
        f"{base_url}/rest/v1/{path}",
        data=None if payload is None else json.dumps(payload).encode("utf-8"),
        headers={"apikey": key, "Authorization": f"Bearer {token}",
                 "Content-Type": "application/json", "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=8) as response:
            body = response.read()
            return json.loads(body) if body else None
    except HTTPError as error:
        try:
            failure = json.loads(error.read())
        except (ValueError, OSError):
            failure = {}
        code = failure.get("code") if isinstance(failure, dict) else None
        if error.code == 401:
            raise AuthDenied("Sesi tidak berlaku. Silakan masuk kembali.") from error
        if code == "42501" or error.code == 403:
            raise AuthForbidden("Hanya super admin yang dapat mengelola pengguna.") from error
        if code == "40001":
            raise AccessConflict("Akun telah diubah admin lain. Muat ulang sebelum menyimpan.") from error
        if code in {"22023", "P0002"}:
            raise ValueError(failure.get("message", "Perubahan akses tidak valid.")) from error
        raise AuthProviderUnavailable from error
    except (URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
        raise AuthProviderUnavailable from error


def read_identity(user_id: str, token: str, current_page: str | None = None) -> dict:
    try:
        normalized_id = str(UUID(user_id))
    except ValueError as error:
        raise AuthDenied("Sesi tidak berlaku. Silakan masuk kembali.") from error
    if current_page is not None and current_page not in DASHBOARD_PAGES:
        raise ValueError("Halaman dashboard tidak valid.")
    profile = (_request("rpc/dashboard_session_presence", token, {"page_path": current_page})
               if current_page is not None else _request("rpc/dashboard_session_identity", token, {}))
    if not isinstance(profile, dict):
        raise AuthProviderUnavailable
    if profile.get("state") == "kicked":
        raise AuthKicked("Sesi Anda dikeluarkan oleh super admin.")
    if profile.get("state") == "expired":
        raise AuthDenied("Sesi berakhir. Silakan masuk kembali.")
    if profile.get("state") == "access_revoked" or not profile.get("active"):
        raise AuthForbidden("Akses akun ini dinonaktifkan atau belum diberikan. Hubungi super admin.")
    if profile.get("id") != normalized_id or profile.get("state") != "open":
        raise AuthDenied("Sesi tidak berlaku. Silakan masuk kembali.")
    if profile.get("role") not in {"member", "super_admin"}:
        raise AuthForbidden("Peran akun tidak valid. Hubungi super admin.")
    return profile


def require_super_admin(identity: dict) -> None:
    if identity.get("role") != "super_admin":
        raise AuthForbidden("Halaman ini hanya tersedia untuk super admin.")


def _names() -> dict[str, str]:
    _, _, roster = _login_directory()
    return {user["id"]: user["name"] for user in roster.values()}


def list_users(identity: dict, token: str) -> dict:
    require_super_admin(identity)
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(seconds=90)).isoformat().replace("+00:00", "Z")
    paths = [
        "dashboard_users?select=id,login_id,role,active,updated_at&order=login_id",
        "dashboard_access_log?select=*&order=created_at.desc,id.desc&limit=20",
        f"dashboard_sessions?select=user_id,started_at,last_seen_at,current_page&ended_at=is.null&last_seen_at=gte.{cutoff}&order=last_seen_at.desc",
    ]
    with ThreadPoolExecutor(max_workers=3) as executor:
        rows, logs, sessions = list(executor.map(lambda path: _request(path, token), paths))
    if not isinstance(rows, list) or not isinstance(logs, list) or not isinstance(sessions, list):
        raise AuthProviderUnavailable
    # RLS can change between verification and this read if another admin revokes access.
    if not any(row["id"] == identity["id"] and row["active"] and row["role"] == "super_admin" for row in rows):
        raise AuthForbidden("Hak super admin Anda telah berubah. Muat ulang halaman.")
    names = _names()
    by_user: dict[str, list[dict]] = {}
    for session in sessions:
        by_user.setdefault(session["user_id"], []).append(session)
    users = []
    for row in rows:
        live = by_user.get(row["id"], []) if row["active"] else []
        latest = max(live, key=lambda item: item["last_seen_at"]) if live else None
        starts = [datetime.fromisoformat(item["started_at"].replace("Z", "+00:00")) for item in live]
        users.append({**row, "name": names.get(row["login_id"], row["login_id"]),
                      "logged_in": bool(live), "login_started_at": min(starts).isoformat() if starts else None,
                      "last_seen_at": latest["last_seen_at"] if latest else None,
                      "current_page": latest["current_page"] if latest else None, "session_count": len(live)})
    by_id = {row["id"]: row["name"] for row in users}
    return {"users": users, "server_time": now.isoformat(), "activity": [
        {**row, "actor_name": by_id.get(row["actor_id"], "Akun admin"),
         "target_name": by_id.get(row["target_id"], "Akun pengguna")}
        for row in logs
    ]}


def update_user(identity: dict, token: str, payload: dict) -> dict:
    require_super_admin(identity)
    try:
        target = str(UUID(str(payload.get("id", ""))))
    except ValueError as error:
        raise ValueError("ID pengguna tidak valid.") from error
    role, active, version = payload.get("role"), payload.get("active"), payload.get("updated_at")
    if not isinstance(role, str) or role not in {"member", "super_admin"} or type(active) is not bool:
        raise ValueError("Peran atau status akun tidak valid.")
    if not isinstance(version, str) or not 10 < len(version) < 80:
        raise ValueError("Muat ulang daftar pengguna sebelum menyimpan.")
    try:
        if datetime.fromisoformat(version.replace("Z", "+00:00")).tzinfo is None:
            raise ValueError
    except ValueError as error:
        raise ValueError("Versi data akun tidak valid. Muat ulang daftar pengguna.") from error
    _request("rpc/dashboard_update_user", token, {
        "target_user_id": target, "new_role": role, "new_active": active, "expected_updated_at": version,
    })
    return {"message": "Akses pengguna berhasil diperbarui."}


def kick_member(identity: dict, token: str, payload: dict) -> dict:
    require_super_admin(identity)
    try:
        target = str(UUID(str(payload.get("id", ""))))
    except ValueError as error:
        raise ValueError("ID pengguna tidak valid.") from error
    _request("rpc/dashboard_kick_member", token, {"target_user_id": target})
    return {"message": "Member telah dikeluarkan dari sesi dashboard. Akunnya tetap bisa login kembali."}


def end_session(token: str) -> None:
    _request("rpc/dashboard_end_session", token, {})
