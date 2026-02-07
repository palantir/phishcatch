# PhishCatch

A Chrome extension that detects and prevents enterprise credential phishing, with platform-driven activity monitoring for web applications.

Originally built by [Palantir Technologies](https://github.com/palantir/phishcatch). See the [blog post](https://blog.palantir.com/phishcatch-detecting-password-reuse-from-the-inside-out-77aa93e3e6fb) on why PhishCatch was built.

## What It Does

**Password reuse detection** — hashes enterprise passwords client-side (PBKDF2-SHA512) and alerts when the same password appears on untrusted websites.

**Phishing page detection** — fingerprints enterprise login page DOM structures with TLSH fuzzy hashing and flags suspicious clones on other domains.

**Activity monitoring** — captures user interactions with monitored web applications (ChatGPT, etc.) and logs them to the backend. The extension ships a generic interception engine; the backend supplies monitoring rules. Rules are managed at runtime through a built-in web dashboard — no code changes or restarts needed to add or modify monitored apps.

**Centralized alerting** — all detections and activity are sent to a FastAPI backend with syslog and Slack integration.

## Architecture

```
Extension (Chrome MV3)                    Backend (FastAPI)
┌────────────────────────────────┐        ┌────────────────────────┐
│ Content Scripts                │        │                        │
│  - Password monitoring         │        │ GET /monitoring-rules  │
│  - Activity monitoring engine  │        │ POST /alert            │
│                                │        │ POST /activity         │
│ Service Worker                 │        │ GET /status            │
│  - Message routing             │◄──────►│                        │
│  - Rule caching                │        │ CRUD /api/rules        │
│  - Hash management             │        │ Slack webhook          │
│                                │        │ Syslog                 │
└────────────────────────────────┘        └────────────────────────┘
```

## Quick Start

### Extension

```bash
cd extension
npm install
npm run build        # production build → output/chrome-mv3/
npm run dev          # development mode with hot reload
npm test             # run tests (95 tests across 12 files)
```

Load `extension/output/chrome-mv3/` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked).

### Backend

```bash
cd server/app
pip install -r requirements.txt
uvicorn main:app --reload
```

Environment variables:
- `PRESHARED_KEY` — PSK for authenticating extension requests
- `SLACK_WEBHOOK` — Slack webhook URL for alert notifications (optional)

### Configuration

Set the extension's config override (or deploy via Chrome managed policy):
- `phishcatch_server` — backend URL (e.g., `http://localhost:8000`)
- `psk` — pre-shared key matching the backend's `PRESHARED_KEY`
- `enterprise_domains` — domains where corporate passwords are entered

See `extension/public/schema.json` for all configuration options and `policy-templates/` for enterprise deployment templates.

## How It Works (TLDR)

1. The **backend** serves monitoring rules that describe what to watch — which domains, what network requests to intercept, and how to extract content.
2. The **extension** fetches these rules on startup, injects content scripts into matching domains, and uses the specified strategy (e.g., `fetch_intercept`) to capture user activity.
3. Captured activity is posted back to the backend, which logs it, pushes it to the live dashboard via SSE, and optionally forwards it to Slack.
4. For password reuse, the extension hashes passwords client-side and compares hashes across sites — passwords never leave the browser in plaintext.

Rules are stored in `rules.json` next to the backend and can be managed through the web dashboard or the REST API without restarting the server. Extensions pick up changes on their next rule refresh.

## Rules Dashboard

The rules dashboard lets you add, edit, and delete monitoring rules at runtime. Start the backend and open:

```
http://localhost:8000/rules/dashboard
```

From here you can:
- View all active monitoring rules with their domains and URL patterns
- Create new rules by clicking **+ New Rule** and filling in the form
- Edit existing rules (source, domains, strategy, fetchConfig)
- Delete rules with a confirmation prompt

Changes take effect immediately — they're persisted to `rules.json` and returned by `GET /monitoring-rules` on the next extension refresh.

A tab bar links between the **Activity** dashboard (live event stream) and the **Rules** dashboard.

### Rules API

The dashboard is backed by a REST API you can also call directly:

| Endpoint | Method | Description |
|---|---|---|
| `/api/rules` | GET | List all rules |
| `/api/rules` | POST | Create a new rule |
| `/api/rules/{id}` | PUT | Update an existing rule |
| `/api/rules/{id}` | DELETE | Delete a rule |
| `/monitoring-rules` | GET | Same list, consumed by the extension |

## Tech Stack

| Component | Technology |
|---|---|
| Extension framework | [WXT](https://wxt.dev/) 0.19 (Vite 5) |
| UI | React 16 + MobX 6 + Blueprint.js 3 |
| Language | TypeScript 5.4 |
| Testing | Vitest 1.6 |
| Password hashing | PBKDF2-SHA512 (100k iterations) |
| DOM fingerprinting | TLSH fuzzy hashing |
| Backend | FastAPI + Mangum (serverless) |
| Manifest | Chrome MV3 (service worker) |

## Documentation

- [Activity monitoring summary](docs/activity-monitoring-summary.md) — feature overview, how it works, challenges and improvements
- [Platform-driven monitoring architecture](docs/architecture/platform-driven-monitoring.md) — architecture decision record
- [Activity monitoring implementation plan](docs/implementation-plans/activity-monitoring.md) — detailed implementation plan
- [WXT migration summary](docs/implementation-plans/wxt-migration-summary.md) — Webpack to WXT migration
- [Popup white screen postmortem](docs/implementation-plans/popup-white-screen-postmortem.md) — MobX + Vite decorator investigation

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
