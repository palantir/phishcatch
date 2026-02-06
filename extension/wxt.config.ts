import { defineConfig } from 'wxt';
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
  },

  vite: () => ({
    plugins: [
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
