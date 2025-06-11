// Google Analytics utility functions
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}

export const trackEvent = (eventName: string, parameters?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
};

export const trackPageView = (pagePath: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', import.meta.env.VITE_GANALYTICS, {
      page_path: pagePath,
    });
  }
};

// Predefined event tracking functions
export const analytics = {
  // Note events
  noteCreated: () => trackEvent('note_created'),
  noteDeleted: () => trackEvent('note_deleted'),
  
  // Notebook events
  notebookCreated: () => trackEvent('notebook_created'),
  notebookDeleted: () => trackEvent('notebook_deleted'),
  
  // Feature usage
  zenModeToggled: (enabled: boolean) => trackEvent('zen_mode_toggled', { enabled }),
  censorshipToggled: (enabled: boolean) => trackEvent('censorship_toggled', { enabled }),
  themeChanged: (theme: string) => trackEvent('theme_changed', { theme }),
  
  // Sync events
  syncCompleted: (method: string) => trackEvent('sync_completed', { method }),
  syncFailed: (method: string) => trackEvent('sync_failed', { method }),
  
  // Export/Import events
  dataExported: () => trackEvent('data_exported'),
  dataImported: (mode: string) => trackEvent('data_imported', { mode }),
  
  // Settings events
  settingsOpened: (tab: string) => trackEvent('settings_opened', { tab }),
  
  // Editor events
  imageUploaded: () => trackEvent('image_uploaded'),
  linkInserted: () => trackEvent('link_inserted'),
  taskListCreated: () => trackEvent('task_list_created'),
  dictationUsed: () => trackEvent('dictation_used'),
};