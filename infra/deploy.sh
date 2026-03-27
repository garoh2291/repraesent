#!/bin/sh
set -eu

PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/bin

APP_DIR="/usr/local/www/my.repraesent.com"
LOG="/var/log/deploy.log"
PIDFILE="/var/run/nodeapp.pid"
NODEAPP_LOG="/var/log/nodeapp.log"
YARN_BIN="/usr/local/bin/yarn"
COREPACK_BIN="/usr/local/bin/corepack"
NODE_BIN="/usr/local/bin/node"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"
}

run_yarn() {
  cd "$APP_DIR"

  if [ -x "$YARN_BIN" ]; then
    "$YARN_BIN" "$@"
  elif [ -x "$COREPACK_BIN" ]; then
    "$COREPACK_BIN" yarn "$@"
  else
    log "No yarn or corepack found"
    exit 1
  fi
}

log "Deploy started"

if [ -f "$PIDFILE" ]; then
  kill "$(cat "$PIDFILE" 2>/dev/null)" 2>/dev/null || true
  rm -f "$PIDFILE"
  sleep 1
fi

cd "$APP_DIR"
git fetch origin >> "$LOG" 2>&1
git reset --hard origin/main >> "$LOG" 2>&1
git clean -fdx -e .env -e uploads >> "$LOG" 2>&1

run_yarn install --frozen-lockfile >> "$LOG" 2>&1
run_yarn build >> "$LOG" 2>&1

/usr/sbin/daemon -f -p "$PIDFILE" -o "$NODEAPP_LOG" \
  /bin/sh -c "cd \"$APP_DIR\" && exec \"$NODE_BIN\" node_modules/@react-router/serve/bin.js ./build/server/index.js"

log "Deploy finished"
