# 001 — Remove high-frequency page entrance motion

- **Status**: DONE
- **Commit**: unavailable (workspace is not a Git repository; rollback snapshot `v1.1.3-before-emil-ui-20260723.zip`)
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 file, 2 declarations

## Problem

Every bottom-navigation change remounts a page that runs the same entrance animation. Navigation is a tens-of-times-per-day action, so the motion adds latency instead of explaining spatial structure.

```css
/* src/styles.css:114-115 — current */
.page { padding: max(18px, calc(env(safe-area-inset-top) + 8px)) 18px 30px; animation: page-in .28s ease both; }
@keyframes page-in { from { opacity: 0; transform: translateY(5px); } }
```

## Target

```css
.page { padding: max(18px, calc(env(safe-area-inset-top) + 8px)) 18px 30px; }
```

Pages should appear immediately when the user changes a bottom-navigation destination.

## Repo conventions to follow

- Keep all shared visual rules in `src/styles.css`.
- Do not change React page mounting or navigation state.

## Steps

1. Remove `animation: page-in .28s ease both` from `.page` in `src/styles.css`.
2. Remove the unused `@keyframes page-in` block.

## Boundaries

- Do NOT change route or navigation logic.
- Do NOT add a replacement page transition.
- Do NOT add a motion dependency.

## Verification

- **Mechanical**: run `pnpm test`, `pnpm build`, and `pnpm smoke -- http://127.0.0.1:<preview-port>`; all must pass.
- **Feel check**: rapidly switch through all six bottom-navigation destinations and confirm the destination is immediate with no vertical drift or fade.
- **Done when**: no `page-in` declaration or keyframe remains and all pages still render correctly.
