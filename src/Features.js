// Feature flags for Solo app

/**
 * Check if filesystem storing is enabled based on:
 * 1. Browser support for File System API
 * 2. Server sync is disabled (to avoid conflicts)
 */
export const isFilesystemStoringEnabled = () => {
  // Check if File System API is supported
  const hasFileSystemSupport = 'showDirectoryPicker' in window;
  
  // Check if server sync is disabled
  // We'll need to access the settings store, but since this is a pure function,
  // we'll return the browser support check and handle sync check in the component
  return hasFileSystemSupport;
};

/**
 * Check if filesystem storing should be available based on sync mode
 * @param {string} syncMode - Current sync mode ('none', 'webdav', 'server')
 * @returns {boolean}
 */
export const isFilesystemStoringAvailable = (syncMode) => {
  const hasFileSystemSupport = isFilesystemStoringEnabled();
  const isServerSyncDisabled = syncMode !== 'server';
  
  return hasFileSystemSupport && isServerSyncDisabled;
};