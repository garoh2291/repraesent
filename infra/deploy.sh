#!/bin/sh
set -e

PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/bin

APP_DIR="/usr/local/www/my.repraesent.com"
LOG="/var/log/deploy.log"

echo "$(date "+%Y-%m-%d %H:%M:%S") Deploy started" >> "$LOG"

kill $(cat /var/run/nodeapp.pid 2>/dev/null) 2>/dev/null || true
rm -f /var/run/nodeapp.pid
sleep 1

cd "$APP_DIR"
git fetch origin >> "$LOG" 2>&1
git reset --hard origin/main >> "$LOG" 2>&1

rm -rf node_modules
yarn install --frozen-lockfile >> "$LOG" 2>&1
yarn run build >> "$LOG" 2>&1

service nodeapp start >> "$LOG" 2>&1
echo "$(date "+%Y-%m-%d %H:%M:%S") Deploy finished" >> "$LOG"
