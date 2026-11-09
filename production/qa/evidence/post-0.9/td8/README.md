# TD-8 service worker update story: evidence

Run: `node production/qa/evidence/post-0.9/td8/td8-check.cjs` from the repo root (Playwright with the
preinstalled Chromium, `vite preview` on port 5340). It builds, plays, simulates a deploy by editing a
string in `src/ui/strings.ts` (restored afterwards) and rebuilding into the same `dist/`.

- `results.txt`: pass/fail lines. `cache-before.json` / `cache-after.json`: Cache Storage listings around the deploy.
- `a-offline-level.png`: a level running offline after the first visit (worker chunk cached).
- `b-offline-after-deploy.png`: a level running offline after the deploy.

Results: (a) pass, (b) pass, (c) pass (changed manifest and icon served fresh online; offline falls back to the cache).

Notes: in (b) only the main bundle's hash changed (the worker chunk was byte-identical, so it correctly stays).
Pruning runs on the navigation, so the old bundle was already deleted even when the new worker had not yet
activated (the cache name showed the old stamp in one run and the new stamp in another). The unit test is
`tests/unit/ui/sw-prune.test.ts`.
