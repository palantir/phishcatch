# Implementation Plan: Platform-Driven Activity Monitoring

> Date: February 2026
> Branch: `migrate/webpack-to-wxt`
> ADR: [Platform-Driven Monitoring Architecture](../architecture/platform-driven-monitoring.md)

## Context

PhishCatch needs to monitor user interactions with web applications (ChatGPT, Copilot, Gemini, etc.) and log them to the backend. The extension ships a generic monitoring engine; the backend supplies monitoring rules. No extension update is needed to add or modify monitored apps.

### Design Principles
1. **Extension = stable generic platform** — ships interception strategies, never changes per-app
2. **Backend = intelligence layer** — supplies rules, receives data, does analysis
3. **Content script = dumb pipe** — reads rules, runs matching strategy, forwards data
4. **Service worker = dumb router** — fetches rules periodically, routes messages to backend

---

## Stress Test Matrix

| Scenario | How it's handled |
|---|---|
| Add Copilot/Gemini/Claude monitoring | Backend adds a rule. Extension unchanged. |
| ChatGPT changes their API endpoint | Backend updates the rule's `urlPattern`. Extension unchanged. |
| Need to monitor a new interaction type (file upload, paste) | Backend adds a rule with different `eventType`. Extension unchanged. |
| Need to stop monitoring an app | Backend removes the rule. Extension unchanged. |
| ChatGPT changes request body format | Backend updates `extractPath` in the rule. Extension unchanged. |
| Extension is offline | Activities queue in local storage, retry on reconnect (existing pattern). |
| Backend is unreachable for rule fetch | Use last cached rules from `browser.storage.local`. |
| 10 apps monitored simultaneously | Each rule only activates on its domains. Non-matching pages return immediately. |
| Need per-app alerting policies | Backend logic, not extension logic. |
| New interception strategy needed (e.g. WebSocket) | Only case requiring extension update — add strategy to engine. Rare. |

---

## Architecture

```
┌─────────────────┐                           ┌─────────────────────────┐
│  Backend API    │   GET /monitoring-rules    │  Service Worker         │
│                 │◄──────────────────────────│  (fetches rules on      │
│  Serves rules   │──────────────────────────►│   startup + every 30m,  │
│  per app/domain │   returns MonitoringRule[] │   caches in storage)    │
└────────┬────────┘                           └────────────┬────────────┘
         │                                                  │
         │  POST /activity                                  │ browser.runtime
         │  (log, classify, alert)                          │ .sendMessage
         │                                                  │
         │                                    ┌─────────────┴────────────┐
         │                                    │  Content Script          │
         │◄───────────────────────────────────│  (ISOLATED world)        │
         │                                    │                          │
         │                                    │  1. Read rules from      │
         │                                    │     browser.storage      │
         │                                    │  2. Match current domain │
         │                                    │  3. If fetch_intercept:  │
         │                                    │     inject MAIN world    │
         │                                    │     helper + configure   │
         │                                    │  4. Receive extracted    │
         │                                    │     data via postMessage │
         │                                    │  5. Forward as           │
         │                                    │     ActivityEvent to SW  │
         │                                    └──────────┬───────────────┘
         │                                               │ postMessage
         │                                    ┌──────────┴───────────────┐
         │                                    │  MAIN World Helper       │
         │                                    │  (public/activity-       │
         │                                    │   interceptor.js)        │
         │                                    │                          │
         │                                    │  Generic fetch patcher.  │
         │                                    │  Configured by rules     │
         │                                    │  received via postMessage│
         │                                    │  from content script.    │
         │                                    │  Never changes per-app.  │
         │                                    └──────────────────────────┘
```

### Rule Lifecycle
1. Backend defines rules (e.g., ChatGPT: intercept `POST /backend-api/conversation`, extract `messages[-1].content.parts`)
2. Service worker fetches rules from `GET {phishcatch_server}/monitoring-rules` on startup + every 30 min
3. Rules cached in `browser.storage.local.monitoringRules`
4. Content script reads cached rules on each page load — no network call
5. If domain matches a rule, activate the corresponding strategy
6. To update monitoring: change backend rules, next refresh picks them up, no extension update

---

## Types — `extension/utils/types.ts`

### MonitoringRule (backend to extension)

```typescript
export interface MonitoringRule {
  id: string
  source: string
  domains: string[]
  strategy: 'fetch_intercept'
  eventType: string
  fetchConfig: {
    urlPattern: string
    method?: string
    extractPath: (string | number)[]
    filterPath?: (string | number)[]
    filterValue?: string
    join?: string
  }
}
```

### ActivityEvent (extension to backend)

```typescript
export interface ActivityEvent {
  eventType: string
  source: string
  content: string
  url: string
  timestamp: number
  metadata?: Record<string, string>
}
```

### Extended PageMessage

```typescript
export interface PageMessage {
  msgtype: 'username' | 'password' | 'debug' | 'domstring' | 'activity'
  content: PasswordContent | UsernameContent | DomstringContent | ActivityEvent | string
}
```

---

## File Changes

### New Files

| File | Purpose | ~Lines |
|---|---|---|
| `extension/entrypoints/activity-monitor.content.ts` | Generic content script engine (ISOLATED world) | 50 |
| `extension/public/activity-interceptor.js` | MAIN world fetch interceptor | 45 |
| `extension/lib/sendActivity.ts` | Forward ActivityEvent to backend | 45 |
| `extension/lib/monitoringRules.ts` | Rule fetch, cache, domain matching | 40 |
| `extension/__tests__/activity.ts` | Tests for extraction, matching, sending | 80 |

### Modified Files

| File | Change | ~Lines |
|---|---|---|
| `extension/utils/types.ts` | Add `MonitoringRule`, `ActivityEvent`, extend `PageMessage` | 10 |
| `extension/lib/backgroundLogic.ts` | Add `'activity'` case to switch | 5 |
| `extension/entrypoints/background.ts` | Add rule refresh interval | 3 |
| `extension/lib/timedCleanup.ts` | Add `tryToSendFailedActivities()` | 15 |
| `extension/wxt.config.ts` | Add `web_accessible_resources` | 5 |
| `server/app/main.py` | Add `GET /monitoring-rules`, `POST /activity` | 70 |

---

## Update Boundary Matrix

| Component | Update mechanism | Changes when... |
|---|---|---|
| Content script engine | Extension update | New interception strategy needed (rare) |
| MAIN world interceptor | Extension update | New extraction primitives needed (rare) |
| Service worker routing | Extension update | New message types needed (rare) |
| `sendActivity.ts` | Extension update | Backend API contract changes (rare) |
| **Monitoring rules** | **Backend release** | **New app, changed DOM/API, new eventType (frequent)** |
| **Activity processing logic** | **Backend release** | **New alerting rules, filtering, classification (frequent)** |

---

## Verification Plan

### Unit Tests
1. `extractByPath` handles nested paths, negative indices, missing keys, null traversal
2. Rule domain matching with wildcards (reuse existing `getDomainType` wildcard logic)
3. `sendActivity` sends correct payload shape to `/activity`
4. Failed activities queue in storage and retry via `tryToSendFailedActivities`
5. `refreshMonitoringRules` stores rules in storage correctly

### Manual E2E Demo
1. Build extension: `cd extension && npx wxt build`
2. Start backend: `cd server/app && uvicorn main:app --reload`
3. Load extension in Chrome, set config override with `phishcatch_server: 'http://localhost:8000'`
4. Verify rule fetch: check `browser.storage.local.monitoringRules` in devtools
5. Navigate to `chatgpt.com`, send a query
6. Verify backend logs show: source=chatgpt, eventType=user_input, content=query text
7. Demo adding a new rule by updating backend — no extension reload needed

### Stress Scenarios
- Non-monitored page: content script returns after storage read (~1ms overhead)
- Rapid queries: all forwarded, backend handles rate limiting
- Backend offline: activities queue, retry every hour
- Rules endpoint unreachable: use cached rules from last successful fetch
- Malformed fetch body (FormData, stream): interceptor skips silently, never breaks page
- Page with no fetch calls: interceptor patches fetch but never fires

---

## Implementation Order

1. Types: Add `MonitoringRule`, `ActivityEvent` to `types.ts`
2. Backend: Add `GET /monitoring-rules` and `POST /activity` endpoints
3. Extension plumbing: `sendActivity.ts`, `monitoringRules.ts`, `backgroundLogic.ts`, `background.ts`
4. Content script + interceptor: `activity-monitor.content.ts`, `public/activity-interceptor.js`
5. Config: `wxt.config.ts` web_accessible_resources, `timedCleanup.ts` retry logic
6. Tests: `activity.ts` test file
7. Build + verify: `wxt build`, load in Chrome, E2E test against local backend
