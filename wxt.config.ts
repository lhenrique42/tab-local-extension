import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'TabLocal',
    description: 'On-device tab manager. Save, organise, and restore your browser sessions.',
    version: '1.0.0',
    permissions: ['tabs', 'tabGroups', 'storage', 'favicon', 'unlimitedStorage'],
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
  },
});
