const CACHE_NAME = 'fbi-wanted-v1.0.1';
const STATIC_CACHE = 'fbi-wanted-static-v1.0.1';
const DYNAMIC_CACHE = 'fbi-wanted-dynamic-v1.0.1';

// Archivos que se almacenarán en caché para funcionamiento offline
const STATIC_FILES = [
  './',
  './index.html',
  './style.css',
  './script.js',
  'https://via.placeholder.com/250?text=No+Image',
  'https://via.placeholder.com/250?text=Error+Image'
];

// URLs de la API que se cachearán
const API_URLS = [
  'https://api.fbi.gov/wanted/v1/list'
];

// Instalar el Service Worker
self.addEventListener('install', event => {
  console.log('🔧 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('📦 Service Worker: Cacheando archivos estáticos');
        // Cachear archivos uno por uno para evitar errores
        return Promise.allSettled(
          STATIC_FILES.map(url => {
            return cache.add(url).catch(error => {
              console.warn(`⚠️ No se pudo cachear ${url}:`, error);
              return null;
            });
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Instalación completada');
        return self.skipWaiting(); // Activar inmediatamente
      })
      .catch(error => {
        console.error('❌ Service Worker: Error durante la instalación:', error);
      })
  );
});

// Activar el Service Worker
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Eliminar cachés antiguas
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Service Worker: Eliminando caché antigua:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Activación completada');
        return self.clients.claim(); // Tomar control inmediatamente
      })
  );
});

// Interceptar requests - versión simplificada para Codespaces
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Saltar requests de autenticación de Codespaces
  if (url.hostname.includes('github.dev') || 
      url.pathname.includes('auth') || 
      url.pathname.includes('signin') ||
      url.pathname.includes('postback')) {
    return; // Dejar que maneje el navegador
  }
  
  // Manejar solicitudes a la API del FBI
  if (url.origin === 'https://api.fbi.gov') {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // Manejar manifest.json con cuidado especial
  if (request.url.includes('manifest.json')) {
    event.respondWith(handleManifest(request));
    return;
  }
  
  // Manejar archivos estáticos (HTML, CSS, JS, imágenes)
  if (request.destination === 'document' || 
      request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image') {
    event.respondWith(handleStaticRequest(request));
    return;
  }
});

// Manejar manifest con fallback
async function handleManifest(request) {
  try {
    // Intentar obtener desde caché primero
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si no está en caché, intentar desde red
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      // Guardar en caché para próxima vez
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.warn('⚠️ Error cargando manifest:', error);
  }
  
  // Fallback: crear manifest básico
  const fallbackManifest = {
    name: "FBI Wanted",
    short_name: "FBI Wanted",
    start_url: "./",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#00285e"
  };
  
  return new Response(JSON.stringify(fallbackManifest), {
    headers: { 'Content-Type': 'application/json' }
  });
}

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
    console.log('🌐 Service Worker: Error de red, buscando en caché:', error);
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
  try {
    // Buscar primero en caché
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si no está en caché, obtener de la red
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Guardar en caché dinámico
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ Service Worker: Error al obtener recurso:', error);
    
    // Fallback para páginas HTML
    if (request.destination === 'document') {
      const fallbackHTML = `
        <!DOCTYPE html>
        <html>
        <head><title>FBI Wanted - Offline</title></head>
        <body>
          <h1>🚫 Sin conexión</h1>
          <p>La aplicación no está disponible offline en este momento.</p>
          <button onclick="window.location.reload()">🔄 Reintentar</button>
        </body>
        </html>
      `;
      return new Response(fallbackHTML, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    // Para otros recursos, devolver error
    return new Response('Recurso no disponible offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}