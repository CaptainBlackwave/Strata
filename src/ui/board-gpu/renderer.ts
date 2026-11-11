/**
 * The PixiJS board (sprint 19 S2, docs/architecture/adr-0001-gpu-sand-board.md). One WebGL canvas
 * behind `#board` draws every jar's glass and sand where today's layout puts the jar buttons; the
 * buttons stay on top as the input layer (S4). It draws only when something changes: there is no
 * Pixi ticker, only a requestAnimationFrame loop that runs while a lift or a pour moves, and stops
 * when the tab is hidden. Loaded on demand, so the DOM board's bundle carries none of Pixi.
 */
import { CanvasSource, Container, Sprite, Texture, WebGLRenderer } from 'pixi.js';
import type { Board } from '../../core/board';
import { type PourSim, type SandConfig, type SandDims, type SandGrid, bandRows, done, finish, gridFromJar, planPour, sandConfig, step, stepsDue } from '../sand';
import { type JarArt, drawJarArt, drawMark } from './art';
import { DirtyTracker, jarKey } from './dirty';
import { type JarGeometry, cubicBezier, lipLocal, pourLip, pourSide } from './geometry';
import { type Rgb, cornerMask, paintAir, paintGrid } from './paint';

/** Texels per sand cell along each axis: each grain gets a little texture of its own. */
const SUB = 2;

/** Motion timings and curves, taken from the DOM board so both feel the same. */
export interface GpuMotion {
  /** The lift to the pour position (ms) and its CSS easing. */
  readonly liftMs: number;
  /** The flight home (ms). */
  readonly backMs: number;
  /** The selection lift's transition (ms), as `.jar`'s `transition` in style.css. */
  readonly selectMs: number;
}

/** What the board asks of the game while a pour plays. */
export interface PourHooks {
  /** The first grain leaves the lip (the pour sound). */
  spill(): void;
  /** The first grain reaches the target: apply the rules' pour and return the board after it. Called once. */
  land(): Board;
  /** The source tips back upright: the player may act again while it flies home. */
  release(): void;
}

/** The renderer's construction options. */
export interface GpuBoardOptions {
  readonly host: HTMLElement;
  readonly palette: readonly Rgb[];
  readonly neutral: Rgb;
  readonly motion: GpuMotion;
  readonly reducedMotion: () => boolean;
  readonly dims: SandDims;
  readonly config?: SandConfig;
}

interface JarView {
  readonly root: Container;
  readonly back: Sprite;
  readonly sand: Sprite;
  readonly marks: Container;
  readonly front: Sprite;
  readonly shadow: Sprite;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly image: ImageData;
  readonly texels: Uint32Array;
  readonly texture: Texture;
  grid: SandGrid;
  geom: JarGeometry;
  lift: number;
  liftFrom: number;
  liftTo: number;
  liftStart: number;
}

interface Pour {
  readonly from: number;
  readonly to: number;
  readonly sim: PourSim;
  readonly side: 1 | -1;
  readonly hooks: PourHooks;
  readonly resolve: () => void;
  readonly reject: (e: unknown) => void;
  /** Where the lip starts (at rest, with the current lift) and waits over the target. */
  readonly startLip: { x: number; y: number };
  readonly waitLip: { x: number; y: number };
  readonly start: number;
  phase: 'move' | 'sim' | 'back';
  backStart: number;
  carry: number;
  spilled: boolean;
  after: Board | null;
  released: boolean;
}

const easeLift = cubicBezier(0.3, 0.7, 0.4, 1);
const easeBack = cubicBezier(0.4, 0, 0.3, 1);

/** The PixiJS jar board. Create with `GpuBoard.create`; `null` when WebGL fails. */
export class GpuBoard {
  private readonly stage = new Container();
  private readonly shadows = new Container();
  private readonly jarsLayer = new Container();
  private readonly air = new Sprite();
  private views: JarView[] = [];
  private art: JarArt | null = null;
  private artKey = '';
  private backTex: Texture | null = null;
  private frontTex: Texture | null = null;
  private shadowTex: Texture | null = null;
  private markTex: Texture | null = null;
  private airCanvas: HTMLCanvasElement | null = null;
  private airCtx: CanvasRenderingContext2D | null = null;
  private airImage: ImageData | null = null;
  private airTexels: Uint32Array | null = null;
  private airTexture: Texture | null = null;
  private mask: Uint8Array | null = null;
  private readonly tracker = new DirtyTracker();
  private board: Board | null = null;
  private selected: number | null = null;
  private pour: Pour | null = null;
  private raf = 0;
  private frames = 0;
  private readonly config: SandConfig;

  private constructor(
    private readonly renderer: WebGLRenderer,
    private readonly opts: GpuBoardOptions,
  ) {
    this.config = opts.config ?? sandConfig;
    this.stage.addChild(this.shadows, this.jarsLayer, this.air);
    this.air.visible = false;
    document.addEventListener('visibilitychange', this.onVisibility);
  }

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

  /** Shows or hides the whole canvas (a board on the DOM fallback hides it). */
  setVisible(on: boolean): void {
    (this.renderer.canvas as HTMLCanvasElement).hidden = !on;
    if (!on) this.completePour();
  }

  /**
   * Lays the jars out at `geoms` (one per jar, read from the buttons) for `board`, and redraws
   * everything. Called after every DOM layout, resize and orientation change.
   */
  layout(geoms: readonly JarGeometry[], board: Board, selected: number | null): void {
    this.completePour();
    this.renderer.resize(window.innerWidth, window.innerHeight);
    const g0 = geoms[0];
    if (!g0) return;
    const res = this.renderer.resolution;
    const key = [g0.glass.width, g0.glass.height, g0.cellH, res, board.capacity].map((v) => v.toFixed(2)).join('/');
    if (key !== this.artKey) this.buildArt(g0, board.capacity, res, key);
    while (this.views.length > geoms.length) this.destroyView(this.views.pop()!);
    while (this.views.length < geoms.length) this.views.push(this.makeView(geoms[this.views.length]));
    this.views.forEach((v, i) => {
      v.geom = geoms[i];
      this.placeArt(v);
    });
    this.tracker.reset();
    this.sync(board, selected, true);
  }

  /**
   * Brings the canvas up to `board` and the selection: redraws only jars whose units changed, and
   * eases the selected jar's lift. A pour in progress owns its two jars until it ends; a board
   * change after it released the input snaps it to its end first (Undo, Restart, a new pour).
   */
  sync(board: Board, selected: number | null, instant = false): void {
    if (board.jars.length !== this.views.length) return;
    const p = this.pour;
    if (p && p.released && board !== p.after) this.completePour();
    this.board = board;
    const keys = board.jars.map(jarKey);
    const owned = this.pour ? [this.pour.from, this.pour.to] : [];
    for (const i of this.tracker.diff(keys)) {
      if (owned.includes(i)) continue;
      const v = this.views[i];
      v.grid = gridFromJar(board.jars[i], board.capacity, this.opts.dims, 1 + i * 7919);
      this.paint(v, board, i);
    }
    // Owned jars are re-marked as undrawn so they are redrawn if the pour is cancelled.
    for (const i of owned) this.tracker.mark(i, '');
    this.selected = selected;
    const now = performance.now();
    this.views.forEach((v, i) => {
      const to = selected === i && !(this.pour && this.pour.from === i) ? 1 : 0;
      if (to === v.liftTo && !instant) return;
      v.liftFrom = v.lift;
      v.liftTo = to;
      v.liftStart = now;
      if (instant || this.opts.reducedMotion()) v.lift = to;
    });
    this.request();
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
    const sim = planPour(board, from, to, this.opts.dims, seed, { side, config: this.config });
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
    this.prepareAir(dst.geom);
    return new Promise<void>((resolve, reject) => {
      this.pour = {
        from, to, sim, side, hooks, resolve, reject, startLip,
        waitLip: pourLip(dst.geom, side, this.config.airRows),
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

  // ---- drawing -------------------------------------------------------------------------------

  private buildArt(g: JarGeometry, capacity: number, res: number, key: string): void {
    for (const t of [this.backTex, this.frontTex, this.shadowTex, this.markTex]) t?.destroy(true);
    this.art = drawJarArt(g, res);
    this.artKey = key;
    const tex = (c: HTMLCanvasElement) => new Texture({ source: new CanvasSource({ resource: c, resolution: res, scaleMode: 'linear' }) });
    this.backTex = tex(this.art.back);
    this.frontTex = tex(this.art.front);
    this.shadowTex = tex(this.art.shadow);
    this.markTex = tex(drawMark(g.cellH * bandRows(capacity, this.opts.dims), res));
    const { cols, rows } = this.opts.dims;
    const r = this.art.innerRadius;
    this.mask = cornerMask(cols * SUB, rows * SUB, (r / g.cellW) * SUB, (r / g.cellH) * SUB);
    for (const v of this.views) {
      v.back.texture = this.backTex;
      v.front.texture = this.frontTex;
      v.shadow.texture = this.shadowTex;
    }
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
      back: new Sprite(this.backTex!),
      sand: new Sprite(texture),
      marks: new Container(),
      front: new Sprite(this.frontTex!),
      shadow: new Sprite(this.shadowTex!),
      canvas, ctx, image, texels: new Uint32Array(image.data.buffer), texture,
      grid: gridFromJar({ units: [], hidden: 0 }, 1, this.opts.dims),
      geom, lift: 0, liftFrom: 0, liftTo: 0, liftStart: 0,
    };
    v.root.addChild(v.back, v.sand, v.marks, v.front);
    this.shadows.addChild(v.shadow);
    this.jarsLayer.addChild(v.root);
    return v;
  }

  private destroyView(v: JarView): void {
    v.root.destroy({ children: true });
    v.shadow.destroy();
    v.texture.destroy(true);
  }

  private placeArt(v: JarView): void {
    const a = this.art!;
    const g = v.geom;
    v.back.position.set(a.left, a.top);
    v.front.position.set(a.left, a.top);
    v.back.setSize(a.width, a.height);
    v.front.setSize(a.width, a.height);
    v.sand.position.set(-g.innerWidth / 2, -g.gridHeight);
    v.sand.setSize(g.innerWidth, g.gridHeight);
    v.shadow.anchor.set(0.5);
    v.shadow.setSize(a.shadowWidth, a.shadowHeight);
    v.shadow.position.set(g.x, g.y + g.base);
    this.placeRest(v);
  }

  /** Puts a jar at rest, with its current lift. */
  private placeRest(v: JarView): void {
    v.root.pivot.set(0, 0);
    v.root.rotation = 0;
    v.root.position.set(v.geom.x, v.geom.y - v.lift * v.geom.lift);
    v.shadow.alpha = 1 - 0.35 * v.lift;
  }

  private paint(v: JarView, board: Board, i: number): void {
    paintGrid(v.grid, this.opts.palette, this.opts.neutral, v.texels, SUB, this.mask ?? undefined);
    v.ctx.putImageData(v.image, 0, 0);
    v.texture.source.update();
    this.drawMarks(v, board.jars[i].hidden, board.capacity);
  }

  /** The "?" on each hidden unit: hidden units sit at the bottom and never move in a pour. */
  private drawMarks(v: JarView, hidden: number, capacity: number): void {
    const unit = v.geom.cellH * bandRows(capacity, this.opts.dims);
    v.marks.removeChildren().forEach((m) => m.destroy());
    for (let k = 0; k < hidden; k++) {
      const m = new Sprite(this.markTex!);
      m.anchor.set(0.5);
      m.setSize(unit, unit);
      m.position.set(0, -(k + 0.5) * unit);
      v.marks.addChild(m);
    }
  }

  private prepareAir(target: JarGeometry): void {
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
    this.air.position.set(target.x - target.innerWidth / 2, target.y - target.gridHeight - rows * target.cellH);
    this.air.setSize(target.innerWidth, rows * target.cellH);
    this.air.visible = true;
  }

  private paintAirNow(p: Pour): void {
    paintAir(p.sim.particles, this.opts.dims.cols, this.config.airRows, this.opts.palette, this.opts.neutral, this.airTexels!, SUB);
    this.airCtx!.putImageData(this.airImage!, 0, 0);
    this.airTexture!.source.update();
  }

  // ---- the frame loop -----------------------------------------------------------------------

  private request(): void {
    if (this.raf || document.hidden) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private last = 0;

  private readonly frame = (now: number): void => {
    this.raf = 0;
    const dt = this.last ? Math.min(100, Math.max(0, now - this.last)) : 0;
    let moving = false;
    try {
      moving = this.animateLifts(now) || moving;
      if (this.pour) moving = this.pourFrame(this.pour, now, dt) || moving;
    } catch (e) {
      const p = this.pour;
      this.pour = null;
      p?.reject(e);
    }
    this.renderer.render(this.stage);
    (this.renderer.canvas as HTMLCanvasElement).dataset.frames = String(++this.frames);
    this.last = moving ? now : 0;
    if (moving) this.request();
  };

  private animateLifts(now: number): boolean {
    let moving = false;
    const ms = this.opts.motion.selectMs;
    this.views.forEach((v, i) => {
      if (this.pour && this.pour.from === i) return;
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
    if (p.phase === 'move') {
      const u = Math.min(1, (now - p.start) / liftMs);
      const e = easeLift(u);
      src.root.position.set(p.startLip.x + (p.waitLip.x - p.startLip.x) * e, p.startLip.y + (p.waitLip.y - p.startLip.y) * e);
      src.shadow.alpha = 1 - 0.7 * e;
      if (u >= 1) p.phase = 'sim';
      return true;
    }
    const due = stepsDue(p.carry, dt, this.config);
    p.carry = due.carryMs;
    for (let k = 0; k < due.steps && !done(p.sim); k++) step(p.sim);
    if (!p.spilled && p.sim.emitted > 0) {
      p.spilled = true;
      p.hooks.spill();
    }
    if (p.sim.landed > 0) this.ensureLanded(p);
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
    // Flying home while the target settles.
    const u = Math.min(1, (now - p.backStart) / backMs);
    const e = easeBack(u);
    const home = { x: src.geom.x + src.root.pivot.x, y: src.geom.y + src.root.pivot.y };
    src.root.rotation = 0;
    src.root.position.set(p.waitLip.x + (home.x - p.waitLip.x) * e, p.waitLip.y + (home.y - p.waitLip.y) * e);
    src.shadow.alpha = 0.3 + 0.7 * e;
    if (u >= 1 && done(p.sim)) {
      this.endPour(p);
      return false;
    }
    return true;
  }

  private repaintPour(p: Pour, src: JarView, dst: JarView): void {
    paintGrid(src.grid, this.opts.palette, this.opts.neutral, src.texels, SUB, this.mask ?? undefined);
    src.ctx.putImageData(src.image, 0, 0);
    src.texture.source.update();
    paintGrid(dst.grid, this.opts.palette, this.opts.neutral, dst.texels, SUB, this.mask ?? undefined);
    dst.ctx.putImageData(dst.image, 0, 0);
    dst.texture.source.update();
    this.paintAirNow(p);
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
    this.pour = null;
    this.air.visible = false;
    const src = this.views[p.from];
    const dst = this.views[p.to];
    src.lift = 0;
    src.liftTo = this.selected === p.from ? 1 : 0;
    src.liftFrom = 0;
    src.liftStart = performance.now();
    this.placeRest(src);
    this.jarsLayer.addChildAt(src.root, Math.min(p.from, this.jarsLayer.children.length - 1));
    this.paint(src, after, p.from);
    this.paint(dst, after, p.to);
    this.tracker.mark(p.from, jarKey(after.jars[p.from]));
    this.tracker.mark(p.to, jarKey(after.jars[p.to]));
    // The board may have moved on already (a fast tap): catch up with it.
    const now = this.board ?? after;
    this.sync(now, this.selected);
    p.resolve();
  }

  private readonly onVisibility = (): void => {
    if (document.hidden) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.last = 0;
      this.completePour(); // a hidden tab never leaves a pour half done
    } else this.request();
  };
}
