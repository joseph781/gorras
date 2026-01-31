// CAPS KINGDOM - Service Worker
const CACHE_NAME = 'caps-kingdom-v2';

// Recursos a cachear inmediatamente
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('🧢 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('🧢 Service Worker: Cacheando archivos');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activar Service Worker
self.addEventListener('activate', (event) => {
  console.log('🧢 Service Worker: Activado');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🧢 Service Worker: Eliminando cache antiguo', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar requests
self.addEventListener('fetch', (event) => {
  // Ignorar requests que no son GET
  if (event.request.method !== 'GET') return;
  
  // Ignorar requests de extensiones y chrome
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('extension')) return;
  
  // Ignorar requests de analytics
  if (event.request.url.includes('google-analytics.com')) return;
  if (event.request.url.includes('googletagmanager.com')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Si está en cache, devolver
        if (cachedResponse) {
          // Actualizar cache en background (stale-while-revalidate)
          event.waitUntil(
            fetch(event.request)
              .then((response) => {
                if (response && response.status === 200) {
                  const responseClone = response.clone();
                  caches.open(CACHE_NAME)
                    .then((cache) => cache.put(event.request, responseClone));
                }
              })
              .catch(() => {}) // Ignorar errores de red en background
          );
          return cachedResponse;
        }
        
        // Si no está en cache, fetch de la red
        return fetch(event.request)
          .then((response) => {
            // No cachear si no es válido
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Cachear la respuesta
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Solo cachear páginas HTML, CSS, JS e imágenes
                const url = event.request.url;
                if (url.endsWith('.html') || 
                    url.endsWith('.css') || 
                    url.endsWith('.js') ||
                    url.includes('fonts.googleapis') ||
                    url.includes('fonts.gstatic') ||
                    url.match(/\.(png|jpg|jpeg|gif|svg|webp)$/i)) {
                  cache.put(event.request, responseClone);
                }
              });
            
            return response;
          })
          .catch(() => {
            // Si falla la red y es una página, mostrar offline
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Manejar notificaciones push
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body || '¡Tenemos novedades para ti!',
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23000" width="100" height="100"/><text y=".9em" x="50%" text-anchor="middle" font-size="70">🧢</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🧢</text></svg>',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Ver ahora' },
      { action: 'close', title: 'Cerrar' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'CAPS KINGDOM', options)
  );
});

// Manejar click en notificación
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') return;
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Si ya hay una ventana abierta, enfocarla
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Si no, abrir nueva ventana
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

console.log('🧢 CAPS KINGDOM Service Worker cargado');
