import './style.css';

export default defineContentScript({
  matches: ['*://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    console.log('[Safari Demo] Content script loaded on', window.location.href);
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
        badge.innerHTML = `
          <span class="title">Safari Demo Extension</span>
          <span class="url">${escapeHtml(window.location.href)}</span>
        `;
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
