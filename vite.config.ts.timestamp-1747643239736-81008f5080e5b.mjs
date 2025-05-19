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
        navigateFallbackDenylist: [/^\/about/],
        // Don't fallback /about to index.html
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyB2aXRlU2luZ2xlRmlsZSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXNpbmdsZWZpbGUnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5pbXBvcnQgZnMgZnJvbSAnZnMnO1xuXG5jb25zdCBpc1BsdWdpbiA9IHByb2Nlc3MuZW52LlZJVEVfQlVJTERNT0RFID09PSAncGx1Z2luJztcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICByZWFjdCgpLFxuICAgIHByb2Nlc3MuZW52LlZJVEVfQlVJTERNT0RFID09PSAncGx1Z2luJyAmJiB2aXRlU2luZ2xlRmlsZSh7IHVzZVJlY29tbWVuZGVkQnVpbGRDb25maWc6IGZhbHNlIH0pLFxuICAgICFpc1BsdWdpbiAmJiBWaXRlUFdBKHtcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxuICAgICAgbWFuaWZlc3Q6IGZhbHNlLFxuICAgICAgd29ya2JveDoge1xuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsdHRmLHdvZmYyfSddLFxuICAgICAgICBuYXZpZ2F0ZUZhbGxiYWNrRGVueWxpc3Q6IFsvXlxcL2Fib3V0L10sIC8vIERvbid0IGZhbGxiYWNrIC9hYm91dCB0byBpbmRleC5odG1sXG4gICAgICAgIHJ1bnRpbWVDYWNoaW5nOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsUGF0dGVybjogL15odHRwczpcXC9cXC9mb250c1xcLmdvb2dsZWFwaXNcXC5jb20vLFxuICAgICAgICAgICAgaGFuZGxlcjogJ1N0YWxlV2hpbGVSZXZhbGlkYXRlJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnZ29vZ2xlLWZvbnRzLXN0eWxlc2hlZXRzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL2ZvbnRzXFwuZ3N0YXRpY1xcLmNvbS8sXG4gICAgICAgICAgICBoYW5kbGVyOiAnQ2FjaGVGaXJzdCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGNhY2hlTmFtZTogJ2dvb2dsZS1mb250cy13ZWJmb250cycsXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcbiAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAzMCxcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQgKiAzNjUsIC8vIDEgeWVhclxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KSxcbiAgICB7XG4gICAgICBuYW1lOiAnaW5saW5lLWZvbnRzJyxcbiAgICAgIHRyYW5zZm9ybShjb2RlLCBpZCkge1xuICAgICAgICBpZiAoaXNQbHVnaW4gJiYgaWQuZW5kc1dpdGgoJy5jc3MnKSkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBjb2RlOiBjb2RlLnJlcGxhY2UoXG4gICAgICAgICAgICAgIC91cmxcXChbJ1wiXT9cXC5cXC5cXC9mb250c1xcLyhbXidcIildKylbJ1wiXT9cXCkvZyxcbiAgICAgICAgICAgICAgKG1hdGNoLCBmaWxlbmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvbnRQYXRoID0gcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvYXNzZXRzL2ZvbnRzJywgZmlsZW5hbWUpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGZvbnRCdWZmZXIgPSBmcy5yZWFkRmlsZVN5bmMoZm9udFBhdGgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IGJhc2U2NEZvbnQgPSBmb250QnVmZmVyLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgICAgICAgICAgICBjb25zdCBleHQgPSBmaWxlbmFtZS5zcGxpdCgnLicpLnBvcCgpO1xuICAgICAgICAgICAgICAgIGNvbnN0IG1pbWVUeXBlID0gYGFwcGxpY2F0aW9uLyR7ZXh0ID09PSAndHRmJyA/ICd4LWZvbnQtdHRmJyA6IGV4dH1gO1xuICAgICAgICAgICAgICAgIHJldHVybiBgdXJsKCdkYXRhOiR7bWltZVR5cGV9O2Jhc2U2NCwke2Jhc2U2NEZvbnR9JylgO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApLFxuICAgICAgICAgICAgbWFwOiBudWxsXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgXSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgZXhjbHVkZTogWydsdWNpZGUtcmVhY3QnXSxcbiAgfSxcbiAgYmFzZTogJy4vJywgLy8gVXNlIHJlbGF0aXZlIHBhdGhzXG4gIGRlZmluZToge1xuICAgICdwcm9jZXNzLmVudi5WSVRFX0JVSUxETU9ERSc6IEpTT04uc3RyaW5naWZ5KHByb2Nlc3MuZW52LlZJVEVfQlVJTERNT0RFIHx8ICdzdGFuZGFsb25lJylcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICAvLyBXaGVuIGluIHBsdWdpbiBtb2RlLCBpbmxpbmUgYWxsIGFzc2V0c1xuICAgIGFzc2V0c0lubGluZUxpbWl0OiBpc1BsdWdpbiA/IE51bWJlci5QT1NJVElWRV9JTkZJTklUWSA6IDQwOTYsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIC8vIEVuc3VyZSBhbGwgYXNzZXRzIGFyZSBpbmxpbmVkIHdoZW4gaW4gcGx1Z2luIG1vZGVcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6IGlzUGx1Z2luID8gJ2Fzc2V0cy9bbmFtZV1bZXh0bmFtZV0nIDogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdW2V4dG5hbWVdJyxcbiAgICAgICAgY2h1bmtGaWxlTmFtZXM6IGlzUGx1Z2luID8gJ2Fzc2V0cy9bbmFtZV0uanMnIDogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6IGlzUGx1Z2luID8gJ2Fzc2V0cy9bbmFtZV0uanMnIDogJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgLy8gSW5saW5lIGFsbCBDU1NcbiAgICAgICAgaW5saW5lRHluYW1pY0ltcG9ydHM6IGlzUGx1Z2luLFxuICAgICAgfVxuICAgIH1cbiAgfVxufSk7Il0sCiAgIm1hcHBpbmdzIjogIjtBQUF5TixTQUFTLG9CQUFvQjtBQUN0UCxPQUFPLFdBQVc7QUFDbEIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sUUFBUTtBQUpmLElBQU0sbUNBQW1DO0FBTXpDLElBQU0sV0FBVyxRQUFRLElBQUksbUJBQW1CO0FBR2hELElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFFBQVEsSUFBSSxtQkFBbUIsWUFBWSxlQUFlLEVBQUUsMkJBQTJCLE1BQU0sQ0FBQztBQUFBLElBQzlGLENBQUMsWUFBWSxRQUFRO0FBQUEsTUFDbkIsY0FBYztBQUFBLE1BQ2QsVUFBVTtBQUFBLE1BQ1YsU0FBUztBQUFBLFFBQ1AsY0FBYyxDQUFDLDBDQUEwQztBQUFBLFFBQ3pELDBCQUEwQixDQUFDLFVBQVU7QUFBQTtBQUFBLFFBQ3JDLGdCQUFnQjtBQUFBLFVBQ2Q7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxZQUNiO0FBQUEsVUFDRjtBQUFBLFVBQ0E7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxjQUNYLFlBQVk7QUFBQSxnQkFDVixZQUFZO0FBQUEsZ0JBQ1osZUFBZSxLQUFLLEtBQUssS0FBSztBQUFBO0FBQUEsY0FDaEM7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsSUFDRixDQUFDO0FBQUEsSUFDRDtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sVUFBVSxNQUFNLElBQUk7QUFDbEIsWUFBSSxZQUFZLEdBQUcsU0FBUyxNQUFNLEdBQUc7QUFDbkMsaUJBQU87QUFBQSxZQUNMLE1BQU0sS0FBSztBQUFBLGNBQ1Q7QUFBQSxjQUNBLENBQUMsT0FBTyxhQUFhO0FBQ25CLHNCQUFNLFdBQVcsUUFBUSxrQ0FBVyxvQkFBb0IsUUFBUTtBQUNoRSxzQkFBTSxhQUFhLEdBQUcsYUFBYSxRQUFRO0FBQzNDLHNCQUFNLGFBQWEsV0FBVyxTQUFTLFFBQVE7QUFDL0Msc0JBQU0sTUFBTSxTQUFTLE1BQU0sR0FBRyxFQUFFLElBQUk7QUFDcEMsc0JBQU0sV0FBVyxlQUFlLFFBQVEsUUFBUSxlQUFlLEdBQUc7QUFDbEUsdUJBQU8sYUFBYSxRQUFRLFdBQVcsVUFBVTtBQUFBLGNBQ25EO0FBQUEsWUFDRjtBQUFBLFlBQ0EsS0FBSztBQUFBLFVBQ1A7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsY0FBYztBQUFBLEVBQzFCO0FBQUEsRUFDQSxNQUFNO0FBQUE7QUFBQSxFQUNOLFFBQVE7QUFBQSxJQUNOLDhCQUE4QixLQUFLLFVBQVUsUUFBUSxJQUFJLGtCQUFrQixZQUFZO0FBQUEsRUFDekY7QUFBQSxFQUNBLE9BQU87QUFBQTtBQUFBLElBRUwsbUJBQW1CLFdBQVcsT0FBTyxvQkFBb0I7QUFBQSxJQUN6RCxlQUFlO0FBQUEsTUFDYixRQUFRO0FBQUE7QUFBQSxRQUVOLGdCQUFnQixXQUFXLDJCQUEyQjtBQUFBLFFBQ3RELGdCQUFnQixXQUFXLHFCQUFxQjtBQUFBLFFBQ2hELGdCQUFnQixXQUFXLHFCQUFxQjtBQUFBO0FBQUEsUUFFaEQsc0JBQXNCO0FBQUEsTUFDeEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
