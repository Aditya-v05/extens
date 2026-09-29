import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'ICP Scout',
    description:
      "ICP fit, the best contact and their email for the company website you're on. Bring your own Apollo + Jev keys.",
    permissions: ['activeTab', 'sidePanel', 'storage'],
    host_permissions: ['https://api.apollo.io/*', 'https://api.typesafe.ai/*'],
    action: { default_title: 'Scout this company' },
  },
});
