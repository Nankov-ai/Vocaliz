const CACHE = 'vocaliz-v2';
const SHELL = [
  '/Vocaliz/',
  '/Vocaliz/index.html',
  '/Vocaliz/app.js',
  '/Vocaliz/style.css',
  '/Vocaliz/nodeflow_icon.svg',
  '/Vocaliz/manifest.json',
];

// External CDN libs — cache on first fetch
const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept Hugging Face model downloads — Transformers.js handles its own caching
  if (url.hostname.includes('huggingface.co')) return;

  // Cache-first for CDN libs
  if (CDN_HOSTS.some(h => url.hostname.includes(h))) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // Cache-first for app shell
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
});
