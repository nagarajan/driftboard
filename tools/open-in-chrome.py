#!/usr/bin/env python3
"""Loopback helper that opens Drift Board's external links in Google Chrome.

Firefox has no way to hand a link to another browser, so the board posts the
URL here instead and this process shells out to `open`. Only requests carrying
an allowed Origin are honoured, since anything running in any browser on this
machine can reach a loopback port.
"""

import json
import re
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = "127.0.0.1"
PORT = 17324
BROWSER = "Google Chrome"

ALLOWED_ORIGINS = frozenset(
    {
        "https://motleytech.net",
        "http://localhost:8095",
        "http://127.0.0.1:8095",
    }
)

MAX_BODY_BYTES = 8192
MAX_URL_LENGTH = 4096
CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def is_openable(url: str) -> bool:
    if not url or len(url) > MAX_URL_LENGTH or CONTROL_CHARS.search(url):
        return False
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


class Handler(BaseHTTPRequestHandler):
    server_version = "DriftBoardChromeOpener/1.0"
    protocol_version = "HTTP/1.1"

    def respond(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health":
            self.respond(404, {"error": "not found"})
            return
        self.respond(200, {"ok": True, "browser": BROWSER})

    def do_POST(self) -> None:
        if self.path != "/open":
            self.respond(404, {"error": "not found"})
            return

        if self.headers.get("Origin", "") not in ALLOWED_ORIGINS:
            self.respond(403, {"error": "origin not allowed"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY_BYTES:
            self.respond(400, {"error": "bad content length"})
            return

        try:
            url = json.loads(self.rfile.read(length))["url"]
        except (ValueError, KeyError, TypeError):
            self.respond(400, {"error": "malformed body"})
            return

        if not isinstance(url, str) or not is_openable(url):
            self.respond(400, {"error": "unsupported url"})
            return

        try:
            subprocess.run(
                ["/usr/bin/open", "-a", BROWSER, url],
                check=True,
                timeout=15,
            )
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
            self.log_error("failed to open %s: %s", url, exc)
            self.respond(502, {"error": "could not launch browser"})
            return

        self.respond(200, {"ok": True})

    def log_message(self, fmt: str, *args) -> None:
        """Silence the per-request access log; errors still go to stderr."""


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    server.serve_forever()


if __name__ == "__main__":
    main()
