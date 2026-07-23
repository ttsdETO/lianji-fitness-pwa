const CACHE_NAME = 'lianji-shell-public-v1'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg?v=3', '/icon-192.png?v=3', '/icon-512.png?v=3']
const BUILD_MANIFEST = '/vite-manifest.json'

const toAssetUrl = (file) => file.startsWith('/') ? file : `/${file}`

const precacheApp = async () => {
  const cache = await caches.open(CACHE_NAME)
  await cache.addAll(APP_SHELL)
  const [indexResponse, manifestResponse] = await Promise.all([
    fetch('/index.html', { cache: 'no-store' }),
    fetch(BUILD_MANIFEST, { cache: 'no-store' }),
  ])
  if (!indexResponse.ok || !manifestResponse.ok) throw new Error('Unable to fetch the application build manifest')

  const manifest = await manifestResponse.clone().json()
  const buildAssets = new Set()
  Object.values(manifest).forEach((entry) => {
    if (entry.file) buildAssets.add(toAssetUrl(entry.file))
    ;[...(entry.css ?? []), ...(entry.assets ?? [])].forEach((file) => buildAssets.add(toAssetUrl(file)))
  })

  await Promise.all([
    cache.put('/index.html', indexResponse),
    cache.put(BUILD_MANIFEST, manifestResponse),
  ])
  await cache.addAll([...buildAssets].filter((url) => !APP_SHELL.includes(url)))
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheApp())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request)
        const cache = await caches.open(CACHE_NAME)
        await cache.put('/index.html', response.clone())
        return response
      } catch {
        return (await caches.match('/index.html')) || Response.error()
      }
    })())
    return
  }
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(event.request, { ignoreVary: true })).then((cached) => cached || fetch(event.request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
      return response
    }).catch(() => cached || Response.error())),
  )
})
