// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { viteSingleFile } from "file:///home/project/node_modules/vite-plugin-singlefile/dist/esm/index.js";
import { VitePWA } from "file:///home/project/node_modules/vite-plugin-pwa/dist/index.js";
import fs from "fs";
var __vite_injected_original_dirname = "/home/project";
var isPlugin = process.env.VITE_BUILDMODE === "plugin";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    process.env.VITE_BUILDMODE === "plugin" && viteSingleFile({ useRecommendedBuildConfig: false }),
    !isPlugin && VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,ttf,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets"
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com/,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              }
            }
          }
        ]
      }
    }),
    {
      name: "inline-fonts",
      transform(code, id) {
        if (isPlugin && id.endsWith(".css")) {
          return {
            code: code.replace(
              /url\(['"]?\.\.\/fonts\/([^'")]+)['"]?\)/g,
              (match, filename) => {
                const fontPath = resolve(__vite_injected_original_dirname, "src/assets/fonts", filename);
                const fontBuffer = fs.readFileSync(fontPath);
                const base64Font = fontBuffer.toString("base64");
                const ext = filename.split(".").pop();
                const mimeType = `application/${ext === "ttf" ? "x-font-ttf" : ext}`;
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
    exclude: ["lucide-react"]
  },
  base: "./",
  // Use relative paths
  define: {
    "process.env.VITE_BUILDMODE": JSON.stringify(process.env.VITE_BUILDMODE || "standalone")
  },
  build: {
    // When in plugin mode, inline all assets
    assetsInlineLimit: isPlugin ? Number.POSITIVE_INFINITY : 4096,
    rollupOptions: {
      output: {
        // Ensure all assets are inlined when in plugin mode
        assetFileNames: isPlugin ? "assets/[name][extname]" : "assets/[name]-[hash][extname]",
        chunkFileNames: isPlugin ? "assets/[name].js" : "assets/[name]-[hash].js",
        entryFileNames: isPlugin ? "assets/[name].js" : "assets/[name]-[hash].js",
        // Inline all CSS
        inlineDynamicImports: isPlugin
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyB2aXRlU2luZ2xlRmlsZSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXNpbmdsZWZpbGUnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuXG5jb25zdCBpc1BsdWdpbiA9IHByb2Nlc3MuZW52LlZJVEVfQlVJTERNT0RFID09PSAncGx1Z2luJztcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIHByb2Nlc3MuZW52LlZJVEVfQlVJTERNT0RFID09PSAncGx1Z2luJyAmJiB2aXRlU2luZ2xlRmlsZSh7IHVzZVJlY29tbWVuZGVkQnVpbGRDb25maWc6IGZhbHNlIH0pLFxuICAgICFpc1BsdWdpbiAmJiBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgbWFuaWZlc3Q6IGZhbHNlLFxuICAgICAgd29ya2JveDoge1xuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsdHRmLHdvZmYyfSddLFxuICAgICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvZm9udHNcXC5nb29nbGVhcGlzXFwuY29tLyxcbiAgICAgICAgICAgIGhhbmRsZXI6ICdTdGFsZVdoaWxlUmV2YWxpZGF0ZScsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2dvb2dsZS1mb250cy1zdHlsZXNoZWV0cycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdzdGF0aWNcXC5jb20vLFxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdnb29nbGUtZm9udHMtd2ViZm9udHMnLFxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XG4gICAgICAgICAgICAgICAgbWF4RW50cmllczogMzAsXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1LCAvLyAxIHllYXJcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSksXG4gICAge1xuICAgICAgbmFtZTogJ2lubGluZS1mb250cycsXG4gICAgICB0cmFuc2Zvcm0oY29kZSwgaWQpIHtcbiAgICAgICAgaWYgKGlzUGx1Z2luICYmIGlkLmVuZHNXaXRoKCcuY3NzJykpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY29kZTogY29kZS5yZXBsYWNlKFxuICAgICAgICAgICAgICAvdXJsXFwoWydcIl0/XFwuXFwuXFwvZm9udHNcXC8oW14nXCIpXSspWydcIl0/XFwpL2csXG4gICAgICAgICAgICAgIChtYXRjaCwgZmlsZW5hbWUpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBmb250UGF0aCA9IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2Fzc2V0cy9mb250cycsIGZpbGVuYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBmb250QnVmZmVyID0gZnMucmVhZEZpbGVTeW5jKGZvbnRQYXRoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBiYXNlNjRGb250ID0gZm9udEJ1ZmZlci50b1N0cmluZygnYmFzZTY0Jyk7XG4gICAgICAgICAgICAgICAgY29uc3QgZXh0ID0gZmlsZW5hbWUuc3BsaXQoJy4nKS5wb3AoKTtcbiAgICAgICAgICAgICAgICBjb25zdCBtaW1lVHlwZSA9IGBhcHBsaWNhdGlvbi8ke2V4dCA9PT0gJ3R0ZicgPyAneC1mb250LXR0ZicgOiBleHR9YDtcbiAgICAgICAgICAgICAgICByZXR1cm4gYHVybCgnZGF0YToke21pbWVUeXBlfTtiYXNlNjQsJHtiYXNlNjRGb250fScpYDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIG1hcDogbnVsbFxuICAgICAgICAgIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIF0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGV4Y2x1ZGU6IFsnbHVjaWRlLXJlYWN0J10sXG4gIH0sXG4gIGJhc2U6ICcuLycsIC8vIFVzZSByZWxhdGl2ZSBwYXRoc1xuICBkZWZpbmU6IHtcbiAgICAncHJvY2Vzcy5lbnYuVklURV9CVUlMRE1PREUnOiBKU09OLnN0cmluZ2lmeShwcm9jZXNzLmVudi5WSVRFX0JVSUxETU9ERSB8fCAnc3RhbmRhbG9uZScpXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgLy8gV2hlbiBpbiBwbHVnaW4gbW9kZSwgaW5saW5lIGFsbCBhc3NldHNcbiAgICBhc3NldHNJbmxpbmVMaW1pdDogaXNQbHVnaW4gPyBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkgOiA0MDk2LFxuICAgIHJvbGx1cE9wdGlvbnM6IHtcbiAgICAgIG91dHB1dDoge1xuICAgICAgICAvLyBFbnN1cmUgYWxsIGFzc2V0cyBhcmUgaW5saW5lZCB3aGVuIGluIHBsdWdpbiBtb2RlXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiBpc1BsdWdpbiA/ICdhc3NldHMvW25hbWVdW2V4dG5hbWVdJyA6ICdhc3NldHMvW25hbWVdLVtoYXNoXVtleHRuYW1lXScsXG4gICAgICAgIGNodW5rRmlsZU5hbWVzOiBpc1BsdWdpbiA/ICdhc3NldHMvW25hbWVdLmpzJyA6ICdhc3NldHMvW25hbWVdLVtoYXNoXS5qcycsXG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiBpc1BsdWdpbiA/ICdhc3NldHMvW25hbWVdLmpzJyA6ICdhc3NldHMvW25hbWVdLVtoYXNoXS5qcycsXG4gICAgICAgIC8vIElubGluZSBhbGwgQ1NTXG4gICAgICAgIGlubGluZUR5bmFtaWNJbXBvcnRzOiBpc1BsdWdpbixcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBeU4sU0FBUyxvQkFBb0I7QUFDdFAsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZUFBZTtBQUN4QixPQUFPLFFBQVE7QUFKZixJQUFNLG1DQUFtQztBQU16QyxJQUFNLFdBQVcsUUFBUSxJQUFJLG1CQUFtQjtBQUdoRCxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRLElBQUksbUJBQW1CLFlBQVksZUFBZSxFQUFFLDJCQUEyQixNQUFNLENBQUM7QUFBQSxJQUM5RixDQUFDLFlBQVksUUFBUTtBQUFBLE1BQ25CLGNBQWM7QUFBQSxNQUNkLFVBQVU7QUFBQSxNQUNWLFNBQVM7QUFBQSxRQUNQLGNBQWMsQ0FBQywwQ0FBMEM7QUFBQSxRQUN6RCxnQkFBZ0I7QUFBQSxVQUNkO0FBQUEsWUFDRSxZQUFZO0FBQUEsWUFDWixTQUFTO0FBQUEsWUFDVCxTQUFTO0FBQUEsY0FDUCxXQUFXO0FBQUEsWUFDYjtBQUFBLFVBQ0Y7QUFBQSxVQUNBO0FBQUEsWUFDRSxZQUFZO0FBQUEsWUFDWixTQUFTO0FBQUEsWUFDVCxTQUFTO0FBQUEsY0FDUCxXQUFXO0FBQUEsY0FDWCxZQUFZO0FBQUEsZ0JBQ1YsWUFBWTtBQUFBLGdCQUNaLGVBQWUsS0FBSyxLQUFLLEtBQUs7QUFBQTtBQUFBLGNBQ2hDO0FBQUEsWUFDRjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLElBQ0Q7QUFBQSxNQUNFLE1BQU07QUFBQSxNQUNOLFVBQVUsTUFBTSxJQUFJO0FBQ2xCLFlBQUksWUFBWSxHQUFHLFNBQVMsTUFBTSxHQUFHO0FBQ25DLGlCQUFPO0FBQUEsWUFDTCxNQUFNLEtBQUs7QUFBQSxjQUNUO0FBQUEsY0FDQSxDQUFDLE9BQU8sYUFBYTtBQUNuQixzQkFBTSxXQUFXLFFBQVEsa0NBQVcsb0JBQW9CLFFBQVE7QUFDaEUsc0JBQU0sYUFBYSxHQUFHLGFBQWEsUUFBUTtBQUMzQyxzQkFBTSxhQUFhLFdBQVcsU0FBUyxRQUFRO0FBQy9DLHNCQUFNLE1BQU0sU0FBUyxNQUFNLEdBQUcsRUFBRSxJQUFJO0FBQ3BDLHNCQUFNLFdBQVcsZUFBZSxRQUFRLFFBQVEsZUFBZSxHQUFHO0FBQ2xFLHVCQUFPLGFBQWEsUUFBUSxXQUFXLFVBQVU7QUFBQSxjQUNuRDtBQUFBLFlBQ0Y7QUFBQSxZQUNBLEtBQUs7QUFBQSxVQUNQO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLGNBQWM7QUFBQSxFQUMxQjtBQUFBLEVBQ0EsTUFBTTtBQUFBO0FBQUEsRUFDTixRQUFRO0FBQUEsSUFDTiw4QkFBOEIsS0FBSyxVQUFVLFFBQVEsSUFBSSxrQkFBa0IsWUFBWTtBQUFBLEVBQ3pGO0FBQUEsRUFDQSxPQUFPO0FBQUE7QUFBQSxJQUVMLG1CQUFtQixXQUFXLE9BQU8sb0JBQW9CO0FBQUEsSUFDekQsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBO0FBQUEsUUFFTixnQkFBZ0IsV0FBVywyQkFBMkI7QUFBQSxRQUN0RCxnQkFBZ0IsV0FBVyxxQkFBcUI7QUFBQSxRQUNoRCxnQkFBZ0IsV0FBVyxxQkFBcUI7QUFBQTtBQUFBLFFBRWhELHNCQUFzQjtBQUFBLE1BQ3hCO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
