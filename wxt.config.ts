import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Safari Demo Extension',
    description: 'Demo extension showcasing popup, options, background, content script, and new tab',
    permissions: ['storage', 'activeTab', 'tabs', 'nativeMessaging'],
    host_permissions: ['*://*/*'],
    browser_action: {
      default_icon: {
        16: '/icon-16.png',
        32: '/icon-32.png',
        48: '/icon-48.png',
      },
    },
  },
});
