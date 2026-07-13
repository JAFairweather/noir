// sw.js — KILL SWITCH.
//
// Noir used to ship a caching service worker. It caused stale-module
// blank screens: during rapid deploys a browser could assemble the
// ES-module graph from two different builds, and a mixed graph fails to
// import — a blank page with no visible error. The offline benefit was
// never worth that risk for a CDN-served game.
//
// So the app no longer uses a service worker at all. This file exists
// ONLY to evict any previously-installed worker: it purges every cache,
// unregisters itself, and reloads controlled pages once — clean, from
// the network. The browser delivers this to already-controlled browsers
// automatically via its service-worker update check, so poisoned tabs
// self-heal on their next visit with no user action.

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
    for (const client of await self.clients.matchAll()) {
      try { client.navigate(client.url) } catch { /* older clients: next manual reload is clean */ }
    }
  })())
})

// No fetch handler on purpose: every request goes straight to the network
// (and the browser's normal HTTP cache), exactly as if no worker existed.
