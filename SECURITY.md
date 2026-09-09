# Security

## Current prototype posture

This repository is a personal-study PWA, not yet a production multi-user service.

### Important known risk

The current `app.js` persists:

- the GitHub Gist token in `localStorage`;
- AI provider keys/configuration in `localStorage`.

`localStorage` is convenient but is readable by JavaScript running in the same origin. That means an XSS bug, compromised third-party script, malicious extension or untrusted browser environment may expose those secrets.

Do not describe browser-local persistence as equivalent to secure secret storage.

## Immediate usage guidance

- do not configure the app on a shared device;
- use the smallest possible token scope;
- use short-lived credentials where possible;
- never reuse a credential with broader repository/account privileges;
- revoke credentials immediately if exposure is suspected;
- keep sensitive personal information out of study notes synchronized to Gist.

## GitHub Gist sync

A secret Gist is unlisted, not magically private because its URL is hard to guess. Access control still depends on GitHub and the credential used by the client.

The current synchronization payload should contain study data only. AI keys and GitHub tokens must never be added to the synced data model.

## AI providers

Browser-side BYOK exposes provider credentials to the browser runtime. A production deployment should prefer a backend/edge layer or provider-supported authorization flow, with quotas and explicit data-handling disclosures.

Prompts sent to an AI provider leave the device. That is separate from offline/local study data and should be communicated to users.

## Target security architecture

1. remove persistent secret values from `localStorage`;
2. use session-only browser storage as an interim compatibility step;
3. move provider credentials to an edge/backend boundary for a product deployment;
4. introduce CSP and reduce third-party script execution;
5. version storage and sync schemas;
6. add automated tests that reject committed credentials and unsafe regressions.

## Credential patterns

CI checks should fail if common credential prefixes or obvious hardcoded API-key assignments are committed. These checks are guardrails, not a secret-scanning service.

## Reporting

Do not put real tokens, API keys, private Gist URLs or private study data in a public issue. Revoke leaked credentials before doing anything else.
