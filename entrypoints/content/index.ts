import './style.css';

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('safari-demo:content: Content script loaded on', window.location.href);

    let sessionDisplay: HTMLParagraphElement | null = null;

    const updateSessionDisplay = (text: string) => {
      if (sessionDisplay) sessionDisplay.textContent = text;
    };

    browser.runtime.onMessage.addListener(
      (message: { type: string }, _sender, sendResponse) => {
        if (message.type === 'pingFromPopup') {
          browser.runtime
            .sendMessage({ type: 'getSessionInfo' })
            .then((info: { sessionId?: string; loadedAt?: string }) => {
              const truncated =
                info.sessionId != null
                  ? `${String(info.sessionId).slice(0, 8)}…`
                  : '—';
              updateSessionDisplay(
                `Pinged from popup! Session: ${truncated} @ ${info.loadedAt ?? '—'}`
              );
              sendResponse({ ok: true });
            })
            .catch((err) => {
              updateSessionDisplay(`Error: ${String(err)}`);
              sendResponse({ error: String(err) });
            });
          return true;
        }

        if (message.type === 'uploadPagePdf') {
          const CHUNK_RAW_SIZE = 12 * 1024 * 1024; // ~16 MB base64 per message (half of ~32 MB ceiling)
          function bytesToBase64(chunk: Uint8Array): string {
            let binary = '';
            const subSize = 8192;
            for (let i = 0; i < chunk.length; i += subSize) {
              const sub = chunk.subarray(i, Math.min(i + subSize, chunk.length));
              binary += String.fromCharCode.apply(null, Array.from(sub));
            }
            return btoa(binary);
          }

          (async () => {
            try {
              const url = window.location.href;
              const res = await fetch(url, { cache: 'force-cache' });
              if (!res.ok) {
                sendResponse({ error: `Fetch failed: ${res.status}` });
                return;
              }
              const contentType = (res.headers.get('Content-Type') ?? '').toLowerCase();
              const isPdf =
                contentType.includes('application/pdf') ||
                url.toLowerCase().endsWith('.pdf');
              if (!isPdf) {
                sendResponse({ error: 'Not a PDF' });
                return;
              }
              const arrayBuffer = await res.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);

              const totalChunks = Math.ceil(bytes.length / CHUNK_RAW_SIZE);
              const uploadId = crypto.randomUUID();
              sendResponse({ uploadId, totalChunks });

              for (let i = 0; i < totalChunks; i++) {
                const start = i * CHUNK_RAW_SIZE;
                const end = Math.min(start + CHUNK_RAW_SIZE, bytes.length);
                const chunk = bytes.subarray(start, end);
                const chunkBase64 = bytesToBase64(chunk);
                await browser.runtime.sendMessage({
                  type: 'pdfChunk',
                  uploadId,
                  chunkIndex: i,
                  totalChunks,
                  chunkBase64,
                });
              }
            } catch (err) {
              sendResponse({ error: String(err) });
            }
          })();
          return true;
        }
      }
    );

    const ui = await createShadowRootUi(ctx, {
      name: 'safari-demo-badge',
      position: 'overlay',
      anchor: 'body',
      append: 'first',
      alignment: 'bottom-right',
      zIndex: 2147483647,
      onMount(container) {
        const badge = document.createElement('div');
        badge.className = 'demo-badge';
        sessionDisplay = document.createElement('p');
        sessionDisplay.className = 'session-info';
        sessionDisplay.textContent = '—';
        badge.innerHTML = `
          <span class="title">Safari Demo Extension</span>
          <span class="url">${escapeHtml(window.location.href)}</span>
        `;
        badge.append(sessionDisplay);
        const pingBtn = document.createElement('button');
        pingBtn.className = 'demo-ping-btn';
        pingBtn.textContent = 'Ping';
        pingBtn.addEventListener('click', async () => {
          try {
            const res = await browser.runtime.sendMessage({ type: 'ping' });
            if (res?.pong) {
              const truncated =
                res.sessionId != null
                  ? `${String(res.sessionId).slice(0, 8)}…`
                  : '—';
              updateSessionDisplay(
                `Session: ${truncated} loaded ${res.loadedAt ?? '—'}`
              );
            } else {
              updateSessionDisplay('No pong');
            }
          } catch (err) {
            updateSessionDisplay(`Error: ${String(err)}`);
          }
        });
        badge.append(pingBtn);
        container.append(badge);
      },
    });

    ui.mount();

    // Notify background that content script is active
    browser.runtime.sendMessage({ type: 'contentScriptMounted' });
  },
});

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
