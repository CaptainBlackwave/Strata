/**
 * Particle effects built from DOM nodes and the Web Animations API: sand splashes,
 * seal sparkles and the level-clear burst. Skipped entirely under reduced motion.
 * Implements design/competitive-roadmap.md item C1 (game feel).
 */

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Options for one burst of particles. */
export interface BurstOptions {
  readonly x: number;
  readonly y: number;
  readonly colors: readonly string[];
  readonly count: number;
  /** Max travel distance in px. */
  readonly spread: number;
  /** Launch direction in degrees (0 = up), and the cone width around it. */
  readonly angle?: number;
  readonly cone?: number;
  readonly size?: number;
  readonly duration?: number;
  readonly gravity?: number;
  readonly className?: string;
}

/** Spawns a burst of particles at viewport coordinates. Example: `burst({ x, y, colors: ['#f2a541'], count: 12, spread: 30 })` */
export function burst(o: BurstOptions): void {
  if (reduced()) return;
  const layer = fxLayer();
  const cone = ((o.cone ?? 360) * Math.PI) / 180;
  const base = (((o.angle ?? 0) - 90) * Math.PI) / 180;
  for (let i = 0; i < o.count; i++) {
    const p = document.createElement('i');
    p.className = o.className ?? 'grain';
    const size = (o.size ?? 5) * (0.6 + Math.random() * 0.8);
    p.style.cssText = `left:${o.x}px;top:${o.y}px;width:${size}px;height:${size}px;background:${o.colors[i % o.colors.length]}`;
    layer.appendChild(p);
    const a = base + (Math.random() - 0.5) * cone;
    const d = o.spread * (0.35 + Math.random() * 0.65);
    const dx = Math.cos(a) * d;
    const dy = Math.sin(a) * d;
    const g = o.gravity ?? 0;
    const dur = (o.duration ?? 600) * (0.7 + Math.random() * 0.6);
    p.animate(
      [
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(0.9)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + g}px)) scale(0.3)`, opacity: 0 },
      ],
      { duration: dur, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' },
    ).onfinish = () => p.remove();
  }
}

/** A ring of sparkles around an element's box, used when a jar seals. */
export function sparkleAround(el: Element, color: string): void {
  if (reduced()) return;
  const r = el.getBoundingClientRect();
  burst({ x: r.left + r.width / 2, y: r.top + r.height * 0.4, colors: [color, '#fff6d8', '#ffffff'], count: 22, spread: r.height * 0.7, size: 5, duration: 750, className: 'spark' });
}

/** The level-clear celebration: sand grains in every board colour thrown up from the bottom. */
export function celebrate(colors: readonly string[]): void {
  if (reduced()) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let k = 0; k < 3; k++) {
    window.setTimeout(() => {
      burst({ x: w * (0.2 + 0.3 * k), y: h * 0.62, colors, count: 34, spread: h * 0.45, angle: 0, cone: 70, size: 7, duration: 1300, gravity: h * 0.25 });
    }, k * 160);
  }
}

function fxLayer(): HTMLElement {
  let layer = document.getElementById('fx');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}
