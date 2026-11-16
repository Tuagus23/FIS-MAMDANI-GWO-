from __future__ import annotations

import json
import mimetypes
import traceback
from http import HTTPStatus
from urllib.parse import parse_qs, unquote

from app import DATASETS, SIMULATION_LOCK, WEB_ROOT, dashboard_data, run_simulation


def json_response(start_response, data: dict, status: int = 200) -> list[bytes]:
    body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
    start_response(
        f"{status} {HTTPStatus(status).phrase}",
        [
            ("Content-Type", "application/json; charset=utf-8"),
            ("Content-Length", str(len(body))),
            ("Cache-Control", "no-store"),
        ],
    )
    return [body]


def static_response(path: str, start_response) -> list[bytes]:
    relative_path = unquote(path.lstrip("/")) or "index.html"
    file_path = (WEB_ROOT / relative_path).resolve()
    if WEB_ROOT not in file_path.parents and file_path != WEB_ROOT:
        return json_response(start_response, {"error": "Halaman tidak ditemukan."}, 404)
    if not file_path.is_file():
        return json_response(start_response, {"error": "Halaman tidak ditemukan."}, 404)

    content_type, _ = mimetypes.guess_type(file_path.name)
    content_type = content_type or "application/octet-stream"
    if content_type.startswith(("text/", "application/javascript")) or content_type == "application/json":
        content_type += "; charset=utf-8"
    body = file_path.read_bytes()
    cache_control = "no-cache" if file_path.suffix in {".html", ".js", ".css"} else "public, max-age=3600"
    start_response(
        "200 OK",
        [
            ("Content-Type", content_type),
            ("Content-Length", str(len(body))),
            ("Cache-Control", cache_control),
        ],
    )
    return [body]


def application(environ, start_response):
    method = environ.get("REQUEST_METHOD", "GET").upper()
    path = environ.get("PATH_INFO", "/") or "/"

    if method == "GET":
        if path == "/api/health":
            return json_response(start_response, {"status": "ok"})

        if path == "/api/datasets":
            return json_response(
                start_response,
                {
                    "default": "results",
                    "datasets": [
                        {"id": key, "label": value["label"], "description": value["description"]}
                        for key, value in DATASETS.items()
                    ],
                },
            )

        if path == "/api/dashboard":
            params = parse_qs(environ.get("QUERY_STRING", ""))
            dataset_id = params.get("dataset", ["results"])[0]
            if dataset_id not in DATASETS:
                return json_response(start_response, {"error": "Dataset tidak dikenal."}, 404)
            try:
                return json_response(start_response, dashboard_data(dataset_id))
            except (OSError, ValueError, json.JSONDecodeError) as error:
                return json_response(
                    start_response,
                    {"error": f"Data eksperimen tidak dapat dibaca: {error}"},
                    500,
                )

        if path.startswith("/api/"):
            return json_response(start_response, {"error": "Alamat API tidak dikenal."}, 404)
        return static_response(path, start_response)

    if method == "POST" and path == "/api/simulate":
        try:
            content_length = int(environ.get("CONTENT_LENGTH") or "0")
            if content_length <= 0 or content_length > 32_768:
                raise ValueError("Permintaan simulasi tidak valid.")
            payload = json.loads(environ["wsgi.input"].read(content_length))
            if not isinstance(payload, dict):
                raise ValueError("Pengaturan simulasi tidak valid.")
        except (ValueError, json.JSONDecodeError) as error:
            return json_response(
                start_response,
                {"error": str(error) or "Permintaan simulasi tidak valid."},
                400,
            )

        if not SIMULATION_LOCK.acquire(blocking=False):
            return json_response(
                start_response,
                {"error": "Simulasi lain sedang berjalan. Coba lagi setelah proses itu selesai."},
                429,
            )

        try:
            return json_response(start_response, run_simulation(payload))
        except ValueError as error:
            return json_response(start_response, {"error": str(error)}, 400)
        except Exception:
            traceback.print_exc()
            return json_response(
                start_response,
                {"error": "Simulasi gagal dijalankan. Periksa pengaturan lalu coba lagi."},
                500,
            )
        finally:
            SIMULATION_LOCK.release()

    if path.startswith("/api/"):
        return json_response(start_response, {"error": "Alamat API tidak dikenal."}, 404)
    return json_response(start_response, {"error": "Metode tidak didukung."}, 405)

