/* global self, fetch, Response */
// Navigations only, network-first, no cache: Chrome's install path wants a fetch handler, and the
// app must behave online exactly as it does without one. Non-navigation requests (Server Actions,
// RSC fetches) are never answered here, so they keep failing into the app's own offline toast.

// The account language lives behind the server this page could not reach, so the phone's language
// stands in for it.
const OFFLINE_TEXT = {
  pl: ['Brak połączenia z internetem. Spróbuj ponownie, gdy będzie zasięg.', 'Odśwież'],
  uk: ["Немає з'єднання з інтернетом. Спробуйте ще раз, коли з'явиться зв'язок.", 'Оновити'],
  ru: ['Нет соединения с интернетом. Попробуйте снова, когда появится связь.', 'Обновить'],
}

const offlinePage = () => {
  const phone = self.navigator.language.slice(0, 2)
  const lang = phone in OFFLINE_TEXT ? phone : 'pl'
  const [message, reload] = OFFLINE_TEXT[lang]
  const html = `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wykończymy</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px;text-align:center">
<p>${message}<br><br><a href="">${reload}</a></p>
</body></html>`
  return new Response(html, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

self.addEventListener('install', () => self.skipWaiting())

// Navigation preload starts the network request while the worker boots, instead of after.
self.addEventListener('activate', (event) =>
  event.waitUntil(
    Promise.all([self.registration.navigationPreload?.enable(), self.clients.claim()]),
  ),
)

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) ?? (await fetch(event.request))
      } catch {
        return offlinePage()
      }
    })(),
  )
})
