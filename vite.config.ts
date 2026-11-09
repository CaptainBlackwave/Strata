// @ts-expect-error node:fs types are not installed (no @types/node; same approach as config-schema.test.ts)
import { readFileSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Stamps the built `dist/sw.js` with a build id (a hash of the emitted file names, which carry
 * content hashes), so each release ships a byte-different worker and browsers install it (TD-8).
 */
function swBuildStamp(): Plugin {
  let outDir = 'dist';
  return {
    name: 'strata-sw-build-stamp',
    apply: 'build',
    configResolved(c) {
      outDir = `${c.root}/${c.build.outDir}`;
    },
    writeBundle(_o, bundle) {
      let h = 0x811c9dc5; // FNV-1a over the sorted file names
      for (const ch of Object.keys(bundle).sort().join('\n')) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
      const id = h.toString(16).padStart(8, '0');
      const file = `${outDir}/sw.js`;
      const src = readFileSync(file, 'utf8');
      // Without the placeholder the cache name would never change, and updates would stop clearing old files.
      if (!src.includes("'__BUILD_ID__'")) throw new Error('sw.js: the __BUILD_ID__ placeholder is missing, so the build cannot stamp it');
      writeFileSync(file, src.replace("'__BUILD_ID__'", `'${id}'`));
    },
  };
}

export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
  plugins: [swBuildStamp()],
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
