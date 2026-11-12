import { describe, expect, it } from 'vitest';
import { createFrameBatch, liveRegionPlan } from '../../../src/ui/logic/frame-batch';

/** A scheduler that holds its callbacks until `run()`, like frames that haven't come yet. */
function frames() {
  const queued: (() => void)[] = [];
  return { schedule: (cb: () => void) => void queued.push(cb), run: () => queued.splice(0).forEach((cb) => cb()), get count() { return queued.length; } };
}

describe('createFrameBatch (sprint 22 L1)', () => {
  it('writes nothing until the frame, then each key once with its latest write', () => {
    const f = frames();
    const batch = createFrameBatch(f.schedule);
    const log: string[] = [];
    batch.queue('hud', () => log.push('hud 1'));
    batch.queue('announce', () => log.push('announce'));
    batch.queue('hud', () => log.push('hud 2'));
    expect(log).toEqual([]);
    expect(batch.pending).toBe(true);
    expect(f.count).toBe(1); // one frame asked for, however many writes
    f.run();
    expect(log).toEqual(['hud 2', 'announce']); // first-queued order, the latest write per key
    expect(batch.pending).toBe(false);
  });
  it('asks for a new frame after a flush, and a manual flush runs the writes at once', () => {
    const f = frames();
    const batch = createFrameBatch(f.schedule);
    const log: number[] = [];
    batch.queue('a', () => log.push(1));
    f.run();
    batch.queue('a', () => log.push(2));
    expect(f.count).toBe(1);
    batch.flush();
    expect(log).toEqual([1, 2]);
    f.run(); // the frame that was asked for finds nothing left
    expect(log).toEqual([1, 2]);
  });
  it('a write that queues again lands in the next frame, not this one', () => {
    const f = frames();
    const batch = createFrameBatch(f.schedule);
    const log: string[] = [];
    batch.queue('a', () => {
      log.push('first');
      batch.queue('a', () => log.push('second'));
    });
    f.run();
    expect(log).toEqual(['first']);
    f.run();
    expect(log).toEqual(['first', 'second']);
  });
});

describe('liveRegionPlan', () => {
  it('writes new text in one go and clears first only for a repeat', () => {
    expect(liveRegionPlan('', 'Poured 2 blue into jar 3.')).toBe('write');
    expect(liveRegionPlan('Poured 2 blue into jar 3.', 'Poured 1 red into jar 4.')).toBe('write');
    expect(liveRegionPlan('Poured 2 blue into jar 3.', 'Poured 2 blue into jar 3.')).toBe('clear-then-write');
  });
});
