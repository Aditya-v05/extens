import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Sift',
    description:
      "Sift the company website you're on: ICP fit, why now, the best contact and their email. Bring your own Apollo + Jev keys.",
    permissions: ['activeTab', 'scripting', 'sidePanel', 'storage'],
    host_permissions: ['https://api.apollo.io/*', 'https://api.typesafe.ai/*'],
    action: { default_title: 'Sift this company' },
  },
});
