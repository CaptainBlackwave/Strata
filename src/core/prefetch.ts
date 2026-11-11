/**
 * Background level prefetch (sprint 8 P4, D46): the cache and the request queue behind
 * instant level starts. DOM-free and worker-agnostic, so it is unit-tested in Node; the
 * browser side (`src/ui/gen-worker.ts`) is plugged in through `GenPort`.
 *
 * Generation is pure and deterministic, so a board made in a worker is the same board
 * `generateLevel` makes on the main thread. Everything that crosses the worker boundary is
 * plain data (numbers, strings, booleans, arrays, plain objects), which structured clone
 * copies exactly.
 *
 * Threading: not thread-safe and not meant to be. One `Prefetcher` lives on the main thread
 * and talks to its worker by messages only.
 */
import type { Board } from './board';
import { type GeneratedLevel, generateLevel } from './generator';
import type { GameConfig, LevelSpec } from './levels';

/** What a level start needs from generation. Structured-clone safe. */
export interface PreparedLevel {
  readonly level: number;
  /** `configKey` of the config it was generated with; a mismatch is a cache miss. */
  readonly configKey: string;
  readonly board: Board;
  readonly spec: LevelSpec;
  readonly seed: number;
  readonly solutionLength: number;
}

/** Main thread to worker. The config travels with the request, so both sides use the same one. */
export interface GenRequest {
  readonly id: number;
  readonly level: number;
  readonly configKey: string;
  readonly config: GameConfig;
}

/** Worker to main thread. */
export type GenResponse =
  | { readonly id: number; readonly ok: true; readonly result: PreparedLevel }
  | { readonly id: number; readonly ok: false; readonly error: string };

/**
 * A channel to something that generates levels off the main thread (a Web Worker in the
 * browser, a fake in tests). `onMessage`/`onError` are assigned by the `Prefetcher`.
 */
export interface GenPort {
  post(req: GenRequest): void;
  onMessage: ((res: GenResponse) => void) | null;
  onError: (() => void) | null;
  terminate(): void;
}

/**
 * A stable fingerprint of a config (FNV-1a over its JSON), so a cached board made with an
 * older or different config is never used.
 * Example: `configKey(config) // 'c3a1f09e'`
 */
export function configKey(config: unknown): string {
  const s = JSON.stringify(config);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * Generates `level` and keeps the parts a level start needs. This is what the worker runs,
 * and what the main thread runs as the synchronous fallback, so both paths share one code path.
 * Example: `prepareLevel(141, config, configKey(config)).board`
 */
export function prepareLevel(level: number, config: GameConfig, key: string): PreparedLevel {
  return fromGenerated(level, key, generateLevel(level, config));
}

/** Strips a `GeneratedLevel` down to a `PreparedLevel`. */
export function fromGenerated(level: number, key: string, gen: GeneratedLevel): PreparedLevel {
  return { level, configKey: key, board: gen.board, spec: gen.spec, seed: gen.seed, solutionLength: gen.solutionLength };
}

/**
 * A small most-recently-used cache of prepared levels, keyed by level and config.
 * Boards are immutable, so an entry can be handed out any number of times (a replay of the
 * same level is instant too).
 * Example: `cache.put(p); cache.get(141, key) === p`
 */
export class PrefetchCache {
  private readonly entries: PreparedLevel[] = [];
  /** `capacity`: how many levels to keep (the current, the next, and a replay's next). */
  constructor(private readonly capacity = 4) {}

  /** The cached level, or `undefined` when it is missing or was made with another config. */
  get(level: number, key: string): PreparedLevel | undefined {
    const i = this.entries.findIndex((e) => e.level === level && e.configKey === key);
    if (i < 0) return undefined;
    const [hit] = this.entries.splice(i, 1);
    this.entries.push(hit); // most recently used last
    return hit;
  }

  /** Adds or replaces an entry, evicting the least recently used past `capacity`. */
  put(p: PreparedLevel): void {
    const i = this.entries.findIndex((e) => e.level === p.level && e.configKey === p.configKey);
    if (i >= 0) this.entries.splice(i, 1);
    this.entries.push(p);
    while (this.entries.length > this.capacity) this.entries.shift();
  }

  /** How many levels are cached. */
  get size(): number {
    return this.entries.length;
  }
}

/** How long a level start waits for a worker already busy on that level before giving up. */
export const WAIT_TIMEOUT_MS = 8000;

/**
 * Queues level generation on a `GenPort` one level at a time, caches the results, and
 * degrades to "no prefetch" when the port is missing or fails. Nothing here ever blocks:
 * callers check `get`, then `pending`/`wait`, and otherwise generate synchronously.
 *
 * Example:
 * ```ts
 * const pf = new Prefetcher(config, () => workerPort());
 * pf.request([7, 8]);
 * const ready = pf.get(7) ?? pf.generateNow(7);
 * ```
 */
export class Prefetcher {
  readonly key: string;
  readonly cache: PrefetchCache;
  private port: GenPort | null = null;
  private broken = false;
  private nextId = 1;
  private inflight: { id: number; level: number } | null = null;
  private readonly queue: number[] = [];
  private readonly waiters = new Map<number, ((p: PreparedLevel | undefined) => void)[]>();

  /**
   * `makePort` creates the worker channel, or returns `null` (or throws) when workers are
   * unavailable; it is called lazily and again after a timeout replaced a stuck worker.
   */
  constructor(
    private readonly config: GameConfig,
    private readonly makePort: () => GenPort | null,
    cache = new PrefetchCache(),
  ) {
    this.key = configKey(config);
    this.cache = cache;
  }

  /** The cached level for the current config, if any. */
  get(level: number): PreparedLevel | undefined {
    return this.cache.get(level, this.key);
  }

  /** Generates on the calling thread (the fallback) and caches the result. */
  generateNow(level: number): PreparedLevel {
    const p = prepareLevel(level, this.config, this.key);
    this.cache.put(p);
    this.queue.splice(0, this.queue.length, ...this.queue.filter((l) => l !== level));
    return p;
  }

  /**
   * Asks for `levels` in the background, in order. Levels already cached, queued or in
   * flight are skipped; invalid levels are ignored. A no-op without a working port.
   */
  request(levels: readonly number[]): void {
    for (const l of levels) {
      if (!Number.isInteger(l) || l < 1) continue;
      if (this.get(l) || this.inflight?.level === l || this.queue.includes(l)) continue;
      this.queue.push(l);
    }
    this.pump();
  }

  /**
   * Makes sure the worker is making `level` (strata-gbw.7): asks for it if it is neither cached
   * nor queued, and moves it to the front of the queue. True when it will arrive from the worker;
   * false without a working worker (or when it is already cached), so the caller generates it.
   * Example: a map replay of level 615 goes to the worker instead of freezing the page.
   */
  ensure(level: number): boolean {
    if (this.get(level)) return false;
    if (!this.pending(level)) this.request([level]);
    const at = this.queue.indexOf(level);
    if (at > 0) {
      this.queue.splice(at, 1);
      this.queue.unshift(level);
    }
    return this.pending(level);
  }

  /** True when the worker is generating `level` right now or has it queued. */
  pending(level: number): boolean {
    return !this.broken && (this.inflight?.level === level || this.queue.includes(level));
  }

  /**
   * Resolves with `level` once the worker delivers it, or `undefined` on a worker error or
   * after `timeoutMs` (the stuck worker is then replaced). Never rejects, never hangs.
   */
  wait(level: number, timeoutMs = WAIT_TIMEOUT_MS): Promise<PreparedLevel | undefined> {
    const hit = this.get(level);
    if (hit) return Promise.resolve(hit);
    if (!this.pending(level)) return Promise.resolve(undefined);
    // Move it to the front so it is next if something else is in flight.
    if (this.inflight?.level !== level) {
      this.queue.splice(this.queue.indexOf(level), 1);
      this.queue.unshift(level);
    }
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        this.dropWaiter(level, finish);
        if (this.inflight?.level === level) this.restartPort(); // stuck: replace the worker
        resolve(undefined);
      }, timeoutMs);
      const finish = (p: PreparedLevel | undefined) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(p);
      };
      const list = this.waiters.get(level) ?? [];
      list.push(finish);
      this.waiters.set(level, list);
    });
  }

  /** Stops the worker. Pending waits resolve `undefined`. */
  dispose(): void {
    this.broken = true;
    this.port?.terminate();
    this.port = null;
    this.inflight = null;
    this.queue.length = 0;
    for (const level of [...this.waiters.keys()]) this.settle(level, undefined);
  }

  private pump(): void {
    if (this.broken || this.inflight || !this.queue.length) return;
    const port = this.ensurePort();
    if (!port) return;
    const level = this.queue.shift()!;
    const id = this.nextId++;
    this.inflight = { id, level };
    try {
      port.post({ id, level, configKey: this.key, config: this.config });
    } catch {
      this.fail();
    }
  }

  private ensurePort(): GenPort | null {
    if (this.port) return this.port;
    try {
      this.port = this.makePort();
    } catch {
      this.port = null;
    }
    if (!this.port) {
      this.fail();
      return null;
    }
    this.port.onMessage = (res) => this.onMessage(res);
    this.port.onError = () => this.fail();
    return this.port;
  }

  private onMessage(res: GenResponse): void {
    if (!this.inflight || res.id !== this.inflight.id) return; // stale (from a replaced worker)
    const { level } = this.inflight;
    this.inflight = null;
    if (res.ok && res.result.level === level && res.result.configKey === this.key) {
      this.cache.put(res.result);
      this.settle(level, res.result);
    } else {
      this.settle(level, undefined); // generation threw in the worker; the caller goes sync
    }
    this.pump();
  }

  /** The worker is unusable: stop prefetching for this session, release every waiter. */
  private fail(): void {
    this.dispose();
  }

  private restartPort(): void {
    this.port?.terminate();
    this.port = null;
    this.inflight = null;
    this.pump();
  }

  private settle(level: number, p: PreparedLevel | undefined): void {
    const list = this.waiters.get(level);
    this.waiters.delete(level);
    for (const f of list ?? []) f(p);
  }

  private dropWaiter(level: number, f: (p: PreparedLevel | undefined) => void): void {
    const list = this.waiters.get(level)?.filter((x) => x !== f) ?? [];
    if (list.length) this.waiters.set(level, list);
    else this.waiters.delete(level);
  }
}
