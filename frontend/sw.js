// Cache the app shell only. API responses must always come from the network.
const CACHE = 'tempmox-shell-v5';
const SHELL = ['/', '/styles.css', '/app.js', '/icon.svg', '/icon-192.png', '/icon-512.png', '/manifest.json'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener('fetch', event => {
  const path = new URL(event.request.url).pathname;
  if (event.request.method !== 'GET' || path.startsWith('/api/')) return;
  if (SHELL.includes(path)) event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
