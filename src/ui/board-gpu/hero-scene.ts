/**
 * The live sand scene on Home (sprint 20 H2, D167, D169; design/ux/home.md §5.5): three jars on the
 * beach, and a funnel that slowly trickles one band into the middle jar. A small PixiJS canvas of its
 * own, drawn with the board's art and paint helpers (glass, sand, masks, worn sand texture, colour
 * patterns), and played by the real pour simulation (src/ui/sand). When the pour has settled, the
 * scene rests, then cross-fades back to the start with the next colour. Loaded on demand with Pixi,
 * so the Classic bundle carries none of it. It draws only while its owner says so (`start`/`stop`);
 * under reduced motion `start` paints one settled frame and stops.
 */
import { CanvasSource, Container, Sprite, Texture, WebGLRenderer } from 'pixi.js';
import type { Board } from '../../core/board';
import { mixSeed } from '../../core/rng';
import { type PourSim, type SandConfig, type SandDims, type SandGrid, done, grainShade, gridFromJar, planPour, step, stepsDue } from '../sand';
import { type GlassLook, type JarArt, drawJarArt } from './art';
import { type JarGeometry, jarGeometry } from './geometry';
import { type PaintLook, type Rgb, cornerMask, paintGrid, paintParticles } from './paint';
import { PATTERNS, patternOverlay, sandOverlay } from './patterns';
import { HERO_CAPACITY, HERO_START, type HeroLayout, type HeroLoop, type HeroTuning, advanceLoop, heroBoard, heroLayout } from '../logic/home-hero';

/** Texels per sand cell, as on the board. */
const SUB = 2;
/** Seeds for the side jars' grains and each loop's pour (any fixed numbers: the scene is the same every visit). */
const SIDE_SEEDS = [11, 23] as const;
const POUR_SEED = 7;
/** The funnel's sand texture, in texels. */
const FUNNEL_TEX = { w: 48, h: 36 } as const;
/** The longest frame gap the scene catches up on (ms); a longer one (a background tab) is dropped. */
const MAX_FRAME_MS = 100;

/** What the scene looks like: the scene's glass, the worn sand piece and the patterns setting. */
export interface HeroLook {
  readonly glass: GlassLook;
  readonly sand: string;
  readonly patterns: boolean;
}

/** What the scene needs from its owner. */
export interface HeroSceneOptions {
  /** The element the canvas fills (`#hero-stage`). */
  readonly host: HTMLElement;
  readonly palette: readonly Rgb[];
  readonly neutral: Rgb;
  readonly dims: SandDims;
  /** The board's sand tuning with the hero's slower spill and shorter drop. */
  readonly sand: SandConfig;
  readonly tuning: HeroTuning;
  readonly reducedMotion: () => boolean;
  /** The WebGL context was lost (true) or restored (false). */
  readonly onContext: (lost: boolean) => void;
}

interface JarView {
  readonly geom: JarGeometry;
  readonly art: JarArt;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly image: ImageData;
  readonly texels: Uint32Array;
  readonly texture: Texture;
  readonly paint: PaintLook;
  grid: SandGrid;
}

/** A canvas, its 2D context and a texture over it. */
interface Surface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly texture: Texture;
}

function surface(w: number, h: number, scaleMode: 'linear' | 'nearest', resolution = 1): Surface {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx, texture: new Texture({ source: new CanvasSource({ resource: canvas, scaleMode, resolution }) }) };
}

/** The Home hero's Pixi scene. Make it with `HeroScene.create`; it is null without WebGL. */
export class HeroScene {
  private readonly stage = new Container();
  private readonly shadows = new Container();
  private readonly jars = new Container();
  private readonly over = new Container();
  private readonly owned: Texture[] = [];
  private views: JarView[] = [];
  private box: HeroLayout | null = null;
  private look: HeroLook | null = null;
  private lookKey = '';
  private air: Surface | null = null;
  private airImage: ImageData | null = null;
  private airSprite = new Sprite();
  private funnel: Surface | null = null;
  private funnelSprite = new Sprite();
  private grain: HTMLCanvasElement | null = null;
  private ghost: Surface | null = null;
  private ghostSprite = new Sprite();
  private board: Board | null = null;
  private sim: PourSim | null = null;
  private finished = false;
  private loop: HeroLoop = HERO_START;
  private carry = 0;
  private raf = 0;
  private last = 0;
  private running = false;
  private lost = false;
  private still = false;

  private constructor(
    private readonly renderer: WebGLRenderer,
    private readonly opts: HeroSceneOptions,
  ) {
    this.stage.addChild(this.shadows, this.jars, this.over);
    this.over.addChild(this.airSprite, this.funnelSprite);
    const canvas = renderer.canvas as HTMLCanvasElement;
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
  }

  /** Starts a WebGL renderer in `opts.host` (decorative: `aria-hidden`). Null when WebGL fails. */
  static async create(opts: HeroSceneOptions): Promise<HeroScene | null> {
    try {
      const renderer = new WebGLRenderer();
      await renderer.init({
        width: Math.max(1, opts.host.clientWidth),
        height: Math.max(1, opts.host.clientHeight),
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        autoDensity: true,
        backgroundAlpha: 0,
        antialias: true,
      });
      const canvas = renderer.canvas as HTMLCanvasElement;
      canvas.className = 'hero-canvas';
      canvas.setAttribute('aria-hidden', 'true');
      opts.host.append(canvas);
      return new HeroScene(renderer, opts);
    } catch {
      return null;
    }
  }

  /** The canvas (for the owner to show or remove). */
  get canvas(): HTMLCanvasElement {
    return this.renderer.canvas as HTMLCanvasElement;
  }

  /** True while the WebGL context is lost. */
  get contextLost(): boolean {
    return this.lost;
  }

  /** Sets the look; a change rebuilds the art and redraws. */
  setLook(look: HeroLook): void {
    const key = JSON.stringify(look);
    if (key === this.lookKey) return;
    this.look = look;
    this.lookKey = key;
    this.layout();
  }

  /** Lays the scene out for the host's size and redraws (after a resize or a look change). */
  layout(): void {
    const w = this.opts.host.clientWidth;
    const h = this.opts.host.clientHeight;
    if (w < 10 || h < 10 || !this.look || this.lost) return;
    this.renderer.resize(w, h);
    this.clear();
    const { dims, tuning } = this.opts;
    this.box = heroLayout(w, h, this.opts.sand.airRows, dims.rows);
    const units = [tuning.left, tuning.middle, tuning.right];
    this.views = this.box.jars.map((b, i) => this.makeJar(b, i === 1 ? [] : units[i], i === 0 ? SIDE_SEEDS[0] : SIDE_SEEDS[1]));
    this.makeOverlays();
    if (this.still || this.opts.reducedMotion()) this.settle();
    else this.begin(this.loop.phase === 'fade' ? this.loop.cycle : this.loop.cycle, true);
    this.paint();
    this.render();
  }

  /** Runs the loop; under reduced motion paints one settled frame instead. */
  start(): void {
    this.still = this.opts.reducedMotion();
    if (this.still) {
      this.stop();
      this.settle();
      this.paint();
      this.render();
      return;
    }
    if (this.running) return;
    if (!this.sim) this.begin(this.loop.cycle, true);
    this.running = true;
    this.last = 0;
    this.request();
  }

  /** Stops drawing (Home hidden, another tab shown, the page hidden). The last frame stays. */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  /** Stops and frees everything, the canvas included. */
  destroy(): void {
    this.stop();
    this.clear();
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.renderer.destroy({ removeView: true });
  }

  private readonly onLost = (e: Event): void => {
    e.preventDefault(); // let the browser restore it
    this.lost = true;
    this.stop();
    this.opts.onContext(true);
  };

  private readonly onRestored = (): void => {
    this.lost = false;
    this.layout();
    this.opts.onContext(false);
  };

  // ---- building ----------------------------------------------------------------------------

  private own(t: Texture): Texture {
    this.owned.push(t);
    return t;
  }

  private clear(): void {
    this.shadows.removeChildren().forEach((c) => c.destroy());
    this.jars.removeChildren().forEach((c) => c.destroy({ children: true }));
    for (const t of this.owned) t.destroy(true);
    this.owned.length = 0;
    this.views = [];
  }

  private makeJar(b: { left: number; top: number; width: number; height: number; unitHeight: number }, units: readonly number[], seed: number): JarView {
    const { dims, palette } = this.opts;
    const res = this.renderer.resolution;
    const geom = jarGeometry({ left: b.left, top: b.top, width: b.width, height: b.height }, b.unitHeight, HERO_CAPACITY, dims);
    const art = drawJarArt(geom, res, this.look!.glass);
    const tex = (c: HTMLCanvasElement) => this.own(new Texture({ source: new CanvasSource({ resource: c, resolution: res }) }));
    const shadow = new Sprite(tex(art.shadow));
    shadow.anchor.set(0.5);
    shadow.setSize(art.shadowWidth, art.shadowHeight);
    shadow.position.set(geom.x, geom.y + geom.base);
    this.shadows.addChild(shadow);
    const root = new Container();
    root.position.set(geom.x, geom.y);
    const back = new Sprite(tex(art.back));
    const front = new Sprite(tex(art.front));
    for (const s of [back, front]) {
      s.position.set(art.left, art.top);
      s.setSize(art.width, art.height);
    }
    const s = surface(dims.cols * SUB, dims.rows * SUB, 'nearest');
    this.own(s.texture);
    const image = s.ctx.createImageData(s.canvas.width, s.canvas.height);
    const sand = new Sprite(s.texture);
    sand.position.set(-geom.innerWidth / 2, -geom.gridHeight);
    sand.setSize(geom.innerWidth, geom.gridHeight);
    root.addChild(back, sand, front);
    this.jars.addChild(root);
    const space = { width: s.canvas.width, height: s.canvas.height, texelW: geom.cellW / SUB, texelH: geom.cellH / SUB, unitRows: (dims.rows / HERO_CAPACITY) * SUB };
    const paint: PaintLook = {
      mask: cornerMask(space.width, space.height, (art.innerRadius / geom.cellW) * SUB, (art.innerRadius / geom.cellH) * SUB),
      texture: sandOverlay(space, this.look!.sand),
      patterns: this.look!.patterns ? palette.map((_, c) => patternOverlay(space, c % PATTERNS.length)) : null,
    };
    const grid = gridFromJar({ units, hidden: 0 }, HERO_CAPACITY, dims, seed);
    if (units.length === 0) {
      // The middle jar: its ghost (the old scene during the cross-fade) sits over its sand.
      this.ghost = surface(s.canvas.width, s.canvas.height, 'nearest');
      this.own(this.ghost.texture);
      this.ghostSprite = new Sprite(this.ghost.texture);
      this.ghostSprite.position.copyFrom(sand.position);
      this.ghostSprite.setSize(geom.innerWidth, geom.gridHeight);
      this.ghostSprite.visible = false;
      root.addChildAt(this.ghostSprite, 2);
    }
    return { geom, art, canvas: s.canvas, ctx: s.ctx, image, texels: new Uint32Array(image.data.buffer), texture: s.texture, paint, grid };
  }

  /** The air above the middle jar (falling grains) and the funnel. */
  private makeOverlays(): void {
    const { dims } = this.opts;
    const m = this.views[1].geom;
    const rows = this.opts.sand.airRows;
    this.air = surface(dims.cols * SUB, rows * SUB, 'nearest');
    this.own(this.air.texture);
    this.airImage = this.air.ctx.createImageData(this.air.canvas.width, this.air.canvas.height);
    this.airSprite.texture = this.air.texture;
    this.airSprite.position.set(m.x - m.innerWidth / 2, m.y - m.gridHeight - rows * m.cellH);
    this.airSprite.setSize(m.innerWidth, rows * m.cellH);
    const f = this.box!.funnel;
    const res = this.renderer.resolution;
    const w = f.topWidth + 12;
    const h = f.coneHeight + f.neckHeight + 10;
    this.funnel = surface(w * res, h * res, 'linear', res);
    this.own(this.funnel.texture);
    this.funnelSprite.texture = this.funnel.texture;
    this.funnelSprite.position.set(f.x - w / 2, f.y - h + 2);
    this.funnelSprite.setSize(w, h);
  }

  /** A grainy patch of the loop's colour for the funnel: the board's tone and sparkle rules. */
  private grainFor(color: number): HTMLCanvasElement {
    const c = this.opts.palette[color % this.opts.palette.length];
    const cv = document.createElement('canvas');
    cv.width = FUNNEL_TEX.w;
    cv.height = FUNNEL_TEX.h;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(cv.width, cv.height);
    for (let i = 0; i < cv.width * cv.height; i++) {
      const s = grainShade(91 + color, i); // 91: a seed offset so the funnel's grain pattern never repeats a jar's (jars seed from their own index)
      const k = 0.87 + 0.2 * (s / 255);
      const glint = s > 250 ? 90 : 0;
      img.data[i * 4] = Math.min(255, c.r * k + glint);
      img.data[i * 4 + 1] = Math.min(255, c.g * k + glint);
      img.data[i * 4 + 2] = Math.min(255, c.b * k + glint);
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  // ---- the loop ----------------------------------------------------------------------------

  /** Plans loop `cycle`'s pour. `fresh` resets the loop to its pour phase. */
  private begin(cycle: number, fresh: boolean): void {
    this.board = heroBoard(this.opts.tuning, cycle);
    const cols = this.opts.dims.cols;
    this.sim = planPour(this.board, 0, 1, this.opts.dims, mixSeed(POUR_SEED, cycle), { config: this.opts.sand, streamCol: cols / 2, streamWidth: 1, side: 1 });
    // The middle jar's own bands go under the stream before the first step (see heroBoard).
    const base = gridFromJar({ units: this.opts.tuning.middle, hidden: 0 }, HERO_CAPACITY, this.opts.dims, mixSeed(POUR_SEED, cycle + 1));
    this.sim.target.cells.set(base.cells);
    this.sim.target.shade.set(base.shade);
    this.finished = false;
    this.carry = 0;
    this.grain = this.grainFor(this.board.jars[0].units[0]);
    if (fresh) this.loop = { phase: 'pour', ms: 0, cycle };
    if (this.views[1]) this.views[1].grid = this.sim.target;
  }

  /** The reduced-motion still: the middle jar with the band settled, the funnel empty, no stream. */
  private settle(): void {
    const t = this.opts.tuning;
    this.sim = null;
    this.grain = null;
    if (this.views[1]) this.views[1].grid = gridFromJar({ units: [...t.middle, t.tops[0]], hidden: 0 }, HERO_CAPACITY, this.opts.dims, POUR_SEED);
    this.ghostSprite.visible = false;
    this.funnelSprite.alpha = 1;
  }

  private request(): void {
    if (this.raf || !this.running || this.lost || document.hidden) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    this.raf = 0;
    if (!this.running || this.lost) return;
    const dt = this.last ? Math.min(MAX_FRAME_MS, now - this.last) : 0;
    this.last = now;
    const before = this.loop;
    if (this.loop.phase === 'pour' && this.sim) {
      const due = stepsDue(this.carry, dt, this.opts.sand);
      this.carry = due.carryMs;
      for (let i = 0; i < due.steps && !done(this.sim); i++) step(this.sim);
      // No snap at the end: the grains already rest where the simulation left them.
      if (done(this.sim)) this.finished = true;
    }
    this.loop = advanceLoop(this.loop, dt, this.finished, this.opts.tuning);
    if (before.phase === 'rest' && this.loop.phase === 'fade') {
      // Keep the settled picture as the ghost, then start the next loop under it.
      this.paint();
      this.ghost!.ctx.clearRect(0, 0, this.ghost!.canvas.width, this.ghost!.canvas.height);
      this.ghost!.ctx.drawImage(this.views[1].canvas, 0, 0);
      this.ghost!.texture.source.update();
      this.begin(this.loop.cycle, false);
    }
    const fading = this.loop.phase === 'fade';
    const u = fading ? Math.min(1, this.loop.ms / this.opts.tuning.fadeMs) : 1;
    this.ghostSprite.visible = fading;
    this.ghostSprite.alpha = 1 - u;
    this.funnelSprite.alpha = u;
    this.paint();
    this.render();
    this.request();
  };

  // ---- drawing -----------------------------------------------------------------------------

  private paint(): void {
    const { palette, neutral, dims } = this.opts;
    for (const v of this.views) {
      paintGrid(v.grid, palette, neutral, v.texels, SUB, v.paint);
      if (v === this.views[1] && this.sim) paintParticles(this.sim.particles, dims.cols, 0, dims.rows, palette, neutral, v.texels, SUB, false, 0);
      v.ctx.putImageData(v.image, 0, 0);
      v.texture.source.update();
    }
    if (this.air && this.airImage) {
      const texels = new Uint32Array(this.airImage.data.buffer);
      const rows = this.opts.sand.airRows;
      if (this.sim) paintParticles(this.sim.particles, dims.cols, -rows, rows, palette, neutral, texels, SUB, true);
      else texels.fill(0);
      this.air.ctx.putImageData(this.airImage, 0, 0);
      this.air.texture.source.update();
    }
    this.drawFunnel();
  }

  /** The frosted funnel, its sand dipping into a crater over the neck as it drains. */
  private drawFunnel(): void {
    if (!this.funnel || !this.box || !this.look) return;
    const { ctx: g, canvas } = this.funnel;
    const res = this.renderer.resolution;
    const f = this.box.funnel;
    const night = this.look.glass.night;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(res, 0, 0, res, 0, 0);
    const cx = (f.topWidth + 12) / 2;
    const yTop = 5;
    const yNeck = yTop + f.coneHeight;
    const yEnd = yNeck + f.neckHeight;
    const cone = () => {
      g.beginPath();
      g.moveTo(cx - f.topWidth / 2, yTop);
      g.lineTo(cx + f.topWidth / 2, yTop);
      g.lineTo(cx + f.neckWidth / 2, yNeck);
      g.lineTo(cx + f.neckWidth / 2, yEnd);
      g.lineTo(cx - f.neckWidth / 2, yEnd);
      g.lineTo(cx - f.neckWidth / 2, yNeck);
      g.closePath();
    };
    g.save();
    cone();
    g.fillStyle = night ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)';
    g.fill();
    g.clip();
    const sim = this.sim;
    const left = sim ? 1 - sim.emitted / Math.max(1, sim.required) : 0;
    if (this.grain && left > 0.002) {
      const level = yTop + f.coneHeight * (1 - Math.sqrt(left)) + 2;
      g.beginPath();
      g.moveTo(cx - f.topWidth, level);
      g.quadraticCurveTo(cx, level + 7, cx + f.topWidth, level);
      g.lineTo(cx + f.topWidth, yEnd + 2);
      g.lineTo(cx - f.topWidth, yEnd + 2);
      g.closePath();
      g.clip();
      g.imageSmoothingEnabled = false;
      g.drawImage(this.grain, cx - f.topWidth / 2, yTop, f.topWidth, yEnd - yTop + 2);
    }
    g.restore();
    g.save();
    cone();
    const shade = g.createLinearGradient(cx - f.topWidth / 2, 0, cx + f.topWidth / 2, 0);
    shade.addColorStop(0, 'rgba(30,38,44,0.10)');
    shade.addColorStop(0.3, 'rgba(255,255,255,0.10)');
    shade.addColorStop(1, 'rgba(30,38,44,0.14)');
    g.fillStyle = shade;
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = this.look.glass.edge;
    g.stroke();
    g.beginPath();
    g.roundRect(cx - f.topWidth / 2 - 3, yTop - 3, f.topWidth + 6, 5, 2.5);
    g.fillStyle = night ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.6)';
    g.fill();
    g.stroke();
    g.restore();
    this.funnel.texture.source.update();
  }

  private render(): void {
    if (this.lost) return;
    this.renderer.render(this.stage);
    this.canvas.dataset.frames = String(Number(this.canvas.dataset.frames ?? 0) + 1);
  }
}
