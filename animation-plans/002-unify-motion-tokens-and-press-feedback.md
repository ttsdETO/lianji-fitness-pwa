# 002 — Unify motion tokens and press feedback

- **Status**: DONE
- **Commit**: unavailable (workspace is not a Git repository; rollback snapshot `v1.1.3-before-emil-ui-20260723.zip`)
- **Severity**: MEDIUM
- **Category**: Easing, duration, and cohesion
- **Estimated scope**: 1 file, shared CSS motion rules

## Problem

Motion values are repeated with built-in easing or ad-hoc cubic-bezier values. Primary press feedback is present but weaker than the shared interaction target.

```css
/* src/styles.css:133-134 — current */
.button { transition: transform .15s, background .2s; }
.button:active { transform: scale(.98); }

/* src/styles.css:181 — current */
.confirm-dialog { animation: confirm-up .26s cubic-bezier(.2,.8,.2,1); }
```

## Target

```css
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
  --duration-press: 150ms;
  --duration-ui: 200ms;
  --duration-drawer: 280ms;
}

.button {
  transition: transform var(--duration-press) var(--ease-out), background-color var(--duration-ui) ease;
}
.button:active { transform: scale(.97); }
```

Drawer and confirmation entrances should use `var(--ease-drawer)` and remain under 300ms. Chevron state changes should use `var(--duration-ui) var(--ease-out)`.

## Repo conventions to follow

- Tokens live in the existing `:root` block in `src/styles.css`.
- The product personality is a calm, crisp fitness utility: no bounce and no decorative page motion.
- Existing dark/light theme color variables stay unchanged.

## Steps

1. Add the exact easing and duration tokens to `:root`.
2. Update button and pressable-element transitions to name exact properties and use the shared tokens.
3. Replace ad-hoc drawer/confirmation curves with `var(--ease-drawer)` and keep durations at or below 280ms.
4. Update chevron rotations and small state transitions to the shared UI duration/easing.

## Boundaries

- Do NOT add springs or a new animation library.
- Do NOT animate layout properties.
- Do NOT add decorative stagger to frequently used lists.

## Verification

- **Mechanical**: run tests, build, and browser smoke.
- **Feel check**: press primary, secondary, navigation, and set-completion buttons; feedback must start on press and release crisply. Open warmup/stretch and confirmation sheets; they should feel related and settle without bounce.
- Toggle DevTools animation playback to 10% and confirm entrances begin quickly and do not exceed 280ms.
- **Done when**: shared motion tokens drive the relevant transitions and no updated UI entrance uses built-in `ease-in` or a duration over 300ms.
