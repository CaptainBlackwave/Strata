/**
 * One active tab (D57, docs/tech-debt.md TD-14, design/gdd/save-data.md §2.1 "One active tab").
 * Every tab keeps its own in-memory save and `writeSave` replaces the whole record, so two
 * live tabs would erase each other's progress. The rule: **the newest tab takes over.**
 *
 * Protocol, one message: `{ kind: 'claim', id, at }`. A claim means "I own the save now;
 * every other tab yield". A tab posts one when it opens and when the player presses
 * Play here. A tab that hears a claim newer than its own yields: it stops writing and
 * shows the "open in another tab" overlay. `at` is a Lamport-style stamp, the later of
 * the clock and one past every claim the tab has seen, so a Play here always outranks
 * the claim it answers even if that tab's clock is behind. Equal stamps go to the larger
 * id, so exactly one tab ends up active.
 *
 * DOM-free apart from the two channel factories, which take their globals as parameters.
 */

/** The only message tabs exchange. */
export interface TabMessage {
  kind: 'claim';
  /** The claiming tab's id, random per page load. */
  id: string;
  /** Lamport-style stamp: later of the clock (ms) and one past every claim seen. */
  at: number;
}

/** How claims travel between tabs. A post never reaches the posting tab itself. */
export interface TabChannel {
  post(msg: TabMessage): void;
  listen(fn: (msg: unknown) => void): void;
}

/** Whether claim `msg` outranks `mine`: a later stamp, or the same stamp and a larger id. */
export function isNewerClaim(msg: TabMessage, mine: Pick<TabMessage, 'id' | 'at'>): boolean {
  return msg.at > mine.at || (msg.at === mine.at && msg.id > mine.id);
}

function isClaim(v: unknown): v is TabMessage {
  if (!v || typeof v !== 'object') return false;
  const m = v as Record<string, unknown>;
  return m.kind === 'claim' && typeof m.id === 'string' && typeof m.at === 'number' && Number.isFinite(m.at);
}

/** One tab's side of the protocol. `onChange(true)` when it takes over, `onChange(false)` when it yields. */
export class TabLock {
  /** Whether this tab owns the save (may write it). */
  active = false;
  private mine = 0;
  private seen = 0;

  /**
   * @param channel  where claims are posted and heard
   * @param id       this tab's id; unique per page load
   * @param onChange called on every change of {@link active}
   * @param clock    milliseconds now (injectable for tests)
   */
  constructor(
    private readonly channel: TabChannel,
    readonly id: string,
    private readonly onChange: (active: boolean) => void,
    private readonly clock: () => number = () => Date.now(),
  ) {}

  /** Starts listening and claims the save: a newly opened tab is the newest. */
  start(): void {
    this.channel.listen((msg) => this.receive(msg));
    this.claim();
  }

  /** Takes the save over (on open, and on Play here) and tells every other tab to yield. */
  claim(): void {
    this.mine = Math.max(this.clock(), this.seen + 1);
    this.seen = this.mine;
    const was = this.active;
    this.active = true;
    this.channel.post({ kind: 'claim', id: this.id, at: this.mine });
    if (!was) this.onChange(true);
  }

  /** Handles one message from another tab. Anything that isn't a well-formed claim is ignored. */
  receive(msg: unknown): void {
    if (!isClaim(msg) || msg.id === this.id) return;
    this.seen = Math.max(this.seen, msg.at);
    if (this.active && isNewerClaim(msg, { id: this.id, at: this.mine })) {
      this.active = false;
      this.onChange(false);
    }
  }
}

/** The parts of a `storage` event the fallback reads. */
export interface StorageEventLike {
  key: string | null;
  newValue: string | null;
}

/** A channel over BroadcastChannel, or `null` where the browser has none. */
export function broadcastChannel(name: string, Ctor: typeof BroadcastChannel | undefined = globalThis.BroadcastChannel): TabChannel | null {
  if (!Ctor) return null;
  try {
    const bc = new Ctor(name);
    return { post: (msg) => bc.postMessage(msg), listen: (fn) => bc.addEventListener('message', (e) => fn((e as MessageEvent).data)) };
  } catch {
    return null;
  }
}

/**
 * The fallback channel: a post writes `key`, and other tabs hear it through the `storage`
 * event, which fires in every tab of the origin except the writer. A blocked store posts nothing.
 */
export function storageChannel(store: { setItem(key: string, value: string): void }, key: string, onStorage: (fn: (e: StorageEventLike) => void) => void): TabChannel {
  return {
    post: (msg) => {
      try {
        store.setItem(key, JSON.stringify(msg));
      } catch {
        /* storage blocked: no other tab can share the save either */
      }
    },
    listen: (fn) =>
      onStorage((e) => {
        if (e.key !== key || !e.newValue) return;
        try {
          fn(JSON.parse(e.newValue));
        } catch {
          fn(null);
        }
      }),
  };
}
