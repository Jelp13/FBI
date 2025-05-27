// Service Worker simplificado para Codespaces
const CACHE_NAME = 'fbi-wanted-v1.0.3';

const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js'
];

// Instalar
self.addEventListener('install', event => {
  console.log('SW: Instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('SW: Cacheando archivos...');
        return Promise.allSettled(
          FILES_TO_CACHE.map(url => 
            cache.add(url).catch(err => {
              console.warn('SW: No se pudo cachear', url);
              return null;
            })
          )
        );
      })
      .then(() => {
        console.log('SW: Instalación completa');
        return self.skipWaiting();
      })
  );
});

// Activar
self.addEventListener('activate', event => {
  console.log('SW: Activando...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('SW: Eliminando caché antigua');
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('SW: Activado');
      return self.clients.claim();
    })
  );
});

// Fetch
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Saltar requests de GitHub
  if (url.hostname.includes('github.dev') || 
      url.pathname.includes('auth')) {
    return;
  }
  
  // Manejar API del FBI
  if (url.hostname === 'api.fbi.gov') {
    event.respondWith(handleAPI(event.request));
    return;
  }
  
  // Otros requests - Network First
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && event.request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// Manejar API
async function handleAPI(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }
  } catch (error) {
    console.log('SW: Error API, buscando en caché');
  }
  
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }
  
  // Fallback offline
  return new Response(JSON.stringify({
    items: [],
    offline: true,
    message: 'Sin conexión'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}