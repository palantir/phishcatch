import { fakeBrowser } from '@webext-core/fake-browser';

// Provide the browser extension API stubs for tests.
// fakeBrowser implements an in-memory version of the WebExtension APIs.
(globalThis as any).browser = fakeBrowser;
(globalThis as any).chrome = fakeBrowser;
