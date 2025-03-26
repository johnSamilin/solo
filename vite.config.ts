import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Solo - Note Taking App',
        short_name: 'Solo',
        description: 'Minimalistic private note-taking app with focus on typography',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'assets/png/icons/16x16.png',
            sizes: '16x16',
            type: 'image/png'
          },
          {
            src: 'assets/png/icons/32x32.png',
            sizes: '32x32',
            type: 'image/png'
          },
          {
            src: 'assets/png/icons/48x48.png',
            sizes: '48x48',
            type: 'image/png'
          },
          {
            src: 'assets/png/icons/64x64.png',
            sizes: '64x64',
            type: 'image/png'
          },
          {
            src: 'assets/png/icons/128x128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: 'assets/png/icons/256x256.png',
            sizes: '256x256',
            type: 'image/png'
          },
          {
            src: 'assets/png/icons/512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,ttf}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: './', // Use relative paths
  define: {
    'process.env.MODE': JSON.stringify(process.env.MODE || 'standalone')
  }
});