#!/usr/bin/env python3
"""Servidor HTTP para acionar o pipeline remotamente via n8n Cloud.

Execute antes de rodar o workflow no n8n:
    python scripts/trigger_server.py

Para expor na internet (necessario para n8n Cloud):
    ngrok http 8080
    -> copie a URL gerada e cole nos nos HTTP Request do workflow n8n
"""
from __future__ import annotations

import json
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PYTHON = sys.executable

ROUTES: dict[str, list[str]] = {
    "/pipeline": ["scripts/2_run_pipeline.py", "--incremental"],
    "/enrich": ["scripts/3_run_ai_enrichment.py", "--limite", "50"],
    "/authors": ["scripts/4_run_authors_bridge.py", "--only-missing", "--limit", "200"],
    "/votes": ["scripts/5_run_votes_bridge.py", "--only-missing", "--limit", "100"],
}


def _run(script_args: list[str], timeout: int = 900) -> dict:
    result = subprocess.run(
        [PYTHON] + script_args,
        capture_output=True,
        text=True,
        timeout=timeout,
        cwd=ROOT,
    )
    return {
        "ok": result.returncode == 0,
        "returncode": result.returncode,
        "stdout": result.stdout[-5000:],
        "stderr": result.stderr[-2000:],
    }


class TriggerHandler(BaseHTTPRequestHandler):
    def _respond(self, status: int, body: dict) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"ok": True, "routes": list(ROUTES.keys())})
        else:
            self._respond(404, {"ok": False, "error": "use POST /pipeline ou POST /enrich"})

    def do_POST(self):
        args = ROUTES.get(self.path)
        if args is None:
            self._respond(404, {"ok": False, "error": f"rota nao encontrada: {self.path}"})
            return
        print(f"[trigger] iniciando: {' '.join(args)}")
        try:
            result = _run(args)
            status = 200 if result["ok"] else 500
            self._respond(status, result)
            print(f"[trigger] finalizado com returncode={result['returncode']}")
        except subprocess.TimeoutExpired:
            self._respond(504, {"ok": False, "error": "timeout — pipeline demorou mais de 15 min"})
        except Exception as exc:
            self._respond(500, {"ok": False, "error": str(exc)})

    def log_message(self, fmt, *args):
        print(f"[trigger] {self.address_string()} {fmt % args}")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    server = HTTPServer(("0.0.0.0", port), TriggerHandler)
    print(f"[trigger] Servidor rodando em http://0.0.0.0:{port}")
    print(f"[trigger] Raiz do projeto: {ROOT}")
    print("[trigger] Rotas disponíveis:")
    print("[trigger]   GET  /health   — verifica se o servidor esta rodando")
    print("[trigger]   POST /pipeline — 2_run_pipeline.py --incremental")
    print("[trigger]   POST /enrich   — 3_run_ai_enrichment.py --limite 50")
    print("[trigger]   POST /authors  — 4_run_authors_bridge.py --only-missing --limit 200")
    print("[trigger]   POST /votes    — 5_run_votes_bridge.py --only-missing --limit 100")
    print("[trigger] Pressione Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[trigger] Servidor encerrado.")
