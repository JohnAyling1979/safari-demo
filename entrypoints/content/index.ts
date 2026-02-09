import './style.css';

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('safari-demo:content: Content script loaded on', window.location.href);

    let sessionDisplay: HTMLParagraphElement | null = null;
    let sharedFileDisplay: HTMLParagraphElement | null = null;

    const updateSessionDisplay = (text: string) => {
      if (sessionDisplay) sessionDisplay.textContent = text;
    };

    const updateSharedFileDisplay = (pdfUrl: string | null) => {
      if (sharedFileDisplay) {
        if (pdfUrl) {
          sharedFileDisplay.innerHTML = `<a href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">${escapeHtml(pdfUrl)}</a>`;
        } else {
          sharedFileDisplay.textContent = '—';
        }
      }
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
        sharedFileDisplay = document.createElement('p');
        sharedFileDisplay.className = 'shared-file-info';
        sharedFileDisplay.textContent = '—';
        badge.innerHTML = `
          <span class="title">Safari Demo Extension</span>
          <span class="url">${escapeHtml(window.location.href)}</span>
          <span class="shared-file-label">Uploaded PDF URL:</span>
        `;
        badge.append(sharedFileDisplay);
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

        // Fetch shared PDF URL on mount
        browser.runtime
          .sendMessage({ type: 'getSharedFile' })
          .then((res: { pdfUrl?: string | null }) => {
            updateSharedFileDisplay(res?.pdfUrl ?? null);
          })
          .catch(() => updateSharedFileDisplay(null));
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
