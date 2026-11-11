# Evidence: strata-gtl (no notice when storage is blocked outright)

`check.cjs` on the production build, Pixel 7, with three storage modes; it records every toast during boot and two Settings writes.

| Storage | Toasts (`result.json`) |
|---|---|
| Blocked (reading `localStorage` throws) | "Progress can't be saved: this browser's storage is full or blocked" (before the fix: none) |
| Full (`setItem` throws) | the same notice |
| Normal | only "Strata is ready to play offline" |

The notice shows at most once a session (the handler in `other-tab.ts`). No page errors.
