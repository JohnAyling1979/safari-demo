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

        if (message.type === 'getPagePdfFromCache') {
          (async () => {
            try {
              const url = window.location.href;
              const res = await fetch(url, { cache: 'force-cache' });
              console.log('getPagePdfFromCache: fetch res:', res);
              if (!res.ok) {
                sendResponse({ error: `Fetch failed: ${res.status}` });
                return;
              }
              const contentType = (res.headers.get('Content-Type') ?? '').toLowerCase();
              console.log('getPagePdfFromCache: contentType:', contentType);
              const isPdf =
                contentType.includes('application/pdf') ||
                url.toLowerCase().endsWith('.pdf');
              console.log('getPagePdfFromCache: isPdf:', isPdf);
              if (!isPdf) {
                sendResponse({ error: 'Not a PDF' });
                return;
              }
              const arrayBuffer = await res.arrayBuffer();
              console.log('getPagePdfFromCache: arrayBuffer:', arrayBuffer);
              const bytes = new Uint8Array(arrayBuffer);
              let binary = '';
              const chunkSize = 8192;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
                binary += String.fromCharCode(...chunk);
              }
              const pdfBase64 = btoa(binary);
              sendResponse({ pdfBase64, contentType });
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
