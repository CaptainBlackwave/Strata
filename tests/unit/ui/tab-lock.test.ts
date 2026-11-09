// Story: production/sprints/sprint-9.md M4 (D57, docs/tech-debt.md TD-14): one active tab, the newest takes over.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type KeyValueStore, freshSave, loadSave, onSaveError, pauseSaves, writeSave } from '../../../src/ui/storage';
import { type TabChannel, type TabMessage, TabLock, isNewerClaim, storageChannel } from '../../../src/ui/tab-lock';

const econ = config as unknown as EconomyConfig;

/** A fake BroadcastChannel bus: every tab's post reaches every other tab, synchronously, never itself. */
function bus() {
  const listeners: ((msg: unknown) => void)[] = [];
  const channel = (): TabChannel => {
    let mine: ((msg: unknown) => void) | null = null;
    return {
      post: (msg) => listeners.filter((l) => l !== mine).forEach((l) => l(JSON.parse(JSON.stringify(msg)))),
      listen: (fn) => {
        mine = fn;
        listeners.push(fn);
      },
    };
  };
  return { channel };
}

/** A tab whose clock is fixed, recording every change of its active flag. */
function tab(channel: TabChannel, id: string, now = 1000) {
  const changes: boolean[] = [];
  const lock = new TabLock(channel, id, (active) => changes.push(active), () => now);
  return { lock, changes };
}

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('isNewerClaim', () => {
  it('a later claim is newer; on a tie the larger id wins, so exactly one tab is newer', () => {
    expect(isNewerClaim({ kind: 'claim', id: 'a', at: 2 }, { id: 'b', at: 1 })).toBe(true);
    expect(isNewerClaim({ kind: 'claim', id: 'a', at: 1 }, { id: 'b', at: 2 })).toBe(false);
    expect(isNewerClaim({ kind: 'claim', id: 'b', at: 5 }, { id: 'a', at: 5 })).toBe(true);
    expect(isNewerClaim({ kind: 'claim', id: 'a', at: 5 }, { id: 'b', at: 5 })).toBe(false);
  });
});

describe('TabLock (D57)', () => {
  it('a tab that starts alone is active and posts one claim', () => {
    const posted: TabMessage[] = [];
    const lock = new TabLock({ post: (m) => posted.push(m), listen: () => undefined }, 'a', () => undefined, () => 7);
    lock.start();
    expect(lock.active).toBe(true);
    expect(posted).toEqual([{ kind: 'claim', id: 'a', at: 7 }]);
  });

  it('the newest tab takes over: when B opens, A yields and B stays active', () => {
    const { channel } = bus();
    const a = tab(channel(), 'a', 1000);
    a.lock.start();
    const b = tab(channel(), 'b', 2000);
    b.lock.start();
    expect(a.lock.active).toBe(false);
    expect(b.lock.active).toBe(true);
    expect(a.changes).toEqual([true, false]);
    expect(b.changes).toEqual([true]);
  });

  it('Play here takes back over even when its clock is behind: the claim is after every claim it has seen', () => {
    const { channel } = bus();
    const a = tab(channel(), 'a', 1000);
    a.lock.start();
    const b = tab(channel(), 'b', 5000); // B's clock reads later than A's will
    b.lock.start();
    a.lock.claim(); // A's clock still reads 1000
    expect(a.lock.active).toBe(true);
    expect(b.lock.active).toBe(false);
    expect(b.changes).toEqual([true, false]);
  });

  it('an older claim arriving late (a message race) does not unseat the newer tab', () => {
    const b = tab({ post: () => undefined, listen: () => undefined }, 'b', 2000);
    b.lock.start();
    b.lock.receive({ kind: 'claim', id: 'a', at: 1000 });
    expect(b.lock.active).toBe(true);
    expect(b.changes).toEqual([true]);
  });

  it('two tabs claiming at the same instant settle on exactly one active tab', () => {
    // Both post before either hears the other: deliver both claims after both started.
    const inbox: { to: TabLock; msg: TabMessage }[] = [];
    let a: TabLock | null = null;
    let b: TabLock | null = null;
    a = new TabLock({ post: (m) => inbox.push({ to: b!, msg: m }), listen: () => undefined }, 'a', () => undefined, () => 3000);
    b = new TabLock({ post: (m) => inbox.push({ to: a!, msg: m }), listen: () => undefined }, 'b', () => undefined, () => 3000);
    a.start();
    b.start();
    for (const { to, msg } of inbox) to.receive(msg);
    expect([a.active, b.active].filter(Boolean)).toHaveLength(1);
    expect(b.active).toBe(true); // the tie goes to the larger id
  });

  it('ignores its own claims and anything that is not a claim', () => {
    const a = tab({ post: () => undefined, listen: () => undefined }, 'a', 1000);
    a.lock.start();
    for (const junk of [null, 'claim', { kind: 'claim', id: 'a', at: 9e9 }, { kind: 'other', id: 'z', at: 9e9 }, { kind: 'claim', id: 7, at: 9e9 }, { kind: 'claim', id: 'z', at: 'later' }]) a.lock.receive(junk);
    expect(a.lock.active).toBe(true);
  });

  it('a third tab makes the second yield; the first, already yielded, stays yielded', () => {
    const { channel } = bus();
    const a = tab(channel(), 'a', 1);
    a.lock.start();
    const b = tab(channel(), 'b', 2);
    b.lock.start();
    const c = tab(channel(), 'c', 3);
    c.lock.start();
    expect([a.lock.active, b.lock.active, c.lock.active]).toEqual([false, false, true]);
    expect(a.changes).toEqual([true, false]); // told once, not twice
  });
});

describe('storageChannel (fallback without BroadcastChannel)', () => {
  it('posts by writing the key and hears other tabs through storage events on that key only', () => {
    const store = memory();
    let handler: ((e: { key: string | null; newValue: string | null }) => void) | null = null;
    const ch = storageChannel(store, 'strata.tab', (fn) => (handler = fn));
    const heard: unknown[] = [];
    ch.listen((m) => heard.push(m));
    ch.post({ kind: 'claim', id: 'a', at: 4 });
    expect(JSON.parse(store.data.get('strata.tab')!)).toEqual({ kind: 'claim', id: 'a', at: 4 });
    handler!({ key: 'strata.save.v2', newValue: '{}' });
    handler!({ key: 'strata.tab', newValue: 'not json' });
    handler!({ key: 'strata.tab', newValue: JSON.stringify({ kind: 'claim', id: 'b', at: 5 }) });
    expect(heard).toEqual([null, { kind: 'claim', id: 'b', at: 5 }]);
  });

  it('a blocked store does not throw', () => {
    const ch = storageChannel({ setItem: () => { throw new Error('blocked'); } }, 'k', () => undefined);
    expect(() => ch.post({ kind: 'claim', id: 'a', at: 1 })).not.toThrow();
  });
});

describe('writeSave while another tab owns the save (D57, TD-14)', () => {
  it('writes nothing while paused and writes again once resumed', () => {
    const store = memory();
    const save = freshSave(econ);
    save.level = 9;
    pauseSaves(true);
    try {
      writeSave(save, store);
      expect(store.data.size).toBe(0);
    } finally {
      pauseSaves(false);
    }
    writeSave(save, store);
    expect(loadSave(econ, store).level).toBe(9);
  });

  it('reports a failed write to the error handler, so the player can be told (TD-14)', () => {
    const errors: unknown[] = [];
    onSaveError(() => errors.push('failed'));
    try {
      writeSave(freshSave(econ), { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } });
      writeSave(freshSave(econ), memory());
    } finally {
      onSaveError(null);
    }
    expect(errors).toEqual(['failed']);
  });
});
