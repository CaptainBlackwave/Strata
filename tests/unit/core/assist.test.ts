// docs/tech-debt.md TD-13: Hint and Shuffle off the main thread.
// The worker path must give exactly what the main-thread call gives for the same board and
// seed; a reply for a board that has since changed is dropped; every failure ends in
// 'fallback', so the caller runs the same job on the main thread and the game never breaks.
import { afterEach, describe, expect, it, vi } from 'vitest';
import rawConfig from '../../../src/config/game-config.json';
import { type Board, canPour, makeBoard } from '../../../src/core/board';
import { generateLevel } from '../../../src/core/generator';
import type { GameConfig } from '../../../src/core/levels';
import { type AssistJob, type AssistPort, type AssistRequest, type AssistResponse, AssistClient, isAssistRequest, runAssist } from '../../../src/core/assist';
import { createRng } from '../../../src/core/rng';
import { GameSession, sessionOptions } from '../../../src/core/session';

const config = rawConfig as unknown as GameConfig;
const options = sessionOptions(config);

/** Late boards from the real generator: level 152 is one of the slowest hints and shuffles. */
const late = generateLevel(152, config).board;
const mid = generateLevel(141, config).board;
/** Level 152 after one legal pour into its last jar, so the hint is a fresh search. */
const latePoured = (() => {
  const s = new GameSession(late, options);
  const last = late.jars.length - 1;
  const from = late.jars.findIndex((_, i) => i !== last && canPour(late, i, last));
  s.pour(from, last);
  return s.board;
})();

/**
 * A fake worker: runs what gen-worker.ts runs and structured-clones both directions like
 * postMessage. `mode` simulates a worker that never answers, errors, or throws in the job.
 */
function fakePort(mode: 'ok' | 'silent' | 'error' | 'throws' = 'ok') {
  const sent: AssistRequest[] = [];
  let terminated = 0;
  const port: AssistPort = {
    onMessage: null,
    onError: null,
    terminate: () => void terminated++,
    post(req) {
      sent.push(req);
      if (mode === 'silent') return;
      const copy = structuredClone(req);
      queueMicrotask(() => {
        if (mode === 'error') return port.onError?.();
        const res: AssistResponse = mode === 'throws' ? { id: copy.id, ok: false, error: 'boom' } : { id: copy.id, ok: true, result: runAssist(copy) };
        port.onMessage?.(structuredClone(res));
      });
    },
  };
  return { port, sent, terminated: () => terminated };
}

const hintJob = (board: Board): AssistJob => ({ kind: 'hint', board, options });
const shuffleJob = (board: Board, seed: number): AssistJob => ({ kind: 'shuffle', board, options, seed });
const always = () => true;

afterEach(() => {
  vi.useRealTimers();
});

describe('runAssist gives the main-thread result (TD-13)', () => {
  it.each([
    ['level 141', mid],
    ['level 152', late],
    ['level 152 after a pour', latePoured],
  ])('a hint on %s matches hintResult(), including the plan it leaves behind', (_, board) => {
    // Arrange: one session asks on the main thread, the other adopts a structured-cloned worker search.
    const main = new GameSession(board, options);
    const viaWorker = new GameSession(board, options);
    const job = structuredClone(hintJob(viaWorker.board));
    // Act
    const res = structuredClone(runAssist(job));
    expect(res.kind).toBe('hint');
    const a = main.hintResult();
    const b = res.kind === 'hint' ? viaWorker.adoptHint(res.search) : null;
    // Assert: same move, same Perfect count, and the follow-up hint comes from the same plan.
    expect(b).toEqual(a);
    expect(viaWorker.assists).toBe(main.assists);
    if ('move' in a) {
      main.pour(a.move.from, a.move.to);
      viaWorker.pour(a.move.from, a.move.to);
      expect(viaWorker.hintWithoutSearch()).toEqual(main.hintResult());
    }
  });

  it.each([1, 7, 123456789, 0xffffffff])('a shuffle with seed %i matches shuffle(createRng(seed))', (seed) => {
    const main = new GameSession(latePoured, options);
    const viaWorker = new GameSession(latePoured, options);
    const res = structuredClone(runAssist(structuredClone(shuffleJob(viaWorker.board, seed))));
    expect(res.kind).toBe('shuffle');
    const ok = main.shuffle(createRng(seed));
    const applied = res.kind === 'shuffle' && res.board !== null && viaWorker.applyShuffle(res.board);
    expect(applied).toBe(ok);
    expect(viaWorker.board).toEqual(main.board);
    expect(viaWorker.assists).toBe(main.assists);
    expect(viaWorker.canUndo).toBe(main.canUndo);
  });

  it('a shuffle that finds nothing returns null, like shuffle() returning false', () => {
    // A 2-jar board with no free space: no re-deal differs from the dealt one and is winnable.
    const stuck = makeBoard(2, [[0, 1], [1, 0]]);
    expect(runAssist(shuffleJob(stuck, 3))).toEqual({ kind: 'shuffle', board: null });
    expect(new GameSession(stuck, options).shuffle(createRng(3))).toBe(false);
  });

  it('tells its own requests apart from level-generation requests on the shared worker', () => {
    expect(isAssistRequest({ id: 1, ...hintJob(mid) })).toBe(true);
    expect(isAssistRequest({ id: 1, level: 7, configKey: 'x', config })).toBe(false);
    expect(isAssistRequest(null)).toBe(false);
  });
});

describe('GameSession pieces the worker path uses', () => {
  it('revision changes with every board change and not with a hint', () => {
    const s = new GameSession(makeBoard(2, [[0, 1], [1, 0], []]), { ...options, extraJarsPerLevel: 1 });
    const seen = [s.revision];
    s.hintResult();
    expect(s.revision).toBe(seen[0]);
    s.pour(0, 2);
    seen.push(s.revision);
    s.undo();
    seen.push(s.revision);
    s.restart();
    seen.push(s.revision);
    s.addExtraJar();
    seen.push(s.revision);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('hintWithoutSearch answers without the solver only when it can', () => {
    const s = new GameSession(late, options);
    expect(s.hintWithoutSearch()).toBeNull(); // a fresh board needs a search
    expect(s.assists).toBe(0);
    const won = new GameSession(makeBoard(2, [[0, 0], []]), options);
    expect(won.hintWithoutSearch()).toEqual({ reason: 'won' });
  });

  it('exposes the tuning it was built with, for the worker job', () => {
    expect(new GameSession(late, options).tuning).toEqual(options);
  });
});

describe('AssistClient', () => {
  it('returns the worker result when the board is still current', async () => {
    const f = fakePort();
    const client = new AssistClient(() => f.port);
    const out = await client.run(hintJob(mid), always);
    expect(out).toEqual({ status: 'done', result: runAssist(hintJob(mid)) });
    expect(f.sent).toHaveLength(1);
  });

  it('drops a reply for a board that changed while it was in flight', async () => {
    const f = fakePort();
    const client = new AssistClient(() => f.port);
    let current = true;
    const p = client.run(hintJob(mid), () => current);
    current = false; // a pour, Undo, Restart or leaving the level
    expect(await p).toEqual({ status: 'stale' });
  });

  it('cancel() settles every pending request as stale at once and stops the busy worker', async () => {
    const f = fakePort('silent');
    const client = new AssistClient(() => f.port);
    const p = client.run(shuffleJob(late, 1), always);
    client.cancel();
    expect(await p).toEqual({ status: 'stale' });
    expect(f.terminated()).toBe(1);
    // The next request gets a new worker.
    const g = fakePort();
    const client2 = new AssistClient(() => g.port);
    client2.cancel(); // nothing in flight: nothing to terminate
    expect(g.terminated()).toBe(0);
  });

  it('ignores a late reply for a request it already settled', async () => {
    const f = fakePort('silent');
    const client = new AssistClient(() => f.port);
    const p = client.run(hintJob(mid), always);
    client.cancel();
    await p;
    expect(() => f.port.onMessage?.({ id: f.sent[0].id, ok: true, result: runAssist(hintJob(mid)) })).not.toThrow();
  });

  it('falls back when no worker can be made, and stops trying', async () => {
    const make = vi.fn(() => null);
    const client = new AssistClient(make);
    expect(await client.run(hintJob(mid), always)).toEqual({ status: 'fallback' });
    expect(await client.run(hintJob(mid), always)).toEqual({ status: 'fallback' });
    expect(make).toHaveBeenCalledTimes(1);
    const throwing = new AssistClient(() => {
      throw new Error('no Worker in Node');
    });
    expect(await throwing.run(hintJob(mid), always)).toEqual({ status: 'fallback' });
  });

  it('falls back on a worker error, but a stale request stays stale', async () => {
    const f = fakePort('error');
    const client = new AssistClient(() => f.port);
    const a = client.run(hintJob(mid), always);
    const b = client.run(hintJob(mid), () => false);
    expect(await a).toEqual({ status: 'fallback' });
    expect(await b).toEqual({ status: 'stale' });
    expect(await client.run(hintJob(mid), always)).toEqual({ status: 'fallback' }); // broken for the session
  });

  it('falls back when the job threw in the worker', async () => {
    const client = new AssistClient(() => fakePort('throws').port);
    expect(await client.run(hintJob(mid), always)).toEqual({ status: 'fallback' });
  });

  it('falls back when post itself throws', async () => {
    const port: AssistPort = {
      onMessage: null,
      onError: null,
      terminate: () => {},
      post: () => {
        throw new Error('DataCloneError');
      },
    };
    expect(await new AssistClient(() => port).run(hintJob(mid), always)).toEqual({ status: 'fallback' });
  });

  it('falls back after the timeout and replaces the stuck worker', async () => {
    vi.useFakeTimers();
    const ports = [fakePort('silent'), fakePort()];
    let made = 0;
    const client = new AssistClient(() => ports[made++].port, 1000);
    const p = client.run(hintJob(mid), always);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toEqual({ status: 'fallback' });
    expect(ports[0].terminated()).toBe(1);
    vi.useRealTimers();
    expect((await client.run(hintJob(mid), always)).status).toBe('done');
    expect(made).toBe(2);
  });

  it('a reply whose kind does not match the job falls back', async () => {
    const port: AssistPort = {
      onMessage: null,
      onError: null,
      terminate: () => {},
      post: (req) => queueMicrotask(() => port.onMessage?.({ id: req.id, ok: true, result: { kind: 'shuffle', board: null } })),
    };
    expect(await new AssistClient(() => port).run(hintJob(mid), always)).toEqual({ status: 'fallback' });
  });
});
