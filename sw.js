const CACHE_NAME = 'fbi-wanted-v1.0.0';
const STATIC_CACHE = 'fbi-wanted-static-v1.0.0';
const DYNAMIC_CACHE = 'fbi-wanted-dynamic-v1.0.0';

// Base path para GitHub Pages
const BASE_PATH = '/FBI';

// Archivos que se almacenarán en caché para funcionamiento offline
const STATIC_FILES = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/style.css`,
  `${BASE_PATH}/script.js`,
  `${BASE_PATH}/manifest.json`,
  'https://via.placeholder.com/250?text=No+Image',
  'https://via.placeholder.com/250?text=Error+Image'
];

// URLs de la API que se cachearán
const API_URLS = [
  'https://api.fbi.gov/wanted/v1/list'
];

// Instalar el Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Cacheando archivos estáticos');
        return cache.addAll(STATIC_FILES);
      })
      .then(() => {
        console.log('Service Worker: Instalación completada');
        return self.skipWaiting(); // Activar inmediatamente
      })
      .catch(error => {
        console.error('Service Worker: Error durante la instalación:', error);
      })
  );
});

// Activar el Service Worker
self.addEventListener('activate', event => {
  console.log('Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Eliminar cachés antiguas
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Eliminando caché antigua:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activación completada');
        return self.clients.claim(); // Tomar control inmediatamente
      })
  );
});

// Interceptar requests (Estrategia Cache First para archivos estáticos)
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Manejar solicitudes a la API del FBI
  if (url.origin === 'https://api.fbi.gov') {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // Manejar archivos estáticos (HTML, CSS, JS, imágenes)
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image' ||
      request.destination === 'manifest') {
    event.respondWith(handleStaticRequest(request));
    return;
  }
  
  // Para otras solicitudes, usar network first
  event.respondWith(
    fetch(request)
      .catch(() => {
        // Si falla la red, intentar desde caché
        return caches.match(request);
      })
  );
});

// Manejar solicitudes a la API (Network First con fallback a caché)
async function handleAPIRequest(request) {
  try {
    // Intentar obtener datos frescos de la red
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Si la respuesta es exitosa, guardar en caché dinámico
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log('Service Worker: Error de red, buscando en caché:', error);
  }
  
  // Si falla la red o hay error, buscar en caché
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Si no hay caché, devolver respuesta offline
  return new Response(
    JSON.stringify({
      items: [],
      offline: true,
      message: 'Datos no disponibles sin conexión'
    }),
    {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

// Manejar archivos estáticos (Cache First)
async function handleStaticRequest(request) {
  // Buscar primero en caché
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Si no está en caché, obtener de la red
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Guardar en caché dinámico
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Error al obtener recurso:', error);
    
    // Fallback para páginas HTML
    if (request.destination === 'document') {
      return caches.match(`${BASE_PATH}/index.html`);
    }
    
    // Para otros recursos, devolver error
    return new Response('Recurso no disponible offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Manejar notificaciones push (para futuras implementaciones)
self.addEventListener('push', event => {
  console.log('Service Worker: Notificación push recibida');
  
  const options = {
    body: event.data ? event.data.text() : 'Nueva persona buscada disponible',
    icon: 'https://via.placeholder.com/192x192/00285e/ffffff?text=FBI',
    badge: 'https://via.placeholder.com/72x72/00285e/ffffff?text=FBI',
    vibrate: [200, 100, 200],
    data: {
      url: `${BASE_PATH}/?tab=wanted`
    },
    actions: [
      {
        action: 'view',
        title: 'Ver detalles'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('FBI Wanted', options)
  );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Click en notificación');
  
  event.notification.close();
  
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || `${BASE_PATH}/`)
    );
  }
});

// Manejar sincronización en segundo plano
self.addEventListener('sync', event => {
  console.log('Service Worker: Evento de sincronización:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(syncData());
  }
});

// Función para sincronizar datos en segundo plano
async function syncData() {
  try {
    console.log('Service Worker: Sincronizando datos...');
    
    // Actualizar caché de la API
    const response = await fetch('https://api.fbi.gov/wanted/v1/list');
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put('https://api.fbi.gov/wanted/v1/list', response);
      console.log('Service Worker: Datos sincronizados correctamente');
    }
  } catch (error) {
    console.error('Service Worker: Error durante la sincronización:', error);
  }
}