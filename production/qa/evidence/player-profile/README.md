# Player profile: evidence (2026-11-08)

Design: `design/gdd/player-profile.md` (PP-1 to PP-10). Unit tests: `tests/unit/profile/` (41 tests; the suite is 213/213). `npm run build` passes.
Browser checks: Vite dev server, headless Chromium, reduced motion on. Pixel 7 (412 px) unless noted; iPhone SE (320 px) with the root font at 150% for large text. No page errors in any run, and no horizontal overflow on any screen.

| Check | Screenshot | Result |
|---|---|---|
| Home chip, Midday | `01-home-chip-midday.png` | Avatar in its frame plus the name on its plate, top-left, above the logo; nothing overlaps |
| Home chip, Moonlit | `02-home-chip-moonlit.png` | Plate keeps its own colours on the night scene |
| Profile, long progress | `03-profile-long-progress.png`, `03b-profile-moonlit.png` | Header with Level 112 badge and edit button; 11 stat tiles; footnote shown |
| Profile, save from before the update | `04-profile-fresh-save.png` | Generated name ("Lagoon Isle 82"), default picks, new counters at 0 |
| Edit: Avatar / Frame / Name tabs | `05`, `06`, `07` | Draft preview on top; locked frames and plates are dimmed with a padlock |
| Locked item tapped | `08-edit-locked-requirement.png` | "Lighthouse: Clear 25 levels · 3/25"; the selection stays on Sand Jar |
| Invalid name ("Hi!") | `09-edit-invalid-name.png` | "Use 2–16 letters or numbers"; Save disabled |
| Close with unsaved changes | `10-discard-prompt.png` | "Discard changes?" with Keep editing / Discard |
| Save | `11-profile-after-save.png`, `12-home-chip-after-save.png` | Stored `{"name":"Zoë Tidewell","avatar":"sailboat","frame":"driftwood","plate":"sea-glass"}`; Profile and chip refresh |
| Win card unlock | `13-win-avatar-and-unlock.png` | Level 25 cleared with hints: small avatar at top-left, "New avatar: Lighthouse" and "New avatar: Anchor" (the 5th shell completed Tide Pool). Stats after: 38 pours, 170 coins earned (20 + 150 set bonus), 38 boosters used |
| 320 px, 150% text | `14`–`17` | The header plate wraps under the portrait and the name wraps at spaces; overlays scroll |
| Keyboard only | `18-keyboard-frame-pick.png` | Chip (Enter) → Profile → Edit; ArrowRight moves to the Frame tab; Tab enters the grid; ArrowLeft picks Sea Glass; Escape asks to discard; Escape again keeps editing; Save stores `frame: "sea-glass"` |

**Defects found and fixed while checking**
1. At 320 px with 150% text, the Profile header squeezed the name plate to one letter per line. The header now wraps, so the plate sits under the portrait.
2. The large plate broke names mid-word ("Saffro / n G…"). It now breaks only at spaces.
3. The proposed name word lists could make 20-character names (over the 16 limit). They were shortened, and a test now checks every combination.
4. Enter on the home screen always started a level, even when the profile chip, daily card, Shells or Scenes button had focus. Enter now activates the focused button. This was already wrong for the daily card before this change.
