import './style.css';

function init() {
  console.log('[Safari Demo] New tab script loaded');
  const app = document.getElementById('app')!;

  app.innerHTML = `
    <div class="newtab">
      <h1>Safari Demo Extension</h1>
      <p class="subtitle">Welcome! This extension demonstrates all components.</p>
      <div class="cards">
        <div class="card">
          <h2>Popup</h2>
          <p>Click the extension icon in the toolbar to open the popup.</p>
          <p>Shows current tab info and message count.</p>
        </div>
        <div class="card">
          <h2>Options</h2>
          <p>Configure theme and view storage data.</p>
          <button id="open-options">Open Options</button>
        </div>
        <div class="card">
          <h2>Content Script</h2>
          <p>Visit any webpage to see the floating badge injected by the content script.</p>
        </div>
        <div class="card">
          <h2>Background</h2>
          <p>The background script handles messaging and storage across all components.</p>
        </div>
      </div>
    </div>
  `;

  document.getElementById('open-options')?.addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
}

init();
