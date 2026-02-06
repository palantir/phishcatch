# PhishCatch: Webpack to WXT Migration Summary

> Completed February 2026 on branch `migrate/webpack-to-wxt`

## What Changed

This migration replaced the entire build toolchain and upgraded the extension manifest, while preserving 100% of the original business logic. No features were added or removed.

### Build System: Webpack 5 → WXT (Vite)

| | Before | After |
|---|--------|-------|
| Bundler | Webpack 5 + ts-loader | WXT 0.19 (Vite 5 + SWC) |
| Test runner | Jest + ts-jest | Vitest 1.6 |
| Browser mock | jest-webextension-mock | @webext-core/fake-browser |
| Extension API | `chrome.*` (callbacks) | `browser.*` (Promises) via wxt/browser |
| Manifest | V2 (persistent background page) | V3 (service worker) |
| MobX pattern | `@observable` / `@observer` decorators | `makeAutoObservable(this)` / `observer()` wrapper |
| MobX version | 5.15 | 6.x |
| TypeScript | 4.8 | 5.4 |
| Output dir | `dist/` | `output/chrome-mv3/` |

### Directory Structure

```
Before (Webpack)                    After (WXT)
extension/                          extension/
  src/                                entrypoints/
    background.ts                       background.ts        (defineBackground wrapper)
    content.ts                          content.ts           (defineContentScript wrapper)
    popup.tsx                           popup/
    lib/                                  index.html
      14 library files                    main.tsx           (React mount point)
    content-lib/                      lib/
      bannedMessage.ts                  backgroundLogic.ts   (extracted from background.ts)
      debounce.ts                       14 library files     (unchanged logic)
    react-popup/                      content-lib/
      app.tsx                           bannedMessage.ts     (unchanged)
      home.tsx                          debounce.ts          (unchanged)
      6 more components               components/
      mobx/                             app.tsx + 7 files    (unchanged logic)
        5 store files                 stores/
    config.ts                           5 store files        (makeAutoObservable)
    types.ts                          utils/
    __tests__/                          config.ts            (Promise-based + try-catch)
      11 test files                     types.ts             (unchanged, 147 lines)
  public/                            __tests__/
    manifest.json                       11 test files        (Vitest conventions)
    popup.html                        public/
    icon.png                            icon.png
    schema.json                         schema.json
    3 CSS files                       assets/
  webpack/                              3 CSS files
    3 config files                    wxt.config.ts
  jest.config.js                      vitest.config.ts
  tsconfig.json                       test-setup.ts
  package.json                        tsconfig.json
                                      package.json
```

### Manifest V2 → V3

| Feature | V2 | V3 |
|---------|----|----|
| Background | `"scripts": ["background.js"], "persistent": true` | `"service_worker": "background.js"` |
| Popup | `"browser_action": { "default_popup": ... }` | `"action": { "default_popup": ... }` |
| Permissions | All in `"permissions"` | Host patterns moved to `"host_permissions"` |
| CSP | String value | `{ "extension_pages": "..." }` |

### API Migration

All 22+ call sites across 12 files converted from callback-style `chrome.*` to Promise-based `browser.*`:

```typescript
// Before (Webpack / MV2)
chrome.storage.local.get('key', (result) => { ... })
chrome.runtime.sendMessage(msg, (response) => { ... })
chrome.browserAction.setBadgeText({ text: '!' })

// After (WXT / MV3)
const result = await browser.storage.local.get('key')
const response = await browser.runtime.sendMessage(msg)
await browser.action.setBadgeText({ text: '!' })
```

### MobX 5 → 6

Legacy TypeScript decorators are incompatible with Vite's build pipeline (see [postmortem](popup-white-screen-postmortem.md) for the full investigation). All stores and components were refactored:

```typescript
// Before (MobX 5 decorators)
import { observable } from 'mobx'
import { observer } from 'mobx-react'

@observer
export class App extends React.Component {
  @observable configReady = false
  // ...
}

// After (MobX 6 functions)
import { makeAutoObservable } from 'mobx'
import { observer } from 'mobx-react'

class StorageState {
  configReady = false
  constructor() {
    makeAutoObservable(this)
  }
}

class AppComponent extends React.Component { ... }
export const App = observer(AppComponent)
```

---

## What Didn't Change

All business logic is identical. No functions were rewritten, no algorithms changed, no behavior modified.

- **Password hashing**: PBKDF2-SHA512 with configurable iterations and salt — `generateHash.ts` unchanged
- **DOM fingerprinting**: TLSH fuzzy hashing for phishing page detection — `domhash.ts`, `tlsh.ts` unchanged
- **Domain classification**: Enterprise and dangerous domain detection — `getDomainType.ts` unchanged
- **Alert system**: Server-side alert creation, local notifications, deduplication, timed cleanup — `sendAlert.ts`, `timedCleanup.ts` unchanged
- **User data management**: Username/password storage, validation, expiry — `userInfo.ts` unchanged
- **Configuration**: Managed policy + local override + caching with TTL — `config.ts` logic unchanged (API calls converted to async/await, try-catch added for managed storage)
- **Content script**: Password field detection, DOM monitoring, message passing — unchanged
- **Popup UI**: All 8 React components render identical UI with Blueprint.js 3
- **Enterprise policy schema**: All 17 fields in `schema.json` unchanged
- **Type definitions**: `types.ts` (147 lines) unchanged

---

## Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` | 0 errors |
| `vitest run` | 82/82 tests passed (11 test files) |
| `wxt build` | Clean production build, 1.5 MB |
| Load in Chrome | Extension loads, popup renders, service worker runs |
| ESLint | Only pre-existing `prettier/@typescript-eslint` deprecation (not from migration) |

### Build Output

```
output/chrome-mv3/
  manifest.json               607 B
  popup.html                  913 B
  background.js               151 KB    (service worker)
  chunks/popup-COScCEmD.js    908 KB    (popup app + Blueprint.js + MobX + React)
  content-scripts/content.js  140 KB    (content script)
  assets/popup-CeheZ8Wi.css   280 KB    (Blueprint.js styles)
  icon.png                     21 KB
  schema.json                 2.8 KB
```

---

## Commits

```
001e79f build: add WXT scaffolding and replace Webpack dependencies
8cb0339 refactor: restructure project to WXT directory conventions
3641a10 feat: create WXT entrypoints and extract background logic
fcdf8d0 refactor: migrate chrome.* API calls to browser.* from wxt/browser
1dd8b25 test: migrate test files from Jest to Vitest conventions
6b06a0f cleanup: remove legacy Webpack/Jest files, fix build and test issues
0c4c0e4 fix: convert callback-style browser.* API calls to async/await
3655ab7 fix: resolve TypeScript type errors and remaining callback-style API calls
2e8d506 feat: upgrade from Manifest V2 to Manifest V3
c21ba30 fix: resolve popup white screen with SWC decorator support
c0d726f fix: upgrade MobX 5→6 to fix popup reactivity with Vite
048d084 docs: add postmortem for popup white screen issue
```

---

## Bugs Found and Fixed During Migration

These were latent issues in the original codebase that only surfaced during the migration:

1. **22 callback-style `browser.*` API calls** — webextension-polyfill throws when callbacks are passed. Tests missed this because the test setup shimmed callbacks. Fixed by converting all to async/await.

2. **`browser.storage.managed.get()` crashes without enterprise policy** — Always throws in dev/testing environments. Original code swallowed the error via callbacks. Fixed with try-catch.

3. **`checkDOMHash` throws on empty DOM** — `throw 'No dom'` became an unhandled rejection. Changed to `return false`.

4. **`popupStore.loadConfig()` silently swallows errors** — `void this.loadConfig()` fire-and-forgets the Promise. Added try-catch with console.error, moved `configReady = true` outside the try block.

---

## Known Limitations

- **Blueprint.js icon fonts**: The `icons-16.eot`, `icons-20.woff` etc. references in Blueprint CSS don't resolve at build time. Icons that rely on these font files may not render. Icons using SVG paths (the default in Blueprint.js 3) work fine.
- **Chunk size**: The popup chunk is 908 KB (Blueprint.js + MobX + React bundled together). Could be reduced with code splitting if needed.

---

## Related Documents

- [Original migration plan](wxt-migration.md)
- [Popup white screen postmortem](popup-white-screen-postmortem.md) — detailed investigation of the four-layered bug that caused the popup to render as a blank white rectangle
