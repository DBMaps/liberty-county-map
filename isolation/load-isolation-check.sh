#!/usr/bin/env bash
set -euo pipefail
PORT="${1:-4173}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
python3 -m http.server "$PORT" >/tmp/gridly-isolation-http.log 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT
sleep 1
for path in \
  "/isolation/static-smoke.html" \
  "/isolation/index-app-disabled.html" \
  "/isolation/index-vendor-only-no-app.html" \
  "/index.html" \
  "/js/app.js?v=1714"; do
  code="$(curl -sS -o /tmp/gridly-isolation-response -w '%{http_code}' "http://127.0.0.1:${PORT}${path}")"
  bytes="$(wc -c </tmp/gridly-isolation-response | tr -d ' ')"
  echo "${code} ${bytes} ${path}"
done
node --check js/app.js
