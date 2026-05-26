const CACHE = 'mah-v12';
const PRECACHE = ['/', '/mech-arena-hub.html', '/calc-data-list.js', '/calc-data-mech-costs.js',
  '/calc-data-pilots.js', '/calc-data-pilot-costs.js', '/calc-data-mods.js', '/calc-data-mod-costs.js',
  '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.svg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // API calls — network only
  if (url.pathname.startsWith('/api/')) return;
  // mech images — network first, cache fallback
  if (url.hostname === 'mecharena.infohubhq.in') {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  // everything else — cache first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return r;
    }))
  );
});
