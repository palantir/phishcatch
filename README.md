# PhishCatch

A Chrome extension that detects and prevents enterprise credential phishing, with platform-driven activity monitoring for web applications.

Originally built by [Palantir Technologies](https://github.com/palantir/phishcatch). See the [blog post](https://blog.palantir.com/phishcatch-detecting-password-reuse-from-the-inside-out-77aa93e3e6fb) on why PhishCatch was built.

## What It Does

**Password reuse detection** — hashes enterprise passwords client-side (PBKDF2-SHA512) and alerts when the same password appears on untrusted websites.

**Phishing page detection** — fingerprints enterprise login page DOM structures with TLSH fuzzy hashing and flags suspicious clones on other domains.

**Activity monitoring** — captures user interactions with monitored web applications (ChatGPT, etc.) and logs them to the backend. The extension ships a generic interception engine; the backend supplies monitoring rules. No extension update is needed to add or modify monitored apps.

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
│  - Rule caching                │        │ Slack webhook          │
│  - Hash management             │        │ Syslog                 │
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
