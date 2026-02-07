// Service Worker for SailAI - AUTO-UPDATE VERSION
// Version: 0.9.6 (HOTFIX: Filter chrome-extension requests)
// This service worker automatically detects updates and prompts users to refresh

const CACHE_NAME = 'sailai-v0.9.8';
const ASSETS_CACHE = 'sailai-assets-v1';

// Resources to cache
const urlsToCache = [
    './',
    './index.html',
    './manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
    console.log('✅ Service Worker v0.9.8 installing...');
    
    // CRITICAL: Skip waiting = immediate activation without waiting for tabs to close
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('📦 Caching app files...');
                return cache.addAll(urlsToCache);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker v0.9.8 activated!');
    
    event.waitUntil(
        Promise.all([
            // Take control of all pages immediately
            clients.claim(),
            
            // Delete old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== ASSETS_CACHE) {
                            console.log('🗑️ Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ]).then(() => {
            // Notify all clients that update is ready
            return clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({
                        type: 'SW_UPDATED',
                        version: '0.9.6'
                    });
                });
            });
        })
    );
});

// Fetch event - SMART CACHING STRATEGY
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // CRITICAL FIX: Only handle HTTP/HTTPS requests
    // Ignore chrome-extension://, about:, data:, etc.
    if (!event.request.url.startsWith('http')) {
        return;
    }
    
    // Strategy 1: NETWORK-FIRST for HTML files (always get latest version)
    if (event.request.headers.get('accept').includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Clone and cache the response
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // If network fails, try cache
                    return caches.match(event.request);
                })
        );
        return;
    }
    
    // Strategy 2: CACHE-FIRST for everything else (CSS, JS, images from CDN)
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(event.request).then((response) => {
                    // Don't cache if not a valid response
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    
                    // Cache CDN assets separately
                    const responseClone = response.clone();
                    caches.open(ASSETS_CACHE).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                    
                    return response;
                });
            })
    );
});

// Listen for messages from clients
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
