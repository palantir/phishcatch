import { fakeBrowser } from '@webext-core/fake-browser';

// @webext-core/fake-browser implements promise-based APIs only.
// The PhishCatch source code uses callback-based chrome.storage APIs.
// This shim wraps storage methods to support both calling conventions.
function wrapStorageArea(area: any): any {
  const originalGet = area.get.bind(area);
  const originalSet = area.set.bind(area);
  const originalClear = area.clear.bind(area);
  const originalRemove = area.remove?.bind(area);

  area.get = function (...args: any[]) {
    const lastArg = args[args.length - 1];
    if (typeof lastArg === 'function') {
      const callback = lastArg;
      const keys = args.length > 1 ? args[0] : undefined;
      originalGet(keys).then((result: any) => callback(result)).catch(() => callback({}));
      return;
    }
    return originalGet(...args);
  };

  area.set = function (...args: any[]) {
    const lastArg = args[args.length - 1];
    if (typeof lastArg === 'function' && args.length > 1) {
      const callback = lastArg;
      const items = args[0];
      originalSet(items).then(() => callback()).catch(() => callback());
      return;
    }
    return originalSet(...args);
  };

  area.clear = function (...args: any[]) {
    const lastArg = args[args.length - 1];
    if (typeof lastArg === 'function') {
      const callback = lastArg;
      originalClear().then(() => callback()).catch(() => callback());
      return;
    }
    return originalClear(...args);
  };

  if (originalRemove) {
    area.remove = function (...args: any[]) {
      const lastArg = args[args.length - 1];
      if (typeof lastArg === 'function' && args.length > 1) {
        const callback = lastArg;
        const keys = args[0];
        originalRemove(keys).then(() => callback()).catch(() => callback());
        return;
      }
      return originalRemove(...args);
    };
  }

  return area;
}

// Wrap all storage areas to support callback-style calls
wrapStorageArea(fakeBrowser.storage.local);
if (fakeBrowser.storage.managed) {
  wrapStorageArea(fakeBrowser.storage.managed);
}
if (fakeBrowser.storage.sync) {
  wrapStorageArea(fakeBrowser.storage.sync);
}

// Stub notifications API (not fully implemented in fake-browser)
if (!(fakeBrowser as any).notifications) {
  (fakeBrowser as any).notifications = {};
}
const notifs = (fakeBrowser as any).notifications;
if (!notifs.create) {
  notifs.create = function (...args: any[]) {
    const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : undefined;
    const id = 'notification-' + Math.random().toString(36).slice(2);
    if (callback) callback(id);
    return Promise.resolve(id);
  };
}
if (!notifs.onButtonClicked) {
  notifs.onButtonClicked = {
    addListener: () => {},
    removeListener: () => {},
    hasListener: () => false,
  };
}

// Stub runtime.getURL
if (!fakeBrowser.runtime.getURL) {
  (fakeBrowser.runtime as any).getURL = (path: string) => `chrome-extension://fake-id/${path}`;
}

// Stub browserAction API
if (!(fakeBrowser as any).browserAction) {
  (fakeBrowser as any).browserAction = {
    setBadgeText: () => {},
    setBadgeBackgroundColor: () => {},
    setIcon: () => {},
  };
}

// Provide the browser extension API stubs for tests.
(globalThis as any).browser = fakeBrowser;
(globalThis as any).chrome = fakeBrowser;
