from __future__ import annotations

import json
import traceback
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from app import DATASETS, SIMULATION_LOCK, dashboard_data, run_simulation


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        request = urlparse(self.path)

        if request.path == "/api/health":
            self.send_json({"status": "ok"})
            return

        if request.path == "/api/datasets":
            self.send_json(
                {
                    "default": "results",
                    "datasets": [
                        {"id": key, "label": value["label"], "description": value["description"]}
                        for key, value in DATASETS.items()
                    ],
                }
            )
            return

        if request.path == "/api/dashboard":
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
        if urlparse(self.path).path != "/api/simulate":
            self.send_json({"error": "Alamat API tidak dikenal."}, status=404)
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
