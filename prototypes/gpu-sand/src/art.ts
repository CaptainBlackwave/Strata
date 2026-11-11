// PROTOTYPE - NOT FOR PRODUCTION
// Question: can a GPU board (Pixi) and a falling-sand pour look and run well enough for Strata?
// Date: 2026-11-11
// All art is generated here on 2D canvases at startup (no asset files), then used as Pixi textures.
import { BASE, BH, BW, IH, IW, WALL, pat } from './consts';

const AS = 2; // art supersampling

function mk(w: number, h: number, scale = AS): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  const g = c.getContext('2d')!;
  g.scale(scale, scale);
  return [c, g];
}

/** Jar art canvas covers x -52..52, y -190..+20 around the interior bottom-centre. */
export const JAR_OX = 52;
export const JAR_OY = 190;
const JW = 104;
const JH = 212;

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rtop: number, rbot: number): void {
  g.beginPath();
  g.moveTo(x + rtop, y);
  g.lineTo(x + w - rtop, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rtop);
  g.lineTo(x + w, y + h - rbot);
  g.quadraticCurveTo(x + w, y + h, x + w - rbot, y + h);
  g.lineTo(x + rbot, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rbot);
  g.lineTo(x, y + rtop);
  g.quadraticCurveTo(x, y, x + rtop, y);
  g.closePath();
}

/** Behind the sand: faint tinted glass interior and the dark back of the opening. */
export function jarBack(): HTMLCanvasElement {
  const [c, g] = mk(JW, JH);
  g.translate(JAR_OX, JAR_OY);
  rr(g, -IW / 2, -IH, IW, IH, 0, 11);
  const gr = g.createLinearGradient(-IW / 2, 0, IW / 2, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.13)');
  gr.addColorStop(0.45, 'rgba(150,205,225,0.07)');
  gr.addColorStop(1, 'rgba(10,50,70,0.22)');
  g.fillStyle = gr;
  g.fill();
  // dark inside of the opening (back arc of the rim ellipse)
  g.beginPath();
  g.ellipse(0, -IH, IW / 2, 5, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(8,36,52,0.28)';
  g.fill();
  g.beginPath();
  g.ellipse(0, -IH, IW / 2 + 1, 5.5, 0, Math.PI, Math.PI * 2);
  g.strokeStyle = 'rgba(255,255,255,0.28)';
  g.lineWidth = 1;
  g.stroke();
  return c;
}

/** In front of the sand: sand shading, glass walls, rim light, inner shadow and highlight streaks. */
export function jarFront(): HTMLCanvasElement {
  const [c, g] = mk(JW, JH);
  g.translate(JAR_OX, JAR_OY);
  const ox = IW / 2 + WALL;

  // 1. shading that sits on the sand (cylinder falloff, light from top-left, base darkening)
  g.save();
  rr(g, -IW / 2, -IH, IW, IH, 0, 11);
  g.clip();
  let gr = g.createLinearGradient(-IW / 2, 0, IW / 2, 0);
  gr.addColorStop(0, 'rgba(10,25,40,0.34)');
  gr.addColorStop(0.2, 'rgba(10,25,40,0.0)');
  gr.addColorStop(0.62, 'rgba(10,25,40,0.0)');
  gr.addColorStop(1, 'rgba(10,25,40,0.46)');
  g.fillStyle = gr;
  g.fillRect(-IW / 2, -IH, IW, IH);
  gr = g.createLinearGradient(-IW / 2, -IH, IW / 2, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.15)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.12)');
  g.fillStyle = gr;
  g.fillRect(-IW / 2, -IH, IW, IH);
  gr = g.createLinearGradient(0, -22, 0, 0);
  gr.addColorStop(0, 'rgba(10,25,40,0)');
  gr.addColorStop(1, 'rgba(10,25,40,0.38)');
  g.fillStyle = gr;
  g.fillRect(-IW / 2, -22, IW, 22);
  // inner shadow under the rim
  gr = g.createLinearGradient(0, -IH, 0, -IH + 14);
  gr.addColorStop(0, 'rgba(10,25,40,0.30)');
  gr.addColorStop(1, 'rgba(10,25,40,0)');
  g.fillStyle = gr;
  g.fillRect(-IW / 2, -IH, IW, 14);
  g.restore();

  // 2. glass wall body (outer minus inner, even-odd)
  g.beginPath();
  rr(g, -ox, -IH, ox * 2, IH + BASE, 4, 20);
  rr(g, -IW / 2, -IH, IW, IH, 0, 11);
  gr = g.createLinearGradient(-ox, 0, ox, 0);
  gr.addColorStop(0, 'rgba(235,252,255,0.62)');
  gr.addColorStop(0.5, 'rgba(170,215,230,0.32)');
  gr.addColorStop(1, 'rgba(120,185,205,0.52)');
  g.fillStyle = gr;
  g.fill('evenodd');

  // thick glass base catches light
  g.save();
  rr(g, -ox, -IH, ox * 2, IH + BASE, 4, 20);
  g.clip();
  gr = g.createLinearGradient(0, 0, 0, BASE);
  gr.addColorStop(0, 'rgba(255,255,255,0.18)');
  gr.addColorStop(1, 'rgba(255,255,255,0.62)');
  g.fillStyle = gr;
  g.fillRect(-ox, 0, ox * 2, BASE);
  g.restore();

  // 3. soft rim light on the outer silhouette (bright top-left, dim bottom-right)
  rr(g, -ox, -IH, ox * 2, IH + BASE, 4, 20);
  gr = g.createLinearGradient(-ox, -IH, ox, 0);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0.22)');
  g.strokeStyle = gr;
  g.lineWidth = 1.7;
  g.stroke();
  // inner edge: thin dark + light pair gives thickness
  rr(g, -IW / 2, -IH, IW, IH, 0, 11);
  gr = g.createLinearGradient(-IW / 2, 0, IW / 2, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.5, 'rgba(0,40,60,0.25)');
  gr.addColorStop(1, 'rgba(0,30,50,0.45)');
  g.strokeStyle = gr;
  g.lineWidth = 1;
  g.stroke();

  // 4. rim flange and the front arc of the opening
  rr(g, -ox - 3, -IH - 7, (ox + 3) * 2, 9, 3.5, 3.5);
  gr = g.createLinearGradient(-ox, 0, ox, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.5, 'rgba(210,240,250,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0.5)');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 1;
  g.stroke();
  g.beginPath();
  g.ellipse(0, -IH, IW / 2 + 1, 5.5, 0, 0, Math.PI);
  g.strokeStyle = 'rgba(255,255,255,0.65)';
  g.lineWidth = 1.3;
  g.stroke();

  // 5. highlight streaks (blurred)
  g.save();
  g.filter = 'blur(1.1px)';
  gr = g.createLinearGradient(0, -IH + 12, 0, -24);
  gr.addColorStop(0, 'rgba(255,255,255,0.85)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0.05)');
  g.fillStyle = gr;
  rr(g, -IW / 2 + 5, -IH + 12, 6, IH - 40, 3, 3);
  g.fill();
  g.beginPath();
  g.ellipse(-IW / 2 + 8, -IH + 8, 3.2, 2, 0, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  rr(g, IW / 2 - 8, -IH + 30, 2.5, IH - 80, 1.2, 1.2);
  g.fill();
  g.restore();
  // base reflection arc
  g.beginPath();
  g.moveTo(-IW / 2 + 10, 3.5);
  g.lineTo(IW / 2 - 10, 3.5);
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = 1.2;
  g.stroke();
  return c;
}

/** Soft contact + cast shadow, centred on the jar base. 160 x 44. */
export function jarShadow(): HTMLCanvasElement {
  const [c, g] = mk(170, 46);
  g.translate(85, 23);
  g.save();
  g.translate(8, 2);
  g.scale(1, 0.2);
  let gr = g.createRadialGradient(0, 0, 0, 0, 0, 78);
  gr.addColorStop(0, 'rgba(30,22,10,0.42)');
  gr.addColorStop(0.55, 'rgba(30,22,10,0.2)');
  gr.addColorStop(1, 'rgba(30,22,10,0)');
  g.fillStyle = gr;
  g.fillRect(-80, -80, 160, 160);
  g.restore();
  g.save();
  g.scale(1, 0.22);
  gr = g.createRadialGradient(0, 0, 0, 0, 0, 46);
  gr.addColorStop(0, 'rgba(10,8,4,0.55)');
  gr.addColorStop(1, 'rgba(10,8,4,0)');
  g.fillStyle = gr;
  g.fillRect(-50, -50, 100, 100);
  g.restore();
  return c;
}

/** Seaside backdrop: sky-to-shallows gradient, soft waves, grain, and a plank shelf per row. */
export function background(rowY: number[]): HTMLCanvasElement {
  const [c, g] = mk(BW, BH);
  let gr = g.createLinearGradient(0, 0, 0, BH);
  gr.addColorStop(0, '#9fd4dd');
  gr.addColorStop(0.45, '#bfe0dc');
  gr.addColorStop(1, '#e6d9b5');
  g.fillStyle = gr;
  g.fillRect(0, 0, BW, BH);
  // light waves
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    const y0 = 40 + k * 26;
    g.moveTo(0, y0);
    for (let x = 0; x <= BW; x += 6) g.lineTo(x, y0 + Math.sin(x / 38 + k * 1.7) * 5 + Math.sin(x / 15 + k) * 1.5);
    g.lineTo(BW, 0);
    g.lineTo(0, 0);
    g.closePath();
    g.fillStyle = `rgba(255,255,255,${0.1 - k * 0.018})`;
    g.fill();
  }
  // vignette
  gr = g.createRadialGradient(BW / 2, BH * 0.45, BH * 0.2, BW / 2, BH * 0.45, BH * 0.75);
  gr.addColorStop(0, 'rgba(255,255,255,0.12)');
  gr.addColorStop(1, 'rgba(20,50,60,0.22)');
  g.fillStyle = gr;
  g.fillRect(0, 0, BW, BH);
  // shelves
  for (const y of rowY) {
    const top = y + BASE;
    gr = g.createLinearGradient(0, top, 0, top + 26);
    gr.addColorStop(0, '#f6ecd0');
    gr.addColorStop(0.35, '#e2cfa2');
    gr.addColorStop(1, '#b99c68');
    g.fillStyle = gr;
    rr(g, 14, top, BW - 28, 24, 5, 5);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.fillRect(16, top + 0.5, BW - 32, 1.5);
    g.fillStyle = 'rgba(70,45,10,0.28)';
    g.fillRect(16, top + 24, BW - 32, 1);
    // soft drop shadow under the shelf
    gr = g.createLinearGradient(0, top + 25, 0, top + 44);
    gr.addColorStop(0, 'rgba(40,60,70,0.28)');
    gr.addColorStop(1, 'rgba(40,60,70,0)');
    g.fillStyle = gr;
    g.fillRect(18, top + 25, BW - 36, 19);
  }
  // faint paper grain
  const id = g.getImageData(0, 0, c.width, c.height);
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.putImageData(id, 0, 0);
  return c;
}

/**
 * Grain tile: near-white luminance noise (so a colour tint stays saturated) with a few darker
 * grains. 256 px, meant to be drawn at 0.5 scale so one texel is half a design pixel.
 */
export function grainTile(): HTMLCanvasElement {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  const id = g.createImageData(n, n);
  const d = id.data;
  // two-octave value noise, tileable
  const lo = new Float32Array(32 * 32);
  for (let i = 0; i < lo.length; i++) lo[i] = Math.random();
  const smp = (x: number, y: number): number => {
    const fx = (x / n) * 32, fy = (y / n) * 32;
    const x0 = Math.floor(fx) & 31, y0 = Math.floor(fy) & 31;
    const x1 = (x0 + 1) & 31, y1 = (y0 + 1) & 31;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a = lo[y0 * 32 + x0] * (1 - tx) + lo[y0 * 32 + x1] * tx;
    const b = lo[y1 * 32 + x0] * (1 - tx) + lo[y1 * 32 + x1] * tx;
    return a * (1 - ty) + b * ty;
  };
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.random();
      let v = 0.84 + (smp(x, y) - 0.5) * 0.16 + (r - 0.5) * 0.2;
      if (r < 0.06) v -= 0.2; // dark grain
      else if (r > 0.97) v += 0.14; // pale grain
      v = Math.max(0, Math.min(1, v));
      const k = (y * n + x) * 4;
      d[k] = d[k + 1] = d[k + 2] = v * 255;
      d[k + 3] = 255;
    }
  }
  g.putImageData(id, 0, 0);
  return c;
}

/** Sparkles: transparent tile with a few small bright stars, drawn on top of the sand. */
export function sparkleTile(): HTMLCanvasElement {
  const n = 256;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d')!;
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * n, y = Math.random() * n;
    const big = Math.random() < 0.18;
    g.fillStyle = `rgba(255,255,255,${big ? 0.95 : 0.7})`;
    g.fillRect(x, y, 1.6, 1.6);
    if (big) {
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(x - 1.5, y + 0.4, 4.6, 0.8);
      g.fillRect(x + 0.4, y - 1.5, 0.8, 4.6);
    }
  }
  return c;
}

/** Colour-blind pattern tile for palette index `ci` (dark marks on transparent). */
export function patternTile(ci: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(20,10,0,0.34)';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (pat(ci, x, y)) g.fillRect(x * 2, y * 2, 2, 2);
  return c;
}

/** Tiny soft grain for falling particles (4 x 4, white). */
export function dot(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = 6;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(3, 3, 0, 3, 3, 3);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 6, 6);
  return c;
}
