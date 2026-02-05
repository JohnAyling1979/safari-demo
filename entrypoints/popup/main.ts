import './style.css';

async function init() {
  console.log('[Safari Demo] Popup script loaded');
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

  // Get count from background
  const { count, _debugLastRun } = await browser.runtime.sendMessage({
    type: 'getCount',
  });
  const lastRunStr =
    _debugLastRun != null
      ? `Background ran ${Math.round((Date.now() - _debugLastRun) / 1000)}s ago`
      : 'Background did not respond';

  app.innerHTML = `
    <div class="popup">
      <h1>Safari Demo</h1>
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
        <p class="debug" id="debug">${lastRunStr}</p>
        <button id="increment">Increment</button>
      </section>
      <section>
        <a href="#" id="options">Open Options</a>
      </section>
    </div>
  `;

  document.getElementById('increment')?.addEventListener('click', async () => {
    const { count: newCount, _debugLastRun } =
      await browser.runtime.sendMessage({ type: 'incrementCount' });
    document.getElementById('count')!.textContent = String(newCount ?? 0);
    const debugEl = document.getElementById('debug');
    if (debugEl && _debugLastRun) {
      debugEl.textContent = `Background ran ${Math.round((Date.now() - _debugLastRun) / 1000)}s ago`;
    }
  });

  document.getElementById('options')?.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  });
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

init();
