#!/bin/sh
set -e

PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/bin

APP_DIR="/usr/local/www/my.repraesent.com"
LOG="/var/log/deploy.log"

echo "$(date "+%Y-%m-%d %H:%M:%S") Deploy started" >> "$LOG"
cd "$APP_DIR"
git pull origin main >> "$LOG" 2>&1
yarn install --frozen-lockfile >> "$LOG" 2>&1
yarn build >> "$LOG" 2>&1
kill $(cat /var/run/nodeapp.pid 2>/dev/null) 2>/dev/null || true
rm -f /var/run/nodeapp.pid
sleep 1
service nodeapp start >> "$LOG" 2>&1
echo "$(date "+%Y-%m-%d %H:%M:%S") Deploy finished" >> "$LOG"
