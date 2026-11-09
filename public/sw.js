/*
 * Strata service worker: makes the home-screen app work offline (sprint 3, T8).
 * - The page (navigation) is network-first: online players always get the latest deploy,
 *   and offline players get the last cached copy.
 * - Built assets have content hashes in their names, so they are cache-first.
 * - On install it reads index.html and pre-caches every asset it references, so the
 *   very first visit is enough to play offline afterwards.
 * - Chunks the page never names, like the level-generation worker (sprint 8 P4), are found
 *   in the cached scripts (`new URL("x.js", import.meta.url)`) and pre-cached too.
 * - TD-8: the cache name carries a build stamp (vite.config.ts replaces __BUILD_ID__ in the
 *   built copy of this file), so every release installs a new worker and drops the old cache.
 *   After each fresh navigation, cached assets/* that the new page and its chunks no longer
 *   reference are deleted, so a deploy that leaves sw.js byte-identical still cleans up.
 * - Non-hashed files (manifest, icons, the page) are network-first with a cache fallback, so a
 *   changed icon or manifest reaches installed copies. Hashed assets/* stay cache-first.
 */
const BUILD_ID = '__BUILD_ID__';
const CACHE = 'strata-' + BUILD_ID;
const CORE = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const ASSET_REF = /(?:src|href)="(\.?\/?assets\/[^"]+)"/g;
const CHUNK_REF = /new URL\(\s*["'`]([^"'`]+\.[A-Za-z0-9]+)["'`]\s*,\s*import\.meta\.url/g; // workers, and any file JS names by URL
const IMPORT_REF = /(?:from|import)\s*\(?\s*["'](\.\/[^"']+\.js)["']/g; // static and dynamic imports between chunks
/** The message posted to every window once the install has cached everything (sprint 11 O4). */
const OFFLINE_READY = 'strata:offline-ready';
const CSS_URL_REF = /url\(\s*["']?(?!data:)([^"')]+)["']?\s*\)/g; // fonts and images named by CSS

/**
 * Adds each URL on its own, so one missing file never fails the rest (TD-7). `cache: 'reload'`
 * skips the browser's HTTP cache, so a host's max-age can't hand an install the previous page.
 */
function addEach(cache, urls) {
  return Promise.allSettled(urls.map((u) => cache.add(new Request(u, { cache: 'reload' }))));
}

/** The built assets (`assets/...`) an HTML page references, as absolute URLs (TD-7: the one copy of the regex). */
function assetsOf(html, scope) {
  return [...html.matchAll(ASSET_REF)].map((m) => new URL(m[1], scope).href);
}

/** Relative references inside one cached asset: worker chunks, chunk imports, CSS urls. */
function refsOf(url, text) {
  const out = [];
  if (url.endsWith('.js')) {
    for (const re of [CHUNK_REF, IMPORT_REF]) for (const m of text.matchAll(re)) out.push(new URL(m[1], url).href);
  } else if (url.endsWith('.css')) {
    for (const m of text.matchAll(CSS_URL_REF)) out.push(new URL(m[1], url).href);
  }
  return out;
}

/**
 * Every URL the page needs: its direct assets plus everything those reference, transitively.
 * `textOf(url)` returns the cached text of a URL, or null when it is not cached.
 */
async function referencedUrls(html, scope, textOf) {
  const seen = new Set(assetsOf(html, scope));
  const queue = [...seen];
  while (queue.length) {
    const url = queue.pop();
    const text = url.endsWith('.js') || url.endsWith('.css') ? await textOf(url) : null;
    if (text == null) continue;
    for (const ref of refsOf(url, text)) {
      if (!seen.has(ref)) {
        seen.add(ref);
        queue.push(ref);
      }
    }
  }
  return seen;
}

/** Whether every URL the page needs is cached (an empty set is never complete). */
function isComplete(keep, cachedUrls) {
  if (keep.size === 0) return false;
  const have = new Set(cachedUrls);
  return [...keep].every((u) => have.has(u));
}

/**
 * Cached `assets/*` URLs that the current page does not reference: safe to delete (TD-8).
 * Only once the current page's own files are all cached (`complete`): otherwise the previous
 * version's files are the only ones offline play has, so nothing is deleted.
 */
function staleAssets(cachedUrls, keep, scope, complete = true) {
  if (keep.size === 0 || !complete) return []; // no known references, or the new set is partial: delete nothing
  const base = new URL('assets/', scope).href;
  return cachedUrls.filter((u) => u.startsWith(base) && !keep.has(u));
}

async function textFromCache(cache, url) {
  const res = await cache.match(url, { ignoreVary: true });
  return res ? res.text() : null;
}

/**
 * Caches the page's assets and the chunks they load (P4). Returns whether every file the page
 * needs is now cached; only then, and when `prune` is set, deletes what it no longer uses.
 */
async function cacheAssets(cache, html, prune = true) {
  const scope = self.registration.scope;
  await addEach(cache, assetsOf(html, scope));
  // Chunks only show up inside cached scripts, so fetch them level by level until nothing is missing.
  for (let round = 0; round < 4; round++) {
    const keep = await referencedUrls(html, scope, (u) => textFromCache(cache, u));
    const cached = new Set((await cache.keys()).map((r) => r.url));
    const missing = [...keep].filter((u) => !cached.has(u));
    if (!missing.length) break;
    await addEach(cache, missing);
  }
  const keep = await referencedUrls(html, scope, (u) => textFromCache(cache, u));
  const cachedUrls = (await cache.keys()).map((r) => r.url);
  const complete = isComplete(keep, cachedUrls);
  if (prune) for (const url of staleAssets(cachedUrls, keep, scope, complete)) await cache.delete(url, { ignoreVary: true });
  return complete;
}

/** Tells every open window that offline play is ready (O4). The page shows a one-time toast. */
async function notifyOfflineReady() {
  for (const client of await self.clients.matchAll({ type: 'window', includeUncontrolled: true })) client.postMessage({ type: OFFLINE_READY });
}

function register() {
  self.addEventListener('install', (event) => {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE);
        await addEach(cache, CORE);
        const page = await cache.match('./');
        // A new release has a new cache, and activating deletes the old one. So fail the install
        // unless this cache holds everything the page needs: the old worker and its files stay,
        // and the browser tries the update again later (review of PR #6).
        const complete = page ? await cacheAssets(cache, await page.text()).catch(() => false) : false;
        if (!complete) throw new Error('Strata: offline files incomplete; keeping the previous version');
        await notifyOfflineReady().catch(() => undefined);
        await self.skipWaiting();
      })(),
    );
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      (async () => {
        for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
        // sw.js rarely changes, so also prune here against the page already cached.
        const cache = await caches.open(CACHE);
        const page = await cache.match('./');
        if (page) await cacheAssets(cache, await page.text()).catch(() => undefined);
        await self.clients.claim();
      })(),
    );
  });

  self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
    if (req.mode === 'navigate') {
      event.respondWith(
        (async () => {
          const cache = await caches.open(CACHE);
          try {
            const fresh = await fetch(req);
            if (fresh.ok) {
              // For the next offline launch: cache this version's files first, and only when all of
              // them are in, store the page itself and prune the old files. A download that fails
              // part-way leaves the previous page and its files as the offline copy.
              const page = fresh.clone();
              event.waitUntil(
                fresh
                  .clone()
                  .text()
                  .then(async (html) => {
                    if (!(await cacheAssets(cache, html, false))) return;
                    await cache.put('./', page);
                    await cacheAssets(cache, html);
                  })
                  .catch(() => undefined),
              );
            }
            return fresh;
          } catch {
            return (await cache.match('./')) ?? Response.error();
          }
        })(),
      );
      return;
    }
    const hashed = new URL(req.url).pathname.includes('/assets/');
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        // ignoreVary: a host may send `Vary: Origin` (vite preview does), and module scripts are
        // requested in CORS mode with an Origin header, so without it the cached copy never matches.
        const opts = { ignoreSearch: true, ignoreVary: true };
        if (hashed) {
          const hit = await cache.match(req, opts); // hashed names never change: cache-first
          if (hit) return hit;
        }
        try {
          const res = await fetch(req);
          if (res.ok) await cache.put(req, res.clone());
          return res;
        } catch {
          // Offline: non-hashed files fall back to the cache; otherwise a clean network error.
          return (!hashed && (await cache.match(req, opts))) || Response.error();
        }
      })(),
    );
  });
}

// Under Node (unit tests) export the pure helpers; in the worker, register the listeners.
if (typeof module !== 'undefined') module.exports = { assetsOf, refsOf, referencedUrls, staleAssets, isComplete, OFFLINE_READY };
else register();
