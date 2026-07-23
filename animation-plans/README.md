# Animation improvement plans

| Plan | Title | Severity | Status |
| --- | --- | --- | --- |
| 001 | Remove high-frequency page entrance motion | HIGH | DONE |
| 002 | Unify motion tokens and press feedback | MEDIUM | DONE |
| 003 | Preserve feedback in accessibility modes | MEDIUM | DONE |

Recommended execution order: 001 → 002 → 003. Plan 001 removes unnecessary motion first; Plan 002 establishes the shared motion vocabulary; Plan 003 adds input- and preference-aware fallbacks on top of those tokens.

The baseline recovery point is `rollback/v1.1.3-before-emil-ui-20260723.zip`.
