#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.quest-web.pid"
if [[ ! -f "$PID_FILE" ]]; then
  echo "网页服务没有通过 start-web.sh 启动。"
  exit 0
fi
pid="$(cat "$PID_FILE" 2>/dev/null || true)"
rm -f "$PID_FILE"
if [[ ! "$pid" =~ ^[0-9]+$ ]] || ! kill -0 "$pid" 2>/dev/null; then
  echo "网页服务已经停止。"
  exit 0
fi
kill "$pid" 2>/dev/null || true
for _ in {1..30}; do
  kill -0 "$pid" 2>/dev/null || { echo "网页服务已停止。"; exit 0; }
  sleep 0.1
done
kill -KILL "$pid" 2>/dev/null || true
echo "网页服务已强制停止。"
