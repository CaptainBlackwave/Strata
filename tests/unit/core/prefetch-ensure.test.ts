// Issue: strata-gbw.7. A map replay or challenge link to a level neither cached nor queued used to
// be generated on the main thread (930 ms on level 615). `ensure` hands it to the worker instead.
import { describe, expect, it } from 'vitest';
import rawConfig from '../../../src/config/game-config.json';
import type { GameConfig } from '../../../src/core/levels';
import { type GenPort, type GenRequest, Prefetcher } from '../../../src/core/prefetch';

const config = rawConfig as unknown as GameConfig;

function silentPort() {
  const sent: GenRequest[] = [];
  const port: GenPort = { onMessage: null, onError: null, terminate: () => undefined, post: (req) => void sent.push(req) };
  return { port, sent };
}

describe('Prefetcher.ensure (strata-gbw.7)', () => {
  it('sends a level that is neither cached nor queued to the worker', () => {
    const { port, sent } = silentPort();
    const pf = new Prefetcher(config, () => port);
    expect(pf.ensure(615)).toBe(true);
    expect(pf.pending(615)).toBe(true);
    expect(sent.map((r) => r.level)).toEqual([615]);
  });

  it('puts the level first when the worker is busy with others', async () => {
    const { port, sent } = silentPort();
    const pf = new Prefetcher(config, () => port);
    pf.request([2, 3]); // 2 in flight, 3 queued
    expect(pf.ensure(615)).toBe(true);
    expect(sent.map((r) => r.level)).toEqual([2]);
    expect(pf.pending(615)).toBe(true);
  });

  it('is false without a worker, so the caller generates on the spot', () => {
    const pf = new Prefetcher(config, () => null);
    expect(pf.ensure(615)).toBe(false);
  });
});
