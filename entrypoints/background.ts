// Session tracking - new values on each background reload
const sessionId = crypto.randomUUID();
const loadedAt = new Date().toISOString();

export default defineBackground({
  // Required for iOS/iPadOS - persistent background not supported
  persistent: false,
  main() {
    console.log('[Safari Demo] Background script loaded', { sessionId, loadedAt });

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
          browser.storage.local.get('demoCount').then((result) => {
            sendResponse({ count: result.demoCount ?? 0 });
          });
          return true; // Keep channel open for async response
        }

        if (message.type === 'incrementCount') {
          console.log('[Safari Demo] Incrementing count');
          browser.storage.local.get('demoCount').then((result) => {
            const currentCount = (result.demoCount ?? 0) as number;
            const count = currentCount + 1;
            browser.storage.local.set({ demoCount: count });
            sendResponse({ count });
          });
          return true;
        }

        if (message.type === 'clearCount') {
          console.log('[Safari Demo] Clearing count');
          browser.storage.local.set({ demoCount: 0 });
          sendResponse({ count: 0 });
          return false;
        }

        if (message.type === 'getSessionInfo') {
          sendResponse({ sessionId, loadedAt });
          return false;
        }

        if (message.type === 'ping') {
          sendResponse({ pong: true, sessionId, loadedAt });
          return false;
        }

        if (message.type === 'pingContentScript') {
          const tabId = (message as { type: string; tabId: number }).tabId;
          if (tabId != null) {
            browser.tabs
              .sendMessage(tabId, { type: 'pingFromPopup' })
              .then(() => sendResponse({ ok: true }))
              .catch((err) => sendResponse({ error: String(err) }));
          } else {
            sendResponse({ error: 'No tabId provided' });
          }
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

        if (message.type === 'getSharedFile') {
          const appName = 'com.powernotes.safari-demo-extension';
          browser.runtime
            .sendNativeMessage(appName, { type: 'getSharedFile' })
            .then((response: { name?: string; size?: number }) => {
              sendResponse({
                name: response?.name ?? null,
                size: response?.size ?? 0,
              });
            })
            .catch((err) => {
              sendResponse({
                name: null,
                size: 0,
                error: String(err),
              });
            });
          return true;
        }

        sendResponse({ error: 'Unknown message type' });
        return false;
      }
    );
  },
});
