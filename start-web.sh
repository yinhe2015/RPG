#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$ROOT_DIR/.quest-web.pid"
LOG_FILE="$ROOT_DIR/.quest-web.log"

if [[ -f "$PID_FILE" ]]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    echo "网页服务已经在运行：http://localhost:${PORT:-5173}（PID ${pid}）"
    exit 0
  fi
  rm -f "$PID_FILE"
fi

cd "$ROOT_DIR"
nohup node server.js >>"$LOG_FILE" 2>&1 &
pid=$!
echo "$pid" >"$PID_FILE"
sleep 0.2
if ! kill -0 "$pid" 2>/dev/null; then
  rm -f "$PID_FILE"
  echo "网页服务启动失败，请查看 $LOG_FILE" >&2
  exit 1
fi
echo "网页服务已启动：http://localhost:${PORT:-5173}（PID ${pid}）"
echo "日志：$LOG_FILE"
