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
  const { count } = await browser.runtime.sendMessage({
    type: 'getCount',
  });

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
        <div class="button-row">
          <button id="increment">Increment</button>
          <button id="clear">Clear</button>
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
