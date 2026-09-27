/* re:praesent service worker (PWA_PUSH_PLAN.md).
 *
 * Hand-written on purpose: vite-plugin-pwa does not support React Router 7 SSR.
 * What it does, and nothing more:
 *   - page loads: network first; offline → the cached /offline.html
 *   - /assets/*: cache first (content-hashed build files, safe to keep)
 *   - never caches /api, *.data, HTML or anything cross-origin
 *   - shows phone alerts (push) and opens the right page when one is tapped
 *
 * Bump VERSION whenever this file changes: the app then shows
 * "New version ready · Reload" and old caches are removed on activate.
 * Served with Cache-Control: no-cache (infra/nginx.conf) so updates are seen.
 */
const VERSION = "v3";
const STATIC_CACHE = `rp-static-${VERSION}`;
const ASSET_CACHE = `rp-assets-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const ICON = "/icons/app-192.png";
const BADGE = "/icons/badge-96.png";
const MAX_ASSETS = 200;

const PRECACHE = [
  OFFLINE_URL,
  "/icons/app-192.png",
  "/icons/app-512.png",
  "/icons/apple-touch-icon-180.png",
  BADGE,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // `reload`: never pre-cache a stale copy out of the HTTP cache.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: "reload" }))))
      .catch(() => undefined),
  );
  // No skipWaiting() here: an update waits until the app says "Reload"
  // (SKIP_WAITING message), so a page never switches worker mid-task.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, ASSET_CACHE]);
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("rp-") && !keep.has(n)).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") self.skipWaiting();
});

/* ── Fetch ─────────────────────────────────────────────────────────────── */

async function trimAssets() {
  try {
    const cache = await caches.open(ASSET_CACHE);
    const keys = await cache.keys();
    // Oldest first (insertion order); drop the overflow.
    for (let i = 0; i < keys.length - MAX_ASSETS; i++) await cache.delete(keys[i]);
  } catch {
    /* best effort */
  }
}

async function assetCacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  const type = response.headers.get("Content-Type") || "";
  // Only real, complete, non-HTML files. A 404 page or an HTML fallback must
  // never be stored under a script's name.
  if (response.ok && response.status === 200 && !type.includes("text/html")) {
    cache.put(request, response.clone()).then(trimAssets).catch(() => undefined);
  }
  return response;
}

async function navigationNetworkFirst(request) {
  try {
    // Never cached: the page is rendered per user on the server.
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    return offline || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  // API calls and React Router data requests go straight to the network.
  if (url.pathname.startsWith("/api") || url.pathname.endsWith(".data")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigationNetworkFirst(request));
    return;
  }
  // Hashed build output. The Vite dev server never serves /assets/, so
  // nothing is cached while developing.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(assetCacheFirst(request));
  }
  // Everything else: the browser's normal behaviour.
});

/* ── Push ──────────────────────────────────────────────────────────────── */

/**
 * Always a URL on this app's own origin. A link built for another host (say
 * the server's REPRAESENT_APP_URL differs from where the app was installed)
 * keeps its path, so it still opens the right page here; it never leaves.
 */
function safeTarget(raw) {
  try {
    const url = new URL(typeof raw === "string" && raw ? raw : "/", self.location.origin);
    if (url.origin !== self.location.origin) {
      return new URL(url.pathname + url.search + url.hash, self.location.origin).href;
    }
    return url.href;
  } catch {
    return new URL("/", self.location.origin).href;
  }
}

function readPayload(event) {
  if (!event.data) return {};
  try {
    const json = event.data.json();
    return json && typeof json === "object" ? json : {};
  } catch {
    try {
      const text = event.data.text();
      return text ? { notification: { body: String(text).slice(0, 200) } } : {};
    } catch {
      return {};
    }
  }
}

self.addEventListener("push", (event) => {
  // ALWAYS show something. iOS revokes the subscription of a worker that
  // receives a push and shows nothing, so even a broken payload gets a
  // plain "re:praesent" notification.
  event.waitUntil(
    (async () => {
      let title = "re:praesent";
      const options = { icon: ICON, badge: BADGE, data: { navigate: safeTarget("/") } };
      try {
        const payload = readPayload(event);
        const n = payload.notification && typeof payload.notification === "object" ? payload.notification : payload;
        if (typeof n.title === "string" && n.title.trim()) title = n.title;
        if (typeof n.body === "string") options.body = n.body;
        if (typeof n.lang === "string") options.lang = n.lang;
        if (typeof n.tag === "string" && n.tag) {
          options.tag = n.tag;
          options.renotify = true;
        }
        if (n.silent === true) options.silent = true;
        const extra = payload.data && typeof payload.data === "object" ? payload.data : {};
        options.data = { ...extra, navigate: safeTarget(n.navigate) };
        // Android only (the server sends them to Android devices): "Call now"
        // and "Remind me in 1 hour". Other platforms ignore or never get them.
        if (Array.isArray(n.actions)) {
          const actions = n.actions
            .filter((a) => a && typeof a.action === "string" && typeof a.title === "string")
            .slice(0, 2)
            .map((a) => ({ action: a.action, title: a.title }));
          if (actions.length) options.actions = actions;
        }

        if (typeof n.app_badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
          try {
            if (n.app_badge > 0) await self.navigator.setAppBadge(n.app_badge);
            else await self.navigator.clearAppBadge();
          } catch {
            /* badge is a nice-to-have */
          }
        }
      } catch {
        /* fall through to the plain notification */
      }
      await self.registration.showNotification(title, options);
    })(),
  );
});

/** "Remind me in 1 hour": the server re-queues the same alert. No page opens. */
async function snooze(data) {
  const s = data && data.snooze;
  if (!s || typeof s.url !== "string" || typeof s.token !== "string") return;
  let url;
  try {
    url = new URL(s.url);
  } catch {
    return;
  }
  if (url.protocol !== "https:" && url.hostname !== "localhost") return;
  try {
    await fetch(url.href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: s.token }),
      credentials: "omit",
    });
  } catch {
    /* offline: the alert simply doesn't come back */
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  if (event.action === "snooze") {
    event.waitUntil(snooze(data));
    return;
  }
  // "Call now" opens the inquiry with ?call=1; the page starts the call.
  const raw = event.action === "call" && typeof data.call_url === "string" ? data.call_url : data.navigate;
  const target = safeTarget(raw);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });
      if (open) {
        try {
          await open.focus();
        } catch {
          /* focus can be refused; navigating still helps */
        }
        if ("navigate" in open) {
          try {
            await open.navigate(target);
            return;
          } catch {
            /* uncontrolled window: ask the page to route itself */
          }
        }
        open.postMessage({ type: "NAVIGATE", url: target });
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/*
 * The browser replaced the push subscription (rare; key rotation or expiry).
 * The worker can re-subscribe, but it cannot tell the server: the sign-in
 * token lives in the page's localStorage, which a worker cannot read. So it
 * re-subscribes with the same key and tells any open page; every app open
 * also re-sends the current subscription (lib/pwa/use-pwa.ts), which is what
 * reaches the server when no page is open right now.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const old = event.oldSubscription;
        const key = old && old.options && old.options.applicationServerKey;
        if (!event.newSubscription && key) {
          await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        }
      } catch {
        /* the page re-subscribes on next open */
      }
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((c) => c.postMessage({ type: "PUSH_SUBSCRIPTION_CHANGED" }));
    })(),
  );
});
