# PhishCatch: Webpack to WXT Migration Plan

> Generated with [Claude Code](https://claude.com/claude-code) - February 2026

## Scope
Migrate the `extension/` build system from Webpack 5 to WXT (Vite-based), migrate tests from Jest to Vitest, and restructure the project to follow WXT conventions. Stay on Manifest V2 to keep this focused on the build system.

## Key Decisions
- **Stay on MV2** - MV3 migration is a separate concern; the extension relies on persistent background pages
- **Migrate to Vitest** - WXT's native test framework; near-identical API to Jest
- **Replace `chrome.*` with `browser.*`** from `wxt/browser` across all source files
- **Use `vite-plugin-node-polyfills`** for Buffer/process/util (needed by pbkdf2)
- **Extract background business logic** into `lib/backgroundLogic.ts` so tests can import it (WXT wraps entrypoints in `defineBackground()` closures)

## New Directory Structure
```
extension/
  entrypoints/
    background.ts              # defineBackground() wrapper
    content.ts                 # defineContentScript() wrapper
    popup/
      index.html               # Popup HTML shell
      main.tsx                 # React entry point (imports CSS)
  components/                  # React popup components (from react-popup/)
    app.tsx
    home.tsx
    debug.tsx
    configOverrideForm.tsx
    manualPasswordForm.tsx
    manualUsernameForm.tsx
    reportPhishingPopup.tsx
    toaster.ts
  stores/                      # MobX stores (from react-popup/mobx/)
    popupState.ts
    configOverride.ts
    manualPasswordState.ts
    manualUsernameState.ts
    reportPhishingState.ts
  lib/                         # Shared utilities (from src/lib/)
    backgroundLogic.ts         # NEW: extracted from background.ts
    byteToHex.ts
    clientId.ts
    domhash.ts
    escapeRegExp.ts
    generateHash.ts
    getDomainType.ts
    getHostFromUrl.ts
    getSanitizedUrl.ts
    handleNotificationClick.ts
    sendAlert.ts
    showCheckmarkIfEnterpriseDomain.ts
    timedCleanup.ts
    tlsh.ts
    userInfo.ts
  content-lib/                 # Content script helpers
    bannedMessage.ts
    debounce.ts
  utils/                       # Shared config + types
    config.ts
    types.ts
  public/                      # Static assets (copied as-is)
    icon.png
    schema.json
  assets/                      # Vite-processed assets
    normalize.css
    blueprint.css
    blueprint-icons.css
  __tests__/                   # Test files
    (all 11 test files + samples/)
  wxt.config.ts
  vitest.config.ts
  test-setup.ts
  tsconfig.json
  package.json
```

## Phase 1: Scaffolding (config files)

### 1.1 Update `package.json`
- **Remove**: webpack, webpack-cli, webpack-merge, copy-webpack-plugin, ts-loader, jest, ts-jest, jest-webextension-mock, @types/jest, jest-environment-jsdom
- **Add**: wxt, vite-plugin-node-polyfills, vitest, @webext-core/fake-browser
- **Keep**: react, react-dom, mobx, mobx-react, @blueprintjs/core, @blueprintjs/icons, pbkdf2, process, util, buffer, typescript, eslint stack, @types/chrome, @types/pbkdf2, @types/react, @types/react-dom
- **Scripts**: `dev` -> `wxt`, `build` -> `wxt build`, `test` -> `vitest run`, `zip` -> `wxt zip`

### 1.2 Create `wxt.config.ts`
- Manifest V2 with same permissions, CSP, storage schema
- `vite-plugin-node-polyfills` for Buffer/process/util globals
- MV2 persistent background via entrypoint definition

### 1.3 Update `tsconfig.json`
- `module: "ESNext"`, `target: "ESNext"`, `moduleResolution: "bundler"`
- Keep `experimentalDecorators: true` (MobX 5)
- Add `types: ["wxt/client"]`
- `jsx: "react-jsx"` (modern transform)

### 1.4 Create `vitest.config.ts`
- jsdom environment, node polyfills plugin, setup file reference

### 1.5 Create `test-setup.ts`
- Import `fakeBrowser` from `@webext-core/fake-browser`
- Assign to `globalThis.chrome` and `globalThis.browser`

## Phase 2: Move & Restructure Files

### 2.1 Create directory structure
Create: `entrypoints/`, `entrypoints/popup/`, `components/`, `stores/`, `lib/`, `content-lib/`, `utils/`, `assets/`, `__tests__/`

### 2.2 Move files (with import path updates)
| From | To |
|------|-----|
| `src/lib/*` | `lib/*` |
| `src/content-lib/*` | `content-lib/*` |
| `src/config.ts` | `utils/config.ts` |
| `src/types.ts` | `utils/types.ts` |
| `src/react-popup/app.tsx` etc. | `components/*.tsx` |
| `src/react-popup/mobx/*` | `stores/*` |
| `src/__tests__/*` | `__tests__/*` |
| `public/normalize.css` | `assets/normalize.css` |
| `public/blueprint.css` | `assets/blueprint.css` |
| `public/blueprint-icons.css` | `assets/blueprint-icons.css` |

### 2.3 Update all import paths in moved files
Every file gets its relative imports adjusted for the new structure.

## Phase 3: Create WXT Entrypoints

### 3.1 Extract `lib/backgroundLogic.ts`
Extract `receiveMessage()`, `handlePasswordEntry()`, `handlePasswordLeak()` from `src/background.ts` into a standalone module. This is critical because tests import `handlePasswordEntry` directly and WXT entrypoints wrap code in closures.

### 3.2 Create `entrypoints/background.ts`
```ts
export default defineBackground({
  persistent: true,
  main() {
    browser.runtime.onMessage.addListener(receiveMessage);
    browser.notifications.onButtonClicked.addListener(handleNotificationClick);
    showCheckmarkIfEnterpriseDomain();
    timedCleanup();
  },
});
```

### 3.3 Create `entrypoints/content.ts`
```ts
export default defineContentScript({
  matches: ['*://*/*'],
  allFrames: true,
  runAt: 'document_idle',
  main() {
    // All content.ts logic moves here
    // checkIfUrlBanned() + ready() callback
  },
});
```

### 3.4 Create `entrypoints/popup/index.html` + `main.tsx`
- HTML: minimal shell with `<div id="root">` and `<script type="module" src="./main.tsx">`
- main.tsx: imports CSS from `assets/`, renders `<App />`

## Phase 4: `chrome.*` -> `browser.*` Migration

Replace `chrome.*` with `browser.*` (from `wxt/browser`) in all 18 source files. Key changes:
- `chrome.storage.local/managed` -> `browser.storage.local/managed`
- `chrome.runtime.sendMessage/onMessage` -> `browser.runtime.*`
- `chrome.notifications.create` -> `browser.notifications.create`
- `chrome.browserAction.setBadgeText` -> `browser.browserAction.setBadgeText`
- `chrome.tabs.*` -> `browser.tabs.*`
- Type `chrome.notifications.NotificationOptions` -> inline or cast

**Special case**: `config.ts` line 47 has `chrome.storage.onChanged.addListener` at module top level. Wrap this in an init function called from the entrypoints to avoid potential build-time execution issues.

## Phase 5: Test Migration (Jest -> Vitest)

### 5.1 Update test imports
- `'../background'` -> `'../lib/backgroundLogic'` (passwordHashing.ts)
- `'../config'` -> `'../utils/config'`
- `'../types'` -> `'../utils/types'`
- `'../lib/*'` -> `'../lib/*'` (no change needed)

### 5.2 Vitest-specific changes
- `jest.setTimeout()` -> `vi.setConfig({ testTimeout: ... })`
- `chrome.storage.local.*` in tests -> works via fakeBrowser shim in test-setup.ts
- `fs.readFileSync('./src/__tests__/samples/...')` -> `path.resolve(__dirname, 'samples/...')` with ESM-compatible `__dirname`

### 5.3 Crypto polyfill in tests
Keep the `Object.defineProperty(global.self, 'crypto', ...)` pattern but verify if jsdom provides `crypto.getRandomValues` natively in Vitest.

## Phase 6: Cleanup & Delete

- Delete `webpack/` directory (3 files)
- Delete `src/` directory (entire tree)
- Delete `jest.config.js`
- Delete `public/manifest.json`
- Delete `public/popup.html`
- Delete CSS files from `public/` (moved to `assets/`)
- Add `.output` and `.wxt` to `.gitignore`

## Verification & Stress Testing

### Build verification
1. `npm install` completes without errors
2. `wxt build` produces output in `.output/chrome-mv2/`
3. Generated `manifest.json` has correct: manifest_version 2, persistent background, content_scripts, browser_action, permissions, storage.managed_schema
4. No polyfill errors (Buffer/process/util available at runtime)

### Test verification
1. `vitest run` - all 11 test files pass
2. Specifically verify `passwordHashing.ts` (heaviest test, needs Buffer polyfill + backgroundLogic extraction)
3. Verify `domhash.ts` (reads sample files from disk, path resolution must work)
4. Verify `alertDup.ts` (60s timeout test)

### Manual browser testing
1. Load unpacked from `.output/chrome-mv2/` in Chrome
2. Popup opens with correct Blueprint.js styling
3. Debug page shows config/stored data correctly
4. Content script detects password fields
5. Enterprise domain badge checkmark works
6. Background processes messages correctly

### Regression checks
- pbkdf2 hashing produces identical outputs (deterministic with same salt)
- TLSH fuzzy hashing works correctly
- Storage operations (get/set/clear) work in all contexts
- Notification creation works
- Server alert sending works
