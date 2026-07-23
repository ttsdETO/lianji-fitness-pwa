# 003 — Preserve feedback in accessibility modes

- **Status**: DONE
- **Commit**: unavailable (workspace is not a Git repository; rollback snapshot `v1.1.3-before-emil-ui-20260723.zip`)
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, media-query rules

## Problem

Reduced motion currently collapses every transition and animation to `0.01ms`, removing useful color and opacity feedback. The icon-button hover style is also active on touch devices, where tap can leave a false hover state.

```css
/* src/styles.css:142 — current */
.icon-button:hover { background: var(--surface-muted); }

/* src/styles.css:932-934 — current */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

## Target

```css
@media (hover: hover) and (pointer: fine) {
  .icon-button:hover { background: var(--surface-muted); }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .confirm-dialog,
  .exercise-drawer,
  .exercise-library { animation: none; }
  .button,
  .icon-button { transition-property: background-color, color, opacity; }
}
```

Add `prefers-reduced-transparency: reduce` fallbacks for floating navigation, sticky action bars, and modal backdrops by increasing background opacity and removing backdrop blur.

## Repo conventions to follow

- Accessibility media queries stay in the responsive layer at the bottom of `src/styles.css`.
- Keep color/opacity feedback that conveys state.

## Steps

1. Gate icon-button hover styles behind `@media (hover: hover) and (pointer: fine)`.
2. Replace the global `0.01ms` override with targeted removal of transform-based movement and smooth scrolling.
3. Preserve color, opacity, and background feedback for reduced-motion users.
4. Add a reduced-transparency fallback for blurred floating surfaces.

## Boundaries

- Do NOT hide state changes.
- Do NOT remove focus styles.
- Do NOT alter application data or behavior.

## Verification

- **Mechanical**: build and smoke must pass.
- **Feel check**: emulate reduced motion and confirm sheets appear without sliding while button state changes remain visible. Emulate touch input and confirm tapping an icon button does not leave a hover-only background behind.
- **Done when**: movement is reduced without eliminating all state feedback, and blurred materials have an opaque fallback.
