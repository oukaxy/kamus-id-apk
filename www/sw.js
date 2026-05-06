const CACHE = 'kamus-v4';
const BASE = '/Kamus-id';

// File yang langsung di-cache saat install
const FILES = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/sw.js',
];

// Install: langsung cache semua file sekaligus
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(FILES).catch(() => {
        return Promise.all(
          FILES.map(url => cache.add(url).catch(() => {}))
        );
      });
    })
  );
  self.skipWaiting();
});

// Activate: hapus cache lama
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first, update di background
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const net = fetch(e.request).then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            cache.put(e.request, res.clone());
          }
          return res;
        }).catch(() => cached || new Response('Offline', { status: 503 }));
        return cached || net;
      })
    )
  );
});
