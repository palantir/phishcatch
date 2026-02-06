# PhishCatch: Activity Monitoring Feature Summary

## What PhishCatch Does

PhishCatch is an open-source Chrome extension built by Palantir to detect and prevent enterprise credential phishing. It works by:

1. **Saving password hashes on trusted domains** — when a user enters a password on a configured enterprise domain (e.g., `corp.example.com`), PhishCatch hashes it with PBKDF2-SHA512 and stores the hash locally. No plaintext passwords leave the browser.

2. **Detecting password reuse on untrusted domains** — when the same password appears on any other website, PhishCatch alerts the user and reports the incident to a backend server. This catches credential phishing in real time, before the attacker can use the stolen password.

3. **Fingerprinting login pages** — PhishCatch uses TLSH (fuzzy hashing) to fingerprint enterprise login page DOM structures. If a non-enterprise site has a suspiciously similar DOM, it flags it as a potential phishing clone.

4. **Centralized alerting** — all detections are sent to a FastAPI backend, which logs them to syslog and optionally forwards to Slack. Enterprise IT gets visibility into credential phishing attempts across the organization.

The extension is configured via Chrome managed policies, making it deployable at scale through MDM/GPO without user interaction.

## How It Works (Architecture)

```
Content Script              Service Worker           Backend (FastAPI)
(runs on every page)        (background process)     (centralized server)

Monitors password fields    Routes messages          POST /alert
Detects DOM fingerprints    Manages hash storage     - Validates PSK
Scrapes usernames           Compares hashes          - Logs to syslog
                            Triggers alerts          - Sends to Slack
        │                          │                        │
        └── sendMessage() ────────►└── fetch() ────────────►│
```

**Key design decisions:**
- Passwords are hashed client-side with random salts — the backend never sees plaintext credentials
- Content scripts run in every frame (`allFrames: true`) to catch login forms in iframes
- Deduplication prevents alert flooding (30-second window per unique alert)
- Failed alerts are queued locally and retried hourly

## What I Added: Activity Monitoring

### The Feature

A platform-driven monitoring engine that captures user interactions with web applications (starting with ChatGPT) and logs them to the backend. The key architectural decision: **the extension is a generic engine; the backend supplies the rules**.

### Why This Architecture

The naive approach — writing a dedicated content script per monitored app — means every new app or API change requires an extension update. Extension updates depend on Chrome Web Store review, auto-update delays, and user action. At scale, this is untenable.

Instead, the backend serves monitoring rules via `GET /monitoring-rules`. The extension fetches these on startup and every 30 minutes. To add Copilot monitoring, update the backend. To fix a broken ChatGPT extraction path, update the backend. The extension never changes.

### How It Works

1. **Backend defines rules** — each rule specifies a domain, an interception strategy, and how to extract data from intercepted requests:

```json
{
  "id": "chatgpt",
  "domains": ["chatgpt.com", "chat.openai.com"],
  "strategy": "fetch_intercept",
  "fetchConfig": {
    "urlPattern": "/backend-api/conversation",
    "extractPath": ["messages", -1, "content", "parts"],
    "filterPath": ["messages", -1, "role"],
    "filterValue": "user"
  }
}
```

2. **Service worker caches rules** — fetches from backend periodically, stores in `browser.storage.local`

3. **Content script activates on matching domains** — reads cached rules, checks if the current hostname matches. On non-monitored pages, it returns immediately (~1ms overhead). On matching pages, it injects a MAIN world fetch interceptor.

4. **MAIN world interceptor captures API calls** — patches `window.fetch` to intercept requests matching the rule's URL pattern. Extracts the user's query using the configured path, sends it back to the content script via `postMessage`.

5. **Content script forwards to service worker** — packages the extracted data as a generic `ActivityEvent` and sends via `browser.runtime.sendMessage`.

6. **Service worker forwards to backend** — `POST /activity` with PSK authentication. Backend logs, classifies, and optionally alerts via Slack.

### What Changes Where

| Frequent changes (backend only) | Rare changes (extension update) |
|---|---|
| Add/remove monitored apps | Add new interception strategy |
| Fix broken extraction paths | Change message format |
| Adjust alerting rules | Modify retry logic |
| Update URL patterns | |

### Challenges Encountered

1. **Chrome MV3 world isolation** — content scripts run in an ISOLATED world and cannot access `window.fetch` on the page. Intercepting fetch requires injecting code into the MAIN world, but MAIN world code cannot access `browser.runtime` APIs. Solution: a two-script bridge pattern where the MAIN world script communicates via `postMessage` and the ISOLATED world script forwards to the service worker.

2. **WXT typed `getURL`** — WXT auto-generates types for `browser.runtime.getURL` based on known public assets. The new `activity-interceptor.js` file wasn't recognized at type-check time. Resolved with a targeted type assertion.

3. **Async save race condition** — the original `sendAlert` pattern uses `void saveUnsentAlert(...)` (fire-and-forget). In tests, the unsent queue hadn't been written to storage before the assertion checked it. Fixed by awaiting the save in `sendActivity`.

4. **Vite CJS deprecation** — Vite's Node API CJS build was deprecated. The project was missing `"type": "module"` in `package.json`, causing Node to load the CJS fallback. One-line fix.

### How I Would Improve It Further

- **Additional interception strategies** — `dom_observer` for apps that don't use fetch, `websocket_intercept` for real-time chat apps
- **Rule validation** — schema validation on rule fetch to reject malformed rules before they reach the content script
- **Content redaction** — backend-side redaction of sensitive content (PII, credentials) before storage
- **Rate limiting** — backend-side throttling per client to prevent flooding from rapid user interactions
- **Rule versioning** — `schemaVersion` field on rules to handle backward-compatible rule format changes
- **Popup UI for activity log** — debug panel showing recently captured activities, useful for demo and troubleshooting

## Files Changed

### New (7 files, ~550 lines)
- `extension/entrypoints/activity-monitor.content.ts` — generic content script engine
- `extension/public/activity-interceptor.js` — MAIN world fetch interceptor
- `extension/lib/sendActivity.ts` — activity forwarding with unsent queue
- `extension/lib/monitoringRules.ts` — rule fetch and cache
- `extension/__tests__/activity.ts` — 13 tests
- `docs/architecture/platform-driven-monitoring.md` — architecture decision record
- `docs/implementation-plans/activity-monitoring.md` — implementation plan

### Modified (7 files, ~160 lines)
- `extension/utils/types.ts` — `ActivityEvent`, `MonitoringRule` types
- `extension/lib/backgroundLogic.ts` — `'activity'` message routing
- `extension/entrypoints/background.ts` — rule refresh scheduling
- `extension/lib/timedCleanup.ts` — unsent activity retry
- `extension/wxt.config.ts` — `web_accessible_resources`
- `extension/package.json` — `"type": "module"`
- `server/app/main.py` — `GET /monitoring-rules`, `POST /activity`

### Verification
- 95/95 tests pass (12 test files)
- 0 TypeScript errors
- Clean production build (1.52 MB)
