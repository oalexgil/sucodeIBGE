/* IBGE 2026 — Painel de Estudos · Service Worker */
const CACHE = "ibge-app-v1";
const CORE = [
  "./",
  "./index.html",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./cursos/Curso-Lingua-Portuguesa-IBGE.html",
  "./cursos/Curso-Raciocinio-Logico-IBGE.html",
  "./cursos/Curso-Conhecimentos-Especificos-IBGE.html"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Mesmo domínio: stale-while-revalidate (abre rápido/offline e atualiza por trás).
   Outros domínios (GitHub API, Gemini, Grok…): passa direto pela rede, sem cache. */
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const fresh = fetch(e.request)
        .then((res) => {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
