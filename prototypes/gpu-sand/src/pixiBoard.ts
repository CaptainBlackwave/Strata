// PROTOTYPE - NOT FOR PRODUCTION
// Question: does a Pixi board (B: fake pour, C: falling-sand pour) look and run well enough for Strata?
// Date: 2026-11-11
import { Application, Container, Graphics, ImageSource, Matrix, Particle, ParticleContainer, Sprite, Texture } from 'pixi.js';
import type { Board, Color } from '../../../src/core/board';
import * as art from './art';
import { BASE, BH, BW, CELL, GH, GW, HIDDEN, IH, IW, PAL_HEX, PAL_RGB, unitRows } from './consts';
import { speed, type Variant } from './variant';

type Sim = typeof import('./sim');
type Mode = 'B' | 'C';

const GPU = 110; // grains per unit in the fake (B) stream
const MAXP = 6000;
const G = 1500; // px/s^2
const TH0 = 14; // deg: tilt reached while the jar travels to the target
const TH_REF = 80; // deg: tilt the pour position is solved for
const LAG = 0.85; // sand surface follows the jar's tilt a little (angle of repose feel)
const D2R = Math.PI / 180;

const rad = (d: number): number => d * D2R;
const ease = (u: number): number => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const smooth = (u: number): number => u * u * (3 - 2 * u);
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

// ---- convex polygon helpers for B (jar interior, mirrored so the lip is on +x) ----
type Pt = [number, number];
const POLY: Pt[] = (() => {
  const r = 11;
  const p: Pt[] = [[-IW / 2, -IH], [IW / 2, -IH]];
  for (let a = 0; a <= 90; a += 15) p.push([IW / 2 - r + Math.cos(rad(a)) * r, -r + Math.sin(rad(a)) * r]);
  for (let a = 90; a <= 180; a += 15) p.push([-IW / 2 + r + Math.cos(rad(a)) * r, -r + Math.sin(rad(a)) * r]);
  return p;
})();

function clip(poly: Pt[], nx: number, ny: number, d: number, ge: boolean): Pt[] {
  const out: Pt[] = [];
  const sg = ge ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = sg * (nx * a[0] + ny * a[1] - d), db = sg * (nx * b[0] + ny * b[1] - d);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
function area(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}
const A0 = area(POLY);
const CORNER_LOSS = IW * IH - A0;

function findD(nx: number, ny: number, v: number): number {
  let lo = Infinity, hi = -Infinity;
  for (const p of POLY) { const d = nx * p[0] + ny * p[1]; if (d < lo) lo = d; if (d > hi) hi = d; }
  if (v >= A0 - 0.01) return lo - 1;
  if (v <= 0) return hi + 1;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (area(clip(POLY, nx, ny, mid, true)) > v) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

interface Band { c: number; vol: number }

interface J {
  i: number;
  hx: number;
  hy: number;
  c: Container;
  fx: Container;
  shadow: Sprite;
  sandG?: Graphics;
  spr?: Sprite;
  cv?: HTMLCanvasElement;
  cx?: CanvasRenderingContext2D;
  img?: ImageData;
  u32?: Uint32Array;
  tex?: Texture;
  grid?: InstanceType<Sim['Grid']>;
  lift: number;
  liftT: number;
  dirty: boolean;
  bands: Band[];
  mound: number;
  mx: number;
  theta: number; // B: current tilt in degrees (mirrored space)
  s: number;
}

interface PourState {
  from: number; to: number; moved: number; color: Color; before: Board; next: Board;
  res: () => void;
  s: number; pvx: number; pvy: number; qx: number; qy: number;
  phase: number; t: number; th: number; thEnd: number;
  nB: number; tB: number; // units in source / target before
  T: number; p: number; spawned: number; landed: number;
  sim?: InstanceType<Sim['SrcSim']>;
  acc: number; stallT: number; lastEm: number; boost: number; settleT: number;
  sTex?: Texture; sCv?: HTMLCanvasElement; sCx?: CanvasRenderingContext2D; sImg?: ImageData; sU32?: Uint32Array; sSpr?: Sprite;
  tick: number;
}

export class PixiBoard implements Variant {
  private app!: Application;
  private world = new Container();
  private shadows = new Container();
  private jarsLayer = new Container();
  private jars: J[] = [];
  private board!: Board;
  private patterns = false;
  private sim!: Sim;
  private p: PourState | null = null;
  private sel: number | null = null;
  private scale = 1;
  private offX = 0;
  private offY = 0;
  private destroyed = false;
  private readonly cap = 4;

  // textures
  private tBack!: Texture; private tFront!: Texture; private tShadow!: Texture; private tGrain!: Texture; private tSpark!: Texture; private tDot!: Texture;
  private tPat: Texture[] = [];

  // particles
  private pc!: ParticleContainer;
  private pool: Particle[] = [];
  private np = 0;
  private px = new Float32Array(MAXP); private py = new Float32Array(MAXP);
  private pvx = new Float32Array(MAXP); private pvy = new Float32Array(MAXP);
  private pcol = new Uint8Array(MAXP); private psh = new Uint8Array(MAXP); private pcl = new Uint8Array(MAXP);
  private ptint = new Uint32Array(MAXP);

  static async create(host: HTMLElement, mode: Mode, onTap: (i: number) => void, count: number): Promise<PixiBoard> {
    const b = new PixiBoard(host, mode, onTap, count);
    await b.init();
    return b;
  }

  private constructor(private host: HTMLElement, private mode: Mode, private onTap: (i: number) => void, private count: number) {}

  /** Row layout: 4 jars per row, last row centred. Returns interior bottom-centre of jar i. */
  static home(i: number, count: number): [number, number] {
    const per = 4;
    const row = Math.floor(i / per);
    const inRow = Math.min(per, count - row * per);
    const col = i - row * per;
    return [BW / 2 + (col - (inRow - 1) / 2) * 96, 300 + row * 225];
  }

  private tex(c: HTMLCanvasElement, res: number, repeat = false): Texture {
    const src = new ImageSource({ resource: c, resolution: res, scaleMode: 'linear', addressMode: repeat ? 'repeat' : 'clamp-to-edge', autoGenerateMipmaps: false });
    return new Texture({ source: src });
  }

  private async init(): Promise<void> {
    if (this.mode === 'C') this.sim = await import('./sim');
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.app = new Application();
    await this.app.init({ width: w, height: h, antialias: true, backgroundAlpha: 0, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, preference: 'webgl' });
    this.host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.app.canvas.addEventListener('pointerdown', (e) => this.pointer(e));
    this.fit();

    const rows = [...new Set(Array.from({ length: this.count }, (_, i) => PixiBoard.home(i, this.count)[1]))];
    this.tBack = this.tex(art.jarBack(), 2);
    this.tFront = this.tex(art.jarFront(), 2);
    this.tShadow = this.tex(art.jarShadow(), 2);
    this.tGrain = this.tex(art.grainTile(), 2, true);
    this.tSpark = this.tex(art.sparkleTile(), 2, true);
    this.tDot = this.tex(art.dot(), 1);
    for (let c = 0; c < 9; c++) this.tPat.push(this.tex(art.patternTile(c), 1, true));
    const bg = new Sprite(this.tex(art.background(rows), 2));
    bg.width = BW; bg.height = BH;
    this.world.addChild(bg, this.shadows, this.jarsLayer);
    this.app.stage.addChild(this.world);

    for (let i = 0; i < this.count; i++) {
      const [hx, hy] = PixiBoard.home(i, this.count);
      const c = new Container();
      c.position.set(hx, hy);
      const back = new Sprite(this.tBack); back.position.set(-art.JAR_OX, -art.JAR_OY);
      const front = new Sprite(this.tFront); front.position.set(-art.JAR_OX, -art.JAR_OY);
      const fx = new Container();
      const j: J = { i, hx, hy, c, fx, shadow: new Sprite(this.tShadow), lift: 0, liftT: 0, dirty: true, bands: [], mound: 0, mx: 0, theta: 0, s: 1 };
      j.shadow.anchor.set(0.5); j.shadow.position.set(hx, hy + BASE + 3);
      this.shadows.addChild(j.shadow);
      c.addChild(back);
      if (this.mode === 'B') {
        j.sandG = new Graphics();
        c.addChild(j.sandG);
      } else {
        const cv = document.createElement('canvas');
        cv.width = GW; cv.height = GH;
        j.cv = cv; j.cx = cv.getContext('2d')!; j.img = j.cx.createImageData(GW, GH); j.u32 = new Uint32Array(j.img.data.buffer);
        j.tex = this.tex(cv, 1);
        j.spr = new Sprite(j.tex); j.spr.scale.set(CELL); j.spr.position.set(-IW / 2, -IH);
        j.grid = new this.sim.Grid();
        c.addChild(j.spr);
      }
      c.addChild(fx, front);
      this.jarsLayer.addChild(c);
      this.jars.push(j);
    }
    this.pc = new ParticleContainer({ dynamicProperties: { position: true, color: true, vertex: true, rotation: false, uvs: false } });
    for (let i = 0; i < MAXP; i++) {
      const p = new Particle({ texture: this.tDot, x: -50, y: -50, alpha: 0, anchorX: 0.5, anchorY: 0.5 });
      this.pool.push(p);
      this.pc.addParticle(p);
    }
    this.app.ticker.add(() => this.frame(Math.min(this.app.ticker.deltaMS / 1000, 0.05) * speed.scale));
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    if (this.destroyed) return;
    this.app.renderer.resize(this.host.clientWidth, this.host.clientHeight);
    this.fit();
  };

  private fit(): void {
    const w = this.host.clientWidth, h = this.host.clientHeight;
    this.scale = Math.min(w / BW, h / BH);
    this.offX = (w - BW * this.scale) / 2;
    this.offY = (h - BH * this.scale) / 2;
    this.world.scale.set(this.scale);
    this.world.position.set(this.offX, this.offY);
  }

  private pointer(e: PointerEvent): void {
    const r = this.app.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left - this.offX) / this.scale;
    const y = (e.clientY - r.top - this.offY) / this.scale;
    for (const j of this.jars) {
      if (x >= j.hx - 48 && x <= j.hx + 48 && y >= j.hy - IH - 14 && y <= j.hy + 16) { this.onTap(j.i); return; }
    }
  }

  // ---------------------------------------------------------------------------------------------
  setBoard(b: Board): void {
    this.board = b;
    b.jars.forEach((jar, i) => {
      const j = this.jars[i];
      j.bands = jar.units.map((c, k) => ({ c: k < jar.hidden ? HIDDEN : c, vol: 1 }));
      if (j.grid) this.sim.fillGrid(j.grid, jar.units, jar.hidden, b.capacity);
      j.mound = 0; j.theta = 0;
      j.dirty = true;
    });
  }

  setSelected(i: number | null): void {
    this.sel = i;
    this.jars.forEach((j, k) => (j.liftT = k === i ? 1 : 0));
  }

  setPatterns(on: boolean): void {
    this.patterns = on;
    this.jars.forEach((j) => { j.dirty = true; if (j.grid) j.grid.dirty = true; });
  }

  destroy(): void {
    this.destroyed = true;
    window.removeEventListener('resize', this.onResize);
    this.app.destroy(true, { children: true, texture: true });
  }

  // ---------------------------------------------------------------------------------------------
  // B: sand bands as clipped polygons with a grain-texture fill

  private unitH(): number { return unitRows(this.cap) * CELL; }
  private UA(): number { return IW * this.unitH(); }

  private spill(nUnits: number, th0 = 0): number {
    // tilt (deg) at which a jar holding `nUnits` of sand has its surface at the lip
    const v = nUnits * this.UA() + CORNER_LOSS;
    const lip: Pt = [IW / 2, -IH];
    const f = (th: number): number => {
      const a = rad(th * LAG);
      const nx = Math.sin(a), ny = Math.cos(a);
      return area(clip(POLY, nx, ny, nx * lip[0] + ny * lip[1], true)) - v;
    };
    let lo = th0, hi = 118;
    if (f(hi) > 0) return hi;
    for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  private drawB(j: J): void {
    const g = j.sandG!;
    g.clear();
    const bands = j.bands.filter((b) => b.vol > 0.001);
    if (!bands.length) return;
    const th = rad(j.theta * LAG);
    const nx = Math.sin(th), ny = Math.cos(th);
    const UA = this.UA();
    const ds: number[] = [];
    let cum = 0;
    for (const b of bands) { cum += b.vol; ds.push(findD(nx, ny, cum * UA + CORNER_LOSS)); }
    const s = j.s;
    for (let k = 0; k < bands.length; k++) {
      let poly = clip(POLY, nx, ny, ds[k], true);
      if (k > 0) poly = clip(poly, nx, ny, ds[k - 1], false);
      if (poly.length < 3) continue;
      const top = k === bands.length - 1;
      // soft mound on the top surface of a jar that is being filled
      if (top && j.mound > 0.2 && j.theta < 1) {
        for (let m = 0; m < poly.length; m++) {
          const a = poly[m], b = poly[(m + 1) % poly.length];
          if (Math.abs(a[1] - ds[k]) < 1e-3 && Math.abs(b[1] - ds[k]) < 1e-3 && Math.abs(a[0] - b[0]) > 4) {
            const ins: Pt[] = [];
            const dir = b[0] > a[0] ? 1 : -1;
            for (let q = 1; q < 12; q++) {
              const x = a[0] + ((b[0] - a[0]) * q) / 12;
              ins.push([x, ds[k] - j.mound * Math.exp(-Math.pow((x - j.mx) / 15, 2))]);
            }
            void dir;
            poly = [...poly.slice(0, m + 1), ...ins, ...poly.slice(m + 1)];
            break;
          }
        }
      }
      const flat: number[] = [];
      for (const p of poly) flat.push(p[0] * s, p[1]);
      const col = PAL_HEX[bands[k].c];
      g.poly(flat, true).fill({ texture: this.tGrain, color: col, textureSpace: 'global' });
      g.poly(flat, true).fill({ texture: this.tSpark, textureSpace: 'global', alpha: 0.9 });
      if (this.patterns && bands[k].c !== HIDDEN) g.poly(flat, true).fill({ texture: this.tPat[bands[k].c], textureSpace: 'global' });
      // lit top edge + a touch of occlusion under it, only where the colour changes (the strata lines)
      const sameAbove = k < bands.length - 1 && bands[k + 1].c === bands[k].c;
      if (!sameAbove) {
        for (let m = 0; m < poly.length; m++) {
          const a = poly[m], b = poly[(m + 1) % poly.length];
          const da = nx * a[0] + ny * a[1] - ds[k], db = nx * b[0] + ny * b[1] - ds[k];
          if (Math.abs(da) < 1e-3 && Math.abs(db) < 1e-3 && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > 3) {
            g.moveTo(a[0] * s + nx * 1.3 * s, a[1] + ny * 1.3).lineTo(b[0] * s + nx * 1.3 * s, b[1] + ny * 1.3).stroke({ width: 2, color: 0x000000, alpha: top ? 0.1 : 0.22 });
            g.moveTo(a[0] * s, a[1]).lineTo(b[0] * s, b[1]).stroke({ width: 1.2, color: 0xffffff, alpha: top ? 0.5 : 0.38 });
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------------------------
  // C: per-jar sand grid -> texture

  private drawC(j: J): void {
    const g = j.grid!;
    this.sim.renderCells(g.col, g.sh, GW, GH, j.u32!, this.patterns);
    j.cx!.putImageData(j.img!, 0, 0);
    j.tex!.source.update();
    g.dirty = false;
  }

  // ---------------------------------------------------------------------------------------------
  // particles

  private spawnP(x: number, y: number, vx: number, vy: number, c: number, sh: number): void {
    if (this.np >= MAXP) return;
    const i = this.np++;
    this.px[i] = x; this.py[i] = y; this.pvx[i] = vx; this.pvy[i] = vy; this.pcol[i] = c; this.psh[i] = sh; this.pcl[i] = 0;
    const rgb = PAL_RGB[c];
    const k = 0.82 + 0.3 * (sh / 255);
    this.ptint[i] = (Math.min(255, rgb[0] * k) << 16) | (Math.min(255, rgb[1] * k) << 8) | Math.min(255, rgb[2] * k);
    const p = this.pool[i];
    p.tint = this.ptint[i];
    p.alpha = 1;
    p.scaleX = p.scaleY = 0.36 + (sh / 255) * 0.2;
    p.x = x; p.y = y;
  }

  private partsFrame(dt: number): void {
    const P = this.p;
    const tj = P ? this.jars[P.to] : null;
    let n = this.np;
    for (let i = 0; i < n; i++) {
      this.pvy[i] += G * dt;
      this.px[i] += this.pvx[i] * dt;
      this.py[i] += this.pvy[i] * dt;
      let gone = false;
      if (tj && P) {
        let lx = this.px[i] - tj.hx;
        const ly = this.py[i] - tj.hy;
        if (!this.pcl[i] && ly >= -IH - 3) {
          this.pcl[i] = 1;
          lx = clamp(lx, -IW / 2 + 5, IW / 2 - 5);
          this.px[i] = tj.hx + lx;
        }
        if (this.pcl[i]) {
          if (this.mode === 'B') {
            const topY = -(P.tB + P.landed / GPU) * this.unitH();
            if (ly >= topY - 1) {
              P.landed++;
              tj.mound = Math.min(9, tj.mound + 0.45);
              tj.mx += (lx - tj.mx) * 0.2;
              tj.dirty = true;
              gone = true;
            }
          } else if (this.sim.grainResting(tj.grid!, lx, ly)) {
            this.sim.landGrain(tj.grid!, lx, ly, this.pcol[i], this.psh[i]);
            P.landed++;
            gone = true;
          }
        }
      }
      if (this.py[i] > BH + 40) gone = true;
      if (gone) {
        n--;
        this.pool[i].alpha = 0;
        if (i !== n) {
          this.px[i] = this.px[n]; this.py[i] = this.py[n]; this.pvx[i] = this.pvx[n]; this.pvy[i] = this.pvy[n];
          this.pcol[i] = this.pcol[n]; this.psh[i] = this.psh[n]; this.pcl[i] = this.pcl[n]; this.ptint[i] = this.ptint[n];
          const a = this.pool[i], b = this.pool[n];
          a.tint = this.ptint[i]; a.alpha = 1; a.scaleX = b.scaleX; a.scaleY = b.scaleY;
        }
        i--;
        continue;
      }
      const p = this.pool[i];
      p.x = this.px[i]; p.y = this.py[i];
    }
    this.np = n;
  }

  // ---------------------------------------------------------------------------------------------
  // the pour

  pour(from: number, to: number, moved: number, color: Color, before: Board, next: Board): Promise<void> {
    return new Promise((res) => this.startPour(from, to, moved, color, before, next, res));
  }

  private startPour(from: number, to: number, moved: number, color: Color, before: Board, next: Board, res: () => void): void {
    const sj = this.jars[from], tj = this.jars[to];
    let s = Math.sign(tj.hx - sj.hx) || (tj.hx < BW / 2 ? -1 : 1);
    const solve = (ss: number): [number, number] => {
      const a = rad(TH_REF) * ss;
      const vx = ss * 72, vy = -IH; // lipLocal - Q  (Q = far bottom corner)
      const rx = vx * Math.cos(a) - vy * Math.sin(a), ry = vx * Math.sin(a) + vy * Math.cos(a);
      return [tj.hx - ss * 30 - rx, tj.hy - IH - 46 - ry];
    };
    let [pvx, pvy] = solve(s);
    if (pvx < 20 || pvx > BW - 20) { const alt = solve(-s); if (alt[0] > 20 && alt[0] < BW - 20) { s = -s; [pvx, pvy] = alt; } }
    sj.s = s;
    const P: PourState = {
      from, to, moved, color, before, next, res, s, pvx, pvy, qx: -s * IW / 2, qy: 0,
      phase: 0, t: 0, th: 0, thEnd: 0, nB: before.jars[from].units.length, tB: before.jars[to].units.length,
      T: Math.min(3.2, 0.9 + 0.6 * moved), p: 0, spawned: 0, landed: 0, acc: 0, stallT: 0, lastEm: 0, boost: 0, settleT: 0, tick: 0,
    };
    this.p = P;
    this.setSelected(null);
    sj.lift = 0;
    this.jarsLayer.addChild(tj.c);
    this.jarsLayer.addChild(sj.c);
    tj.fx.addChild(this.pc);
    this.pc.position.set(-tj.hx, -tj.hy);
    sj.c.pivot.set(P.qx, P.qy);
    sj.c.position.set(sj.hx + P.qx, sj.hy + P.qy);
    sj.shadow.alpha = 1;
    if (this.mode === 'B') { sj.theta = 0; sj.bands = before.jars[from].units.map((c, k) => ({ c: k < before.jars[from].hidden ? HIDDEN : c, vol: 1 })); }
  }

  private pose(P: PourState, x: number, y: number, th: number): void {
    const sj = this.jars[P.from];
    sj.c.position.set(x, y);
    sj.c.rotation = P.s * rad(th);
    P.th = th;
    if (this.mode === 'B') { sj.theta = th; sj.dirty = true; }
  }

  private lipWorld(P: PourState): [number, number] {
    const a = P.s * rad(P.th);
    const vx = P.s * IW / 2 - P.qx, vy = -IH - P.qy;
    return [P.pvx + vx * Math.cos(a) - vy * Math.sin(a), P.pvy + vx * Math.sin(a) + vy * Math.cos(a)];
  }

  private pourFrame(P: PourState, dt: number): void {
    const sj = this.jars[P.from], tj = this.jars[P.to];
    const home: [number, number] = [sj.hx + P.qx, sj.hy + P.qy];
    P.t += dt;
    const bandsFor = (L: number): Band[] => {
      const src = P.before.jars[P.from];
      const out: Band[] = [];
      for (let k = 0; k < src.units.length; k++) out.push({ c: k < src.hidden ? HIDDEN : src.units[k], vol: clamp(L - k, 0, 1) });
      return out;
    };
    const targetBands = (): Band[] => {
      const t = P.before.jars[P.to];
      const out: Band[] = t.units.map((c, k) => ({ c: k < t.hidden ? HIDDEN : c, vol: 1 }));
      const v = P.landed / GPU;
      for (let k = 0; k < Math.ceil(v); k++) out.push({ c: P.color, vol: Math.min(1, v - k) });
      return out;
    };

    if (P.phase === 0) {
      const u = Math.min(1, P.t / 0.55);
      const e = ease(u);
      this.pose(P, home[0] + (P.pvx - home[0]) * e, home[1] + (P.pvy - home[1]) * e, TH0 * e);
      sj.shadow.alpha = 1 - 0.65 * e;
      if (u >= 1) {
        P.phase = 1; P.t = 0;
        if (this.mode === 'C') this.beginSim(P);
      }
      return;
    }

    if (P.phase === 1) {
      if (this.mode === 'B') {
        const u = Math.min(1, P.t / P.T);
        P.p = smooth(u);
        const L = P.nB - P.moved * P.p;
        const target = Math.max(TH0, this.spill(L) + 3);
        const th = P.th + clamp(target - P.th, -140 * dt, 140 * dt);
        this.pose(P, P.pvx, P.pvy, th);
        sj.bands = bandsFor(L);
        const want = Math.floor(P.p * GPU * P.moved);
        while (P.spawned < want) {
          const [lx, ly] = this.lipWorld(P);
          const a = P.s * rad(P.th);
          const sp = 45 + Math.random() * 60;
          this.spawnP(lx + (Math.random() - 0.5) * 3, ly + (Math.random() - 0.5) * 3, Math.cos(a) * sp * P.s + (Math.random() - 0.5) * 10, Math.sin(a) * sp * P.s + 10 + Math.random() * 20, P.color, (Math.random() * 256) | 0);
          P.spawned++;
        }
        const t = tj;
        t.bands = targetBands();
        t.dirty = true;
        if (u >= 1) { P.phase = 2; P.t = 0; P.thEnd = P.th; }
      } else {
        const sim = P.sim!;
        const unitCells = unitRows(this.cap) * GW;
        const need = P.moved * unitCells;
        const Lrem = P.nB - sim.emitted / unitCells;
        if (sim.emitted === P.lastEm) P.stallT += dt; else { P.stallT = 0; P.lastEm = sim.emitted; P.boost = Math.max(0, P.boost - 2); }
        if (P.stallT > 0.45) P.boost = Math.min(30, P.boost + dt * 25);
        const target = Math.min(118, Math.max(TH0, this.spill(Lrem) + 6 + P.boost));
        const th = P.th + clamp(target - P.th, -80 * dt, 80 * dt);
        this.pose(P, P.pvx, P.pvy, th);
        sim.setPose(P.pvx, P.pvy, P.s * rad(th));
        P.acc += dt;
        let n = 0;
        const lean = th < 40 ? 0 : th < 75 ? 1 : 2;
        while (P.acc >= 1 / 120 && n < 4) { sim.step(lean); P.acc -= 1 / 120; n++; }
        if (P.acc > 0.05) P.acc = 0;
        this.renderS(P);
        this.stepTarget(P, tj);
        if (sim.emitted >= need || P.t > 7) { P.phase = 2; P.t = 0; P.thEnd = P.th; }
      }
      return;
    }

    if (P.phase === 2) {
      const u = Math.min(1, P.t / 0.5);
      const th = P.thEnd * (1 - ease(u));
      this.pose(P, P.pvx, P.pvy, th);
      if (this.mode === 'B') {
        sj.bands = bandsFor(P.nB - P.moved);
        tj.bands = targetBands();
        tj.dirty = true;
      } else {
        const sim = P.sim!;
        sim.setPose(P.pvx, P.pvy, P.s * rad(th));
        P.acc += dt;
        let n = 0;
        while (P.acc >= 1 / 120 && n < 4) { sim.step(th < 40 ? 0 : 1); P.acc -= 1 / 120; n++; }
        if (P.acc > 0.05) P.acc = 0;
        this.renderS(P);
        this.stepTarget(P, tj);
      }
      if (u >= 1) {
        if (this.mode === 'C') this.endSim(P);
        P.phase = 3; P.t = 0;
      }
      return;
    }

    if (P.phase === 3) {
      const u = Math.min(1, P.t / 0.5);
      const e = ease(u);
      this.pose(P, P.pvx + (home[0] - P.pvx) * e, P.pvy + (home[1] - P.pvy) * e, 0);
      sj.shadow.alpha = 0.35 + 0.65 * e;
      if (this.mode === 'C') this.stepTarget(P, tj);
      if (this.mode === 'B') { tj.bands = targetBands(); tj.dirty = true; }
      if (u >= 1) { P.phase = 4; P.t = 0; }
      return;
    }

    // phase 4: let the last grains land and the top settle, then snap to the exact discrete state
    if (this.mode === 'C') this.stepTarget(P, tj);
    P.settleT += dt;
    if (this.mode === 'B') { tj.bands = targetBands(); tj.dirty = true; }
    if ((this.np === 0 && P.t > 0.55) || P.t > 2.5) this.finish(P);
  }

  private stepTarget(P: PourState, tj: J): void {
    P.tick++;
    this.sim.settleStep(tj.grid!, P.tick, 14);
    this.sim.settleStep(tj.grid!, P.tick + 1, 14);
  }

  private beginSim(P: PourState): void {
    const sj = this.jars[P.from];
    // bounding box of the jar over every pose it can reach, in world px
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let th = 0; th <= 120; th += 6) {
      const a = P.s * rad(th);
      for (const [lx, ly] of [[-IW / 2 - WALLM, -IH], [IW / 2 + WALLM, -IH], [-IW / 2 - WALLM, BASE], [IW / 2 + WALLM, BASE]]) {
        const vx = lx - P.qx, vy = ly - P.qy;
        const wx = P.pvx + vx * Math.cos(a) - vy * Math.sin(a), wy = P.pvy + vx * Math.sin(a) + vy * Math.cos(a);
        x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy); y1 = Math.max(y1, wy);
      }
    }
    const ox = Math.floor((x0 - 8) / CELL) * CELL, oy = Math.floor((y0 - 8) / CELL) * CELL;
    const w = Math.ceil((x1 + 8 - ox) / CELL), h = Math.ceil((y1 + 8 - oy) / CELL);
    const sim = new this.sim.SrcSim(w, h, ox, oy, P.s, (x, y, c, sh, vx, vy) => this.spawnP(x, y, vx, vy, c, sh));
    sim.qx = P.qx; sim.qy = P.qy;
    sim.setPose(P.pvx, P.pvy, P.s * rad(P.th));
    sim.loadFromLocal(sj.grid!);
    sim.emitted = 0;
    sim.limit = P.moved * unitRows(this.cap) * GW;
    P.sim = sim;
    P.sCv = document.createElement('canvas');
    P.sCv.width = w; P.sCv.height = h;
    P.sCx = P.sCv.getContext('2d')!;
    P.sImg = P.sCx.createImageData(w, h);
    P.sU32 = new Uint32Array(P.sImg.data.buffer);
    P.sTex = this.tex(P.sCv, 1);
    P.sSpr = new Sprite(P.sTex);
    sj.c.addChildAt(P.sSpr, 2);
    sj.spr!.visible = false;
    this.renderS(P);
  }

  private renderS(P: PourState): void {
    const sim = P.sim!;
    this.sim.renderCells(sim.col, sim.sh, sim.w, sim.h, P.sU32!, this.patterns, Math.round(sim.ox / CELL), Math.round(sim.oy / CELL));
    P.sCx!.putImageData(P.sImg!, 0, 0);
    P.sTex!.source.update();
    // sprite lives inside the rotating jar: counter-transform so it stays world-aligned
    const sj = this.jars[P.from];
    const J = new Matrix().translate(-P.qx, -P.qy).rotate(sj.c.rotation).translate(sj.c.position.x, sj.c.position.y);
    const m = J.clone().invert().append(new Matrix().scale(CELL, CELL).translate(sim.ox, sim.oy));
    P.sSpr!.setFromMatrix(m);
  }

  private endSim(P: PourState): void {
    const sj = this.jars[P.from];
    sj.c.removeChild(P.sSpr!);
    P.sSpr!.destroy();
    P.sTex!.destroy(true);
    sj.spr!.visible = true;
    // the source gets its exact discrete state
    this.sim.fillGrid(sj.grid!, P.next.jars[P.from].units, P.next.jars[P.from].hidden, P.next.capacity);
    P.sim = undefined;
  }

  private finish(P: PourState): void {
    const sj = this.jars[P.from], tj = this.jars[P.to];
    sj.c.pivot.set(0, 0);
    sj.c.position.set(sj.hx, sj.hy);
    sj.c.rotation = 0;
    sj.shadow.alpha = 1;
    tj.fx.removeChild(this.pc);
    // leftover particles (should be none) are dropped
    for (let i = 0; i < this.np; i++) this.pool[i].alpha = 0;
    this.np = 0;
    tj.mound = 0;
    this.setBoard(P.next);
    this.p = null;
    P.res();
  }

  // ---------------------------------------------------------------------------------------------
  private frame(dt: number): void {
    if (this.destroyed) return;
    for (const j of this.jars) {
      if (j.lift !== j.liftT) {
        j.lift += clamp(j.liftT - j.lift, -dt * 9, dt * 9);
        if (!this.p || (this.p.from !== j.i)) j.c.y = j.hy - j.lift * 16;
        j.shadow.alpha = 1 - 0.3 * j.lift;
      }
    }
    if (this.p) this.pourFrame(this.p, dt);
    if (this.p || this.np) this.partsFrame(dt);
    if (this.p) { const tj = this.jars[this.p.to]; if (tj.mound > 0) { tj.mound *= Math.exp(-dt * (this.p.phase >= 2 ? 6 : 1.2)); tj.dirty = true; } }
    for (const j of this.jars) {
      if (this.mode === 'B') { if (j.dirty) { this.drawB(j); j.dirty = false; } }
      else if (j.grid!.dirty || j.dirty) { this.drawC(j); j.dirty = false; }
    }
  }
}

const WALLM = 6;
