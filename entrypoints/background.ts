export default defineBackground({
  // Required for iOS/iPadOS - persistent background not supported
  persistent: false,
  main() {
    // Initialize demo count in storage
    browser.storage.local.get('demoCount').then((result) => {
      if (result.demoCount == null) {
        browser.storage.local.set({ demoCount: 0 });
      }
    });

    // Message handler for popup, options, content script
    browser.runtime.onMessage.addListener(
      (message: { type: string }, sender, sendResponse) => {
        if (message.type === 'getCount') {
          browser.storage.local.get('demoCount').then((result) => {
            sendResponse({ count: result.demoCount ?? 0 });
          });
          return true; // Keep channel open for async response
        }

        if (message.type === 'incrementCount') {
          browser.storage.local.get('demoCount').then((result) => {
            const count = (result.demoCount as number | undefined) ?? 0 + 1;
            browser.storage.local.set({ demoCount: count });
            sendResponse({ count });
          });
          return true;
        }

        if (message.type === 'contentScriptMounted') {
          // Update badge when content script is active on a tab
          const tabId = sender.tab?.id;
          if (tabId != null && browser.action?.setBadgeText) {
            browser.action.setBadgeText({ tabId, text: '✓' });
            browser.action.setBadgeBackgroundColor?.({
              tabId,
              color: '#22c55e',
            });
          }
          sendResponse({ ok: true });
          return false;
        }

        sendResponse({ error: 'Unknown message type' });
        return false;
      }
    );
  },
});
