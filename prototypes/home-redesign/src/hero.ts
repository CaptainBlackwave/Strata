// PROTOTYPE - NOT FOR PRODUCTION
// Question: is a calm hero-and-tabs Home clearly better than today's stacked Home? (sprint 20 H1)
// Date: 2026-11-12
//
// The hero: three jars of layered sand in the Realistic look, painted with the real GPU board's
// sand painter (src/ui/board-gpu/paint.ts) and glass art (src/ui/board-gpu/art.ts) on a plain 2D
// canvas, so the mock-up needs no Pixi. A glass funnel slowly trickles sand into the middle jar;
// when the funnel is empty the scene cross-fades back to the start and the loop begins again.
import { cornerMask, hexToRgb, paintGrid, type Rgb } from '../../../src/ui/board-gpu/paint';
import { drawJarArt, innerRadius, DEFAULT_LOOK, type GlassLook, type JarArt } from '../../../src/ui/board-gpu/art';
import type { JarGeometry } from '../../../src/ui/board-gpu/geometry';
import { createGrid, grainShade, EMPTY, type SandGrid } from '../../../src/ui/sand/grid';
import config from '../../../src/config/game-config.json';

const PALETTE: Rgb[] = (config as { palette: { hex: string }[] }).palette.map((p) => hexToRgb(p.hex));
const NEUTRAL = hexToRgb('#b9a88d');
const C = { terracotta: 0, saffron: 1, sage: 2, lagoon: 3, coral: 4, plum: 5, denim: 6, lemon: 7, cocoa: 8, mint: 9, lavender: 12, sky: 13 };
/** Units of the bands are 0..n, bottom first. The middle jar's top band is the trickle's. */
const MIDDLE = [C.terracotta, C.saffron, C.lagoon];
const TOPS = [C.coral, C.lemon, C.mint, C.lavender];
const LEFT = [C.denim, C.sage, C.plum, C.saffron];
const RIGHT = [C.cocoa, C.coral, C.sky, C.lemon];
/** Bands a jar holds at full (the fourth is the middle jar's trickle). */
const CAP = 4;
const SUB = 2;
const NIGHT: GlassLook = { edge: 'rgba(214,226,242,0.6)', body: 'rgba(255,255,255,0.1)', band: 'transparent', rim: 'rgba(255,255,255,0.16)', shadow: 'rgb(0,0,0)', night: true };

interface Jar {
  cx: number;
  baseY: number;
  iw: number;
  ih: number;
  cellW: number;
  band: number;
  grid: SandGrid;
  art: JarArt;
  tex: HTMLCanvasElement;
  buf: Uint32Array;
  mask: Uint8Array;
  dirty: boolean;
}

interface Grain {
  x: number;
  y: number;
  vy: number;
  shade: number;
}

/** Fills `units` bands, bottom first, with fresh shades from `seed`. */
function fill(grid: SandGrid, band: number, units: number[], seed: number): void {
  const { cols, rows, cells, shade } = grid;
  cells.fill(EMPTY);
  shade.fill(0);
  units.forEach((u, k) => {
    for (let y = rows - (k + 1) * band; y < rows - k * band; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        cells[i] = u + 1;
        shade[i] = grainShade(seed, i);
      }
    }
  });
}

/** The animated hero. `start()` runs the loop; under reduced motion it draws one settled frame. */
export class Hero {
  private readonly ctx: CanvasRenderingContext2D;
  private jars: Jar[] = [];
  private stream: Grain[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private look: GlassLook = DEFAULT_LOOK;
  private poured = 0;
  private total = 0;
  private quiet = 0;
  private cycle = 0;
  private hold = 0;
  private fade: HTMLCanvasElement | null = null;
  private fadeT = 0;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private seed = 7;
  private funnelTex: HTMLCanvasElement | null = null;
  private running = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly reduced: () => boolean) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D canvas');
    this.ctx = ctx;
    new ResizeObserver(() => this.layout()).observe(canvas);
  }

  /** Light or night glass; repaints. */
  setNight(night: boolean): void {
    this.look = night ? NIGHT : DEFAULT_LOOK;
    this.layout();
  }

  /** Runs (or, under reduced motion, paints one still frame). */
  start(): void {
    this.running = true;
    cancelAnimationFrame(this.raf);
    if (this.reduced()) {
      this.settleStill();
      this.draw();
      return;
    }
    this.last = performance.now();
    const tick = (t: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (t - this.last) / 1000);
      this.last = t;
      this.acc += dt * 60;
      let n = 0;
      while (this.acc >= 1 && n < 3) {
        this.step();
        this.acc -= 1;
        n++;
      }
      if (n === 3) this.acc = 0;
      if (this.fade) this.fadeT += dt / 1.6;
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  /** Stops drawing (another tab is shown, or the page is hidden). */
  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private layout(): void {
    const r = this.canvas.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.w = r.width;
    this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    const W = this.w;
    const baseY = this.h - 26;
    const big = Math.min(W * 0.3, (this.h - 120) * 0.5);
    const small = big * 0.76;
    const mk = (cx: number, iw: number, ih: number, units: number[], seed: number): Jar => {
      const cols = Math.max(20, Math.round(iw / 2.4));
      const cellW = iw / cols;
      const rows = Math.floor((ih - 6) / cellW);
      const band = Math.floor((rows * 0.9) / CAP);
      const grid = createGrid({ cols, rows });
      fill(grid, band, units, seed);
      const g = { glass: { left: 0, top: 0, width: iw + 8, height: ih + 6 }, wall: 3, base: Math.max(8, iw * 0.09), innerWidth: iw, innerHeight: ih } as unknown as JarGeometry;
      const art = drawJarArt(g, this.dpr, this.look);
      const tw = cols * SUB;
      const th = rows * SUB;
      const tex = document.createElement('canvas');
      tex.width = tw;
      tex.height = th;
      const rad = innerRadius(g) / (cellW / SUB);
      return { cx, baseY, iw, ih, cellW, band, grid, art, tex, buf: new Uint32Array(tw * th), mask: cornerMask(tw, th, rad, rad), dirty: true };
    };
    const prev = this.jars[1];
    this.jars = [
      mk(W / 2 - big * 1.12, small, small * 1.95, LEFT, 11),
      mk(W / 2, big, big * 2.05, MIDDLE, 7),
      mk(W / 2 + big * 1.12, small, small * 1.95, RIGHT, 23),
    ];
    // Side jars stand a little behind: higher on the beach.
    this.jars[0].baseY -= 10;
    this.jars[2].baseY -= 10;
    const m = this.jars[1];
    this.total = m.grid.cols * m.band;
    if (prev && prev.grid.cols === m.grid.cols && prev.grid.rows === m.grid.rows) {
      m.grid.cells.set(prev.grid.cells);
      m.grid.shade.set(prev.grid.shade);
    } else {
      this.poured = 0;
      this.stream = [];
    }
    this.funnelTex = this.grainTexture(PALETTE[TOPS[this.cycle % TOPS.length]], 120, 80);
    if (this.reduced()) this.settleStill();
    this.draw();
  }

  /** A grainy patch of one colour, for the funnel's sand. Same tone rules as the board. */
  private grainTexture(c: Rgb, w: number, h: number): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d')!;
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const s = grainShade(91, (i >> 1) - (((i / w) | 0) % 2) * 0);
      const k = 0.87 + 0.2 * (s / 255);
      img.data[i * 4] = Math.min(255, c.r * k + (s > 250 ? 90 : 0));
      img.data[i * 4 + 1] = Math.min(255, c.g * k + (s > 250 ? 90 : 0));
      img.data[i * 4 + 2] = Math.min(255, c.b * k + (s > 250 ? 90 : 0));
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return cv;
  }

  /** The reduced-motion still: the middle jar with its top band settled, no stream. */
  private settleStill(): void {
    const m = this.jars[1];
    if (!m) return;
    fill(m.grid, m.band, [...MIDDLE, TOPS[0]], 7);
    this.poured = this.total;
    this.stream = [];
    m.dirty = true;
  }

  private spout(): { x: number; y: number } {
    const m = this.jars[1];
    return { x: m.cx, y: m.baseY - m.ih - 30 };
  }

  /** One simulation step: the stream falls, grains pile and creep level, the loop resets. */
  private step(): void {
    const m = this.jars[1];
    if (!m) return;
    const { cols, rows, cells, shade } = m.grid;
    const top = TOPS[this.cycle % TOPS.length] + 1;
    // The funnel lets out about one grain a step (a thin, slow trickle).
    if (this.poured < this.total && !this.fade) {
      const n = Math.random() < 0.6 ? 1 : 2;
      for (let k = 0; k < n && this.poured < this.total; k++) {
        const air = (m.baseY - m.ih - this.spout().y) / m.cellW;
        this.stream.push({ x: cols / 2 + (Math.random() - 0.5) * 1.6, y: -air, vy: 0.25, shade: (Math.random() * 256) | 0 });
        this.poured++;
      }
    }
    // Grains in the air.
    const keep: Grain[] = [];
    for (const p of this.stream) {
      p.vy = Math.min(1.6, p.vy + 0.06);
      p.y += p.vy;
      if (p.y >= 0) {
        let x = Math.max(0, Math.min(cols - 1, Math.round(p.x)));
        if (cells[x] !== EMPTY) {
          const alt = [x - 1, x + 1, x - 2, x + 2].find((v) => v >= 0 && v < cols && cells[v] === EMPTY);
          if (alt === undefined) continue;
          x = alt;
        }
        cells[x] = top;
        shade[x] = p.shade;
        continue;
      }
      keep.push(p);
    }
    this.stream = keep;
    // Gravity inside the jar, bottom up; then the slow creep that levels the pile.
    let moved = 0;
    const heights = new Int16Array(cols);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = rows - 2; y >= 0; y--) {
        const flip = (y + pass) & 1;
        for (let j = 0; j < cols; j++) {
          const x = flip ? cols - 1 - j : j;
          const i = y * cols + x;
          if (cells[i] === EMPTY) continue;
          const below = i + cols;
          if (cells[below] === EMPTY) {
            cells[below] = cells[i];
            shade[below] = shade[i];
            cells[i] = EMPTY;
            moved++;
            continue;
          }
          const d = Math.random() < 0.5 ? -1 : 1;
          for (const dx of [d, -d]) {
            const nx = x + dx;
            if (nx < 0 || nx >= cols) continue;
            if (cells[i + dx] === EMPTY && cells[below + dx] === EMPTY) {
              cells[below + dx] = cells[i];
              shade[below + dx] = shade[i];
              cells[i] = EMPTY;
              moved++;
              break;
            }
          }
        }
      }
    }
    for (let x = 0; x < cols; x++) {
      let y = 0;
      while (y < rows && cells[y * cols + x] === EMPTY) y++;
      heights[x] = y;
    }
    for (let r = 0; r < 2; r++) for (let x = 0; x < cols; x++) {
      const y = heights[x];
      if (y >= rows || Math.random() > 0.45) continue;
      for (const d of Math.random() < 0.5 ? [-1, 1] : [1, -1]) {
        let lower = false;
        for (let k = 1; k <= 7; k++) {
          const nx = x + d * k;
          if (nx < 0 || nx >= cols) break;
          if (heights[nx] >= y + 2) lower = true;
        }
        const nx = x + d;
        if (lower && nx >= 0 && nx < cols && cells[y * cols + nx] === EMPTY) {
          const i = y * cols + x;
          cells[i + d] = cells[i];
          shade[i + d] = shade[i];
          cells[i] = EMPTY;
          heights[x]++;
          moved++;
          break;
        }
      }
    }
    m.dirty = true;
    this.quiet = moved === 0 && this.stream.length === 0 ? this.quiet + 1 : 0;
    // The loop: the funnel is empty and the sand has settled, rest a moment, then fade back.
    if (this.poured >= this.total && this.quiet > 30 && !this.fade) {
      this.hold++;
      if (this.hold > 240) {
        this.hold = 0;
        this.fade = document.createElement('canvas');
        this.fade.width = this.canvas.width;
        this.fade.height = this.canvas.height;
        this.fade.getContext('2d')!.drawImage(this.canvas, 0, 0);
        this.fadeT = 0;
        this.cycle++;
        this.seed += 13;
        fill(m.grid, m.band, MIDDLE, this.seed);
        this.poured = 0;
        this.funnelTex = this.grainTexture(PALETTE[TOPS[this.cycle % TOPS.length]], 120, 80);
      }
    }
    if (this.fade && this.fadeT >= 1) this.fade = null;
  }

  private draw(): void {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Back to front: shadows, then each jar (back glass, sand, front glass), funnel, stream.
    for (const j of this.jars) {
      const a = j.art;
      g.drawImage(a.shadow, j.cx - a.shadowWidth / 2, j.baseY + j.art.height - a.shadowHeight / 2 + a.top - 2, a.shadowWidth, a.shadowHeight);
    }
    const order = [0, 2, 1];
    for (const k of order) {
      const j = this.jars[k];
      if (!j) continue;
      const a = j.art;
      g.drawImage(a.back, j.cx + a.left, j.baseY + a.top, a.width, a.height);
      if (j.dirty) {
        paintGrid(j.grid, PALETTE, NEUTRAL, j.buf, SUB, { mask: j.mask });
        const img = new ImageData(new Uint8ClampedArray(j.buf.buffer, j.buf.byteOffset, j.buf.byteLength), j.tex.width, j.tex.height);
        j.tex.getContext('2d')!.putImageData(img, 0, 0);
        j.dirty = false;
      }
      const gh = j.grid.rows * j.cellW;
      g.imageSmoothingEnabled = false;
      // Night: the sand is moonlit, a touch dimmer and cooler than by day.
      if (this.look.night) g.filter = 'brightness(0.86) saturate(0.92)';
      g.drawImage(j.tex, j.cx - j.iw / 2, j.baseY - gh, j.iw, gh);
      g.filter = 'none';
      g.imageSmoothingEnabled = true;
      g.drawImage(a.front, j.cx + a.left, j.baseY + a.top, a.width, a.height);
    }
    this.drawFunnel();
    const m = this.jars[1];
    if (m) {
      const c = PALETTE[TOPS[this.cycle % TOPS.length]];
      const mouth = m.baseY - m.grid.rows * m.cellW;
      for (const p of this.stream) {
        const k = 0.9 + 0.25 * (p.shade / 255);
        g.fillStyle = `rgb(${(c.r * k) | 0},${(c.g * k) | 0},${(c.b * k) | 0})`;
        g.fillRect(m.cx - m.iw / 2 + p.x * m.cellW, mouth + p.y * m.cellW, m.cellW, m.cellW);
      }
    }
    if (this.fade) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = Math.max(0, 1 - this.fadeT);
      g.drawImage(this.fade, 0, 0);
      g.globalAlpha = 1;
    }
  }

  /** A small frosted funnel above the middle jar, its sand level falling as it drains. */
  private drawFunnel(): void {
    const m = this.jars[1];
    if (!m || this.reduced()) return;
    const g = this.ctx;
    const s = this.spout();
    const topW = m.iw * 0.62;
    const coneH = topW * 0.55;
    const neckW = 6;
    const neckH = 12;
    const yTop = s.y - neckH - coneH;
    const cone = () => {
      g.beginPath();
      g.moveTo(s.x - topW / 2, yTop);
      g.lineTo(s.x + topW / 2, yTop);
      g.lineTo(s.x + neckW / 2, yTop + coneH);
      g.lineTo(s.x + neckW / 2, s.y);
      g.lineTo(s.x - neckW / 2, s.y);
      g.lineTo(s.x - neckW / 2, yTop + coneH);
      g.closePath();
    };
    g.save();
    cone();
    g.fillStyle = this.look.night ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.3)';
    g.fill();
    g.clip();
    const left = 1 - this.poured / Math.max(1, this.total);
    if (left > 0.002 && this.funnelTex) {
      // The sand's surface dips into a little crater over the neck.
      const level = yTop + coneH * (1 - Math.sqrt(left)) + 2;
      g.beginPath();
      g.moveTo(s.x - topW, level);
      g.quadraticCurveTo(s.x, level + 7, s.x + topW, level);
      g.lineTo(s.x + topW, s.y + 2);
      g.lineTo(s.x - topW, s.y + 2);
      g.closePath();
      g.clip();
      g.imageSmoothingEnabled = false;
      g.drawImage(this.funnelTex, s.x - topW / 2, yTop, topW, coneH + neckH + 2);
      g.imageSmoothingEnabled = true;
    } else if (this.poured < this.total && this.funnelTex) {
      g.drawImage(this.funnelTex, s.x - neckW / 2, s.y - neckH, neckW, neckH);
    }
    g.restore();
    // Matte glass: soft side shading, a thin outline and a rim.
    g.save();
    cone();
    const gr = g.createLinearGradient(s.x - topW / 2, 0, s.x + topW / 2, 0);
    gr.addColorStop(0, 'rgba(30,38,44,0.10)');
    gr.addColorStop(0.3, 'rgba(255,255,255,0.10)');
    gr.addColorStop(1, 'rgba(30,38,44,0.14)');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 1.4;
    g.strokeStyle = this.look.edge;
    g.stroke();
    g.beginPath();
    g.roundRect(s.x - topW / 2 - 3, yTop - 3, topW + 6, 5, 2.5);
    g.fillStyle = this.look.night ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.6)';
    g.fill();
    g.stroke();
    g.restore();
  }
}
