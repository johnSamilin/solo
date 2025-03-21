export const MODE = process.env.MODE || 'standalone';

export const isStandalone = MODE === 'standalone';
export const isPlugin = MODE === 'plugin';