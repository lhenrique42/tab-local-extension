# TabLocal

A privacy-first Chrome extension that replaces the New Tab page with a visual workspace for saving, organizing, and restoring browser sessions — all stored locally on your device, no account required.

---

## Features

- **Save sessions** — one click saves all open tabs in a window as a named collection
- **Workspace** — drag-and-drop collections and tabs across groups; reorder everything
- **Restore** — open a full collection in the current or a new window; background tabs are loaded in a discarded (suspended) state to save memory
- **Tab management** — add individual tabs by URL, duplicate, or remove with a confirm guard
- **Import / Export** — back up your data as JSON and restore it on any machine
- **Auto-group by domain** — cluster open tabs into Chrome tab groups by hostname with one button
- **Native tab group sync** — mirrors Chrome tab group colors and titles into saved collections
- **Settings** — restore mode, native sync, auto-group toggle, theme
- **Dark mode only** — clean dark UI with Geist typeface

## Tech Stack

| Layer               | Technology                                |
| ------------------- | ----------------------------------------- |
| Extension framework | [WXT](https://wxt.dev) 0.20 (Manifest V3) |
| UI                  | React 19, TypeScript strict               |
| Drag & drop         | @dnd-kit/core + @dnd-kit/sortable         |
| List virtualization | @tanstack/react-virtual                   |
| Storage             | `chrome.storage.local` via typed adapter  |
| Icons               | lucide-react                              |
| Fonts               | @fontsource/geist, @fontsource/geist-mono |
| Testing             | Vitest 2 + Testing Library + vitest-axe   |
| Linting             | ESLint 9 flat config + TypeScript ESLint  |
| Package manager     | pnpm 11                                   |

## Project Structure

```
entrypoints/
  background.ts       # MV3 service worker — Chrome API side-effects only
  newtab/             # New Tab Page — main workspace
  popup/              # Extension popup — quick save
  settings/           # Settings page

components/
  workspace/          # GroupSection, CollectionCard, TabList, LiveTabsSidebar, ...
  popup/              # Popup UI
  settings/           # Settings UI
  shared/             # Button, Icon, ConfirmDialog, EmptyState

lib/
  storage/            # Schema, adapter, migrations, defaults
  messaging/          # Typed message handlers (save, restore, auto-group, ...)
  chrome/             # chrome.tabs / chrome.tabGroups adapters
  hooks/              # useStorage, useLiveTabs

composables/
  useImportExport.ts  # Export-to-JSON and import-from-file logic
  useTheme.ts         # Theme switching

assets/styles/
  tokens.css          # Design tokens (colors, spacing, typography)

public/icons/         # Extension icons (16, 32, 48, 128 px)
```

## Getting Started

**Prerequisites:** Node.js ≥ 18, pnpm 11

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

WXT starts a dev server and outputs the extension to `.output/chrome-mv3/`. Load it in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `.output/chrome-mv3/`

Open a new tab to see the workspace.

### Build

```bash
pnpm build          # production bundle → .output/chrome-mv3/
pnpm zip            # .output/local-tab-1.0.0-chrome.zip (ready for CWS upload)
```

### Tests

```bash
pnpm test           # vitest run
pnpm test:watch     # watch mode
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
```

## Architecture Notes

- **All `chrome.*` calls** go through `lib/chrome/` adapters — never directly from React components.
- **All colors/spacing/typography** come from `assets/styles/tokens.css` custom properties — no hardcoded values.
- **Storage mutations** are single-key atomic writes; no multi-step sagas, safe across MV3 service worker restarts.
- **No Tailwind** — CSS custom properties throughout.

## Privacy

All data is stored in `chrome.storage.local`. Nothing leaves the device. No network calls are made for user data. See [`docs/privacy-practices.md`](docs/privacy-practices.md) for the full disclosure.

## License

This project is licensed under the **MIT License** – see the `LICENSE` file for details.

## Support

If you encounter any issues or have questions, feel free to open an issue on GitHub
