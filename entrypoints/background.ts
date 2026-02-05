export default defineBackground({
  // Required for iOS/iPadOS - persistent background not supported
  persistent: false,
  main() {
    console.log('[Safari Demo] Background script loaded');

    // Fires when the non-persistent background is about to be unloaded (MV2 event pages only)
    browser.runtime.onSuspend?.addListener(() => {
      console.log('[Safari Demo] Background script unloading (suspended)');
    });

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
          console.log('[Safari Demo] Getting count from storage');
          const now = Date.now();
          browser.storage.local.get('demoCount').then((result) => {
            browser.storage.local.set({ _debugLastRun: now });
            sendResponse({ count: result.demoCount ?? 0, _debugLastRun: now });
          });
          return true; // Keep channel open for async response
        }

        if (message.type === 'incrementCount') {
          console.log('[Safari Demo] Incrementing count');
          const now = Date.now();
          browser.storage.local.get('demoCount').then((result) => {
            browser.storage.local.set({ _debugLastRun: now });
            const currentCount = (result.demoCount ?? 0) as number;
            const count = currentCount + 1;
            browser.storage.local.set({ demoCount: count });
            sendResponse({ count, _debugLastRun: now });
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
