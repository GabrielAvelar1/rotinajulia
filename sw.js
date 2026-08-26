const CACHE_NAME = 'rotina-julia-v1';
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

// Instalação do Service Worker e cache dos recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
  );
});

// Interceptar as requisições para servir do cache caso esteja offline
self.addEventListener('fetch', (event) => {
  // Apenas tentar cachear requisições para a mesma origem (evita bugar APIs do Supabase)
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }
});
