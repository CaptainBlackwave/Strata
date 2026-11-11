---
status: designed and signed off (owner interview 2026-11-11, D116–D124); §3.3 link preview (H1) live, §3.1 share card built (H2), §3.2 and §3.4 not built
owner: game-designer / ux-designer
decisions: D114, D116–D118, D120–D124
verified-by: owner interview 2026-11-11
---

# Sharing: Design Document

> Sprint 14, from the owner interview after 0.13.1 (D114, D116–D118 in `systems-index.md`).
> Growth goal: players bring friends. Web only, and no server at all.

## 1. Overview

**Purpose**: make a result worth sending, and make the link a friend receives worth opening. Today Share exists in two places (the daily win card and the weekly sheet) and sends three lines of plain text with a link. This adds a picture to share, a way to challenge a friend on any cleared level, a proper link preview, and Share offered at a few high points.

**Scope**: the share card image; challenge links for numbered levels; the link preview (page title, description, preview image); where Share is offered. The daily's and weekly's text and links stay as they are and remain the fallback.

**Out of scope**: accounts, leaderboards, friend lists, counting shares or visits, rewards for sharing, app stores (D117, D118, the brief's anti-pillars).

## 2. Player Fantasy

"Look what I did, your turn." Sharing is a calm, optional gesture, never a pop-up and never rewarded. A friend who taps the link is playing within seconds, with no sign-up.

## 3. Detailed Rules

### 3.1 Share card (image)

- A share makes a picture on the device and hands it to the phone's share sheet together with the existing text and link.
- **What it shows**: the Strata name, the result (below), three small sealed jars in the board's sand colours on the player's current scene, and the game's address. It never shows the board or the solution. The jars use the scene's glass colours, not the player's jar style: styles are CSS textures the canvas does not reproduce (decided while building H2; the card stays readable and on-brand without them). Text sits only on the scene's card colour, where ink, soft ink and accent text all reach 4.5:1 in every scene.
- **The preview**: Share opens a small sheet with the picture as it will be sent, the **Show my name** switch (off each time it opens, D122) and **Share**. Escape and Close return to where Share was pressed.

| Share from | Headline | Detail lines |
|---|---|---|
| Daily | "Daily · 11 Nov" and its difficulty name | "Solved in N pours", "S-day streak" |
| Weekly set | "Weekly set · W46" and the theme name | The five boards' pours, a dash for an unplayed board |
| Level challenge (§3.2) | "Level N" | "N pours. Can you beat it?", Perfect mark if earned |
| Milestone (§3.4) | The milestone's name | One line, for example "30-day streak" or "Tide Pool set complete" |

- **Size**: one portrait card, 1080 × 1350, PNG, drawn with the canvas API from the same colour tokens the scene uses.
- **Fallbacks, in order**: image + text through the share sheet; text only through the share sheet; text copied to the clipboard. The player is told which happened in the same status line as today ("Shared", "Copied").
- **Accessibility**: the text always travels with the image, so the result is readable without the picture. With Colour patterns on, the card's jars carry the patterns.
- **Privacy**: the card shows the profile name only if the player has set one, and a "Show my name" switch on the share preview is off by default.

### 3.2 Challenge a friend (numbered levels)

- **Where**: the map's card for a cleared level gains **Challenge a friend** next to Replay. The win card of a numbered level gains a quiet **Share** button (today only the daily's has one).
- **The link**: `?challenge=N&pours=P`. `N` is the level, `P` the sender's best pours. Nothing else: no name, no save data.
- **Opening it**:

| Receiver's progress | What happens |
|---|---|
| Has cleared or reached level N | A card: "A friend cleared level N in P pours. Beat it?" with **Play** and **Not now**. Play starts level N as a replay with "Beat P pours" under the pour counter |
| Has not reached level N | A card: "A friend is on level N. You're on level M." with **Play level M**. The challenge is not kept |
| New player (tutorial not done) | The tutorial first, then the card above (as for daily links, D82) |

- **The result**: the win card says "N pours: you beat it by X", "you matched it" or "X more than your friend", and offers **Send it back** (a new challenge link with the receiver's pours).
- **Rules that do not change**: a replay pays no coins (M1); it can earn a missing Perfect mark and a better best (D50). A challenge never unlocks a level (D3).
- **Honesty**: `P` is whatever the link says. There is no ranking, so a made-up number harms nobody; it is clamped to 1–999.

### 3.3 Link preview

- `index.html` gains a fuller title ("Strata: a calm seaside sand-sort puzzle"), a one-sentence description, and Open Graph and Twitter card tags with one preview image, 1200 × 630.
- The preview image is the same for every link. With no server (D118) a pasted link cannot show a personal result; only the shared picture can.
- The image is rendered once from the game's own art by a script in `tools/`, and committed to `public/`. It is the project's first committed image besides the icons.
- The preview image needs the site's full address in `index.html`. This is the one place the GitHub Pages address is written down; share links keep using the page's own address.

### 3.4 Share moments

Share is offered, as a quiet secondary button, on:
- the daily win card and the weekly sheet (today);
- the win card of a numbered level (§3.2);
- a completed shell set (the set card);
- a streak milestone on the daily win card: days 7, 30, 60 and 100;
- a newly earned badge (the badge card).

Never a pop-up, never a reminder, never a reward (no coins, shells, badges or boosters for sharing or for a friend opening a link).

## 4. Formulas

| Formula | Expression | Example |
|---|---|---|
| Challenge verdict | `diff = mine − P`: beat if `diff < 0`, matched if `0`, else behind by `diff` | Friend 34, mine 31: "you beat it by 3" |
| Challenge pours clamp | `min(999, max(1, P))`; not an integer: the link opens as a plain `?level=N` replay | `pours=0` reads as 1 |

## 5. Edge Cases

- The share sheet cannot take files (desktop browsers, some in-app browsers): text only, then the clipboard.
- Canvas drawing fails or is blocked: text only; no error is shown beyond the normal status line.
- A challenge link for a level whose board changed after it was sent (as in 0.13.1): the receiver plays today's board. The card still shows the friend's pours; nothing can detect the mismatch without save data in the link, so the text says "cleared level N in P pours", not "this board".
- A challenge link opened while another board is in play: the card waits until that board ends or the player goes Home (as daily links do).
- A challenge link with a level past 1,000,000 or below 1: ignored, the game opens normally.
- Two tabs (D57): the tab that opens the link takes over as usual.
- Reduced motion: the card is a still image, so nothing changes.

## 6. Dependencies

`daily-puzzle.md` and `weekly-set.md` (their Share text and links), `level-map.md` (the cleared-level card, replays), `feel-audio-ui.md` (win card), `scenes.md` and `jar-styles.md` (card colours and jar look), `player-profile.md` (the optional name), `shell-collection.md` and `badges.md` (milestone cards), `save-data.md` (nothing new is saved).

## 7. Tuning Knobs (`sharing` in `game-config.json`)

| Knob | Draft value |
|---|---|
| `card.width`, `card.height` | 1080, 1350 |
| `streakMilestones` | 7, 30, 60, 100 |
| `challenge.maxPours` | 999 |

## 8. Acceptance Criteria

- Sharing a daily on a phone that supports it opens the share sheet with a picture and the text; on one that does not, the text is shared or copied, and the status line says which.
- The card is drawn in every scene with readable text (contrast unit-tested from the scene tokens, as scenes are today).
- A challenge link opens the right card for each of the three receiver states, and never opens a level the receiver has not reached.
- The verdict line is right for beat, matched and behind (unit-tested).
- A malformed challenge link never breaks the launch (unit-tested with hostile input).
- A pasted link shows the title, description and preview image in a link-preview check.
- Nothing is sent to any server, and nothing new is written to the save.
- Screenshots of every card and every new button are in `production/qa/evidence/sprint-14/`.

## Owner Decisions (interview 2026-11-11)

| # | Question | Decision |
|---|---|---|
| D120 | Should sharing or a friend's visit ever pay anything? | **No reward.** It cannot be verified without a server and would be farmable |
| D121 | A challenge for a level the receiver has not reached | **Invite them to play on**; the challenge is dropped and nothing is saved |
| D122 | The player's name on the card | **Off by default**, a switch on the share preview |
| D123 | One committed PNG for the link preview | **Yes**, rendered from the game's own art by a script |
| D124 | The GitHub Pages address in `index.html` for the preview image | **Yes**; share links keep using the page's own address |

No questions are open.

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-11-11 | Claude (sprint 14 draft) | First draft from the owner interview (D114, D116–D118) |
| 2026-11-11 | Claude (sprint 14 H0) | Signed off: the five open questions answered (D120–D124) |
| 2026-11-11 | Claude (sprint 14 H2) | §3.1 built: `src/ui/logic/share-card.ts` (plan, fallbacks), `src/ui/share-card.ts` (canvas), the preview sheet; daily and weekly Share use it. Jars use scene glass, not jar styles |
| 2026-11-11 | Claude (sprint 14 H1) | §3.3 built: title, description, Open Graph and Twitter tags, `public/og.png` from `tools/share/link-preview.cjs`; tests in `tests/unit/share/link-preview.test.ts` |
