import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      devOptions: {
        enabled: false
      },
      manifest: {
        name: 'Solo',
        short_name: 'Solo',
        description: 'Minimalistic private note-taking app',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/assets/icons/png/192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/assets/icons/png/512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      injectManifest: {
        swSrc: 'public/sw.js',
        swDest: 'sw.js',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,ttf,woff,woff2,otf,mp3}'],
      }
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: './', // Use relative paths
  build: {
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      }
    }
  }
});