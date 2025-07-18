// Service Worker for Solo App
// Handles periodic background sync for local image storage

const CACHE_NAME = 'solo-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Periodic Background Sync event
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'image-storage-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

async function performBackgroundSync() {
  try {
    // Get server settings from IndexedDB or other storage
    const serverUrl = await getServerUrl();
    const serverToken = await getServerToken();
    
    if (!serverUrl) {
      console.log('No server URL configured for background sync');
      return;
    }

    const response = await fetch(`${serverUrl}/api/ping`, {
      method: 'GET',
      headers: {
        'Authorization': serverToken ? `Bearer ${serverToken}` : '',
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('Periodic background sync successful:', data.timestamp);
      
      // Here you could perform actual image synchronization
      // For now, just log the successful ping
    } else {
      console.warn('Periodic background sync failed:', response.status);
    }
  } catch (error) {
    console.error('Periodic background sync error:', error);
  }
}

// Helper functions to get settings from storage
async function getServerUrl() {
  try {
    // Try to get from IndexedDB first
    const db = await openSettingsDB();
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const result = await store.get('server-url');
    return result?.value;
  } catch (error) {
    console.error('Failed to get server URL:', error);
    return null;
  }
}

async function getServerToken() {
  try {
    const db = await openSettingsDB();
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const result = await store.get('server-token');
    return result?.value;
  } catch (error) {
    console.error('Failed to get server token:', error);
    return null;
  }
}

function openSettingsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('solo-settings', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
  });
}