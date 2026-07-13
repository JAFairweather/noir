// sw.js — genuinely network-first for same-origin GETs.
//
// GitHub Pages serves everything with a fixed 10-minute cache. The
// first version of this worker called fetch() with default cache mode,
// which RESPECTS that header — so during rapid deploys the browser
// could assemble the ES-module graph from two different builds, and a
// mixed graph fails to import: a blank page with no error visible.
// 'no-cache' forces revalidation on every asset (cheap: unchanged
// files come back 304), so the whole graph always comes from one
// consistent version. Offline still falls back to the last good copy.

const CACHE = 'noir-v2'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => clients.claim())
))

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.origin !== location.origin || e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(e.request, copy))
      return res
    }).catch(() => caches.match(e.request))
  )
})
