"""Serve the same Python handler used by Vercel during local development."""
from http.server import ThreadingHTTPServer
from pathlib import Path
import runpy
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
handler = runpy.run_path(str(ROOT / "api" / "[...path].py"))["handler"]

if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8000), handler)
    print("Python API: http://127.0.0.1:8000")
    server.serve_forever()
