import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'TabLocal',
    description: 'On-device tab manager. Save, organise, and restore your browser sessions.',
    version: '1.0.0',
    permissions: ['tabs', 'tabGroups', 'storage', 'favicon', 'unlimitedStorage'],
    commands: {
      "save-window": {
        suggested_key: { default: "Ctrl+Shift+S", mac: "Command+Shift+S" },
        description: "Save current window as a collection",
      },
    },
    chrome_url_overrides: {
      newtab: 'newtab.html',
    },
  },
});
