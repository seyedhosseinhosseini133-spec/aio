/* ============ Aio — Service Worker (offline PWA) ============ */
'use strict';

const VERSION = 'aio-v5.0';
const CORE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/storage.js',
  './js/markdown.js',
  './js/i18n.js',
  './js/i18n-data-1.js',
  './js/i18n-data-2.js',
  './js/i18n-data-3.js',
  './js/i18n-data-4.js',
  './js/ai.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(CORE.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => {
        /* tell open pages a new version took over → they reload once */
        try { c.postMessage({ type: 'SW_UPDATED', version: VERSION }); } catch (err) {}
      }))
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // navigation → network first, fallback to cached shell (offline)
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('./index.html', copy)).catch(() => {});
        return res;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // same-origin & fonts → cache first, then network (update cache)
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(
      caches.match(req).then(hit => {
        if (hit) {
          // refresh in background
          fetch(req).then(res => {
            if (res && res.ok || res && res.type === 'opaque') {
              caches.open(VERSION).then(c => c.put(req, res)).catch(() => {});
            }
          }).catch(() => {});
          return hit;
        }
        return fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => caches.match('./index.html'));
      })
    );
  }
});
