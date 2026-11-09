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

## Review follow-up (PR #6): a failed update keeps the previous version

The independent review found that the build-stamped cache made a failed or partial update worse than before. The new worker activated with an incomplete cache and deleted the old one. The navigation handler also stored the new page before its files arrived. Either way, the next offline launch had no scripts.

Now:
- an install only succeeds when the new cache holds every file the page needs;
- a navigation stores the new page only after all of its files are cached, and only then prunes old files;
- install fetches bypass the browser's HTTP cache (`cache: 'reload'`);
- dynamic `import()` and non-JS files named from JS are followed;
- the build fails if `sw.js` loses its `__BUILD_ID__` placeholder.

Scenario **(d)** in `td8-check.cjs` makes a second deploy whose new main script fails to download. With the worker before these fixes, both (d) checks fail (`results-before-review-fixes.txt`): the cached page is the new one, and offline play errors. With the fixes, all 9 checks pass (`results.txt`, `d-offline-after-failed-update.png`). Unit tests: `tests/unit/ui/sw-complete.test.ts` (seen failing first).
