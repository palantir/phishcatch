# Overview

This extension is designed to identify and prevent enterprise password leaks. The main idea is to detect when users reuse their corporate passwords on untrusted domains, which is a red flag.

When you enter a password on an enterprise domain, the extension hashes and stores it locally. Then when you enter a password on a non-enterprise domain, it hashes that too and compares it against stored enterprise password hashes. If there's a match, it sends an alert.

Domains are classified into three categories: enterprise domains where passwords can be saved, dangerous domains where reuse is monitored, and ignored domains that are excluded. The extension also automatically detects usernames from form fields using configurable CSS selectors, with special handling for Microsoft Online login pages.

There's also DOM hash detection to catch phishing pages by comparing page DOM hashes against previously seen enterprise login pages. When password reuse or suspicious activity is detected, alerts are sent to a configurable server endpoint with URL, usernames, and other metadata. Failed alerts are stored locally and retried automatically. Users can get browser notifications with options to report false positives, and there's a popup interface for manually reporting phishing pages.

Everything is stored locally in the browser with automatic cleanup based on configurable retention policies. The extension is designed for enterprise deployment with policies for domain lists, alert behavior, hash settings, and server endpoints.

# Summary

Added functionality to capture ChatGPT API requests and user inputs. To capture what users send to ChatGPT, we needed to intercept network requests and read their bodies. This is challenging in Chrome extensions due to security restrictions. The chrome.webRequest.onBeforeRequest API can intercept requests but doesn't expose request bodies, so we can't read POST payloads. Given this, I came up with two alternative approaches:

1. UI event capture: Listen for Enter or send button clicks in the content script, extract the input, and correlate it with the next conversation request by timestamp. This is unreliable due to timing and race conditions.
2. Monkey patching fetch/XHR: Intercept window.fetch and XMLHttpRequest at the page level to access the actual Request objects and read their bodies.

I ended up choosing monkey patching. Monkey patched fetch and XHR in the MAIN world content script using the @rxliuli/vista library. This allows intercepting requests before they're sent, cloning requests to read their bodies, filtering for ChatGPT conversation endpoints, extracting user inputs from the request payload, and sending the data to the background service worker via window.postMessage (since MAIN world scripts don't have direct access to chrome.runtime APIs). The content script (interceptor) runs in "world": "MAIN" to access the page's JavaScript context, otherwise monkey patching will not work. We use a discriminated union type system for type-safe message passing. Requests are filtered by URL pattern (chatgpt.com + /conversation endpoint). We parse ChatGPT's request format to extract user message inputs. This approach requires careful implementation to comply with Chrome Web Store policies, I would have to double check and see if monkey patching fetch and XHR would be an issue. The extension only intercepts requests to specific endpoints and processes data locally before sending alerts to the server.

Once the intercepted data is processed in the background service worker, alerts are sent to the server via POST requests to the /alert endpoint (e.g., http://localhost:8000/alert). The alert payload uses a discriminated union type system with two main alert types: CredentialAlert (for password reuse, DOM hash, user reports, etc.) and ConversationAlert (for ChatGPT conversation intercepts). The server validates the pre-shared key (PSK) and processes each alert type accordingly. Failed alerts are stored locally and retried automatically, with old alerts being filtered out during cleanup. The server endpoint is configured via the extension's config and can be set to any server URL.

## Challenges

1. Service Worker was not loading properly. No errors in the service worker console that I could see. I asked Cursor to check the build output and it found that getHostFromUrl on L36 was not in the bundle causing a runtime error when the Service Worker loads. Fixed by modifying chunking in the webpack config
2. Having a vendor bundle is an older paradigm and isn't needed anymore. Now bundlers like webpack will only bundle everything they need into once script
3. Alert type we send over to the server was too specific and should have been more generic so more message types can be send over. Ideally, we send over type/content and let the server unpack the request body as needed per request
4. Capturing reading the POST body from a network request.
5. Wrestled with chunking in webpack, it was not setup correctly
6. Types in the project leave a lot to be desired. Cleaned up as much as I could to help TypeScript be more useful

## TODO

1. Types file is getting large, would be nice to split types out by domain (content/background/interceptor)
2. Be great to rework the structure of the project. Having a libs folder is an older paradigm. Nothing wrong with it, I just don't see it used much recently. Would prefer to divide out by domain (content/background/interceptor)
3. Use a type safe messenger, something like webext messenger for send/recieve messages
4. Change the config to use .env instead of hard coded in the config.ts file
