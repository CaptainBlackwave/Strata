// PROTOTYPE - NOT FOR PRODUCTION
// Question: baseline "today" look: coloured stacked rectangles in rounded glass (DOM/CSS)
// Date: 2026-11-11
import type { Board, Color } from '../../../src/core/board';
import { PAL_CSS, HIDDEN } from './consts';
import { speed, type Variant } from './variant';

const PAT_CSS = [
  'radial-gradient(circle, rgba(0,0,0,.35) 1.6px, transparent 2px) 0 0/7px 7px',
  'repeating-linear-gradient(45deg, rgba(0,0,0,.3) 0 2px, transparent 2px 6px)',
  'linear-gradient(rgba(0,0,0,.3),rgba(0,0,0,.3)) 50% 50%/2px 70% no-repeat, linear-gradient(90deg,rgba(0,0,0,.3),rgba(0,0,0,.3)) 50% 50%/70% 2px no-repeat',
  'repeating-linear-gradient(0deg, rgba(0,0,0,.3) 0 2px, transparent 2px 6px)',
  'repeating-linear-gradient(135deg, rgba(0,0,0,.3) 0 2px, transparent 2px 5px)',
  'radial-gradient(circle, transparent 2px, rgba(0,0,0,.3) 2.5px, transparent 3.5px) 0 0/9px 9px',
  'repeating-linear-gradient(90deg, rgba(0,0,0,.3) 0 2px, transparent 2px 6px)',
  'repeating-linear-gradient(45deg, rgba(0,0,0,.28) 0 2px, transparent 2px 6px), repeating-linear-gradient(-45deg, rgba(0,0,0,.28) 0 2px, transparent 2px 6px)',
  'conic-gradient(rgba(0,0,0,.28) 25%, transparent 0 50%, rgba(0,0,0,.28) 0 75%, transparent 0) 0 0/10px 10px',
  '',
];

export class VariantA implements Variant {
  private root: HTMLDivElement;
  private jars: HTMLDivElement[] = [];
  private board!: Board;
  private patterns = false;

  constructor(host: HTMLElement, private onTap: (i: number) => void) {
    this.root = document.createElement('div');
    this.root.className = 'a-board';
    host.appendChild(this.root);
  }

  setBoard(b: Board): void {
    this.board = b;
    if (this.jars.length !== b.jars.length) {
      this.root.innerHTML = '';
      this.jars = b.jars.map((_, i) => {
        const j = document.createElement('div');
        j.className = 'a-jar';
        j.dataset.i = String(i);
        j.addEventListener('pointerdown', () => this.onTap(i));
        this.root.appendChild(j);
        return j;
      });
    }
    b.jars.forEach((jar, i) => {
      const el = this.jars[i];
      el.innerHTML = '';
      jar.units.forEach((c, k) => {
        const u = document.createElement('div');
        u.className = 'a-unit';
        const col = k < jar.hidden ? HIDDEN : c;
        u.style.background = PAL_CSS[col];
        u.style.height = `${100 / b.capacity}%`;
        if (this.patterns && col !== HIDDEN) u.style.background = `${PAT_CSS[col]}, ${PAL_CSS[col]}`;
        el.appendChild(u);
      });
    });
  }

  setSelected(i: number | null): void {
    this.jars.forEach((j, k) => j.classList.toggle('sel', k === i));
  }

  async pour(from: number, to: number, _m: number, _c: Color, _before: Board, next: Board): Promise<void> {
    const el = this.jars[from];
    el.classList.add('sel');
    await new Promise((r) => setTimeout(r, 260 / speed.scale));
    this.setBoard(next);
    this.setSelected(null);
    await new Promise((r) => setTimeout(r, 120 / speed.scale));
    void to;
  }

  setPatterns(on: boolean): void {
    this.patterns = on;
    if (this.board) this.setBoard(this.board);
  }

  destroy(): void {
    this.root.remove();
  }
}
