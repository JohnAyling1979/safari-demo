import './style.css';

async function init() {
  console.log('safari-demo:popup: Popup script loaded');
  const app = document.getElementById('app')!;

  // Get current tab
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });

  const tabInfo = tab
    ? {
        title: tab.title ?? 'No title',
        url: tab.url ?? 'No URL',
      }
    : { title: 'N/A', url: 'N/A' };

  // Get count, session info, and shared PDF URL from background
  const [{ count }, { sessionId, loadedAt }, sharedFile] = await Promise.all([
    browser.runtime.sendMessage({ type: 'getCount' }),
    browser.runtime.sendMessage({ type: 'getSessionInfo' }),
    browser.runtime.sendMessage({ type: 'getSharedFile' }).catch(() => ({ pdfUrl: null })),
  ]);

  const truncatedSessionId =
    sessionId != null ? `${String(sessionId).slice(0, 8)}…` : '—';

  const pdfUrl = sharedFile?.pdfUrl ?? null;
  const sharedPdfDisplay =
    pdfUrl != null
      ? `<a class="value url" id="sharedPdfLink" href="${escapeHtml(pdfUrl)}" target="_blank" rel="noopener">${escapeHtml(pdfUrl)}</a>`
      : '<p class="value" id="sharedPdfLink">—</p>';

  app.innerHTML = `
    <div class="popup">
      <h1>Safari Demo</h1>
      <section>
        <h2>Shared PDF</h2>
        <p class="label">Uploaded PDF URL:</p>
        ${sharedPdfDisplay}
        <div class="button-row">
          <button id="refreshSharedFile">Refresh</button>
        </div>
      </section>
      <section>
        <h2>Current Tab</h2>
        <p class="label">Title:</p>
        <p class="value">${escapeHtml(tabInfo.title)}</p>
        <p class="label">URL:</p>
        <p class="value url">${escapeHtml(tabInfo.url)}</p>
      </section>
      <section>
        <h2>Storage Demo</h2>
        <p>Message count: <strong id="count">${count ?? 0}</strong></p>
        <div class="button-row">
          <button id="increment">Increment</button>
          <button id="clear">Clear</button>
        </div>
      </section>
      <section>
        <h2>Background Session</h2>
        <p class="label">Session ID:</p>
        <p class="value debug" id="sessionId">${escapeHtml(truncatedSessionId)}</p>
        <p class="label">Loaded at:</p>
        <p class="value debug" id="loadedAt">${escapeHtml(loadedAt ?? '—')}</p>
        <div class="button-row">
          <button id="refreshSession">Refresh</button>
          <button id="pingBackground">Ping background</button>
          <button id="notifyTab">Notify current tab</button>
        </div>
      </section>
      <section>
        <a href="#" id="options">Open Options</a>
      </section>
    </div>
  `;

  const updateCountFromResponse = (newCount: number | undefined) => {
    document.getElementById('count')!.textContent = String(newCount ?? 0);
  };

  document.getElementById('increment')?.addEventListener('click', async () => {
    const { count: newCount } = await browser.runtime.sendMessage({
      type: 'incrementCount',
    });
    updateCountFromResponse(newCount);
  });

  document.getElementById('clear')?.addEventListener('click', async () => {
    const { count: newCount } = await browser.runtime.sendMessage({
      type: 'clearCount',
    });
    updateCountFromResponse(newCount);
  });

  const updateSessionDisplay = (info: {
    sessionId?: string;
    loadedAt?: string;
  }) => {
    const sessionEl = document.getElementById('sessionId');
    const loadedEl = document.getElementById('loadedAt');
    if (sessionEl)
      sessionEl.textContent =
        info.sessionId != null
          ? `${String(info.sessionId).slice(0, 8)}…`
          : '—';
    if (loadedEl) loadedEl.textContent = info.loadedAt ?? '—';
  };

  document.getElementById('refreshSession')?.addEventListener('click', async () => {
    const info = await browser.runtime.sendMessage({ type: 'getSessionInfo' });
    updateSessionDisplay(info);
  });

  document.getElementById('pingBackground')?.addEventListener('click', async () => {
    const res = await browser.runtime.sendMessage({ type: 'ping' });
    if (res?.pong) {
      updateSessionDisplay(res);
    }
  });

  document.getElementById('notifyTab')?.addEventListener('click', async () => {
    if (!tab?.id) {
      alert('No active tab');
      return;
    }
    const res = await browser.runtime.sendMessage({
      type: 'pingContentScript',
      tabId: tab.id,
    });
    if (res?.error) {
      alert(`Error: ${res.error}`);
    }
  });

  document.getElementById('options')?.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  });

  document.getElementById('refreshSharedFile')?.addEventListener('click', async () => {
    const sharedFile = await browser.runtime
      .sendMessage({ type: 'getSharedFile' })
      .catch(() => ({ pdfUrl: null }));
    const el = document.getElementById('sharedPdfLink');
    if (el) {
      const url = sharedFile?.pdfUrl ?? null;
      if (url) {
        el.outerHTML = `<a class="value url" id="sharedPdfLink" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`;
      } else {
        el.outerHTML = '<p class="value" id="sharedPdfLink">—</p>';
      }
    }
  });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

init();
