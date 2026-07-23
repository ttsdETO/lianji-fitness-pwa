# Security Review Report

## Findings summary

| Severity | Found | Open after remediation |
| --- | ---: | ---: |
| Critical | 0 | 0 |
| High | 2 | 0 |
| Medium | 2 | 0 |
| Low | 2 | 0 |
| Info | 2 | 0 |
| **Total** | **8** | **0** |

- Dependency audit: 0 known vulnerable production packages.
- Secrets scan: 0 exposed credentials.
- Review date: 2026-07-23.
- Scope: React/TypeScript source, static assets, scripts, tests, configuration, documentation and dependency lockfile intended for the public copy.
- Frameworks: React 19, Vite 6, Vitest 3.

## Findings

### Privacy and sensitive-data exposure

#### High — Hard-coded personal health profile and individualized plan

**Confidence: High**

The original source initialized a concrete birth date, height, body weight, body measurements, protein target, equipment list, exact working weights and injury-specific plan conditions. Publishing those values could disclose health and identity-adjacent information.

**Remediation:** the public copy starts with an empty optional profile, an empty equipment list and no body measurements. The first locally entered weight establishes the baseline. Exact working weights and personal injury history were replaced with generic, self-selected loading and universal safety criteria.

#### High — Excessive health context sent to a third-party AI service

**Confidence: High**

The original AI request included name, age, body measurements, recovery records, free-text notes and recent workout history whenever a user sent a prompt.

**Remediation:** the public copy never sends the profile name. It defaults to a minimal context containing equipment, current plan and anonymous aggregates. Detailed health context requires an explicit user choice and the UI describes the exact categories sent.

#### Medium — AI conversation persisted beyond the current session

**Confidence: High**

Free-text prompts and replies can contain personal or health information. They were previously stored in persistent `localStorage`.

**Remediation:** AI conversations now use `sessionStorage`; legacy persistent conversation data is removed when the AI configuration is loaded.

#### Low — Sensitive backup export lacked a dedicated warning

**Confidence: High**

JSON backups contain the complete local profile, history, body and recovery data.

**Remediation:** export now requires an explicit sensitive-data warning confirmation. Documentation explains the backup contents.

#### Low — Backup import had no file type or size boundary

**Confidence: High**

An arbitrarily large or non-JSON file could be read into memory before validation.

**Remediation:** import now requires a `.json` filename and rejects files larger than 5 MB before reading them.

### Developer tooling

#### Medium — Optional importer executed arbitrary supplied Python source

**Confidence: High**

The original developer-only database importer used `exec(compile(...))` on a command-line source path. Running it with an untrusted file would execute arbitrary code with the developer's permissions.

**Remediation:** the importer was not required to build or run the app and was removed from the public copy. The checked static exercise JSON remains in the repository; documentation now requires trusted source data and schema review for future updates.

### Repository exposure controls

#### Info — Local state and generated artifacts excluded

**Confidence: High**

The public copy excludes `.git`, `.wrangler`, `dist`, `node_modules`, `.pnpm-store`, TypeScript build metadata and the rollback archive. The `.gitignore` also blocks these categories, exported backups, credentials, certificates and environment files.

#### Info — Browser security controls present

**Confidence: High**

The project contains no `dangerouslySetInnerHTML`, runtime `eval`, dynamic command execution, user-controlled network endpoint or hard-coded credential. CSP fixes network and frame destinations; requests disable credentials, redirects, caching and referrers.

## Dependency audit

`pnpm audit --prod --registry https://registry.npmjs.org` returned **No known vulnerabilities found** on 2026-07-23. Production dependencies are React and React DOM; no package from the review skill's high-risk watchlist is a production dependency.

## Secrets and exposure scan

Scanned for common OpenAI, Anthropic, GitHub, AWS, Google, Stripe, Slack, Cloudflare and private-key patterns; credential-like assignments; connection strings; local user paths; email addresses; phone numbers; and high-risk secret filenames.

No real credential, private key, `.env`, account identifier, personal email, phone number or local user path was found in the public copy. Test strings such as `sk-secure-test-key` are intentionally invalid fixtures and never reach production builds.

## Verification

- TypeScript production build: passed.
- Vitest suite: 44/44 tests passed across 7 test files.
- Mobile/PWA smoke: passed at 390 × 844, including navigation, timers and offline refresh.
- AI coach smoke: passed with an intercepted mock endpoint; no real API Key was used.
- Production dependency audit: passed.
- Post-remediation secret and privacy rescan: passed for source and production build.
- File and line coverage: 82 repository-candidate files, including 80 text files / 16,110 text lines and 2 binary image assets.

This is a static review plus build/test verification. It does not replace runtime penetration testing or the privacy terms of optional third-party services.
