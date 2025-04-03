import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'fs';

const isPlugin = process.env.VITE_BUILDMODE === 'plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    process.env.VITE_BUILDMODE === 'plugin' && viteSingleFile({ useRecommendedBuildConfig: false }),
    {
      name: 'inline-fonts',
      transform(code, id) {
        if (isPlugin && id.endsWith('.css')) {
          return {
            code: code.replace(
              /url\(['"]?\.\.\/fonts\/([^'")]+)['"]?\)/g,
              (match, filename) => {
                const fontPath = resolve(__dirname, 'src/assets/fonts', filename);
                const fontBuffer = fs.readFileSync(fontPath);
                const base64Font = fontBuffer.toString('base64');
                const ext = filename.split('.').pop();
                const mimeType = `application/${ext === 'ttf' ? 'x-font-ttf' : ext}`;
                return `url('data:${mimeType};base64,${base64Font}')`;
              }
            ),
            map: null
          };
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  base: './', // Use relative paths
  define: {
    'process.env.VITE_BUILDMODE': JSON.stringify(process.env.VITE_BUILDMODE || 'standalone')
  },
  build: {
    // When in plugin mode, inline all assets
    assetsInlineLimit: isPlugin ? Number.POSITIVE_INFINITY : 4096,
    rollupOptions: {
      output: {
        // Ensure all assets are inlined when in plugin mode
        assetFileNames: isPlugin ? 'assets/[name][extname]' : 'assets/[name]-[hash][extname]',
        chunkFileNames: isPlugin ? 'assets/[name].js' : 'assets/[name]-[hash].js',
        entryFileNames: isPlugin ? 'assets/[name].js' : 'assets/[name]-[hash].js',
        // Inline all CSS
        inlineDynamicImports: isPlugin,
      }
    }
  }
});