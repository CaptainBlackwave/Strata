/**
 * Level-generation worker (sprint 8 P4, D46), which also runs Hint and Shuffle (TD-13).
 * It runs `prepareLevel` off the main thread so a slow level (141, 185) is ready before the
 * player taps Next or Play, and `runAssist` so a hard board's solver search never freezes the
 * tab. Both share the exact code the main thread uses for its synchronous fallback, so the
 * results are identical.
 *
 * Protocol: receives a `GenRequest` or an `AssistRequest` and posts back one `GenResponse` or
 * `AssistResponse` with the same `id`. The board screen (`src/ui/screens/board.ts`) starts one
 * instance for prefetch and one for assists, so a hint never queues behind a level being made:
 * `new Worker(new URL('./gen-worker.ts', import.meta.url), { type: 'module' })`.
 */
import { type AssistRequest, type AssistResponse, isAssistRequest, runAssist } from '../core/assist';
import { type GenRequest, type GenResponse, prepareLevel } from '../core/prefetch';

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<GenRequest | AssistRequest>) => void) | null;
  postMessage(msg: GenResponse | AssistResponse): void;
};

scope.onmessage = (e) => {
  const msg = e.data;
  if (isAssistRequest(msg)) {
    let res: AssistResponse;
    try {
      res = { id: msg.id, ok: true, result: runAssist(msg) };
    } catch (err) {
      res = { id: msg.id, ok: false, error: String(err) };
    }
    return scope.postMessage(res);
  }
  const { id, level, configKey, config } = msg;
  let res: GenResponse;
  try {
    res = { id, ok: true, result: prepareLevel(level, config, configKey) };
  } catch (err) {
    res = { id, ok: false, error: String(err) };
  }
  scope.postMessage(res);
};
