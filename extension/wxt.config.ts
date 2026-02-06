import { defineConfig } from 'wxt';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  manifest: {
    manifest_version: 2,
    name: 'PhishCatch',
    description: 'Identify and prevent enterprise password leaks',
    version: '0.16',
    icons: { '128': 'icon.png' },
    storage: {
      managed_schema: 'schema.json',
    },
    externally_connectable: {},
    content_security_policy:
      "script-src 'self'; object-src 'self'; connect-src http://localhost:* https://*",
    permissions: ['http://*/*', 'https://*/*', 'storage', 'notifications'],
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
