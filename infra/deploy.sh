#!/bin/sh
set -e

APP_DIR="/usr/local/www/my.repraesent.com"
LOG="/var/log/deploy.log"

echo "$(date "+%Y-%m-%d %H:%M:%S") Deploy started" >> "$LOG"
cd "$APP_DIR"
git pull origin main >> "$LOG" 2>&1
npm ci >> "$LOG" 2>&1
npm run build >> "$LOG" 2>&1
service nodeapp restart >> "$LOG" 2>&1
echo "$(date "+%Y-%m-%d %H:%M:%S") Deploy finished" >> "$LOG"
