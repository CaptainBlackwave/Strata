# Web stack — Version Reference

| Field | Value |
|-------|-------|
| **Runtime** | Evergreen browsers (Chromium, Safari/WebKit, Firefox), phone-first |
| **Language** | TypeScript 5.8.3 (strict), ES2022 target |
| **Bundler / dev server** | Vite 6.3.5 |
| **Tests** | Vitest 3.2.4 (unit); Playwright with preinstalled Chromium (screenshots, play-through) |
| **Rendering** | DOM + CSS; Web Animations API for the pour animation |
| **Project Pinned** | 2026-11-08 |

## Notes

- APIs used are long-stable web platform features: `Element.animate()`, `matchMedia('(prefers-reduced-motion)')`,
  `localStorage` (always wrapped in try/catch), CSS custom properties, `env(safe-area-inset-*)`.
- No framework and no runtime dependencies. All three packages are dev-only.
- `src/core/` must stay DOM-free so it can be unit-tested in Node and ported to an engine later.
