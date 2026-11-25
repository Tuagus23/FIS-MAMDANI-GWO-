from __future__ import annotations

import json
import traceback
from pathlib import Path
from functools import lru_cache
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from auth import (
    AuthConfigurationError,
    AuthDenied,
    AuthForbidden,
    AuthKicked,
    AuthProviderUnavailable,
    public_auth_config,
    sign_in_with_identifier,
    verify_authorization_header,
)
from app import DATASETS, SIMULATION_LOCK, dashboard_data, run_simulation
from access import DASHBOARD_PAGES, AccessConflict, end_session, kick_member, list_users, update_user


@lru_cache(maxsize=1)
def public_dashboard_enabled() -> bool:
    try:
        settings = json.loads((Path(__file__).resolve().parents[1] / "dashboard-access.json").read_text())
        return settings.get("public_dashboard") is True
    except (OSError, ValueError, AttributeError):
        return False


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        request = urlparse(self.path)

        if request.path == "/api/health":
            self.send_json({"status": "ok"})
            return

        if request.path == "/api/auth-config":
            try:
                self.send_json(public_auth_config())
            except AuthConfigurationError as error:
                self.send_json({"error": str(error)}, status=503)
            return

        if request.path in {"/api/datasets", "/api/bootstrap"}:
            if not self.require_dashboard_access():
                return
            response = {
                "default": "results",
                "identity": {
                    "id": self.auth_identity["id"],
                    "name": self.auth_identity["name"],
                    "role": self.auth_identity["role"],
                },
                "datasets": [
                    {"id": key, "label": value["label"], "description": value["description"]}
                    for key, value in DATASETS.items()
                ],
            }
            if request.path == "/api/bootstrap":
                try:
                    response["data"] = dashboard_data("results")
                except (OSError, ValueError, json.JSONDecodeError):
                    response["data"] = None
                    response["data_error"] = "Data eksperimen belum dapat dimuat. Coba lagi."
            self.send_json(response)
            return

        if request.path == "/api/admin-users":
            self.manage_users()
            return

        if request.path == "/api/session":
            page = parse_qs(request.query).get("page", [None])[0]
            if page is not None and page not in DASHBOARD_PAGES:
                self.send_json({"error": "Halaman dashboard tidak valid."}, status=400)
                return
            if self.require_authentication(current_page=page):
                self.send_json({"identity": {key: self.auth_identity[key] for key in ("id", "name", "role")}})
            return

        if request.path == "/api/dashboard":
            if not self.require_dashboard_access():
                return
            dataset_id = parse_qs(request.query).get("dataset", ["results"])[0]
            if dataset_id not in DATASETS:
                self.send_json({"error": "Dataset tidak dikenal."}, status=404)
                return
            try:
                self.send_json(dashboard_data(dataset_id))
            except (OSError, ValueError, json.JSONDecodeError) as error:
                self.send_json(
                    {"error": f"Data eksperimen tidak dapat dibaca: {error}"},
                    status=500,
                )
            return

        self.send_json({"error": "Alamat API tidak dikenal."}, status=404)

    def do_POST(self) -> None:
        request_path = urlparse(self.path).path
        if request_path == "/api/login":
            self.sign_in()
            return
        if request_path == "/api/admin-users":
            self.manage_users(update=True)
            return
        if request_path == "/api/admin-kick":
            self.manage_users(update=True, kick=True)
            return
        if request_path == "/api/session":
            if not self.require_authentication():
                return
            try:
                end_session(self.headers.get("Authorization", "").partition(" ")[2])
                self.send_json({"message": "Sesi dashboard diakhiri."})
            except (AuthConfigurationError, AuthProviderUnavailable):
                self.send_json({"error": "Sesi belum dapat diakhiri. Coba lagi."}, status=503)
            except AuthDenied as error:
                self.send_json({"error": str(error)}, status=401)
            except AuthForbidden as error:
                self.send_json({"error": str(error)}, status=403)
            return
        if request_path != "/api/simulate":
            self.send_json({"error": "Alamat API tidak dikenal."}, status=404)
            return

        if not self.require_dashboard_access():
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 32_768:
                raise ValueError("Permintaan simulasi tidak valid.")
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise ValueError("Pengaturan simulasi tidak valid.")
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(
                {"error": str(error) or "Permintaan simulasi tidak valid."},
                status=400,
            )
            return

        if not SIMULATION_LOCK.acquire(blocking=False):
            self.send_json(
                {"error": "Simulasi lain sedang berjalan. Coba lagi setelah proses itu selesai."},
                status=429,
            )
            return

        try:
            self.send_json(run_simulation(payload))
        except ValueError as error:
            self.send_json({"error": str(error)}, status=400)
        except Exception:
            traceback.print_exc()
            self.send_json(
                {"error": "Simulasi gagal dijalankan. Periksa pengaturan lalu coba lagi."},
                status=500,
            )
        finally:
            SIMULATION_LOCK.release()

    def sign_in(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 4096:
                raise ValueError("Permintaan login tidak valid.")
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise ValueError("Permintaan login tidak valid.")
            identifier = payload.get("identifier")
            password = payload.get("password")
            if not isinstance(identifier, str) or not isinstance(password, str):
                raise ValueError("Masukkan nama akhir/NIM dan kata sandi.")
            if len(identifier) > 100 or len(password) > 256:
                raise ValueError("Permintaan login tidak valid.")
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"error": str(error) or "Permintaan login tidak valid."}, status=400)
            return

        try:
            self.send_json(sign_in_with_identifier(identifier, password))
        except AuthConfigurationError as error:
            self.send_json({"error": str(error)}, status=503)
        except AuthKicked as error:
            self.send_json({"error": str(error), "code": "session_kicked"}, status=401)
        except AuthDenied as error:
            self.send_json({"error": str(error)}, status=401)
        except AuthForbidden as error:
            self.send_json({"error": str(error)}, status=403)
        except AuthProviderUnavailable:
            self.send_json(
                {"error": "Layanan login tidak dapat dihubungi. Coba lagi sebentar."},
                status=503,
            )

    def require_dashboard_access(self) -> bool:
        if public_dashboard_enabled() and not self.headers.get("Authorization"):
            self.auth_identity = {"id": "public", "name": "Pengunjung", "role": "guest"}
            return True
        return self.require_authentication()

    def require_authentication(self, current_page: str | None = None) -> bool:
        try:
            header = self.headers.get("Authorization", "")
            self.auth_identity = (verify_authorization_header(header, current_page=current_page)
                                  if current_page is not None else verify_authorization_header(header))
            return True
        except AuthConfigurationError as error:
            self.send_json({"error": str(error)}, status=503)
        except AuthKicked as error:
            self.send_json({"error": str(error), "code": "session_kicked"}, status=401)
        except AuthDenied as error:
            self.send_json({"error": str(error)}, status=401)
        except AuthForbidden as error:
            self.send_json({"error": str(error), "code": "access_revoked"}, status=403)
        except AuthProviderUnavailable:
            self.send_json(
                {"error": "Layanan login tidak dapat dihubungi. Coba lagi sebentar."},
                status=503,
            )
        return False

    def manage_users(self, update: bool = False, kick: bool = False) -> None:
        if not self.require_authentication():
            return
        token = self.headers.get("Authorization", "").partition(" ")[2]
        try:
            if update:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 4096:
                    raise ValueError("Permintaan perubahan akun tidak valid.")
                payload = json.loads(self.rfile.read(length))
                if not isinstance(payload, dict):
                    raise ValueError("Permintaan perubahan akun tidak valid.")
                operation = kick_member if kick else update_user
                self.send_json(operation(self.auth_identity, token, payload))
            else:
                self.send_json(list_users(self.auth_identity, token))
        except AuthForbidden as error:
            self.send_json({"error": str(error), "code": "admin_required"}, status=403)
        except AuthDenied as error:
            self.send_json({"error": str(error)}, status=401)
        except AccessConflict as error:
            self.send_json({"error": str(error)}, status=409)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"error": str(error) or "Permintaan tidak valid."}, status=400)
        except (AuthConfigurationError, AuthProviderUnavailable):
            self.send_json({"error": "Data akses belum dapat dimuat. Coba lagi sebentar."}, status=503)

    def send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status, HTTPStatus(status).phrase)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.log_date_time_string()} - {format % args}")
