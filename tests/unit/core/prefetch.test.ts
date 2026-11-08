// Sprint 8 P4 (production/sprints/sprint-8.md, D46): background level prefetch.
// The worker path must give the exact board synchronous generation gives, and every failure
// (no worker, worker error, worker stuck) must end in "not pending", so the caller goes sync.
import { afterEach, describe, expect, it, vi } from 'vitest';
import rawConfig from '../../../src/config/game-config.json';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import {
  type GenPort,
  type GenRequest,
  type GenResponse,
  type PreparedLevel,
  PrefetchCache,
  Prefetcher,
  configKey,
  prepareLevel,
} from '../../../src/core/prefetch';

const config = rawConfig as unknown as GameConfig;

/**
 * A fake worker: runs what gen-worker.ts runs, and structured-clones both directions like
 * postMessage does. `mode` simulates a worker that never answers or one that errors.
 */
function fakePort(mode: 'ok' | 'silent' | 'error' = 'ok') {
  const sent: GenRequest[] = [];
  let terminated = 0;
  const port: GenPort = {
    onMessage: null,
    onError: null,
    terminate: () => void terminated++,
    post(req) {
      sent.push(req);
      if (mode === 'silent') return;
      const copy = structuredClone(req);
      queueMicrotask(() => {
        if (mode === 'error') return port.onError?.();
        let res: GenResponse;
        try {
          res = { id: copy.id, ok: true, result: prepareLevel(copy.level, copy.config, copy.configKey) };
        } catch (e) {
          res = { id: copy.id, ok: false, error: String(e) };
        }
        port.onMessage?.(structuredClone(res));
      });
    },
  };
  return { port, sent, terminated: () => terminated };
}

const prepared = (level: number, key = 'k'): PreparedLevel => ({
  level,
  configKey: key,
  board: { capacity: 4, jars: [] },
  spec: { level, colors: 3, capacity: 4, spare: 2, buriedDepth: 0, challenge: false, mechanics: [] },
  seed: 1,
  solutionLength: 1,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Prefetcher determinism', () => {
  // 21 has a mechanic, 141 is the slowest level (fallback step), 185 a slow funnel level.
  it.each([1, 21, 141, 185])('worker-prefetched level %i equals synchronous generateLevel', async (level) => {
    const { port } = fakePort();
    const pf = new Prefetcher(config, () => port);

    pf.request([level]);
    const fromWorker = await pf.wait(level);
    const direct = generateLevel(level, config);

    expect(fromWorker).toBeDefined();
    expect(fromWorker!.board).toEqual(direct.board);
    expect(fromWorker!.spec).toEqual(direct.spec);
    expect(fromWorker!.seed).toBe(direct.seed);
    expect(fromWorker!.solutionLength).toBe(direct.solutionLength);
    expect(pf.get(level)).toBe(fromWorker); // and it is now a cache hit
  });

  it('generateNow (the sync fallback) gives the same board as generateLevel and caches it', () => {
    const pf = new Prefetcher(config, () => null);

    const p = pf.generateNow(22);

    expect(p.board).toEqual(generateLevel(22, config).board);
    expect(pf.get(22)).toBe(p);
  });
});

describe('Prefetcher queue', () => {
  it('generates requested levels one at a time, in order, skipping duplicates', async () => {
    const { port, sent } = fakePort();
    const pf = new Prefetcher(config, () => port);

    pf.request([3, 4, 3, 0, -1, 2.5]);
    expect(sent.map((r) => r.level)).toEqual([3]); // one in flight
    await pf.wait(4);

    expect(sent.map((r) => r.level)).toEqual([3, 4]);
    expect(pf.get(3)).toBeDefined();
    expect(pf.pending(3)).toBe(false);
  });

  it('sends the config and its key with every request', () => {
    const { port, sent } = fakePort('silent');
    const pf = new Prefetcher(config, () => port);

    pf.request([5]);

    expect(sent[0].configKey).toBe(configKey(config));
    expect(sent[0].config).toBe(config);
  });

  it('ignores a response for another config', async () => {
    const port: GenPort = { onMessage: null, onError: null, terminate: () => undefined, post: (req) => queueMicrotask(() => port.onMessage?.({ id: req.id, ok: true, result: prepared(req.level, 'other') })) };
    const pf = new Prefetcher(config, () => port);

    pf.request([6]);
    const got = await pf.wait(6);

    expect(got).toBeUndefined();
    expect(pf.get(6)).toBeUndefined();
  });
});

describe('Prefetcher failures fall back to synchronous', () => {
  it('without worker support nothing is pending and wait resolves undefined', async () => {
    const pf = new Prefetcher(config, () => null);

    pf.request([7]);

    expect(pf.pending(7)).toBe(false);
    expect(await pf.wait(7)).toBeUndefined();
  });

  it('a worker constructor that throws is treated as no worker', () => {
    const pf = new Prefetcher(config, () => {
      throw new Error('blocked');
    });

    pf.request([7]);

    expect(pf.pending(7)).toBe(false);
  });

  it('a worker error releases the waiter and stops prefetching', async () => {
    const { port } = fakePort('error');
    const pf = new Prefetcher(config, () => port);

    pf.request([8, 9]);
    const got = await pf.wait(8);

    expect(got).toBeUndefined();
    expect(pf.pending(9)).toBe(false);
  });

  it('a stuck worker times out, is terminated and replaced', async () => {
    vi.useFakeTimers();
    const ports = [fakePort('silent'), fakePort('silent')];
    let made = 0;
    const pf = new Prefetcher(config, () => ports[made++].port);

    pf.request([10, 11]);
    const waiting = pf.wait(10, 500);
    vi.advanceTimersByTime(500);

    expect(await waiting).toBeUndefined();
    expect(ports[0].terminated()).toBe(1);
    expect(ports[1].sent.map((r) => r.level)).toEqual([11]); // the queue moves on with a new worker
  });

  it('wait moves a queued level to the front', () => {
    const { port, sent } = fakePort('silent');
    const pf = new Prefetcher(config, () => port);
    pf.request([12, 13, 14]);

    void pf.wait(14, 60_000);
    port.onMessage?.({ id: sent[0].id, ok: false, error: 'x' }); // 12 finishes (failed)

    expect(sent.map((r) => r.level)).toEqual([12, 14]);
  });
});

describe('PrefetchCache', () => {
  it('misses when the config key differs', () => {
    const cache = new PrefetchCache();
    cache.put(prepared(1, 'a'));

    expect(cache.get(1, 'b')).toBeUndefined();
    expect(cache.get(1, 'a')?.level).toBe(1);
  });

  it('evicts the least recently used past capacity', () => {
    const cache = new PrefetchCache(2);
    cache.put(prepared(1));
    cache.put(prepared(2));
    cache.get(1, 'k'); // 1 is now the most recent

    cache.put(prepared(3));

    expect(cache.size).toBe(2);
    expect(cache.get(2, 'k')).toBeUndefined();
    expect(cache.get(1, 'k')).toBeDefined();
  });

  it('configKey is stable and changes with the config', () => {
    expect(configKey(config)).toBe(configKey(structuredClone(config)));
    expect(configKey({ ...config, baseSeed: config.baseSeed + 1 })).not.toBe(configKey(config));
  });
});
