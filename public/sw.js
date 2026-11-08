/*
 * Strata service worker: makes the home-screen app work offline (sprint 3, T8).
 * - The page (navigation) is network-first: online players always get the latest deploy,
 *   and offline players get the last cached copy.
 * - Built assets have content hashes in their names, so they are cache-first.
 * - On install it reads index.html and pre-caches every asset it references, so the
 *   very first visit is enough to play offline afterwards.
 * - Chunks the page never names, like the level-generation worker (sprint 8 P4), are found
 *   in the cached scripts (`new URL("x.js", import.meta.url)`) and pre-cached too. Anything
 *   else under the site is cached on its first fetch (cache-first).
 */
const CACHE = 'strata-v1';
const CORE = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const ASSET_REF = /(?:src|href)="(\.?\/?assets\/[^"]+)"/g;
const CHUNK_REF = /new URL\(\s*["'`]([^"'`]+\.js)["'`]\s*,\s*import\.meta\.url/g;

/** Adds each URL on its own, so one missing file never fails the rest (TD-7). */
function addEach(cache, urls) {
  return Promise.allSettled(urls.map((u) => cache.add(u)));
}

/** The built assets (`assets/...`) an HTML page references, as absolute URLs (TD-7: the one copy of the regex). */
function assetsOf(html) {
  return [...html.matchAll(ASSET_REF)].map((m) => new URL(m[1], self.registration.scope).href);
}

/** Caches every asset `html` references, plus the chunks those scripts load by URL (P4). */
async function cacheAssets(cache, html) {
  const assets = assetsOf(html);
  await addEach(cache, assets);
  const chunks = [];
  for (const url of assets.filter((a) => a.endsWith('.js'))) {
    const res = await cache.match(url);
    if (!res) continue;
    for (const m of (await res.text()).matchAll(CHUNK_REF)) chunks.push(new URL(m[1], url).href);
  }
  if (chunks.length) await addEach(cache, [...new Set(chunks)]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await addEach(cache, CORE);
      const page = await cache.match('./');
      if (page) await cacheAssets(cache, await page.text()).catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
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
            await cache.put('./', fresh.clone());
            // Cache the assets this version of the page uses, for the next offline launch.
            event.waitUntil(fresh.clone().text().then((html) => cacheAssets(cache, html)).catch(() => undefined));
          }
          return fresh;
        } catch {
          return (await cache.match('./')) ?? Response.error();
        }
      })(),
    );
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // ignoreVary: a host may send `Vary: Origin` (vite preview does), and module scripts are
      // requested in CORS mode with an Origin header, so without it the cached copy never matches.
      const hit = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res.clone());
        return res;
      } catch {
        return Response.error(); // offline and not cached: a clean network error, not an unhandled rejection
      }
    })(),
  );
});
