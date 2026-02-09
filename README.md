# Safari Demo Extension

A WXT-based web extension that demonstrates all extension components: popup, options, background script, content script, and new tab override.

## Components

- **Popup** – Click the toolbar icon to see current tab info and message count
- **Options** – Theme toggle and storage demo (right-click icon → Options)
- **Background** – Handles messaging and storage across components
- **Content Script** – Injects a floating badge on every webpage
- **New Tab** – Custom welcome page when opening a new tab

## Development

```bash
# Install dependencies
pnpm install

# Dev mode (Chrome by default)
pnpm dev

# Dev mode for Safari
pnpm dev:safari

# Build for Safari
pnpm build:safari

# Create zip for distribution
pnpm zip:safari
```

## Safari Installation

**Required first:** Unsigned development extensions only appear in Safari when "Allow Unsigned Extensions" is enabled:

1. Safari → Settings → Advanced → enable **Show features for web developers**
2. Develop menu → enable **Allow Unsigned Extensions**
3. Keep the app running when checking Safari → Settings → Extensions

Then:

1. Build: `pnpm build:safari`
2. Copy built extension into Xcode project: `cp -R .output/safari-mv2/* "Safari Demo Extension/Shared (Extension)/Resources/"`
3. Open the Xcode project (`Safari Demo Extension`), select **My Mac** as destination, and run (⌘R)
4. With the app running, open Safari → Settings → Extensions and enable the extension
