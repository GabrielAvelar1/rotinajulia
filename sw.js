const CACHE_NAME = 'rotina-julia-v5';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/supabase.js',
  './js/banner.js',
  './js/folders.js',
  './js/tasks.js',
  './js/calendar.js',
  './js/routines.js',
  './js/charts.js',
  './js/player.js',
  './manifest.json',
  './calendario.png'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Limpando cache antigo do Service Worker:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First para arquivos locais: Sempre busca a versão mais recente na rede.
// Se a rede falhar (ex: offline), serve do cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Apenas gerenciar recursos do próprio domínio
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Se estiver offline ou a rede falhar, pega do cache
          return caches.match(event.request);
        })
    );
  }
});
