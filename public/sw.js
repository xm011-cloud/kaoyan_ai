// Basic Service Worker for offline support + notification click handling
// v8：不再由 Service Worker 缓存用户私有 API 响应，避免账号切换或网络波动导致旧数据回流。
const CACHE_NAME = 'c6-study-v8';

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
// /api/* → 网络直连。私有学习数据由 API 的 no-store 约束；离线只由明确可重放的写入队列处理。
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // 用户私有 API（读取和写入）均不落入 Cache Storage。
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
