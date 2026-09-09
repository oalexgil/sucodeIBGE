# SUConcursos — IBGE 2026

Progressive Web App for structured exam preparation, currently configured for the **IBGE PSS 02/2026 — Analista Censitário / Webdesign e Produção Gráfica**.

The repository is more than a static course: it combines lessons, question practice, spaced review, error tracking, simulations, notes, progress data, optional synchronization and an AI study assistant in a browser-first PWA.

> **Product direction:** the current IBGE experience should be treated as a reference implementation of a reusable **SUConcursos Engine**, with exam-specific content separated from the learning platform.

## Current capabilities

- installable PWA with offline support for local content;
- 3 study tracks and 39 lessons;
- question bank and error notebook;
- spaced review cycle;
- simulation history and progress metrics;
- per-lesson notes;
- optional cross-device synchronization through GitHub Gist;
- optional AI tutor with Gemini or an OpenAI-compatible API.

## Product architecture today

```text
index.html          dashboard / configuration UI
app.js              local data + sync + AI + shared course integration
questoes.html       question-practice UI
questoes-data.js    question content
cursos/             exam-specific lesson HTML
sw.js               offline service worker
manifest.json       PWA manifest
icons/              application icons
```

The main technical debt is that platform behavior and IBGE-specific content are tightly coupled. `app.js` also owns local data, synchronization, AI providers and course integration in one large browser module.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the target split.

## Security posture — important

The current prototype is designed for personal use. **GitHub tokens and AI API keys are currently persisted in browser `localStorage`.** That is convenient but is not an appropriate production secret-storage model: any script executing in the same origin, or a compromised browser environment, may be able to read them.

Do not use long-lived/high-scope credentials and do not configure this prototype on a shared or untrusted device.

The safer target architecture is:

- secrets kept server-side or exchanged through an OAuth/device-flow style backend;
- short-lived sessions in the browser;
- no persistent API key in frontend storage by default;
- Content Security Policy and reduced third-party execution surface.

The current Gist sync stores study data, not AI keys, but a secret Gist is **unlisted, not access-controlled by secrecy of the URL alone**.

Read [SECURITY.md](SECURITY.md) before using sync or AI credentials.

## Local data model

Study progress is stored by section with timestamps so local and remote copies can be merged at section level. The Gist sync includes study sections such as progress, notes, errors, simulations and stats.

AI configuration is maintained separately from the study-data object and is not intentionally pushed into the Gist payload.

## Running locally

Serve the repository over localhost so PWA/network features behave consistently:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

Repository checks:

```bash
npm test
```

The current CI suite has no runtime package dependencies.

## Installing as a PWA

Use the browser's install/add-to-home-screen flow after opening the deployed HTTPS site. Offline availability depends on resources cached by the service worker; synchronization and AI naturally still require network access.

## Synchronization

The current implementation can connect to the GitHub Gist API and create/update `ibge-study-data.json`.

For this prototype, use the **smallest possible credential scope and short expiry**. Do not use a broad personal access token or a token you reuse for other work.

Because the credential is currently persisted in `localStorage`, the recommended production evolution is to replace direct browser token handling rather than simply documenting token creation more aggressively.

## AI tutor

The tutor can call Gemini or an OpenAI-compatible endpoint and includes exam-specific context in its system prompt.

For personal experimentation, browser-side BYOK can be useful. For a product deployed to other users, provider credentials should not be embedded or persistently stored in frontend code. Prefer a controlled backend/edge proxy, provider OAuth where available, per-user quotas and explicit data-handling disclosures.

## Engineering principles

- exam content must be separable from the learning engine;
- progress and review logic should remain deterministic and testable;
- secrets should not be part of the study-data sync model;
- AI should augment explanations, not become the source of truth for exam rules;
- offline/PWA behavior should degrade clearly when network-only features are unavailable;
- security warnings must reflect the code that actually ships.

## Target architecture

```text
src/
├── engine/
│   ├── progress/
│   ├── review/
│   ├── questions/
│   ├── simulations/
│   └── notes/
├── content/
│   └── ibge-2026/
├── storage/
├── sync/
├── ai/
├── pwa/
└── ui/
```

This makes IBGE a content/configuration package rather than the identity of the software platform.

## Validation and roadmap

Priority order:

1. remove persistent browser secret storage;
2. isolate a reusable study engine from IBGE content;
3. define versioned schemas for progress/sync data;
4. add deterministic tests for review scheduling, merges and simulations;
5. harden service-worker cache versioning and offline migrations;
6. add content validation so question/course updates cannot silently break the app.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Changes that affect synchronization or credentials should be isolated in focused pull requests and must include a security impact note.

## Disclaimer

This is an independent study tool. Official notices, exam rules, dates and requirements should always be confirmed in the official organizer/institution sources.
