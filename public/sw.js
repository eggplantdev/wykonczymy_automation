// Navigations only, network-first, no cache: Chrome's install path wants a fetch handler, and the
// app must behave online exactly as it does without one. Non-navigation requests (Server Actions,
// RSC fetches) are never answered here, so they keep failing into the app's own offline toast.
const OFFLINE_HTML = `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wykończymy</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;text-align:center">
<p>Brak połączenia z internetem. Spróbuj ponownie, gdy będzie zasięg.<br><br><a href="">Odśwież</a></p>
</body></html>`

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(OFFLINE_HTML, {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
    ),
  )
})
