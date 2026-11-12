/**
 * Sprint 22 L1 (D181, strata-8j3 follow-up): the text a pour changes (the HUD and the screen-reader
 * live region) is written once per frame, together, instead of in several separate writes. DOM-free:
 * the caller passes the scheduler (the browser's requestAnimationFrame) and the writes.
 */

/** Queued writes, flushed together once per frame. */
export interface FrameBatch {
  /**
   * Queues `write` under `key` for the next flush. A later write under the same key replaces the
   * earlier one (only the latest HUD or announcement matters); writes flush in the order their key
   * was first queued. The first queue after a flush asks the scheduler for one frame.
   */
  queue(key: string, write: () => void): void;
  /** Runs every queued write now (also what the scheduled frame calls). Safe to call when empty. */
  flush(): void;
  /** Whether anything waits for the next flush. */
  readonly pending: boolean;
}

/**
 * Makes a frame batch over `schedule`, which must call its callback once, later (requestAnimationFrame).
 * Example: `const batch = createFrameBatch((cb) => requestAnimationFrame(cb)); batch.queue('hud', updateHud);`
 */
export function createFrameBatch(schedule: (flush: () => void) => void): FrameBatch {
  const writes = new Map<string, () => void>();
  let scheduled = false;
  const flush = (): void => {
    scheduled = false;
    const run = [...writes.values()];
    writes.clear();
    for (const w of run) w();
  };
  return {
    queue(key, write) {
      writes.set(key, write); // Map.set on an existing key keeps its first position
      if (scheduled) return;
      scheduled = true;
      schedule(flush);
    },
    flush,
    get pending() {
      return writes.size > 0;
    },
  };
}

/**
 * How the polite live region takes new text. Different text is written at once (one write: a screen
 * reader reads any change). The same text again must be cleared first and written a moment later,
 * or a screen reader hears no change and stays silent (a second identical pour, say).
 */
export function liveRegionPlan(current: string, next: string): 'write' | 'clear-then-write' {
  return current === next ? 'clear-then-write' : 'write';
}
