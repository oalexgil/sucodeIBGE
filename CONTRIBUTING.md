# Contributing

## Run locally

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Checks

```bash
npm test
```

The current test suite uses Node.js built-ins only.

## Rules

- Keep exam-specific content separate from reusable engine logic when extracting modules.
- Do not commit tokens, API keys, private Gist URLs or user study data.
- Do not add secrets to the synchronized study-data schema.
- Any change to authentication, storage or synchronization must include a security impact note.
- AI is optional: deterministic study features must continue to work without provider access.
- Preserve storage schema compatibility or provide an explicit migration.
- Add tests for deterministic learning rules and sync behavior.

## Focused PR examples

- `security: move provider keys to session-only secret store`
- `refactor: extract section merge into pure module`
- `test: cover review schedule boundaries`
- `pwa: version cache and migration policy`
- `content: update IBGE question manifest`
