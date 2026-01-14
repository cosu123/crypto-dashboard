// ============================================
// SERVICE WORKER - HEIDI CRYPTO PORTFOLIO
// Estrategia: Cache-first para assets, Network-only para Google Sheets
// ============================================

const CACHE_VERSION = 'crypto-dashboard-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/config.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Instalación: cachear assets estáticos
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker v2...');
  
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] Cacheando assets estáticos');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        console.log('[SW] Assets cacheados exitosamente');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Error cacheando assets:', error);
      })
  );
});

// Activación: limpiar cachés antiguos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker v2...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_VERSION) {
              console.log('[SW] Eliminando caché antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Service Worker activado');
        return self.clients.claim();
      })
  );
});

// Fetch: estrategia híbrida
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NUNCA cachear Google Sheets API - Network-only
  if (url.hostname === 'docs.google.com' && url.pathname.includes('/gviz/tq')) {
    console.log('[SW] Network-only para Google Sheets:', url.pathname);
    event.respondWith(
      fetch(event.request, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
        .catch((error) => {
          console.error('[SW] Error fetching Google Sheets:', error);
          return new Response(JSON.stringify({ error: 'No hay conexión a internet' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // Cache-first para assets estáticos
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('[SW] Sirviendo desde caché:', event.request.url);
          return cachedResponse;
        }
        
        console.log('[SW] Fetching desde red:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Solo cachear respuestas exitosas
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }
            
            // Cachear la respuesta para futuras solicitudes
            const responseToCache = response.clone();
            caches.open(CACHE_VERSION)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('[SW] Error fetching:', error);
            // Intentar servir desde caché como fallback
            return caches.match('/index.html');
          });
      })
  );
});

// Sincronización en segundo plano (opcional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-portfolio') {
    console.log('[SW] Sincronizando portafolio en segundo plano...');
    event.waitUntil(
      Promise.resolve()
    );
  }
});

// Notificaciones push (opcional)
self.addEventListener('push', (event) => {
  console.log('[SW] Push recibido');
  
  const options = {
    body: event.data ? event.data.text() : 'Actualización del portafolio disponible',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    tag: 'portfolio-update'
  };
  
  event.waitUntil(
    self.registration.showNotification('HEIDI Crypto Portfolio', options)
  );
});

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker cargado correctamente');
