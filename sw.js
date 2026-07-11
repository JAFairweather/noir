// sw.js — network-first for same-origin GETs.
//
// GitHub Pages serves everything with a fixed 10-minute cache, which is
// wrong for a project iterating this fast: players kept replaying stale
// builds. This worker inverts the policy — always try the network, fall
// back to the last good copy offline — so a plain reload is always the
// current build.

const CACHE = 'noir-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.origin !== location.origin || e.request.method !== 'GET') return
  e.respondWith(
    fetch(e.request).then((res) => {
      const copy = res.clone()
      caches.open(CACHE).then((c) => c.put(e.request, copy))
      return res
    }).catch(() => caches.match(e.request))
  )
})
