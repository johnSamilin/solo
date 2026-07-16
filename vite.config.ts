import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveBuildMode, buildFeatureDefines } from './feature-flags.build';

const mode = resolveBuildMode();

export default defineConfig({
  plugins: [
    react(),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: './', // Use relative paths
  define: {
    ...buildFeatureDefines(mode),
  },
  build: {
    assetsInlineLimit: 4096,
    minify: process.env.MINIFY === 'true',
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      }
    }
  }
});
