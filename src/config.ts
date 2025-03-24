export const VITE_BUILDMODE = import.meta.env.VITE_BUILDMODE || 'standalone';

export const isStandalone = VITE_BUILDMODE === 'standalone';
export const isPlugin = VITE_BUILDMODE === 'plugin';