/**
 * Level-generation worker (sprint 8 P4, D46). Runs `prepareLevel` off the main thread so a
 * slow level (141, 185) is ready before the player taps Next or Play. It shares the exact
 * code the main thread uses for its synchronous fallback, so the boards are identical.
 *
 * Protocol: receives a `GenRequest`, posts back one `GenResponse` with the same `id`.
 * Started from `src/ui/main.ts` via
 * `new Worker(new URL('./gen-worker.ts', import.meta.url), { type: 'module' })`.
 */
import { type GenRequest, type GenResponse, prepareLevel } from '../core/prefetch';

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<GenRequest>) => void) | null;
  postMessage(msg: GenResponse): void;
};

scope.onmessage = (e) => {
  const { id, level, configKey, config } = e.data;
  let res: GenResponse;
  try {
    res = { id, ok: true, result: prepareLevel(level, config, configKey) };
  } catch (err) {
    res = { id, ok: false, error: String(err) };
  }
  scope.postMessage(res);
};
