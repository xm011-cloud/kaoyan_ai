// Basic Service Worker for offline support + notification click handling
// v6：任务勾选热修 bundle 变更 → 强制刷新已安装 PWA（v5 的旧 bundle 会让 checkbox 修复不生效）
const CACHE_NAME = 'c6-study-v6';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/login',
  '/favicon.ico',
  '/offline.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).catch(() => {
      // Individual asset failures shouldn't block installation
    })
  );
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // 有旧版缓存 = 真升级（非首次安装）：通知已打开的页面「有新版本」，由页面展示刷新提示。
      // 不自动 navigate 刷新页面——避免打断用户正在进行的操作，也避免测试/工作流被中途重载。
      const hadOldCache = keys.some((key) => key !== CACHE_NAME);
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
        .then(() => self.clients.claim())
        .then(() => {
          if (hadOldCache) {
            return self.clients.matchAll({ type: 'window' }).then((clients) =>
              clients.forEach((c) => c.postMessage({ type: 'app-updated' }))
            );
          }
        });
    })
  );
});

// Network-first strategy for navigation, cache-first for static assets.
// GET /api/* → network-first with cache fallback（离线读已访问过的数据）。
// 非 GET 的 /api/* → 网络直连（写入类请求由客户端离线队列接管，见 src/lib/offline-queue.ts）。
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // API GET - network first, cache response for offline reads
  if (url.pathname.startsWith('/api/') && event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // API non-GET - network only
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests - network first, fallback to cache, then offline.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(
            (cached) => cached || caches.match('/offline.html')
          )
        )
    );
    return;
  }

  // Static assets - cache first
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

// 登出时清空 API 缓存，避免下一位登录者读到上一位用户的数据
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'clear-api-cache') return;
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.keys().then((keys) =>
        Promise.all(
          keys
            .filter((req) => new URL(req.url).pathname.startsWith('/api/'))
            .map((req) => cache.delete(req))
        )
      )
    )
  );
});

// Notification click → open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) {
        clients[0].focus();
      } else {
        self.clients.openWindow('/dashboard');
      }
    })
  );
});
