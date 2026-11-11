<!-- PROTOTYPE - NOT FOR PRODUCTION -->
<!-- Question: can a GPU board (Pixi) and a falling-sand pour look and run well enough for Strata? -->
<!-- Date: 2026-11-11 -->
# gpu-sand prototype (throwaway)

**Status:** concluded, awaiting owner decision (design/gdd/systems-index.md D153-D156).

**Hypothesis:** a PixiJS board with lit glass and real-looking sand (B), and a CPU falling-sand pour
driven by the core pour rules (C), look clearly better than today's DOM board (A) and hold a smooth
frame rate on a phone-sized viewport.

One page, level 52 (`generateLevel(52, config)`), a switch between three variants. Taps pour with core `canPour` / `pour`.

| | |
|---|---|
| A today | DOM/CSS stacked rectangles, baseline only |
| B pixi | Pixi v8: glass, grain-textured sand, shadows, tilt + particle stream (fake pour) |
| C pixi + sand sim | B's look; each jar is a 40x96 sand grid, a tilting jar is simulated in a world grid, grains fall as particles and pile in the target |

## Run it

```
cd prototypes/gpu-sand
npm i && npx vite          # http://localhost:5173 (also on the LAN: --host is on)
```

## Open it on a phone

`npx vite build` (base is `./`, output `prototypes/gpu-sand/dist`), host that folder on any static host,
or run `npx vite preview --host` and open `http://<computer-LAN-ip>:4173` on the phone.
The checkbox "patterns" shows the colour-blind pattern overlay in all three variants.

## Findings

See `evidence/` (screenshots, `frame-times.json`, `frame-times-unthrottled.json`) and the report
handed back with this prototype. Known glitches in C: the grains' pattern overlay is fixed to the screen
(shimmers while sand moves), the pour is slower than B, a source jar is re-sampled once when its sand moves
into the world grid (a small aliasing step), and the pour only stays in sync because it is snapped to the exact
board state at the end.
