from __future__ import annotations

import csv
import json
import math
import mimetypes
import os
import threading
import traceback
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from auth import (
    AuthConfigurationError,
    AuthDenied,
    AuthForbidden,
    AuthProviderUnavailable,
    public_auth_config,
    verify_authorization_header,
)
from wsn_gwo_v2.config import SimulationConfig
from wsn_gwo_v2.fuzzy import MembershipSet
from wsn_gwo_v2.wsn import NetworkSimulator, create_topology


ROOT = Path(__file__).resolve().parent
WEB_ROOT = ROOT / "web"
GWO_MODEL = ROOT / "results" / "membership_gwo.json"
SIMULATION_LOCK = threading.Lock()

DATASETS = {
    "results": {
        "label": "Eksperimen utama",
        "description": "Ringkasan eksperimen FUZZY, LEACH, dan GWO.",
        "path": ROOT / "results",
    },
    "hasil_optimasi_10seed": {
        "label": "Kalibrasi 10 seed",
        "description": "Model GWO dilatih pada sepuluh seed dan divalidasi pada topologi terpisah.",
        "paths": [ROOT / "hasil_optimasi_10seed", ROOT / "validasi_results_10seed"],
    },
    "optimasi_seed42_weight030": {
        "label": "Eksperimen seed 42",
        "description": "Seed 42 ikut dalam latihan GWO, jadi bukan pengujian independen.",
        "path": ROOT / "optimasi_seed42_weight030",
    },
}


def read_csv_rows(path: Path) -> list[dict]:
    if not path.is_file():
        return []

    with path.open("r", encoding="utf-8-sig", newline="") as file:
        rows = []
        for row in csv.DictReader(file):
            converted = {}
            for key, value in row.items():
                if value is None or value == "":
                    converted[key] = None
                    continue
                try:
                    number = float(value)
                    if not math.isfinite(number):
                        converted[key] = None
                    elif number.is_integer():
                        converted[key] = int(number)
                    else:
                        converted[key] = number
                except ValueError:
                    converted[key] = value
            rows.append(converted)
        return rows


def read_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def dashboard_data(dataset_id: str) -> dict:
    dataset = DATASETS[dataset_id]
    folder = next(
        (path for path in dataset.get("paths", [dataset.get("path")]) if path and path.is_dir()),
        dataset.get("paths", [dataset.get("path")])[0],
    )
    history = read_csv_rows(folder / "round_metrics.csv")
    return {
        "dataset": {
            "id": dataset_id,
            "label": dataset["label"],
            "description": dataset["description"],
        },
        "summary": read_csv_rows(folder / "protocol_summary.csv"),
        "validation": read_csv_rows(folder / "validation_summary.csv"),
        "validation_rows": read_csv_rows(folder / "validation.csv"),
        "history": [
            {
                "protocol": row.get("protocol"),
                "round_number": row.get("round_number"),
                "alive_nodes": row.get("alive_nodes"),
            }
            for row in history
        ],
        "membership": read_json(folder / "membership_gwo.json")
        or read_json(GWO_MODEL),
    }


def run_simulation(payload: dict) -> dict:
    try:
        nodes = int(payload.get("nodes", 30))
        rounds = int(payload.get("rounds", 1600))
        seed = int(payload.get("seed", 42))
        head_count = int(payload.get("cluster_head_count", 1))
    except (TypeError, ValueError) as error:
        raise ValueError("Isi semua pengaturan dengan angka bulat.") from error

    if not 10 <= nodes <= 60:
        raise ValueError("Jumlah node harus antara 10 dan 60.")
    if not 100 <= rounds <= 2000:
        raise ValueError("Jumlah ronde harus antara 100 dan 2.000.")
    if not 0 <= seed <= 999999:
        raise ValueError("Seed harus antara 0 dan 999.999.")
    if not 1 <= head_count <= min(nodes, 10):
        raise ValueError("Jumlah cluster head harus antara 1 dan 10.")

    config = SimulationConfig(
        nodes=nodes,
        rounds=rounds,
        seed=seed,
        cluster_head_count=head_count,
    )
    topology = create_topology(config, seed)
    membership = MembershipSet.load(GWO_MODEL)
    summaries = []
    history = []

    for protocol in ("FUZZY", "LEACH", "GWO"):
        simulation = NetworkSimulator(
            config,
            protocol,
            initial_nodes=topology,
            membership=membership if protocol == "GWO" else None,
        )
        history.extend(asdict(row) for row in simulation.run())
        summaries.append(asdict(simulation.summary()))

    return {
        "config": {
            "nodes": nodes,
            "rounds": rounds,
            "seed": seed,
            "cluster_head_count": head_count,
        },
        "summary": summaries,
        "history": history,
    }


class DashboardHandler(BaseHTTPRequestHandler):
    server_version = "FuzzyCHWSN/1.0"

    def do_GET(self) -> None:
        request = urlparse(self.path)
        if request.path == "/api/health":
            self.send_json({"status": "ok"})
            return

        if request.path == "/api/auth/config":
            try:
                self.send_json(public_auth_config())
            except AuthConfigurationError as error:
                self.send_json({"error": str(error)}, status=503)
            return

        if request.path == "/api/datasets":
            if not self.require_authentication():
                return
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
            if not self.require_authentication():
                return
            params = parse_qs(request.query)
            dataset_id = params.get("dataset", ["results"])[0]
            if dataset_id not in DATASETS:
                self.send_json({"error": "Dataset tidak dikenal."}, status=404)
                return
            try:
                self.send_json(dashboard_data(dataset_id))
            except (OSError, ValueError, json.JSONDecodeError) as error:
                self.send_json({"error": f"Data eksperimen tidak dapat dibaca: {error}"}, status=500)
            return

        self.serve_static(request.path)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/simulate":
            self.send_json({"error": "Alamat API tidak dikenal."}, status=404)
            return

        if not self.require_authentication():
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length <= 0 or content_length > 32_768:
                raise ValueError("Permintaan simulasi tidak valid.")
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise ValueError("Pengaturan simulasi tidak valid.")
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json({"error": str(error) or "Permintaan simulasi tidak valid."}, status=400)
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
        except Exception as error:
            traceback.print_exc()
            self.send_json({"error": "Simulasi gagal dijalankan. Periksa pengaturan lalu coba lagi."}, status=500)
        finally:
            SIMULATION_LOCK.release()

    def require_authentication(self) -> bool:
        try:
            verify_authorization_header(self.headers.get("Authorization", ""))
            return True
        except AuthConfigurationError as error:
            self.send_json({"error": str(error)}, status=503)
        except AuthDenied as error:
            self.send_json({"error": str(error)}, status=401)
        except AuthForbidden as error:
            self.send_json({"error": str(error)}, status=403)
        except AuthProviderUnavailable:
            self.send_json(
                {"error": "Layanan login tidak dapat dihubungi. Coba lagi sebentar."},
                status=503,
            )
        return False

    def serve_static(self, url_path: str) -> None:
        relative_path = unquote(url_path.lstrip("/")) or "index.html"
        file_path = (WEB_ROOT / relative_path).resolve()
        if WEB_ROOT not in file_path.parents and file_path != WEB_ROOT:
            self.send_error(404)
            return
        if not file_path.is_file():
            self.send_error(404)
            return

        content_type, _ = mimetypes.guess_type(file_path.name)
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type or 'application/octet-stream'}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache" if file_path.suffix in {".html", ".js", ".css"} else "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, data: dict, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False, allow_nan=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.log_date_time_string()} - {format % args}")


def main() -> None:
    host = "0.0.0.0"
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), DashboardHandler)
    print(f"Fuzzy CH WSN web berjalan di http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()

