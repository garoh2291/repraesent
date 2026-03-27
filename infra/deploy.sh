#!/bin/sh
set -e

PATH=/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/bin

APP_DIR="/usr/local/www/my.repraesent.com"
LOG="/var/log/deploy.log"
PIDFILE="/var/run/nodeapp.pid"
NODEAPP_LOG="/var/log/nodeapp.log"

# After rm -rf node_modules there is no ./node_modules/.bin/yarn yet — use jail Yarn once for install only.
bootstrap_yarn() {
	if [ -x /usr/local/bin/yarn ]; then
		/usr/local/bin/yarn "$@"
	elif [ -x /usr/local/lib/node_modules/corepack/shims/yarn ]; then
		/usr/local/lib/node_modules/corepack/shims/yarn "$@"
	else
		echo "$(date "+%Y-%m-%d %H:%M:%S") No yarn in /usr/local/bin or corepack shims" >> "$LOG"
		return 1
	fi
}

echo "$(date "+%Y-%m-%d %H:%M:%S") Deploy started" >> "$LOG"

kill $(cat "$PIDFILE" 2>/dev/null) 2>/dev/null || true
rm -f "$PIDFILE"
sleep 1

cd "$APP_DIR"
git fetch origin >> "$LOG" 2>&1
git reset --hard origin/main >> "$LOG" 2>&1

rm -rf node_modules
bootstrap_yarn install --frozen-lockfile >> "$LOG" 2>&1

YARN_APP="$APP_DIR/node_modules/.bin/yarn"
if [ ! -x "$YARN_APP" ]; then
	echo "$(date "+%Y-%m-%d %H:%M:%S") Missing $YARN_APP after install" >> "$LOG"
	exit 1
fi

"$YARN_APP" run build >> "$LOG" 2>&1

/usr/sbin/daemon -f -p "$PIDFILE" -o "$NODEAPP_LOG" /bin/sh -c "cd \"$APP_DIR\" && exec \"$YARN_APP\" run start"

echo "$(date "+%Y-%m-%d %H:%M:%S") Deploy finished" >> "$LOG"
