# Phone check results (sprint 13 P1; D74, D101)

Run by the owner on 2026-11-11 on a **Samsung S25 Ultra, Chrome**, against the live 0.13.0 build, using the
phone checklist page (19 checks, from `production/qa/device-checklist.md` plus the checks added for 0.11 to 0.13).

| Result | Count | Checks |
|---|---|---|
| Works | 10 | pinch zoom, fast taps never zoom, largest text, music changes with the scene, volume sliders, vibration, weekly set, installed app offline, What's new shows once, looks right in the browser |
| Problem | 1 | music keeps playing in the background |
| Can't check | 8 | Aurora night, Winter lights and New Year fireworks (scenes not owned yet), jars at level 100+, both screen reader checks, jar styles (level 60+), the new jars (level 101+) |

## The problem: music keeps playing in the background

**Owner's note:** "Music doesnt stop in the background".

**What the code did.** The music paused only on `visibilitychange` with `document.hidden`. A browser check
(`production/qa/evidence/sprint-13/p1-music-background/bgmusic.cjs`, which measures the real audio output) shows
that this works whenever the page reports itself hidden: the output drops to silence.

**Why it can still play on a phone.** When the page never reports hidden, nothing paused the music. That
happens in an in-app browser, for example a link opened from inside another app such as the Claude app,
which can leave the page "visible" while the app is in the background. The same check showed that a window
focus loss alone (`blur`) left the music playing.

**Fix.** The music now also pauses on window `blur` and `pagehide`, and resumes on `focus` and `pageshow`
(only when the page is visible and music is on). `src/ui/audio.ts`, `watchVisibility`.

**Evidence.**
- Regression test, seen failing before the fix and passing after: `tests/unit/ui/audio.test.ts`, "music pauses
  when the window loses focus and resumes on focus, even if the page never reports hidden".
- Real output levels after the fix (`after-fix.txt`): hidden 0.0000, focus lost 0.0000, focus back 0.0080,
  `pagehide` 0.0000; playing about 0.008.

**To confirm on the phone** once it is live: play with music on, switch to another app, and come back.

## Carried over
The checks marked "Can't check" stay on the list for a later run, when the owner has reached those levels or
scenes.
