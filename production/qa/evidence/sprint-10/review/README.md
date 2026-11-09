# Independent review of PR #8: fixes

The Kilo review bot ran out of output budget on PR #8, so the diff was reviewed independently. That review found one medium and four low defects. All five are fixed; each check below fails on the code before the fix and passes after it.

| # | Finding | Fix | Check |
|---|---|---|---|
| 1 (medium) | Closing the win card within about 0.6 s of a first clear left the coin count-up running, so coins flew from the screen corner over the next board | The count-up stops when the card is hidden, and a coin flight with an invisible end lands at once (`win.ts`, `fx.ts`) | `coin-flight.cjs`: 3 stray coins before, 0 after |
| 2 (low) | With the music slider at 0, the music engine kept scheduling notes silently, costing battery | `startMusic` schedules nothing at volume 0, and raising the slider starts it | `audio.test.ts` "music at volume 0…" |
| 3 (low) | A failed first audio unlock kept a dead music engine, so music never played after a later unlock | The failure path drops the engine and the buses tied to the dead context | `audio.test.ts` "a failed first unlock…" |
| 4 (low) | Only a "suspended" context was resumed; iOS leaves it "interrupted" after the page is hidden | Resume whenever not running, on unlock and when the page is shown again | `audio.test.ts`, the two resume tests |
| 5 (low) | A saved volume off the slider's 5% step was spoken as the stored value (33%) while the slider showed 35% | The spoken value is read back from the slider | `slider-snap.cjs`: "33%" / 35 before, "35%" / 35 after |
