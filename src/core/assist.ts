/**
 * Hint and Shuffle off the main thread (docs/tech-debt.md TD-13): the message protocol, the
 * job both threads run, and the client that drops stale replies. DOM-free and worker-agnostic,
 * so it is unit-tested in Node; the browser side plugs in a Web Worker through `AssistPort`
 * (the level-generation worker module, `src/ui/gen-worker.ts`, answers both protocols).
 *
 * Results are identical on both threads: `runAssist` is the only code that computes them, and
 * everything that crosses the boundary (boards, moves, options, a numeric seed) is plain data
 * that structured clone copies exactly.
 *
 * Threading: one `AssistClient` lives on the main thread and talks to its worker by messages
 * only. Not thread-safe and not meant to be.
 */
import type { Board } from './board';
import { createRng } from './rng';
import { type HintSearch, type SessionOptions, findShuffle, searchHint } from './session';

/** A Hint or Shuffle to compute for `board`. Structured-clone safe. */
export type AssistJob =
  | { readonly kind: 'hint'; readonly board: Board; readonly options: SessionOptions }
  /** `seed` seeds the shuffle's RNG (`createRng(seed)`), so the worker deals what the main thread would. */
  | { readonly kind: 'shuffle'; readonly board: Board; readonly options: SessionOptions; readonly seed: number };

/** What a job found. A shuffle's `board` is `null` when no winnable re-deal was found. */
export type AssistResult = { readonly kind: 'hint'; readonly search: HintSearch } | { readonly kind: 'shuffle'; readonly board: Board | null };

/** Main thread to worker. */
export type AssistRequest = AssistJob & { readonly id: number };

/** Worker to main thread, with the request's `id`. */
export type AssistResponse = { readonly id: number; readonly ok: true; readonly result: AssistResult } | { readonly id: number; readonly ok: false; readonly error: string };

/**
 * How a request ended. `'stale'`: the board changed (or `cancel` ran) before the reply, so
 * nothing may be applied and nothing charged. `'fallback'`: the worker is missing, failed or
 * timed out, so the caller runs `runAssist(job)` on the main thread.
 */
export type AssistOutcome = { readonly status: 'done'; readonly result: AssistResult } | { readonly status: 'stale' } | { readonly status: 'fallback' };

/** A channel to a worker (a Web Worker in the browser, a fake in tests). Handlers are set by the client. */
export interface AssistPort {
  post(req: AssistRequest): void;
  onMessage: ((res: AssistResponse) => void) | null;
  onError: (() => void) | null;
  terminate(): void;
}

/**
 * How long a request waits for the worker before falling back (ms). A safety net for a stuck
 * worker only: the solver budgets (F7) end a real search well before this, even on a slow phone.
 */
export const ASSIST_TIMEOUT_MS = 30_000;

/**
 * Computes a job. This is what the worker runs, and what the main thread runs as the
 * fallback, so the two can't differ.
 * Example: `runAssist({ kind: 'shuffle', board, options: session.tuning, seed: 42 })`
 */
export function runAssist(job: AssistJob): AssistResult {
  if (job.kind === 'hint') return { kind: 'hint', search: searchHint(job.board, job.options.hintNodeBudget) };
  return { kind: 'shuffle', board: findShuffle(job.board, job.options, createRng(job.seed)) };
}

/** True for an assist request, false for a level-generation request (`GenRequest`) on the same worker. */
export function isAssistRequest(msg: unknown): msg is AssistRequest {
  return typeof msg === 'object' && msg !== null && 'kind' in msg && 'board' in msg;
}

interface Pending {
  readonly kind: AssistJob['kind'];
  readonly isCurrent: () => boolean;
  readonly timer: ReturnType<typeof setTimeout>;
  readonly finish: (o: AssistOutcome) => void;
}

/**
 * Sends Hint and Shuffle jobs to a worker and settles each one exactly once: `'done'` while
 * the board is still the one asked about, `'stale'` once it changed, `'fallback'` on any
 * failure. Never rejects, never hangs.
 *
 * Example:
 * ```ts
 * const client = new AssistClient(() => workerPort());
 * const out = await client.run(job, () => session.revision === askedAt);
 * if (out.status === 'stale') return;
 * apply(out.status === 'done' ? out.result : runAssist(job));
 * ```
 */
export class AssistClient {
  private port: AssistPort | null = null;
  private broken = false;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();

  /**
   * `makePort` creates the worker channel, or returns `null` (or throws) when workers are
   * unavailable; it is called lazily, and again after `cancel` or a timeout stopped a worker.
   */
  constructor(
    private readonly makePort: () => AssistPort | null,
    private readonly timeoutMs = ASSIST_TIMEOUT_MS,
  ) {}

  /** Sends `job`. `isCurrent` says whether the board it was asked for is still on the table. */
  run(job: AssistJob, isCurrent: () => boolean): Promise<AssistOutcome> {
    return new Promise((resolve) => {
      const port = this.ensurePort();
      if (!port) return resolve(isCurrent() ? { status: 'fallback' } : { status: 'stale' });
      const id = this.nextId++;
      const timer = setTimeout(() => {
        if (!this.pending.has(id)) return;
        this.settle(id, { status: 'fallback' });
        this.stopPort(); // stuck: the next request gets a new worker
      }, this.timeoutMs);
      this.pending.set(id, { kind: job.kind, isCurrent, timer, finish: resolve });
      try {
        port.post({ ...job, id });
      } catch {
        this.settle(id, { status: 'fallback' });
      }
    });
  }

  /**
   * The board changed: every request in flight settles `'stale'` now, and a busy worker is
   * stopped so a long stale search does not delay the next request.
   */
  cancel(): void {
    if (!this.pending.size) return;
    for (const id of [...this.pending.keys()]) this.settle(id, { status: 'stale' });
    this.stopPort();
  }

  private ensurePort(): AssistPort | null {
    if (this.broken) return null;
    if (this.port) return this.port;
    try {
      this.port = this.makePort();
    } catch {
      this.port = null;
    }
    if (!this.port) {
      this.broken = true;
      return null;
    }
    const port = this.port;
    port.onMessage = (res) => this.port === port && this.onMessage(res);
    port.onError = () => this.port === port && this.fail();
    return port;
  }

  private onMessage(res: AssistResponse): void {
    const p = this.pending.get(res.id);
    if (!p) return; // already settled (cancelled or timed out)
    this.settle(res.id, res.ok && res.result.kind === p.kind ? { status: 'done', result: res.result } : { status: 'fallback' });
  }

  /** The worker is unusable: stop using it for this session and fall back for everything pending. */
  private fail(): void {
    this.broken = true;
    for (const id of [...this.pending.keys()]) this.settle(id, { status: 'fallback' });
    this.stopPort();
  }

  /** Settles a request once; a request whose board changed is always `'stale'`. */
  private settle(id: number, outcome: AssistOutcome): void {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    clearTimeout(p.timer);
    p.finish(outcome.status === 'stale' || p.isCurrent() ? outcome : { status: 'stale' });
  }

  private stopPort(): void {
    this.port?.terminate();
    this.port = null;
  }
}
