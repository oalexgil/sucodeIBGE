# Architecture

## Current state

The project is a browser-first PWA with exam content and platform behavior mixed together. `app.js` currently coordinates:

- local study data;
- synchronization through GitHub Gist;
- AI provider configuration and requests;
- shared course integration;
- utility/event behavior.

This works for one configured exam but makes reuse and testing difficult.

## Product boundary

The long-term product should be thought of as **SUConcursos Engine**. IBGE 2026 becomes one content package using that engine.

```text
src/
├── engine/
│   ├── progress.js
│   ├── review-schedule.js
│   ├── errors.js
│   ├── simulations.js
│   └── notes.js
├── content/
│   └── ibge-2026/
│       ├── manifest.js
│       ├── lessons/
│       └── questions/
├── storage/
│   ├── schema.js
│   ├── local-store.js
│   └── migrations.js
├── sync/
│   ├── merge.js
│   ├── adapter.js
│   └── github-gist-adapter.js
├── ai/
│   ├── tutor.js
│   ├── providers/
│   └── prompts/
├── pwa/
│   └── cache-policy.js
└── ui/
```

## Core rules

### Engine
The engine must not depend on IBGE names, DOM elements, API keys or GitHub. It owns deterministic learning behavior only.

### Content
Exam-specific content contains lesson metadata, questions, answer explanations, dates and configuration. It should be replaceable without changing engine code.

### Storage
Persisted data needs an explicit schema version and migrations. Browser storage must be treated as fallible: quota, corruption and old formats are normal cases.

### Sync
Synchronization should consume/produce versioned study-data objects. Provider-specific authentication belongs outside merge logic.

### AI
The AI layer is optional. Study progress, questions, reviews and simulations must continue to work without an AI provider.

### PWA
Offline caching should have an explicit version strategy and avoid leaving clients stuck with incompatible HTML/JS/data combinations.

## Security boundary

The current browser implementation persists GitHub and AI credentials in `localStorage`. This is a known prototype limitation, not a production target.

Target options, in preference order:

1. backend/edge service owns provider credentials and browser uses short-lived sessions;
2. OAuth/device authorization where the provider supports it;
3. if pure browser BYOK is retained for an advanced/personal mode, secrets should be session-only by default, clearly disclosed and never synchronized.

## Incremental refactor plan

### PR 1 — foundation
Documentation, CI and security posture. No silent behavior changes.

### PR 2 — secrets
Introduce a secret-store abstraction, migrate GitHub/AI credentials away from persistent `localStorage`, add tests and migration warnings.

### PR 3 — deterministic core
Extract section merge, review schedule and progress calculations into pure modules with tests.

### PR 4 — content boundary
Move IBGE-specific configuration out of shared engine code.

### PR 5 — sync adapters
Separate GitHub Gist transport from merge logic and define a versioned payload contract.

## Testing strategy

- static security guardrails for accidentally committed credentials;
- unit tests for data merges and migrations;
- unit tests for review scheduling and simulation rules;
- fixture tests for content manifests;
- browser smoke tests for offline install, stale-cache upgrades and provider-unavailable states.
