from __future__ import annotations

import json
from datetime import datetime
from uuid import UUID
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from auth import AuthDenied, AuthForbidden, AuthProviderUnavailable, _login_directory, _settings


class AccessConflict(Exception):
    pass


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
            return json.loads(response.read())
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


def read_identity(user_id: str, token: str) -> dict:
    try:
        normalized_id = str(UUID(user_id))
    except ValueError as error:
        raise AuthDenied("Sesi tidak berlaku. Silakan masuk kembali.") from error
    rows = _request(f"dashboard_users?id=eq.{normalized_id}&select=id,role,active", token)
    if not isinstance(rows, list) or len(rows) != 1 or not rows[0].get("active"):
        raise AuthForbidden("Akses akun ini dinonaktifkan atau belum diberikan. Hubungi super admin.")
    profile = rows[0]
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
    rows = _request("dashboard_users?select=id,login_id,role,active,updated_at&order=login_id", token)
    logs = _request("dashboard_access_log?select=*&order=created_at.desc,id.desc&limit=20", token)
    if not isinstance(rows, list) or not isinstance(logs, list):
        raise AuthProviderUnavailable
    # RLS can change between verification and this read if another admin revokes access.
    if not any(row["id"] == identity["id"] and row["active"] and row["role"] == "super_admin" for row in rows):
        raise AuthForbidden("Hak super admin Anda telah berubah. Muat ulang halaman.")
    names = _names()
    users = [{**row, "name": names.get(row["login_id"], row["login_id"])} for row in rows]
    by_id = {row["id"]: row["name"] for row in users}
    return {"users": users, "activity": [
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
