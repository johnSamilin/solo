import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    process.env.VITE_BUILDMODE === 'plugin' && viteSingleFile({ useRecommendedBuildConfig: false })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: './', // Use relative paths
  define: {
    'process.env.VITE_BUILDMODE': JSON.stringify(process.env.VITE_BUILDMODE || 'standalone')
  }
});