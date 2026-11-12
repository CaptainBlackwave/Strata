/**
 * The PixiJS board (sprint 19 S2/S3, docs/architecture/adr-0001-gpu-sand-board.md). One WebGL canvas
 * behind `#board` draws every jar's glass, sand and mechanic marks where today's layout puts the jar
 * buttons; the buttons stay on top as the input layer (S4), with the DOM's text (hourglass and clam
 * counts) and corks. It draws only when something changes: there is no Pixi ticker, only a
 * requestAnimationFrame loop that runs while a lift, a pour or a mechanic effect moves, and stops
 * when the tab is hidden. Loaded on demand, so the DOM board's bundle carries none of Pixi.
 */
import { CanvasSource, Container, Sprite, Texture, WebGLRenderer } from 'pixi.js';
import { type Board, type Jar, isSealed } from '../../core/board';
import { type PourSim, type SandConfig, type SandDims, type SandGrid, bandRows, done, finish, gridFromJar, planPour, sandConfig, step, stepsDue } from '../sand';
import { DEFAULT_LOOK, type GlassLook, type JarArt, drawJarArt, drawMark } from './art';
import { DirtyTracker, jarKey } from './dirty';
import { type JarGeometry, cubicBezier, lipLocal, mouthRow, pourLip, pourSide } from './geometry';
import { type PillLook, drawClamShell, drawCork, drawFunnelMark, drawGlow, drawIce, drawPadlock, drawPill, drawSieveBand, padlockBox } from './mech-art';
import { corkDrop, glowAt, liftTarget, mustSnapPour, nopeShake, shuffleHop } from './events';
import { type PaintLook, type Rgb, cornerMask, paintGrid, paintParticles } from './paint';
import { type Overlay, PATTERNS, patternOverlay, sandOverlay } from './patterns';

/** Texels per sand cell along each axis: each grain gets a little texture of its own. */
const SUB = 2;
/** The falling stream's width in CSS px (strata-085: a narrow stream, 2 to 4 px). */
const STREAM_PX = 3;
/** Where the lip waits over the target's opening, as a share of its width from the near wall (strata-r8z). */
const LIP_INSET = 0.3;
/** A locked jar's sand is dulled like the DOM's `.jar.locked .glass { filter: saturate(0.85) }`. */
const LOCKED_SATURATION = 0.85;

/** Motion timings and curves, taken from the DOM board so both feel the same. */
export interface GpuMotion {
  /** The lift to the pour position (ms). */
  readonly liftMs: number;
  /** The flight home (ms). */
  readonly backMs: number;
  /** The selection lift's transition (ms), as `.jar`'s `transition` in style.css. */
  readonly selectMs: number;
  /** The hourglass flip (`FLIP_MS`) and the clam opening (`CLAM_OPEN_MS`). */
  readonly flipMs: number;
  readonly clamOpenMs: number;
  /** style.css `thaw` (760 ms) and `unlock` (800 ms). */
  readonly thawMs: number;
  readonly unlockMs: number;
  /** style.css `cork-drop` (520 ms), `nope` (300 ms), the Shuffle hop (260 ms, 25 ms a jar), and one jar's win glow (`FX_MS.winGlowEach`). */
  readonly corkMs: number;
  readonly nopeMs: number;
  readonly hopMs: number;
  readonly hopStagger: number;
  readonly glowMs: number;
}

/** What the board looks like beyond its jars: the scene and glass piece, the sand piece and patterns. */
export interface BoardLook {
  readonly glass: GlassLook;
  /** The scene's ink (`--ink`): the padlock's and the sieve band's edges. */
  readonly ink: string;
  /** The worn sand piece id (`plain`, `fine`, `glint`, `layered`, `ripple`). */
  readonly sand: string;
  /** Colour-blind patterns on. */
  readonly patterns: boolean;
  /** The worn cork piece id (`cork`, `driftwood`, `rope`, `scallop`, `brass`). */
  readonly cork: string;
  /** The scene's `--glow` and `--glow-core`, as `r, g, b` (the win glow, D73). */
  readonly glow: string;
  readonly glowCore: string;
}

/** What the board asks of the game while a pour plays. */
export interface PourHooks {
  /** The first grain leaves the lip (the pour sound). */
  spill(): void;
  /** The first grain reaches the target: apply the rules' pour and return the board after it. Called once. */
  land(): Board;
  /** The source tips back upright: the player may act again while it flies home. */
  release(): void;
  /** The source's hourglass count pill, where the DOM draws it at rest, to carry along; or none. */
  readonly pill?: (PillLook & { readonly left: number; readonly top: number }) | null;
}

/** The renderer's construction options. */
export interface GpuBoardOptions {
  readonly host: HTMLElement;
  /** Palette colours, by colour id; `hex` strings are used for the marks. */
  readonly palette: readonly Rgb[];
  readonly paletteHex: readonly string[];
  readonly neutral: Rgb;
  readonly motion: GpuMotion;
  readonly reducedMotion: () => boolean;
  readonly dims: SandDims;
  readonly config?: SandConfig;
  /** WebGL lost its context (true) or got it back (false): the board falls back to the DOM and returns. */
  readonly onContext?: (lost: boolean) => void;
}

interface JarView {
  readonly root: Container;
  readonly back: Sprite;
  /** The sand and its "?" marks: the hourglass flip turns this over. */
  readonly sandLayer: Container;
  readonly sand: Sprite;
  readonly marks: Container;
  readonly front: Sprite;
  /** Mechanic marks over the glass: ice, padlock, funnel, sieve band, clam shell. */
  readonly decor: Container;
  readonly shadow: Sprite;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly image: ImageData;
  readonly texels: Uint32Array;
  readonly texture: Texture;
  grid: SandGrid;
  geom: JarGeometry;
  /** The jar as last drawn (its mechanics, to notice a thaw or an unlock). */
  jar: Jar | null;
  lift: number;
  liftFrom: number;
  liftTo: number;
  liftStart: number;
  /** The sealed jar's cork sprite (the drop moves it), and a shake's offset in px (refusal, Shuffle). */
  cork: Sprite | null;
  corkRest: { x: number; y: number; w: number; h: number } | null;
  shakeX: number;
  shakeY: number;
  /** The hourglass count travelling with the jar in a pour (strata-5lq). */
  pill: Sprite | null;
}

/** The per-size sand look: the corner mask, the sand texture and the patterns. */
interface GrainLook {
  readonly mask: Uint8Array;
  readonly texture: Overlay | null;
  readonly patterns: readonly Overlay[] | null;
}

/** A short effect: a thaw, an unlock, a clam opening, a flip. */
interface Fx {
  readonly jar: number;
  readonly kind: 'thaw' | 'unlock' | 'clam' | 'flip' | 'cork' | 'nope' | 'hop' | 'glow';
  readonly start: number;
  readonly ms: number;
  readonly sprite: Sprite | null;
  /** Draws progress `u` (0..1, or below 0 while delayed). */
  readonly at: (u: number) => void;
  readonly end: () => void;
}

interface Pour {
  readonly from: number;
  readonly to: number;
  readonly sim: PourSim;
  readonly side: 1 | -1;
  readonly hooks: PourHooks;
  readonly resolve: () => void;
  readonly reject: (e: unknown) => void;
  readonly startLip: { x: number; y: number };
  readonly waitLip: { x: number; y: number };
  /** The target's mouth row (narrow jars), for the air and its own texture. */
  readonly targetMouth: number;
  readonly start: number;
  /** Moving to the target (the spill held), pouring, flying home, then the target's last settling once home. */
  phase: 'move' | 'sim' | 'back' | 'tail';
  backStart: number;
  carry: number;
  spilled: boolean;
  after: Board | null;
  released: boolean;
  /** The target sealed: its cork drops in once every grain has landed. */
  sealWhenFull?: { jar: Jar; capacity: number };
}

const easeLift = cubicBezier(0.3, 0.7, 0.4, 1);
const easeBack = cubicBezier(0.4, 0, 0.3, 1);
const easeFlip = cubicBezier(0.45, 0, 0.25, 1);
const easeClam = cubicBezier(0.3, 0.6, 0.4, 1);
const easeIn = cubicBezier(0.42, 0, 1, 1);

/** The PixiJS jar board. Create with `GpuBoard.create`; `null` when WebGL fails. */
export class GpuBoard {
  private readonly stage = new Container();
  private readonly shadows = new Container();
  private readonly jarsLayer = new Container();
  private readonly fxLayer = new Container();
  private readonly air = new Sprite();
  private views: JarView[] = [];
  /** Cached textures by key (glass art, marks); cleared when the look or the resolution changes. */
  private readonly textures = new Map<string, Texture>();
  private readonly arts = new Map<string, JarArt>();
  private readonly grains = new Map<string, GrainLook>();
  private look: BoardLook = { glass: DEFAULT_LOOK, ink: '#4a3b2c', sand: 'plain', patterns: false, cork: 'cork', glow: '255, 220, 150', glowCore: '255, 246, 216' };
  /** The hint's "from" jar (lifted by half, as the DOM), or `null`. */
  private hintFrom: number | null = null;
  /** The WebGL context is lost: nothing draws until it is restored. */
  private lost = false;
  private lookKey = '';
  private airCanvas: HTMLCanvasElement | null = null;
  private airCtx: CanvasRenderingContext2D | null = null;
  private airImage: ImageData | null = null;
  private airTexels: Uint32Array | null = null;
  private airTexture: Texture | null = null;
  private readonly tracker = new DirtyTracker();
  private board: Board | null = null;
  private selected: number | null = null;
  private pour: Pour | null = null;
  private fx: Fx[] = [];
  private raf = 0;
  private frames = 0;
  private last = 0;
  private readonly config: SandConfig;

  private constructor(
    private readonly renderer: WebGLRenderer,
    private readonly opts: GpuBoardOptions,
  ) {
    this.config = opts.config ?? sandConfig;
    this.stage.addChild(this.shadows, this.jarsLayer, this.fxLayer, this.air);
    this.air.visible = false;
    document.addEventListener('visibilitychange', this.onVisibility);
    const canvas = renderer.canvas as HTMLCanvasElement;
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  /** True while the WebGL context is lost. */
  get contextLost(): boolean {
    return this.lost;
  }

  /**
   * The context is gone (S6): any pour is played out at once on the CPU (the rules apply as usual)
   * and nothing draws; the board's owner switches to the DOM board.
   */
  private readonly onContextLost = (e: Event): void => {
    e.preventDefault(); // allow the browser to restore it
    this.lost = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.completePour();
    this.endFx();
    this.opts.onContext?.(true);
  };

  /** The context is back (S6): every texture is rebuilt from its canvas, then the owner re-lays out. */
  private readonly onContextRestored = (): void => {
    this.lost = false;
    this.clearCaches();
    this.tracker.reset();
    for (const v of this.views) {
      v.texture.source.update();
      if (v.jar) this.applyArt(v);
    }
    this.airTexture?.source.update();
    this.opts.onContext?.(false);
  };

  /** Starts the WebGL renderer and puts its canvas in `host` (decorative: `aria-hidden`, no pointer events). */
  static async create(opts: GpuBoardOptions): Promise<GpuBoard | null> {
    try {
      const renderer = new WebGLRenderer();
      await renderer.init({
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        backgroundAlpha: 0,
        antialias: true,
      });
      const canvas = renderer.canvas as HTMLCanvasElement;
      canvas.className = 'gpu-board';
      canvas.setAttribute('aria-hidden', 'true');
      opts.host.prepend(canvas);
      return new GpuBoard(renderer, opts);
    } catch {
      return null;
    }
  }

  /** How many jars are laid out. */
  get jarCount(): number {
    return this.views.length;
  }

  /** True while a pour plays (or flies home). */
  get pouring(): boolean {
    return this.pour !== null;
  }

  /** The jar a pour is carrying away from its button, or `null` (its DOM marks hide meanwhile). */
  get away(): number | null {
    return this.pour && this.pour.phase !== 'tail' ? this.pour.from : null;
  }

  /** Shows or hides the whole canvas. */
  setVisible(on: boolean): void {
    (this.renderer.canvas as HTMLCanvasElement).hidden = !on;
    if (!on) this.completePour();
  }

  /**
   * Sets the scene, glass piece, sand piece and patterns. A change redraws everything at the next
   * `sync` or `layout`. Returns true when it changed.
   */
  setLook(look: BoardLook): boolean {
    const key = JSON.stringify(look);
    if (key === this.lookKey) return false;
    this.look = look;
    this.lookKey = key;
    this.clearCaches();
    this.tracker.reset();
    for (const v of this.views) this.applyArt(v);
    return true;
  }

  /**
   * Lays the jars out at `geoms` (one per jar, read from the buttons) for `board`, and redraws
   * everything. Called after every DOM layout, resize and orientation change.
   */
  layout(geoms: readonly JarGeometry[], board: Board, selected: number | null): void {
    this.completePour();
    this.endFx();
    const res = this.renderer.resolution;
    this.renderer.resize(window.innerWidth, window.innerHeight);
    if (res !== this.renderer.resolution) this.clearCaches();
    while (this.views.length > geoms.length) this.destroyView(this.views.pop()!);
    while (this.views.length < geoms.length) this.views.push(this.makeView(geoms[this.views.length]));
    this.views.forEach((v, i) => {
      v.geom = geoms[i];
      v.jar = null; // a new layout draws each jar as it is, with no thaw or unlock
      this.applyArt(v, board.jars[i]);
    });
    this.tracker.reset();
    this.sync(board, selected, true);
  }

  /**
   * Brings the canvas up to `board` and the selection: redraws only jars that changed (their units
   * or mechanics), plays a thaw or an unlock where one ended, and eases the selected jar's lift.
   * A pour in progress owns its two jars until it ends; a board change after it released the input
   * snaps it to its end first (Undo, Restart, a new pour).
   */
  sync(board: Board, selected: number | null, instant = false, hintFrom: number | null = this.hintFrom): void {
    if (board.jars.length !== this.views.length) return;
    this.hintFrom = hintFrom;
    const p = this.pour;
    if (p && mustSnapPour(p.released, board === p.after)) this.completePour();
    this.board = board;
    const keys = board.jars.map(jarKey);
    const owned = this.pour ? [this.pour.from, this.pour.to] : [];
    for (const i of this.tracker.diff(keys)) {
      if (owned.includes(i)) continue;
      const v = this.views[i];
      const jar = board.jars[i];
      if (!instant && v.jar) this.mechanicFx(i, v.jar, jar);
      v.grid = gridFromJar(jar, board.capacity, this.opts.dims, 1 + i * 7919);
      this.redraw(v, jar, board.capacity);
    }
    // Owned jars are re-marked as undrawn so they are redrawn if the pour is cancelled.
    for (const i of owned) this.tracker.mark(i, '');
    this.selected = selected;
    const now = performance.now();
    const carried = this.pour && this.pour.phase !== 'tail' ? this.pour.from : null;
    this.views.forEach((v, i) => {
      const to = liftTarget(i, selected, hintFrom, carried);
      if (to === v.liftTo && !instant) return;
      v.liftFrom = v.lift;
      v.liftTo = to;
      v.liftStart = now;
      if (instant || this.opts.reducedMotion()) v.lift = to;
    });
    this.request();
  }

  /**
   * Jar `i` just sealed (from `sealFx`): its cork is drawn now, from the board after the pour, and
   * drops in as the DOM's `cork-drop`. Reduced motion: it is simply there.
   */
  seal(i: number, jar: Jar, capacity: number): void {
    const v = this.views[i];
    if (!v) return;
    const p = this.pour;
    if (p && p.to === i && p.sim.landed < p.sim.required) {
      // The sand is still falling into it: the cork waits until the last grain is in.
      p.sealWhenFull = { jar, capacity };
      return;
    }
    this.decorate(v, jar, capacity);
    if (this.opts.reducedMotion() || !v.cork) return;
    this.addFx({
      jar: i, kind: 'cork', start: performance.now(), ms: this.opts.motion.corkMs, sprite: null,
      at: (u) => this.poseCork(v, corkDrop(u, v.corkRest?.h ?? 0)),
      end: () => this.poseCork(v, corkDrop(1, 0)),
    });
  }

  /** The refusal shake on jar `i` (from `nope`): ±4 px, as style.css `nope`. The outline is the DOM's. */
  nope(i: number): void {
    const v = this.views[i];
    if (!v || this.opts.reducedMotion()) return;
    this.addFx({
      jar: i, kind: 'nope', start: performance.now(), ms: this.opts.motion.nopeMs, sprite: null,
      at: (u) => (v.shakeX = nopeShake(u)),
      end: () => (v.shakeX = 0),
    });
  }

  /** The Shuffle hop on every jar (from `renderAllJars(true)`): 6 px up and back, 25 ms apart. */
  hop(): void {
    if (this.opts.reducedMotion()) return;
    const now = performance.now();
    this.views.forEach((v, i) => {
      this.addFx({
        jar: i, kind: 'hop', start: now + i * this.opts.motion.hopStagger, ms: this.opts.motion.hopMs, sprite: null,
        at: (u) => (v.shakeY = shuffleHop(u)),
        end: () => (v.shakeY = 0),
      });
    });
  }

  /**
   * The win glow run (sprint 18 F3, `winGlowPlan`) on the canvas jars: each planned jar glows in
   * turn, then holds its glow until the card opens. Returns the stop function, as `winGlowRun`.
   */
  winGlow(steps: readonly { readonly jar: number; readonly at: number }[]): () => void {
    const now = performance.now();
    const sprites: Sprite[] = [];
    for (const s of steps) {
      const v = this.views[s.jar];
      if (!v) continue;
      const g = v.geom.glass;
      const { core, halo } = { core: this.look.glowCore, halo: this.look.glow };
      let pad = 0;
      const t = this.tex(`glow|${g.width.toFixed(2)}x${g.height.toFixed(2)}|${core}|${halo}`, (r) => {
        const d = drawGlow(g.width, g.height, core, halo, r);
        return d.canvas;
      });
      pad = 17;
      const sp = new Sprite(t);
      sp.anchor.set(0.5);
      sp.setSize(g.width + 2 * pad, g.height + 2 * pad);
      sp.position.set(g.left + g.width / 2, g.top + g.height / 2);
      sp.alpha = 0;
      this.fxLayer.addChild(sp);
      sprites.push(sp);
      const w0 = sp.width;
      const h0 = sp.height;
      this.addFx({
        jar: s.jar, kind: 'glow', start: now + s.at, ms: this.opts.motion.glowMs, sprite: sp,
        at: (u) => {
          const p = glowAt(u);
          sp.alpha = p.alpha;
          sp.setSize(w0 * p.scale, h0 * p.scale);
        },
        // The glow holds at its last value until the card opens; `stop` removes it.
        end: () => {
          const p = glowAt(1);
          sp.alpha = p.alpha;
          sp.setSize(w0, h0);
        },
      });
    }
    return () => {
      this.fx = this.fx.filter((f) => f.kind !== 'glow');
      for (const sp of sprites) sp.destroy();
      this.request();
    };
  }

  private poseCork(v: JarView, p: { x: number; y: number; rotate: number; scale: number; alpha: number }): void {
    const c = v.cork;
    const r = v.corkRest;
    if (!c || !r) return;
    c.anchor.set(0.5);
    c.position.set(r.x + r.w / 2 + p.x, r.y + r.h / 2 + p.y);
    c.rotation = (p.rotate * Math.PI) / 180;
    c.setSize(r.w * p.scale, r.h * p.scale);
    c.alpha = p.alpha;
  }

  /**
   * The hourglass flip on jar `i` (D96): its sand already shows the new order, and turns over about
   * its own middle after `delay` ms, as the DOM's `flipFx`. Reduced motion: nothing moves.
   */
  flip(i: number, delay: number): void {
    const v = this.views[i];
    if (!v || this.opts.reducedMotion() || !this.board) return;
    const unit = v.geom.cellH * bandRows(this.board.capacity, this.opts.dims);
    const mid = (this.board.jars[i].units.length * unit) / 2;
    v.sandLayer.pivot.set(0, -mid);
    v.sandLayer.position.set(0, -mid);
    this.addFx({
      jar: i, kind: 'flip', start: performance.now() + delay, ms: this.opts.motion.flipMs, sprite: null,
      at: (u) => {
        const a = Math.PI * (1 - easeFlip(Math.max(0, u)));
        v.sandLayer.scale.y = Math.cos(a);
      },
      end: () => {
        v.sandLayer.scale.y = 1;
        v.sandLayer.pivot.set(0, 0);
        v.sandLayer.position.set(0, 0);
      },
    });
  }

  /**
   * A clam's shell swinging open on jar `i` (D96, §2.6): the jar is drawn open already; the shell
   * stays closed over it for `delay` ms, then tips back on its hinge and fades, as the DOM's `clamOpenFx`.
   */
  clamOpen(i: number, delay: number): void {
    const v = this.views[i];
    if (!v || this.opts.reducedMotion()) return;
    const shell = this.shellSprite(v);
    const foot = v.root.toGlobal({ x: shell.x, y: shell.y + shell.height });
    shell.anchor.set(0, 1);
    shell.position.set(foot.x, foot.y);
    this.fxLayer.addChild(shell);
    const h = shell.height;
    this.addFx({
      jar: i, kind: 'clam', start: performance.now() + delay, ms: this.opts.motion.clamOpenMs, sprite: shell,
      at: (u) => {
        const e = easeClam(Math.max(0, u));
        const deg = e < 0.45 ? (34 * e) / 0.45 : 34 + ((78 - 34) * (e - 0.45)) / 0.55;
        shell.height = h * Math.cos((deg * Math.PI) / 180);
        shell.alpha = e < 0.45 ? 1 : 1 - (e - 0.45) / 0.55;
      },
      end: () => shell.destroy(),
    });
  }

  /** Ends every flip and clam opening at once (a board change other than a pour, as `cancelFlips`). */
  cancelFlips(): void {
    this.endFx(['flip', 'clam']);
  }

  /**
   * Plays a pour as falling sand: the source lifts to the target, tips while the simulation spills
   * its top colour, then flies home while the target settles; at the end both jars snap exactly to
   * the board `hooks.land` returned. Resolves once the jar is home.
   */
  playPour(from: number, to: number, board: Board, seed: number, hooks: PourHooks): Promise<void> {
    this.completePour();
    const src = this.views[from];
    const dst = this.views[to];
    const side = pourSide(src.geom, dst.geom, window.innerWidth);
    const { cols, rows } = this.opts.dims;
    // The lip waits over the opening, a little in from the near wall, and the stream falls straight down from it.
    const streamCol = (side > 0 ? LIP_INSET : 1 - LIP_INSET) * cols;
    const sourceMouth = mouthRow(src.geom, rows);
    const targetMouth = mouthRow(dst.geom, rows);
    const sim = planPour(board, from, to, this.opts.dims, seed, { side, config: this.config, streamCol, streamWidth: STREAM_PX / dst.geom.cellW, sourceMouth, targetMouth });
    // The grids are the same sand: keep the grains' shades so nothing shimmers at the start.
    sim.source.shade.set(src.grid.shade);
    sim.target.shade.set(dst.grid.shade);
    src.grid = sim.source;
    dst.grid = sim.target;
    const lip = lipLocal(src.geom, side);
    const startLip = { x: src.geom.x + lip.x, y: src.geom.y + lip.y - src.lift * src.geom.lift };
    src.root.pivot.set(lip.x, lip.y);
    src.root.position.set(startLip.x, startLip.y);
    this.jarsLayer.addChild(src.root);
    if (hooks.pill) {
      // The hourglass count travels with its jar (strata-5lq), redrawn from the DOM's own pill.
      const look = hooks.pill;
      src.pill?.destroy();
      src.pill = new Sprite(this.tex(`pill|${JSON.stringify(look)}`, (r) => drawPill(look, r)));
      src.pill.setSize(look.width, look.height);
      src.pill.position.set(look.left - src.geom.x, look.top - src.geom.y);
      src.decor.addChild(src.pill);
    }
    this.prepareAir(dst.geom, targetMouth);
    return new Promise<void>((resolve, reject) => {
      this.pour = {
        from, to, sim, side, hooks, resolve, reject, startLip, targetMouth,
        waitLip: { x: dst.geom.x - dst.geom.innerWidth / 2 + streamCol * dst.geom.cellW, y: pourLip(dst.geom, side, this.config.airRows, targetMouth).y },
        start: performance.now(), phase: 'move', backStart: 0, carry: 0, spilled: false, after: null, released: false,
      };
      src.liftTo = 0;
      this.request();
    });
  }

  /** Ends any pour at once: runs the simulation out, applies the rules, snaps and puts the jar home. */
  completePour(): void {
    const p = this.pour;
    if (!p) return;
    try {
      while (!done(p.sim)) step(p.sim);
      this.ensureLanded(p);
      this.release(p);
      this.endPour(p);
    } catch (e) {
      this.pour = null;
      p.reject(e);
    }
  }

  /** Removes the canvas and frees the GPU. */
  destroy(): void {
    cancelAnimationFrame(this.raf);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.destroy({ removeView: true });
  }

  // ---- art -----------------------------------------------------------------------------------

  private clearCaches(): void {
    for (const t of this.textures.values()) t.destroy(true);
    this.textures.clear();
    this.arts.clear();
    this.grains.clear();
  }

  /** A cached texture, made by `make` (a canvas at the renderer's resolution) the first time. */
  private tex(key: string, make: (res: number) => HTMLCanvasElement, scaleMode: 'linear' | 'nearest' = 'linear'): Texture {
    let t = this.textures.get(key);
    if (!t) {
      const res = this.renderer.resolution;
      t = new Texture({ source: new CanvasSource({ resource: make(res), resolution: res, scaleMode }) });
      this.textures.set(key, t);
    }
    return t;
  }

  private sizeKey(g: JarGeometry): string {
    return [g.glass.width, g.glass.height, g.cellW, g.cellH].map((n) => n.toFixed(2)).join('x');
  }

  /** The glass art for a jar of this size, funnel or not, in the current look. */
  private artFor(g: JarGeometry, funnel: boolean): { art: JarArt; back: Texture; front: Texture; shadow: Texture } {
    const key = `${this.sizeKey(g)}|${funnel ? 'f' : ''}`;
    let art = this.arts.get(key);
    if (!art) {
      art = drawJarArt(g, this.renderer.resolution, this.look.glass, funnel);
      this.arts.set(key, art);
    }
    const a = art;
    return { art: a, back: this.tex(`back|${key}`, () => a.back), front: this.tex(`front|${key}`, () => a.front), shadow: this.tex(`shadow|${key}`, () => a.shadow) };
  }

  /** The corner mask, sand texture and patterns for a jar of this size. */
  private grainFor(g: JarGeometry, capacity: number, innerRadius: number): GrainLook {
    const key = `${this.sizeKey(g)}|${capacity}`;
    let look = this.grains.get(key);
    if (!look) {
      const { cols, rows } = this.opts.dims;
      const space = { width: cols * SUB, height: rows * SUB, texelW: g.cellW / SUB, texelH: g.cellH / SUB, unitRows: bandRows(capacity, this.opts.dims) * SUB };
      look = {
        mask: cornerMask(space.width, space.height, (innerRadius / g.cellW) * SUB, (innerRadius / g.cellH) * SUB),
        texture: sandOverlay(space, this.look.sand),
        patterns: this.look.patterns ? this.opts.palette.map((_, c) => patternOverlay(space, c % PATTERNS.length)) : null,
      };
      this.grains.set(key, look);
    }
    return look;
  }

  private makeView(geom: JarGeometry): JarView {
    const { cols, rows } = this.opts.dims;
    const canvas = document.createElement('canvas');
    canvas.width = cols * SUB;
    canvas.height = rows * SUB;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(canvas.width, canvas.height);
    const texture = new Texture({ source: new CanvasSource({ resource: canvas, scaleMode: 'nearest' }) });
    const v: JarView = {
      root: new Container(),
      back: new Sprite(),
      sandLayer: new Container(),
      sand: new Sprite(texture),
      marks: new Container(),
      front: new Sprite(),
      decor: new Container(),
      shadow: new Sprite(),
      canvas, ctx, image, texels: new Uint32Array(image.data.buffer), texture,
      grid: gridFromJar({ units: [], hidden: 0 }, 1, this.opts.dims),
      geom, jar: null, lift: 0, liftFrom: 0, liftTo: 0, liftStart: 0,
      cork: null, corkRest: null, shakeX: 0, shakeY: 0, pill: null,
    };
    v.sandLayer.addChild(v.sand, v.marks);
    v.root.addChild(v.back, v.sandLayer, v.front, v.decor);
    this.shadows.addChild(v.shadow);
    this.jarsLayer.addChild(v.root);
    return v;
  }

  private destroyView(v: JarView): void {
    v.root.destroy({ children: true });
    v.shadow.destroy();
    v.texture.destroy(true);
  }

  /** Puts a jar's glass art and sand sprite in place for its geometry and mechanics. */
  private applyArt(v: JarView, jar: Jar | null = v.jar): void {
    const g = v.geom;
    const { art, back, front, shadow } = this.artFor(g, jar?.funnel === true);
    v.back.texture = back;
    v.front.texture = front;
    v.shadow.texture = shadow;
    v.back.position.set(art.left, art.top);
    v.front.position.set(art.left, art.top);
    v.back.setSize(art.width, art.height);
    v.front.setSize(art.width, art.height);
    v.sand.position.set(-g.innerWidth / 2, -g.gridHeight);
    v.sand.setSize(g.innerWidth, g.gridHeight);
    v.shadow.anchor.set(0.5);
    v.shadow.setSize(art.shadowWidth, art.shadowHeight);
    v.shadow.position.set(g.x, g.y + g.base);
    this.placeRest(v);
  }

  /** Puts a jar at rest, with its current lift. */
  private placeRest(v: JarView): void {
    v.root.pivot.set(0, 0);
    v.root.rotation = 0;
    v.root.position.set(v.geom.x + v.shakeX, v.geom.y - v.lift * v.geom.lift + v.shakeY);
    v.shadow.alpha = 1 - 0.35 * v.lift;
  }

  /** Redraws a jar: its art (a funnel's glass differs), its sand, its "?" marks and its mechanic marks. */
  private redraw(v: JarView, jar: Jar, capacity: number): void {
    if ((v.jar?.funnel === true) !== (jar.funnel === true) || !v.back.texture) this.applyArt(v, jar);
    v.jar = jar;
    this.paintSand(v, jar, capacity);
    this.drawMarks(v, jar.hidden, capacity);
    this.decorate(v, jar, capacity);
  }

  private paintLook(v: JarView, jar: Jar | null, capacity: number): PaintLook {
    const art = this.artFor(v.geom, jar?.funnel === true).art;
    const grain = this.grainFor(v.geom, capacity, art.innerRadius);
    return { mask: grain.mask, texture: grain.texture, patterns: grain.patterns, saturation: jar?.lock !== undefined ? LOCKED_SATURATION : 1 };
  }

  private paintSand(v: JarView, jar: Jar | null, capacity: number): void {
    paintGrid(v.grid, this.opts.palette, this.opts.neutral, v.texels, SUB, this.paintLook(v, jar, capacity));
    v.ctx.putImageData(v.image, 0, 0);
    v.texture.source.update();
  }

  /** The "?" on each hidden unit: hidden units sit at the bottom and never move in a pour. */
  private drawMarks(v: JarView, hidden: number, capacity: number): void {
    const unit = v.geom.cellH * bandRows(capacity, this.opts.dims);
    v.marks.removeChildren().forEach((m) => m.destroy());
    const mark = this.tex(`mark|${unit.toFixed(2)}`, (res) => drawMark(unit, res));
    for (let k = 0; k < hidden; k++) {
      const m = new Sprite(mark);
      m.anchor.set(0.5);
      m.setSize(unit, unit);
      m.position.set(0, -(k + 0.5) * unit);
      v.marks.addChild(m);
    }
  }

  /** The jar's box in jar-local space: the button (the DOM's `--jar-w` wide) and the glass. */
  private local(v: JarView) {
    const g = v.geom;
    const w = g.button.width;
    return {
      w,
      left: g.button.left - g.x,
      top: g.button.top - g.y,
      bottom: g.button.top + g.button.height - g.y,
      jarH: g.button.height - w * 0.18,
      glassLeft: g.glass.left - g.x,
      glassTop: g.glass.top - g.y,
    };
  }

  /** The mechanic marks, as style.css places them (from the button's box and `--jar-w`). */
  private decorate(v: JarView, jar: Jar, capacity: number): void {
    v.decor.removeChildren().forEach((c) => c.destroy());
    v.cork = null;
    v.corkRest = null;
    v.pill = null;
    const b = this.local(v);
    const pat = (c: number) => (this.look.patterns ? c % PATTERNS.length : null);
    v.sandLayer.visible = jar.clam === undefined; // a closed clam hides its sand (D96, §2.6)
    if (jar.funnel) {
      const s = new Sprite(this.tex(`funnel|${b.w.toFixed(2)}`, (r) => drawFunnelMark(b.w, r)));
      s.position.set(-(b.w * 0.95) / 2, b.top + b.w * 0.18 - b.w * 0.3);
      v.decor.addChild(s);
    }
    if (jar.frozen) v.decor.addChild(this.iceSprite(v));
    if (jar.lock !== undefined) v.decor.addChild(this.padlockSprite(v, jar.lock));
    if (jar.sieve !== undefined) {
      const out = Math.max(2, b.w * 0.06);
      const width = b.w + 2 * out;
      const height = Math.max(11, b.w * 0.25);
      const color = this.opts.paletteHex[jar.sieve];
      const s = new Sprite(this.tex(`sieve|${width.toFixed(2)}|${color}|${pat(jar.sieve)}`, (r) => drawSieveBand(width, height, color, this.look.ink, pat(jar.sieve!), r)));
      s.position.set(b.left - out, b.top + b.w * 0.18 - 2);
      v.decor.addChild(s);
    }
    if (jar.clam !== undefined) v.decor.addChild(this.shellSprite(v));
    if (isSealed(jar, capacity)) {
      // style.css `.cork`: 18% in from each side, --jar-w × 0.18 − 6 px from the top, --jar-w × 0.26 tall.
      const w = b.w * 0.64;
      const h = b.w * 0.26;
      const rest = { x: b.left + b.w * 0.18, y: b.top + b.w * 0.18 - 6, w, h };
      const id = this.look.cork;
      const s = new Sprite(this.tex(`cork|${id}|${w.toFixed(2)}x${h.toFixed(2)}`, (r) => drawCork(id, w, h, r)));
      v.decor.addChild(s);
      v.cork = s;
      v.corkRest = rest;
      this.poseCork(v, corkDrop(1, 0));
    }
  }

  private iceSprite(v: JarView): Sprite {
    const g = v.geom;
    const rt = g.button.width * 0.12;
    const rb = g.button.width * 0.38;
    const s = new Sprite(this.tex(`ice|${g.glass.width.toFixed(2)}x${g.glass.height.toFixed(2)}`, (r) => drawIce(g.glass.width, g.glass.height, rt, rb, r)));
    s.position.set(g.glass.left - g.x, g.glass.top - g.y);
    s.setSize(g.glass.width, g.glass.height);
    return s;
  }

  private padlockSprite(v: JarView, lock: number): Sprite {
    const b = this.local(v);
    const color = this.opts.paletteHex[lock];
    const pat = this.look.patterns ? lock % PATTERNS.length : null;
    const key = `lock|${b.w.toFixed(2)}|${color}|${pat}|${this.look.ink}`;
    const texture = this.tex(key, (r) => drawPadlock(b.w, color, this.look.ink, pat, r).canvas);
    const a = padlockMetrics(b.w);
    const s = new Sprite(texture);
    s.setSize(a.width, a.height);
    // style.css: top = --jar-w × 0.18 − 2 px, then translate(−50%, −30%) of the box.
    const boxTop = b.top + b.w * 0.18 - 2 - 0.3 * a.boxHeight;
    s.position.set(-a.width / 2, boxTop - a.boxTop);
    return s;
  }

  private shellSprite(v: JarView): Sprite {
    const b = this.local(v);
    const width = b.w + 2;
    const height = b.jarH + b.w * 0.12;
    const night = this.look.glass.night;
    const s = new Sprite(this.tex(`clam|${width.toFixed(2)}x${height.toFixed(2)}|${night}`, (r) => drawClamShell(width, height, b.w, night, r)));
    s.position.set(b.left - 1, b.bottom + 1 - height);
    s.setSize(width, height + 2);
    return s;
  }

  /** Starts the thaw or unlock effect where a jar's ice or padlock just went (as `renderMechanics`). */
  private mechanicFx(i: number, was: Jar, now: Jar): void {
    if (this.opts.reducedMotion()) return;
    const v = this.views[i];
    const place = (s: Sprite) => {
      const p = v.root.toGlobal({ x: s.x + s.width / 2, y: s.y + s.height / 2 });
      s.anchor.set(0.5);
      s.position.set(p.x, p.y);
      this.fxLayer.addChild(s);
      return { x: p.x, y: p.y, w: s.width, h: s.height };
    };
    if (was.frozen && !now.frozen) {
      const s = this.iceSprite(v);
      const o = place(s);
      this.addFx({
        jar: i, kind: 'thaw', start: performance.now(), ms: this.opts.motion.thawMs, sprite: s,
        at: (u) => {
          const e = easeIn(Math.max(0, u));
          const k = e < 0.3 ? 1 + 0.04 * (e / 0.3) : 1.04 - 0.19 * ((e - 0.3) / 0.7);
          s.setSize(o.w * k, o.h * k);
          s.y = o.y + (e < 0.3 ? 0 : 0.1 * o.h * ((e - 0.3) / 0.7));
          s.alpha = e < 0.3 ? 1 : 1 - (e - 0.3) / 0.7;
        },
        end: () => s.destroy(),
      });
    }
    if (was.lock !== undefined && now.lock === undefined) {
      const s = this.padlockSprite(v, was.lock);
      const o = place(s);
      this.addFx({
        jar: i, kind: 'unlock', start: performance.now(), ms: this.opts.motion.unlockMs, sprite: s,
        at: (u) => {
          const e = easeIn(Math.max(0, u));
          const lift = e < 0.25 ? 0.3 * (e / 0.25) : 0.3 + 1.6 * ((e - 0.25) / 0.75);
          const rot = e < 0.25 ? -12 * (e / 0.25) : -12 + 37 * ((e - 0.25) / 0.75);
          s.y = o.y - lift * o.h;
          s.rotation = (rot * Math.PI) / 180;
          s.alpha = e < 0.25 ? 1 : 1 - (e - 0.25) / 0.75;
          const k = e < 0.25 ? 1 : 1 - 0.2 * ((e - 0.25) / 0.75);
          s.setSize(o.w * k, o.h * k);
        },
        end: () => s.destroy(),
      });
    }
  }

  private addFx(f: Fx): void {
    this.fx.push(f);
    f.at(-1);
    this.request();
  }

  private endFx(kinds?: readonly Fx['kind'][]): void {
    const keep: Fx[] = [];
    for (const f of this.fx) {
      if (kinds && !kinds.includes(f.kind)) keep.push(f);
      else f.end();
    }
    this.fx = keep;
    this.request();
  }

  private prepareAir(target: JarGeometry, mouth: number): void {
    const { cols } = this.opts.dims;
    const rows = this.config.airRows;
    if (!this.airCanvas || this.airCanvas.width !== cols * SUB || this.airCanvas.height !== rows * SUB) {
      this.airTexture?.destroy(true);
      this.airCanvas = document.createElement('canvas');
      this.airCanvas.width = cols * SUB;
      this.airCanvas.height = rows * SUB;
      this.airCtx = this.airCanvas.getContext('2d')!;
      this.airImage = this.airCtx.createImageData(this.airCanvas.width, this.airCanvas.height);
      this.airTexels = new Uint32Array(this.airImage.data.buffer);
      this.airTexture = new Texture({ source: new CanvasSource({ resource: this.airCanvas, scaleMode: 'nearest' }) });
      this.air.texture = this.airTexture;
    }
    this.air.position.set(target.x - target.innerWidth / 2, target.y - target.gridHeight + (mouth - rows) * target.cellH);
    this.air.setSize(target.innerWidth, rows * target.cellH);
    this.air.visible = true;
  }

  private paintAirNow(p: Pour): void {
    const rows = this.config.airRows;
    paintParticles(p.sim.particles, this.opts.dims.cols, p.targetMouth - rows, rows, this.opts.palette, this.opts.neutral, this.airTexels!, SUB, true);
    this.airCtx!.putImageData(this.airImage!, 0, 0);
    this.airTexture!.source.update();
  }

  // ---- the frame loop -----------------------------------------------------------------------

  private request(): void {
    if (this.raf || document.hidden || this.lost) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.raf = 0;
    const dt = this.last ? Math.min(100, Math.max(0, now - this.last)) : 0;
    let moving = false;
    try {
      moving = this.animateFx(now) || moving;
      moving = this.animateLifts(now) || moving;
      if (this.pour) moving = this.pourFrame(this.pour, now, dt) || moving;
    } catch (e) {
      const p = this.pour;
      this.pour = null;
      p?.reject(e);
    }
    if (this.lost) return; // nothing draws on a lost context
    this.renderer.render(this.stage);
    (this.renderer.canvas as HTMLCanvasElement).dataset.frames = String(++this.frames);
    this.last = moving ? now : 0;
    if (moving) this.request();
  };

  private animateFx(now: number): boolean {
    if (!this.fx.length) return false;
    const keep: Fx[] = [];
    for (const f of this.fx) {
      const u = (now - f.start) / f.ms;
      if (u >= 1) f.end();
      else {
        f.at(u);
        keep.push(f);
      }
    }
    this.fx = keep;
    return keep.length > 0;
  }

  private animateLifts(now: number): boolean {
    let moving = false;
    const ms = this.opts.motion.selectMs;
    this.views.forEach((v, i) => {
      if (this.pour && this.pour.from === i && this.pour.phase !== 'tail') return;
      if (v.lift !== v.liftTo) {
        const u = ms > 0 ? Math.min(1, (now - v.liftStart) / ms) : 1;
        v.lift = u >= 1 ? v.liftTo : v.liftFrom + (v.liftTo - v.liftFrom) * easeLift(u);
        moving = moving || v.lift !== v.liftTo;
      }
      this.placeRest(v);
    });
    return moving;
  }

  /** One frame of a pour. Returns true while it still moves. */
  private pourFrame(p: Pour, now: number, dt: number): boolean {
    const src = this.views[p.from];
    const dst = this.views[p.to];
    const { liftMs, backMs } = this.opts.motion;
    const due = stepsDue(p.carry, dt, this.config);
    p.carry = due.carryMs;
    if (p.phase === 'move') {
      // The jar tips as it flies, like the DOM pour, but nothing spills until the lip is over the opening (strata-r8z).
      for (let k = 0; k < due.steps && !done(p.sim); k++) step(p.sim, { holdSpill: true });
      const u = Math.min(1, (now - p.start) / liftMs);
      const e = easeLift(u);
      src.root.position.set(p.startLip.x + (p.waitLip.x - p.startLip.x) * e, p.startLip.y + (p.waitLip.y - p.startLip.y) * e);
      src.root.rotation = p.side * p.sim.tilt;
      src.shadow.alpha = 1 - 0.7 * e;
      this.repaintPour(p, src, dst);
      if (u >= 1) p.phase = 'sim';
      return true;
    }
    for (let k = 0; k < due.steps && !done(p.sim); k++) step(p.sim);
    if (!p.spilled && p.sim.emitted > 0) {
      p.spilled = true;
      p.hooks.spill();
    }
    if (p.sim.landed > 0) this.ensureLanded(p);
    this.dropPendingCork(p);
    this.repaintPour(p, src, dst);
    if (p.phase === 'sim') {
      src.root.position.set(p.waitLip.x, p.waitLip.y);
      src.root.rotation = p.side * p.sim.tilt;
      if (p.sim.phase === 'settle' || done(p.sim)) {
        this.ensureLanded(p);
        this.release(p);
        p.phase = 'back';
        p.backStart = now;
      }
      return true;
    }
    if (p.phase === 'tail') {
      // Home already: the target's last grains settle, then both snap to the board.
      if (done(p.sim)) {
        this.endPour(p);
        return false;
      }
      return true;
    }
    // Flying home while the target settles.
    const u = Math.min(1, (now - p.backStart) / backMs);
    const e = easeBack(u);
    const home = { x: src.geom.x + src.root.pivot.x, y: src.geom.y + src.root.pivot.y };
    src.root.rotation = 0;
    src.root.position.set(p.waitLip.x + (home.x - p.waitLip.x) * e, p.waitLip.y + (home.y - p.waitLip.y) * e);
    src.shadow.alpha = 0.3 + 0.7 * e;
    if (u >= 1) {
      if (done(p.sim)) {
        this.endPour(p);
        return false;
      }
      // The jar is home: the pour is over for the player (input, the win card) while the sand settles.
      p.phase = 'tail';
      src.lift = 0;
      this.placeRest(src);
      src.pill?.destroy(); // home: the DOM's own count shows again
      src.pill = null;
      p.resolve();
    }
    return true;
  }

  private repaintPour(p: Pour, src: JarView, dst: JarView): void {
    const cap = this.board?.capacity ?? 4;
    this.paintSand(src, src.jar, cap);
    paintGrid(dst.grid, this.opts.palette, this.opts.neutral, dst.texels, SUB, this.paintLook(dst, dst.jar, cap));
    // Grains already inside the target fall behind its glass, in its own texture.
    paintParticles(p.sim.particles, this.opts.dims.cols, 0, this.opts.dims.rows, this.opts.palette, this.opts.neutral, dst.texels, SUB, false, p.targetMouth);
    dst.ctx.putImageData(dst.image, 0, 0);
    dst.texture.source.update();
    this.paintAirNow(p);
  }

  private dropPendingCork(p: Pour, force = false): void {
    const pending = p.sealWhenFull;
    if (!pending || (!force && p.sim.landed < p.sim.required)) return;
    p.sealWhenFull = undefined;
    this.seal(p.to, pending.jar, pending.capacity);
  }

  private ensureLanded(p: Pour): void {
    if (p.after) return;
    p.after = p.hooks.land();
    this.board = p.after;
  }

  private release(p: Pour): void {
    if (p.released) return;
    p.released = true;
    p.hooks.release();
  }

  /** Snaps both jars to the rules' board, puts the jar home and resolves the pour. */
  private endPour(p: Pour): void {
    const after = p.after!;
    finish(p.sim, after);
    const pendingCork = p.sealWhenFull;
    p.sealWhenFull = undefined;
    this.pour = null;
    this.air.visible = false;
    const src = this.views[p.from];
    const dst = this.views[p.to];
    if (p.phase !== 'tail') {
      src.lift = 0;
      src.liftTo = this.selected === p.from ? 1 : 0;
      src.liftFrom = 0;
      src.liftStart = performance.now();
    }
    this.placeRest(src);
    this.jarsLayer.addChildAt(src.root, Math.min(p.from, this.jarsLayer.children.length - 1));
    for (const [v, i] of [[src, p.from], [dst, p.to]] as const) {
      const was = v.jar;
      const jar = after.jars[i];
      if (was) this.mechanicFx(i, was, jar);
      this.redraw(v, jar, after.capacity);
      this.tracker.mark(i, jarKey(jar));
    }
    if (pendingCork) this.seal(p.to, pendingCork.jar, pendingCork.capacity);
    // The board may have moved on already (a fast tap): catch up with it.
    const now = this.board ?? after;
    this.sync(now, this.selected);
    p.resolve(); // a no-op when the tail already resolved it
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.last = 0;
      this.completePour(); // a hidden tab never leaves a pour half done
      this.endFx();
    } else this.request();
  };
}

/** A padlock's size and box, as `drawPadlock` lays it out (the texture may be cached). */
function padlockMetrics(w: number): { width: number; height: number; boxTop: number; boxHeight: number } {
  const { bw, bh } = padlockBox(w);
  const pad = 2;
  return { width: bw + 2 * pad, height: bh * 0.7 + bh + 2 * pad, boxTop: pad + bh * 0.7, boxHeight: bh };
}
