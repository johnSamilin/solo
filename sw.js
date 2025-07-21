// Service Worker for Solo App
// Handles periodic background sync and background fetch for local image storage

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
    event.waitUntil(performImageSync());
  }
});

// Background Fetch event
self.addEventListener('backgroundfetch', (event) => {
  if (event.tag.startsWith('download-image-')) {
    event.waitUntil(handleBackgroundFetch(event));
  }
});

async function performImageSync() {
  try {
    // Get server settings and local file list
    const serverUrl = await getServerUrl();
    const serverToken = await getServerToken();
    const localFiles = await getLocalFileList();
    
    if (!serverUrl) {
      console.log('No server URL configured for background sync');
      return;
    }

    // Send local file list to server for comparison
    const response = await fetch(`${serverUrl}/api/sync/images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': serverToken ? `Bearer ${serverToken}` : '',
      },
      body: JSON.stringify({ localFiles }),
    });

    if (response.ok) {
      const { filesToDownload } = await response.json();
      console.log('Image sync check successful:', filesToDownload.length, 'files to download');
      
      // Start background fetch for each missing file
      for (const file of filesToDownload) {
        await startBackgroundDownload(file, serverUrl, serverToken);
      }
    } else {
      console.warn('Image sync check failed:', response.status);
    }
  } catch (error) {
    console.error('Image sync error:', error);
  }
}

async function startBackgroundDownload(file, serverUrl, serverToken) {
  try {
    const downloadUrl = `${serverUrl}/api/images/download/${file.id}`;
    const tag = `download-image-${file.id}`;
    
    // Register background fetch
    const registration = await self.registration;
    await registration.backgroundFetch.fetch(tag, downloadUrl, {
      icons: [{ src: '/assets/icons/png/256x256.png', sizes: '256x256', type: 'image/png' }],
      title: `Downloading ${file.name}`,
      downloadTotal: file.size || 1024 * 1024, // Default 1MB if size unknown
      headers: {
        'Authorization': serverToken ? `Bearer ${serverToken}` : '',
      },
    });
    
    console.log('Started background download for:', file.name);
  } catch (error) {
    console.error('Failed to start background download:', error);
  }
}

async function handleBackgroundFetch(event) {
  const { tag, request } = event;
  const fileId = tag.replace('download-image-', '');
  
  try {
    // Get the downloaded response
    const response = await event.waitUntil(fetch(request));
    
    if (response.ok) {
      // Store the file locally using File System API
      const arrayBuffer = await response.arrayBuffer();
      await storeFileLocally(fileId, arrayBuffer);
      
      console.log('Successfully downloaded and stored file:', fileId);
      
      // Show notification to user
      self.registration.showNotification('Image Downloaded', {
        body: `Successfully downloaded image ${fileId}`,
        icon: '/assets/icons/png/256x256.png',
        tag: 'image-download',
      });
    } else {
      console.error('Background fetch failed:', response.status);
    }
  } catch (error) {
    console.error('Background fetch error:', error);
  }
}

async function getLocalFileList() {
  try {
    // Get the selected storage directory handle from IndexedDB
    const directoryHandle = await getStorageDirectoryHandle();
    if (!directoryHandle) {
      return [];
    }
    
    const files = [];
    for await (const [name, handle] of directoryHandle.entries()) {
      if (handle.kind === 'file' && name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        const file = await handle.getFile();
        files.push({
          name: name,
          size: file.size,
          lastModified: file.lastModified,
        });
      }
    }
    
    return files;
  } catch (error) {
    console.error('Failed to get local file list:', error);
    return [];
  }
}

async function storeFileLocally(fileId, arrayBuffer) {
  try {
    const directoryHandle = await getStorageDirectoryHandle();
    if (!directoryHandle) {
      throw new Error('No storage directory selected');
    }
    
    // Create file handle
    const fileHandle = await directoryHandle.getFileHandle(`${fileId}.jpg`, {
      create: true,
    });
    
    // Write file data
    const writable = await fileHandle.createWritable();
    await writable.write(arrayBuffer);
    await writable.close();
    
    console.log('File stored locally:', fileId);
  } catch (error) {
    console.error('Failed to store file locally:', error);
    throw error;
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

async function getStorageDirectoryHandle() {
  try {
    const db = await openSettingsDB();
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');
    const result = await store.get('storage-directory-handle');
    return result?.value;
  } catch (error) {
    console.error('Failed to get storage directory handle:', error);
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