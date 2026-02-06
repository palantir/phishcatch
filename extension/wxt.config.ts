import { defineConfig } from 'wxt';
import react from '@vitejs/plugin-react-swc';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  outDir: 'output',
  manifestVersion: 3,
  manifest: {
    name: 'PhishCatch',
    description: 'Identify and prevent enterprise password leaks',
    version: '0.16',
    icons: { '128': 'icon.png' },
    storage: {
      managed_schema: 'schema.json',
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    permissions: ['storage', 'notifications'],
    host_permissions: ['http://*/*', 'https://*/*'],
    web_accessible_resources: [
      {
        resources: ['activity-interceptor.js'],
        matches: ['<all_urls>'],
      },
    ],
  },

  vite: () => ({
    plugins: [
      react(),
      // Chrome extensions don't support CORS on chrome-extension:// URLs.
      // Vite adds crossorigin to module scripts by default, which silently
      // prevents them from loading in the extension context.
      {
        name: 'strip-crossorigin',
        transformIndexHtml(html: string) {
          return html.replace(/ crossorigin/g, '');
        },
      },
      nodePolyfills({
        include: ['buffer', 'process', 'util'],
        globals: {
          Buffer: true,
          process: true,
        },
      }),
    ],
  }),
});
