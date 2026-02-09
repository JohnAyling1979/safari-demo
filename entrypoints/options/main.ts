import './style.css';

async function init() {
  console.log('safari-demo:options: Options script loaded');
  const app = document.getElementById('app')!;

  const { demoCount = 0, theme = 'light' } =
    await browser.storage.local.get(['demoCount', 'theme']);

  app.innerHTML = `
    <div class="options">
      <h1>Options</h1>
      <section>
        <h2>Theme</h2>
        <label>
          <input type="radio" name="theme" value="light" ${
            theme === 'light' ? 'checked' : ''
          } />
          Light
        </label>
        <label>
          <input type="radio" name="theme" value="dark" ${
            theme === 'dark' ? 'checked' : ''
          } />
          Dark
        </label>
      </section>
      <section>
        <h2>Storage Demo</h2>
        <p>Message count from storage: <strong id="count">${demoCount}</strong></p>
      </section>
    </div>
  `;

  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.addEventListener('change', (e) => {
      const value = (e.target as HTMLInputElement).value as 'light' | 'dark';
      browser.storage.local.set({ theme: value });
      document.body.dataset.theme = value;
    });
  });

  document.body.dataset.theme = theme as string;
}

init();
