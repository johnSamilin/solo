// Feature flags for Solo app

/**
 * Check if filesystem storing is enabled based on:
 * 1. Browser support for File System API
 */
export const isFilesystemStoringEnabled = () => {
  // Check if File System API is supported
  const hasFileSystemSupport = 'showDirectoryPicker' in window;
  
  return hasFileSystemSupport;
};

/**
 * Check if filesystem storing should be available
 * (Now always available when browser supports it - works as additional security layer)
 * @returns {boolean}
 */
export const isFilesystemStoringAvailable = () => {
  const hasFileSystemSupport = isFilesystemStoringEnabled();
  
  return hasFileSystemSupport;
};