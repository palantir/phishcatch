# Postmortem: Popup White Screen During Webpack-to-WXT Migration

**Date:** 2026-02-05
**Severity:** P1 — Extension popup completely non-functional
**Duration:** Multiple debugging cycles across the migration effort
**Resolution:** Upgrade MobX 5 → 6 (`makeAutoObservable`), remove decorator syntax

---

## Summary

After migrating the PhishCatch Chrome extension build system from Webpack 5 to WXT (Vite-based), the popup rendered as a blank white rectangle. The extension loaded successfully, the service worker ran, and content scripts injected — but the popup UI never appeared. The root cause was a subtle incompatibility between MobX 5's legacy TypeScript decorators and Vite's class field initialization semantics, compounded by three additional issues that had to be peeled away before the real problem became visible.

---

## Timeline of Issues

The popup failure was not a single bug but a **stack of four layered issues**, each of which had to be resolved before the next one became observable:

### Layer 1: `crossorigin` attribute on module scripts
### Layer 2: `browser.storage.managed.get()` crash without enterprise policy
### Layer 3: esbuild silently strips legacy TypeScript decorators
### Layer 4: `useDefineForClassFields` shadows MobX prototype getter/setters

---

## Layer 1: `crossorigin` Attribute (Silent Script Load Failure)

### Symptom
Popup showed a completely blank white rectangle. No console output at all — not even errors.

### Root Cause
Vite adds `crossorigin` to all `<script type="module">` and `<link rel="stylesheet">` tags by default. This is correct for web pages (enables CORS for ES modules), but Chrome extensions serve resources from `chrome-extension://` URLs which do **not** support CORS. The `crossorigin` attribute causes the browser to silently refuse to load the scripts — no network error, no console error, just a blank page.

### Built output before fix
```html
<script type="module" crossorigin src="/chunks/popup-BNCqkBzt.js"></script>
<link rel="stylesheet" crossorigin href="/assets/popup-CeheZ8Wi.css">
```

### Fix
Added a custom Vite plugin to strip the attribute at build time:

```typescript
// wxt.config.ts
{
  name: 'strip-crossorigin',
  transformIndexHtml(html: string) {
    return html.replace(/ crossorigin/g, '');
  },
}
```

### Why This Was Hard to Debug
- No errors in the popup DevTools console
- No errors in the extension service worker console
- No network errors visible in the Chrome DevTools Network tab
- The script appeared to load (200 status) but was silently discarded by the browser's module loader
- This behavior is not documented in Vite's docs or WXT's docs for Chrome extension development

---

## Layer 2: Managed Storage Crash (Silent Config Failure)

### Symptom
After fixing Layer 1, the popup script loaded (confirmed via `console.log`) but still showed a white rectangle. No error messages in the console.

### Root Cause
`browser.storage.managed.get()` throws an exception when no enterprise policy is configured for the extension — which is the case for 100% of development/testing environments and any user who hasn't had the extension deployed via enterprise policy.

The original Webpack build used `chrome.storage.managed.get()` with a callback, where the error was silently swallowed. The WXT migration converted all APIs to `browser.*` (Promise-based via webextension-polyfill), making the error a rejected Promise. Since the call was inside `getConfig()`, which was called from `popupStore.loadConfig()`, which was fire-and-forget via `void this.loadConfig()`, the rejection was unhandled and `configReady` never became `true`.

### Call chain
```
popupStore constructor
  → void this.loadConfig()
    → await getConfig()
      → await getManagedPreferences()
        → await browser.storage.managed.get(...)  // THROWS
      // Promise rejects, loadConfig() never reaches configReady = true
```

### Fix
```typescript
async function getManagedPreferences(): Promise<Prefs> {
  const prefs = { ...defaults }
  try {
    const storedPrefs = await browser.storage.managed.get(Object.keys(prefs))
    // ... merge stored prefs
  } catch {
    // Managed storage throws when no enterprise policy is configured.
    // Fall back to defaults.
  }
  return prefs
}
```

Also wrapped the entire `loadConfig()` body in try-catch and moved `this.configReady = true` outside the try block so it's always reached.

### Why This Was Hard to Debug
- The error was swallowed by the `void` fire-and-forget pattern in the constructor
- No unhandled rejection warning appeared in the popup console
- The same code worked under Webpack because callback-style errors were silently ignored
- `browser.storage.managed` is rarely tested in development — it only works with enterprise policy deployment

---

## Layer 3: esbuild Strips Legacy Decorators (No MobX Reactivity)

### Symptom
After fixing Layers 1 and 2, the popup showed "Loading..." (the configReady=false state) and never progressed. Console confirmed `loadConfig()` completed without error, but the component never re-rendered.

### Root Cause
Vite uses **esbuild** for TypeScript transformation. esbuild does **not** support legacy TypeScript decorators (`experimentalDecorators: true`). When esbuild encounters `@observable` and `@observer` decorators, it silently strips them from the output — it doesn't error, it just removes them.

This meant:
- `@observable` properties were never registered with MobX — they were just plain class fields
- `@observer` components were never wrapped — they were just plain React components
- Setting `this.configReady = true` was a plain property assignment with no MobX notification
- The React component rendered once with `configReady = false` and had no mechanism to know when it changed

### Evidence from built output (before fix)
```javascript
// No decorator transform code present
// No __decorate, Reflect.decorate, or similar
class h5 {
  constructor() {
    this.showDebug = false;
    this.configReady = false;
    // ... plain assignments, no MobX wrapping
  }
}
```

### Fix Attempt: SWC Plugin
Added `@vitejs/plugin-react-swc` with `tsDecorators: true` to replace esbuild with SWC for TypeScript transformation. SWC has native support for legacy TypeScript decorators.

```typescript
// wxt.config.ts
import react from '@vitejs/plugin-react-swc';
react({ tsDecorators: true })
```

This generated proper `Reflect.decorate` calls in the output:
```javascript
X5([H1], h5.prototype, "showDebug");
X5([H1], h5.prototype, "configReady");
// ... decorators applied to prototype
```

### Result
Decorators were now being transformed — but the popup **still** showed "Loading..." and never updated. This led to Layer 4.

---

## Layer 4: `useDefineForClassFields` Shadows MobX Getters (The Real Bug)

### Symptom
Identical to Layer 3: "Loading..." forever. Decorators were confirmed present in the built output via `Reflect.decorate`. `loadConfig()` confirmed completing successfully. But the observer component never re-rendered.

### Root Cause

This was the deepest and most subtle issue. It involves an interaction between three specs:

1. **TypeScript's `useDefineForClassFields`**: When `target >= ES2022` (which includes `ESNext`), TypeScript defaults `useDefineForClassFields` to `true`. This changes how class fields are initialized — from assignment semantics (`this.x = value`) to define semantics (`Object.defineProperty(this, 'x', { value })`)

2. **SWC's class field compilation**: SWC respects this setting and generates a `_define_property` helper:
   ```javascript
   var sp = (e, t, r) => t in e
     ? Object.defineProperty(e, t, { enumerable: true, configurable: true, writable: true, value: r })
     : e[t] = r;
   ```

3. **MobX 5's decorator mechanism**: The `@observable` decorator modifies the **class prototype** by replacing the property descriptor with a getter/setter pair. When an instance is created, property access should go through these prototype getter/setters, allowing MobX to track reads and writes.

The fatal interaction:

```
Step 1: Class is defined
Step 2: Decorators run on PROTOTYPE
        → MobX puts getter/setter on h5.prototype.configReady
Step 3: new StorageState() — constructor runs
Step 4: SWC's _define_property helper runs: h0(this, "configReady", false)
        → Checks: "configReady" in this  →  TRUE (found on prototype via [[Has]])
        → Executes: Object.defineProperty(this, "configReady", { value: false, ... })
        → Creates an OWN DATA property on the instance
        → This SHADOWS the prototype getter/setter
Step 5: Later, this.configReady = true
        → Writes to the OWN data property
        → MobX's setter on the prototype is NEVER called
        → MobX has no idea the value changed
        → Observer components are never notified
        → UI never updates
```

### Evidence from built output
```javascript
class h5 {
  constructor() {
    h0(this, "showDebug", !1);      // Object.defineProperty — shadows prototype
    h0(this, "configReady", !1);     // Object.defineProperty — shadows prototype
    h0(this, "config");              // Object.defineProperty — shadows prototype
    // ...
    this.loadConfig()
  }
}
// Decorators applied to prototype BEFORE constructor runs:
X5([H1], h5.prototype, "showDebug");
X5([H1], h5.prototype, "configReady");
```

The `h0` helper's conditional logic is the key:
```javascript
var sp = (e, t, r) => t in e    // "configReady" in this → TRUE (on prototype)
  ? cp(e, t, { ... value: r })  // Object.defineProperty(this, "configReady", {value: false})
  : e[t] = r;                   // this["configReady"] = false  ← would work, but never reached
```

If the `in` check returned `false`, the simple assignment branch (`e[t] = r`) would trigger MobX's prototype setter. But because the decorator already put a property on the prototype, `in` returns `true`, and the `Object.defineProperty` branch runs instead — creating an own property that shadows the prototype forever.

### Fix Attempts That Failed

**Attempt 1: `useDefineForClassFields: false` in tsconfig.json**
```json
{ "useDefineForClassFields": false }
```
SWC (via `@vitejs/plugin-react-swc`) did not respect this setting. The built output was byte-identical — same chunk hash, same `_define_property` calls. The plugin likely doesn't pass this tsconfig field through to SWC's transform options.

**Attempt 2: `target: "ES2021"` in tsconfig.json**
Before ES2022, `useDefineForClassFields` defaults to `false`. But again, the SWC plugin did not change its output. Same chunk hash, same code.

**Attempt 3: `decorate()` function instead of decorator syntax**
MobX 5's `decorate(Class, { field: observable })` function was meant to be the non-decorator alternative. But it operates identically to `@observable` — it modifies the prototype. The `_define_property` helper still shadows the prototype getter/setter in the constructor. Same result.

### The Actual Fix: Upgrade to MobX 6

MobX 6 introduced `makeAutoObservable(this)` which takes a fundamentally different approach:

```typescript
class StorageState {
  showDebug = false
  configReady = false
  // ...

  constructor() {
    makeAutoObservable(this)  // Operates on the INSTANCE, not the prototype
    void this.loadConfig()
  }
}
```

`makeAutoObservable(this)` runs **in the constructor, after class field initialization**. It inspects the instance's own properties (which now exist as plain data properties thanks to `_define_property`) and replaces them in-place with observable versions. It doesn't rely on the prototype at all.

Built output with MobX 6:
```javascript
class WC {
  constructor() {
    v0(this, "showDebug", !1);       // _define_property — creates own property
    v0(this, "configReady", !1);     // _define_property — creates own property
    // ...
    Qr(this);                        // makeAutoObservable(this) — converts own
                                     // properties to observables IN PLACE
    this.loadConfig()
  }
}
// No prototype decorators needed
```

The component wrapper also changed from decorator to function call:
```typescript
// Before (MobX 5):
@observer
export class App extends React.Component { ... }

// After (MobX 6):
class AppComponent extends React.Component { ... }
export const App = observer(AppComponent)
```

### Full Dependency Changes
```
mobx:       ^5.15.7 → ^6.x
mobx-react: ^6.3.0  → ^7.x
```

Both are backward-compatible with React 16.13.1 (the project's React version).

---

## Why Tests Never Caught This

The test suite (82 tests, all passing throughout) never touched MobX stores or React components. All tests exercised the library layer: password hashing, TLSH fuzzy hashing, domain classification, URL sanitization, storage operations, and alert deduplication.

The MobX reactivity issue was a **runtime-only, UI-only** bug that manifested exclusively when:
1. The popup was opened in a real Chrome extension context
2. MobX stores were instantiated with their constructor logic
3. React components wrapped with `observer()` needed to react to state changes

None of these conditions existed in the unit test environment.

Additionally, the test setup used `@webext-core/fake-browser` which provides a Promise-based stub for `browser.*` APIs. The managed storage crash (Layer 2) was masked because fake-browser's `storage.managed.get()` returns an empty object instead of throwing.

---

## Lessons Learned

### 1. Vite/esbuild silently strips legacy TypeScript decorators
esbuild does not support `experimentalDecorators: true`. It silently removes decorator expressions during transformation without any warning or error. If your project uses legacy TypeScript decorators (MobX 5, Angular, TypeORM, etc.), you **must** use an alternative transformer (SWC, Babel) when migrating to Vite.

### 2. `useDefineForClassFields` is a hidden MobX killer
TypeScript 5.x with `target: "ESNext"` defaults `useDefineForClassFields` to `true`. This silently breaks all prototype-based decorator patterns (MobX 5, MobX 6 with decorators). The symptom is invisible at build time — code compiles, decorators appear to transform correctly, but reactivity doesn't work at runtime because `Object.defineProperty` shadows prototype getters/setters.

### 3. `@vitejs/plugin-react-swc` doesn't respect all tsconfig fields
Setting `useDefineForClassFields: false` or changing `target` in `tsconfig.json` had no effect on SWC's output through the Vite plugin. The plugin reads some tsconfig fields but doesn't pass `useDefineForClassFields` through to SWC's transform options (at least in version 4.x).

### 4. MobX 6's `makeAutoObservable` is immune to class field semantics
Unlike decorator-based approaches that modify the prototype, `makeAutoObservable(this)` operates on the instance after class field initialization. It works identically regardless of `useDefineForClassFields`. This makes it the only reliable MobX pattern for Vite/esbuild/SWC-based build systems.

### 5. Multiple bugs can stack and mask each other
The popup failure had four independent causes. Each had to be fixed in order because earlier failures (script not loading, config crash) prevented the later ones from being observable. This made the debugging process feel like peeling an onion — each fix revealed a new, deeper issue.

### 6. `void promise` is a dangerous pattern for critical async initialization
The `void this.loadConfig()` pattern in the constructor fire-and-forgets the Promise. Any rejection is silently swallowed. This made Layers 2, 3, and 4 all present identically: a white popup with no errors. Adding try-catch with `console.error` and ensuring `configReady = true` runs unconditionally (outside the try block) made subsequent debugging dramatically easier.

### 7. Test coverage doesn't guarantee runtime behavior
82/82 tests passed at every stage, from the first broken build to the final working popup. The test suite covered business logic exhaustively but had zero coverage of the MobX/React integration layer. When migrating build systems, the integration layer is exactly where breakage occurs.

---

## Files Changed in the Fix

| File | Change |
|------|--------|
| `wxt.config.ts` | Added `@vitejs/plugin-react-swc`, `strip-crossorigin` plugin |
| `utils/config.ts` | Try-catch around `browser.storage.managed.get()` |
| `stores/popupState.ts` | `@observable` → `makeAutoObservable(this)`, try-catch in `loadConfig()` |
| `stores/configOverride.ts` | `@observable` → `makeAutoObservable(this)` |
| `stores/reportPhishingState.ts` | `@observable` → `makeAutoObservable(this)` |
| `stores/manualUsernameState.ts` | `@observable` → `makeAutoObservable(this)` |
| `stores/manualPasswordState.ts` | `@observable` → `makeAutoObservable(this)` |
| `components/app.tsx` | `@observer class` → `observer()` wrapper, loading indicator |
| `components/debug.tsx` | `@observer class` → `observer()` wrapper |
| `components/configOverrideForm.tsx` | `@observer class` → `observer()` wrapper |
| `entrypoints/popup/main.tsx` | Diagnostic console.log |
| `lib/domhash.ts` | `throw 'No dom'` → `return false` |
| `tsconfig.json` | Removed `experimentalDecorators` (no longer needed) |
| `package.json` | Added `@vitejs/plugin-react-swc`, upgraded `mobx` 5→6, `mobx-react` 6→7 |

## Relevant Commits

```
c21ba30 fix: resolve popup white screen with SWC decorator support
c0d726f fix: upgrade MobX 5→6 to fix popup reactivity with Vite
```
