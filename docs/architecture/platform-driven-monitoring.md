# Architecture Decision Record: Platform-Driven Activity Monitoring

> Date: February 2026
> Status: Accepted
> Branch: `migrate/webpack-to-wxt`

## Problem

PhishCatch needs to monitor user interactions with web applications like ChatGPT, GitHub Copilot, Google Gemini, and other SaaS tools to detect data exfiltration and policy violations. The naive approach — writing a dedicated content script per application — creates a maintenance burden: every new app, every UI change, every API modification requires an extension update that must be pushed to all users.

Chrome extension updates are not instant. They depend on the Chrome Web Store review process (or enterprise deployment pipelines), auto-update intervals, and user action. This makes per-app content scripts untenable at scale.

## Decision

Ship the extension as a **generic monitoring engine** with built-in interception strategies. The **backend supplies monitoring rules** that tell the engine what to watch, where to watch, and how to extract data. Rules are fetched periodically and cached locally.

### Core Architecture

```
Backend API                    Service Worker              Content Script (ISOLATED)
┌──────────────┐               ┌──────────────┐            ┌──────────────────────┐
│              │ GET /rules    │              │ storage    │                      │
│ Serves rules │──────────────►│ Caches rules │──────────►│ Reads rules          │
│ per app      │               │ in storage   │            │ Matches domain       │
│              │               │              │            │ Injects MAIN helper  │
│              │               │              │            │ Forwards events      │
│              │ POST /activity│              │ sendMsg   │                      │
│ Logs, alerts │◄──────────────│ Routes msg   │◄───────────│ Packages ActivityEvt │
│ classifies   │               │ to backend   │            │                      │
└──────────────┘               └──────────────┘            └──────────┬───────────┘
                                                                      │ postMessage
                                                           ┌──────────┴───────────┐
                                                           │ MAIN World Helper     │
                                                           │ (activity-            │
                                                           │  interceptor.js)      │
                                                           │                       │
                                                           │ Patches window.fetch  │
                                                           │ Extracts data per     │
                                                           │ rule configuration    │
                                                           └───────────────────────┘
```

### What Ships Where

| Component | Ships with | Update mechanism | Changes when |
|---|---|---|---|
| Content script engine | Extension | Extension update (rare) | New interception strategy needed |
| MAIN world interceptor | Extension | Extension update (rare) | New extraction primitives needed |
| Service worker routing | Extension | Extension update (rare) | New message types needed |
| **Monitoring rules** | **Backend** | **Platform release** | **New app, changed API, new event type** |
| **Activity processing** | **Backend** | **Platform release** | **New alerting rules, filtering** |

The frequently-changing parts (rules, processing logic) live on the backend. The stable engine lives in the extension.

## Alternatives Considered

### 1. Per-App Content Scripts (Rejected)

```
extension/entrypoints/
  chatgpt.content.ts      ← hardcoded for ChatGPT
  copilot.content.ts      ← hardcoded for Copilot
  gemini.content.ts       ← hardcoded for Gemini
```

**Why rejected**: Every new app or API change requires an extension update. With 10+ monitored apps, this becomes a constant release treadmill. A ChatGPT DOM change shouldn't force all users to update their extension.

### 2. Generic Content Script with Hardcoded Strategies (Rejected)

A content script that supports all strategies but has app-specific configuration baked into the extension code (e.g., a JSON file bundled with the extension).

**Why rejected**: Still requires an extension update to change which apps are monitored or to fix broken extraction paths. The configuration is stable — but the data it operates on is not.

### 3. Configuration via Managed Policy Only (Rejected)

Use Chrome's `browser.storage.managed` (enterprise policy) to push monitoring rules.

**Why rejected**: Only works in enterprise-managed environments. Requires IT to deploy policy changes via MDM/GPO. Not suitable for non-enterprise deployments or rapid iteration.

### 4. MutationObserver Instead of Fetch Interception (Rejected as Primary)

Watch the DOM for new user message elements using `MutationObserver` from the ISOLATED world.

**Why rejected as primary strategy**: DOM structure changes frequently across app updates (CSS classes, element hierarchy, data attributes). API endpoints and request body formats are more stable. MutationObserver requires fragile CSS selectors that break on every UI refresh.

**Preserved as future strategy**: `dom_observer` can be added as an alternative strategy type in the monitoring engine for apps where fetch interception isn't viable.

## Design Constraints

### Content Script as Dumb Pipe

The content script must contain ZERO app-specific logic. It:
1. Reads cached rules from `browser.storage.local`
2. Checks if the current domain matches any rule
3. If no match, returns immediately (fast path)
4. If match, activates the interception strategy specified by the rule
5. Packages extracted data as a generic `ActivityEvent`
6. Forwards to the service worker

It does not classify, filter, deduplicate, or analyze. Those are backend concerns.

### Service Worker as Router

The service worker adds exactly two responsibilities:
1. **Rule refresh**: Fetch rules from backend on startup + every 30 minutes, cache in storage
2. **Message routing**: When it receives an `'activity'` message, POST it to the backend

It does not inspect the content, apply rules, or make alerting decisions.

### Backend as Intelligence Layer

All monitoring intelligence lives on the backend:
- **Rule definitions**: Which apps to monitor, which endpoints to intercept, how to extract data
- **Activity logging**: Structured syslog, queryable audit trail
- **Classification**: What constitutes a policy violation vs. normal usage
- **Alerting**: Slack webhooks, email, SIEM integration
- **Rate limiting**: Prevent flooding from rapid user interactions
- **Data redaction**: Strip sensitive content before storage if needed

## Data Flow

### Rule Delivery
```
Backend defines rules
  → Service worker fetches GET /monitoring-rules (startup + every 30 min)
  → Rules stored in browser.storage.local.monitoringRules
  → Content script reads from storage on each page load (no network call)
```

### Activity Capture (fetch_intercept strategy)
```
User sends ChatGPT query
  → Browser calls window.fetch('/backend-api/conversation', {body: ...})
  → MAIN world interceptor matches URL against rule's urlPattern
  → Parses body JSON, traverses extractPath to get query text
  → Applies filter (filterPath/filterValue) to confirm it's a user message
  → postMessage({type: 'PHISHCATCH_ACTIVITY', content, source, eventType})
  → Content script (ISOLATED) receives postMessage
  → Packages as ActivityEvent, sends via browser.runtime.sendMessage
  → Service worker receives, calls sendActivity()
  → POST to backend /activity endpoint
  → Backend logs, classifies, alerts
```

## Security Model

### Trust Boundary

The extension trusts the backend server identified by `phishcatch_server` in its configuration. This is the same trust model used for the existing alert system — the extension already sends password-related alerts to this server.

Monitoring rules come from this trusted server. If the server is compromised, an attacker could push rules that extract data from arbitrary websites. This is mitigated by:
1. **PSK authentication**: All requests include a pre-shared key
2. **Existing trust relationship**: The extension already trusts the backend with credential alerts
3. **Enterprise deployment**: In production, the server is behind corporate infrastructure
4. **Rule scope**: Rules only control *what data is extracted* from *which domains*. They cannot execute arbitrary code, modify pages, or access extension storage.

### Data Sensitivity

Activities may contain sensitive user input (queries to AI tools, messages in chat apps). The extension captures and forwards this data without inspection — it is the backend's responsibility to:
- Apply data retention policies
- Redact sensitive content if required
- Control access to logged activities
- Comply with organizational privacy policies

## Type Design

### Strings Over Enums for `eventType` and `source`

```typescript
eventType: string    // not enum { USER_INPUT, FILE_UPLOAD, ... }
source: string       // not enum { CHATGPT, COPILOT, ... }
```

**Rationale**: Enums create a compile-time dependency. Adding a new app or event type would require updating the enum in `types.ts` and releasing an extension update — exactly what this architecture avoids. Strings are validated by the backend at runtime.

### Array Paths Over Dot-Notation for Data Extraction

```typescript
extractPath: (string | number)[]    // ['messages', -1, 'content', 'parts']
// not: "messages[-1].content.parts"
```

**Rationale**: Array paths require no string parsing in the interceptor. Negative indices (`-1` for last element) are native array values. Arrays serialize directly to JSON with no ambiguity. The interceptor's `extractByPath()` function is ~10 lines — no regex, no parser, no edge cases.

## Future Extensions

### Additional Interception Strategies

The monitoring engine currently supports `fetch_intercept`. Future strategies can be added without breaking existing rules:

- **`dom_observer`**: MutationObserver watching for new elements matching configured selectors. Useful for apps that don't use fetch or have opaque API calls.
- **`input_capture`**: Event listeners on input fields matching configured selectors. Useful for traditional form-based apps.
- **`websocket_intercept`**: Patch `WebSocket` constructor to capture messages. Useful for real-time chat apps.

Each new strategy requires an extension update (adding the strategy implementation to the engine). But once a strategy exists, any number of apps can use it via backend rules alone.

### Rule Versioning

Rules currently have no version field. If rule schema changes in the future, add a `schemaVersion` field to the rule and handle backward compatibility in the content script.

## Related Documents

- [Implementation Plan](../implementation-plans/activity-monitoring.md)
- [WXT Migration Summary](../implementation-plans/wxt-migration-summary.md)
- [Popup White Screen Postmortem](../implementation-plans/popup-white-screen-postmortem.md)
