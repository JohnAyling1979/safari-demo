// Session tracking - new values on each background reload
const sessionId = crypto.randomUUID();
const loadedAt = new Date().toISOString();

const UPLOAD_URL = 'http://localhost:8006/v1/projects/EJ5a_5shRbOumYBfRyXhuQ/documents/uploads';
const METADATA_URL = 'http://localhost:8006/v1/projects/EJ5a_5shRbOumYBfRyXhuQ/documents/metadata';
const VIEW_URL_BASE = 'http://localhost:8006/v1/projects/EJ5a_5shRbOumYBfRyXhuQ/documents/files';
const ACCESS_TOKEN = 'kYQRAu8MSLSK29MjlY54fA'; // local dummy token for demo

type PendingUpload = {
  resolve: (value: { ok: true; pdfUrl: string } | { error: string }) => void;
  reject: (reason: unknown) => void;
  totalChunks: number;
  chunks: Record<number, Uint8Array>;
  filename: string;
};
const pendingUploads: Record<string, PendingUpload> = {};

export default defineBackground({
  // Required for iOS/iPadOS - persistent background not supported
  persistent: false,
  main() {
    console.log('safari-demo:background: Background script loaded', { sessionId, loadedAt });

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
          console.log('safari-demo:background: Getting count from storage');
          browser.storage.local.get('demoCount').then((result) => {
            sendResponse({ count: result.demoCount ?? 0 });
          });
          return true; // Keep channel open for async response
        }

        if (message.type === 'incrementCount') {
          console.log('safari-demo:background: Incrementing count');
          browser.storage.local.get('demoCount').then((result) => {
            const currentCount = (result.demoCount ?? 0) as number;
            const count = currentCount + 1;
            browser.storage.local.set({ demoCount: count });
            sendResponse({ count });
          });
          return true;
        }

        if (message.type === 'clearCount') {
          console.log('safari-demo:background: Clearing count');
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

        if (message.type === 'pdfChunk') {
          const msg = message as {
            type: string;
            uploadId: string;
            chunkIndex: number;
            totalChunks: number;
            chunkBase64?: string;
          };
          const { uploadId, chunkIndex, totalChunks } = msg;
          const pending = pendingUploads[uploadId];

          if (!pending) return false;

          const b64 = msg.chunkBase64;
          if (typeof b64 !== 'string' || b64.length === 0) {
            console.warn('pdfChunk: missing or empty chunkBase64');
            pending.chunks[chunkIndex] = new Uint8Array(0);
          } else {
            try {
              const binary = atob(b64);
              const chunk = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) chunk[i] = binary.charCodeAt(i);
              pending.chunks[chunkIndex] = chunk;
            } catch (e) {
              console.warn('pdfChunk: atob failed for chunk', chunkIndex, e);
              pending.chunks[chunkIndex] = new Uint8Array(0);
            }
          }

          // Only assemble when we have every index 0..totalChunks-1 (no duplicates, no gaps)
          let allPresent = true;
          for (let i = 0; i < totalChunks; i++) {
            if (pending.chunks[i] === undefined) {
              allPresent = false;
              break;
            }
          }
          if (!allPresent) return false;

          (async () => {
            try {
              const order = Array.from({ length: totalChunks }, (_, i) => i);
              let totalLength = 0;
              for (const i of order) {
                const c = pending.chunks[i];
                if (c == null) {
                  pending.resolve({ error: 'Missing chunk during reassembly' });
                  delete pendingUploads[uploadId];
                  return;
                }
                totalLength += c.length;
              }
              const bytes = new Uint8Array(totalLength);
              let offset = 0;
              for (const i of order) {
                bytes.set(pending.chunks[i], offset);
                offset += pending.chunks[i].length;
              }

              if (bytes.length === 0) {
                pending.resolve({ error: 'Reassembled PDF is empty (chunks may not have been received correctly)' });
                delete pendingUploads[uploadId];
                return;
              }

              const filename = pending.filename || 'upload.pdf';
              const safeFilename = filename.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
              const boundary = `Boundary-${crypto.randomUUID()}`;
              const preamble = new TextEncoder().encode(
                `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safeFilename}"\r\nContent-Type: application/pdf\r\n\r\n`
              );
              const suffix = new TextEncoder().encode(`\r\n--${boundary}--\r\n`);
              const body = new Uint8Array(preamble.length + bytes.length + suffix.length);
              body.set(preamble, 0);
              body.set(bytes, preamble.length);
              body.set(suffix, preamble.length + bytes.length);

              const res = await fetch(UPLOAD_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': `multipart/form-data; boundary=${boundary}`,
                  'X-ACCESS-TOKEN': ACCESS_TOKEN,
                },
                body,
              });

              if (!res.ok) {
                pending.resolve({ error: `Upload failed: ${res.status}` });
                delete pendingUploads[uploadId];
                return;
              }
              const json = (await res.json()) as { sha256?: string; size?: number };
              const sha256 = json?.sha256;

              if (!sha256) {
                pending.resolve({ error: 'Upload failed: no sha256 in response' });
                delete pendingUploads[uploadId];
                return;
              }

              const metadataRes = await fetch(METADATA_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-ACCESS-TOKEN': ACCESS_TOKEN,
                },
                body: JSON.stringify({
                  sha256,
                  filename: filename,
                  headers: { 'Content-Type': 'application/pdf' },
                }),
              });

              if (!metadataRes.ok) {
                pending.resolve({ error: `Metadata failed: ${metadataRes.status}` });
                delete pendingUploads[uploadId];
                return;
              }

              const pdfUrl = `${VIEW_URL_BASE}/${sha256}?access_token=${encodeURIComponent(ACCESS_TOKEN)}`;
              const appName = 'com.powernotes.safari-demo-extension';
              const nativeResponse = (await browser.runtime.sendNativeMessage(appName, {
                type: 'setSharedPdfUrl',
                pdfUrl,
              })) as { ok?: boolean; error?: string };

              if (nativeResponse?.ok !== true) {
                pending.resolve({ error: nativeResponse?.error ?? 'Failed to store PDF URL' });
              } else {
                pending.resolve({ ok: true, pdfUrl });
              }
            } catch (err) {
              pending.resolve({ error: String(err) });
            }
            delete pendingUploads[uploadId];
          })();
          return false;
        }

        if (message.type === 'getSharedFile') {
          const appName = 'com.powernotes.safari-demo-extension';
          browser.runtime
            .sendNativeMessage(appName, { type: 'getSharedFile' })
            .then((response: { pdfUrl?: string | null }) => {
              sendResponse({
                pdfUrl: response?.pdfUrl ?? null,
              });
            })
            .catch((err) => {
              sendResponse({
                pdfUrl: null,
                error: String(err),
              });
            });
          return true;
        }

        if (message.type === 'clearSharedFile') {
          const appName = 'com.powernotes.safari-demo-extension';
          browser.runtime
            .sendNativeMessage(appName, { type: 'clearSharedFile' })
            .then((response: { ok?: boolean }) => {
              const ok = response?.ok ?? true;
              sendResponse({ ok });
              if (ok) {
                // Notify all tabs so content overlay updates
                browser.tabs.query({}).then((tabs) => {
                  for (const tab of tabs) {
                    if (tab.id != null) {
                      browser.tabs.sendMessage(tab.id, { type: 'sharedFileUpdated' }).catch(() => {
                        // Tab may not have content script; ignore
                      });
                    }
                  }
                });
              }
            })
            .catch((err) => {
              sendResponse({ ok: false, error: String(err) });
            });
          return true;
        }

        if (message.type === 'checkCurrentTabIsPdf') {
          const tabId = (message as { type: string; tabId?: number }).tabId;
          (async () => {
            try {
              const tab =
                tabId != null
                  ? await browser.tabs.get(tabId)
                  : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
              if (!tab?.id || !tab.url) {
                sendResponse({ isPdf: false });
                return;
              }
              if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
                sendResponse({ isPdf: false });
                return;
              }
              // Fallback: Safari's native PDF viewer doesn't run content scripts, so treat .pdf URLs as PDF
              if (tab.url.toLowerCase().endsWith('.pdf')) {
                sendResponse({ isPdf: true });
                return;
              }
              const res = (await browser.tabs.sendMessage(tab.id, { type: 'checkIsPdf' }).catch(() => null)) as { isPdf?: boolean } | null;
              sendResponse({ isPdf: res?.isPdf === true });
            } catch {
              sendResponse({ isPdf: false });
            }
          })();
          return true;
        }

        if (message.type === 'uploadCurrentTabPdf') {
          (async () => {
            try {
              const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
              if (!tab?.id || !tab.url) {
                sendResponse({ error: 'No active tab' });
                return;
              }
              if (!tab.url.startsWith('http://') && !tab.url.startsWith('https://')) {
                sendResponse({ error: 'Current tab is not a PDF' });
                return;
              }

              const contentResponse = (await browser.tabs.sendMessage(tab.id, {
                type: 'uploadPagePdf',
              })) as { uploadId?: string; totalChunks?: number; filename?: string; error?: string };

              if (contentResponse?.error) {
                sendResponse({ error: contentResponse.error });
                return;
              }
              const uploadId = contentResponse?.uploadId;
              const totalChunks = contentResponse?.totalChunks ?? 0;
              const filename = contentResponse?.filename ?? 'upload.pdf';
              if (!uploadId || totalChunks <= 0) {
                sendResponse({ error: 'No PDF data from page' });
                return;
              }

              const result = await new Promise<
                { ok: true; pdfUrl: string } | { error: string }
              >((resolve, reject) => {
                pendingUploads[uploadId] = {
                  resolve,
                  reject,
                  totalChunks,
                  chunks: {},
                  filename,
                };
              });

              if ('error' in result) {
                sendResponse({ error: result.error });
              } else {
                sendResponse({ ok: true, pdfUrl: result.pdfUrl });
              }
            } catch (err) {
              sendResponse({ error: String(err) });
            }
          })();
          return true;
        }

        sendResponse({ error: 'Unknown message type' });
        return false;
      }
    );
  },
});
