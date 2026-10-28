// Offline play: once the game has been opened, every file it uses is kept here, so it starts again without internet
// (worlds are already in this browser's IndexedDB). With a connection the newest files are always fetched first, and the
// copy is refreshed; without one, or when the network is too slow, the kept copy answers.
const CACHE = 'nemo-offline-v1';
const NETWORK_WAIT = 4000; // ms before a slow network gives way to the kept copy

// on install: the page itself and every script, style and font it names
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await fetch('index.html', { cache: 'no-cache' }); if (!res.ok) return;
      const html = await res.clone().text(); await c.put('index.html', res); await c.put('./', new Response(html, { headers: res.headers }));
      const files = new Set(['fonts/Galmuri11-Bold.woff2']);
      for (const m of html.matchAll(/(?:src|href)="([^"#?:]+\.(?:js|css|woff2|png))"/g)) files.add(m[1]);
      await Promise.all([...files].map(f => fetch(f, { cache: 'no-cache' }).then(r => r.ok && c.put(f, r)).catch(() => {})));
    } catch (er) {} // offline at install: the files are kept as they are used instead
  })());
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })());
});
// what is never kept: multiplayer (/mp, /rooms, /ping) and anything on another host
const skip = url => url.origin !== self.location.origin || /\/(mp|rooms|ping)(\/|$)/.test(url.pathname);
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || skip(url)) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const net = fetch(req).then(res => { if (res.ok && res.type === 'basic') c.put(req, res.clone()).catch(() => {}); return res; });
    const kept = c.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? c.match('index.html') : null));
    // the network first; the kept copy if it fails or takes too long
    const slow = new Promise(r => setTimeout(r, NETWORK_WAIT, 'slow'));
    try { const r = await Promise.race([net, slow]); if (r !== 'slow') return r; const k = await kept; if (k) { net.catch(() => {}); return k; } return await net; }
    catch (er) { const k = await kept; if (k) return k; throw er; }
  })());
});
