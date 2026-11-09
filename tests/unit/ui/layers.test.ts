// Sprint 6 F3 (production/qa/sprint-6-findings.md): dialogs hold keyboard focus.
import { describe, expect, it } from 'vitest';
import { type LayerElement, LayerStack } from '../../../src/ui/layers';

type Fake = LayerElement & { name: string };
const fake = (name: string, hidden = true): Fake => ({ name, hidden, inert: false, style: { zIndex: '' } });

function setup() {
  const board = fake('board', false);
  const toast = fake('toast', false);
  const home = fake('home');
  const settings = fake('settings');
  const leave = fake('leave');
  const all = [board, toast, home, settings, leave];
  const stack = new LayerStack<Fake>(() => all, [toast], 20);
  return { board, toast, home, settings, leave, stack };
}

describe('LayerStack', () => {
  it('with no layer open, nothing is inert and the board is in front', () => {
    const { board, stack } = setup();
    expect(stack.top()).toBeNull();
    expect(board.inert).toBe(false);
  });

  it('opening a layer shows it and makes everything else inert except the toast', () => {
    const { board, toast, home, settings, stack } = setup();
    stack.open(settings, null);
    expect(settings.hidden).toBe(false);
    expect(settings.inert).toBe(false);
    expect(board.inert).toBe(true);
    expect(home.inert).toBe(true);
    expect(toast.inert).toBe(false);
  });

  it('a layer opened over another makes the lower one inert and draws above it', () => {
    const { home, settings, stack } = setup();
    stack.open(home, null);
    stack.open(settings, null);
    expect(stack.top()).toBe(settings);
    expect(home.inert).toBe(true);
    expect(Number(settings.style.zIndex)).toBeGreaterThan(Number(home.style.zIndex));
  });

  it('closing returns the opener and hands the front back to the layer below', () => {
    const { home, settings, stack } = setup();
    const opener = { focus: () => undefined };
    stack.open(home, null);
    stack.open(settings, opener);
    expect(stack.close(settings)).toBe(opener);
    expect(settings.hidden).toBe(true);
    expect(stack.top()).toBe(home);
    expect(home.inert).toBe(false);
  });

  it('closing the last layer makes the board interactive again', () => {
    const { board, settings, stack } = setup();
    stack.open(settings, null);
    stack.close(settings);
    expect(stack.top()).toBeNull();
    expect(board.inert).toBe(false);
  });

  it('re-opening an open layer moves it to the top and keeps its first opener', () => {
    const { home, settings, stack } = setup();
    const first = { focus: () => undefined };
    stack.open(home, first);
    stack.open(settings, null);
    stack.open(home, { focus: () => undefined });
    expect(stack.top()).toBe(home);
    expect(stack.close(home)).toBe(first);
  });

  it('closing a layer that is not open only hides it', () => {
    const { leave, stack } = setup();
    leave.hidden = false;
    expect(stack.close(leave)).toBeNull();
    expect(leave.hidden).toBe(true);
    expect(stack.has(leave)).toBe(false);
  });

  it('a pinned layer stays on top and interactive when another opens later (D57, the other-tab overlay)', () => {
    const { board, home, settings, stack } = setup();
    stack.open(home, null);
    stack.pin(settings, null);
    stack.open(home, null); // e.g. a pour finishing behind the overlay
    expect(stack.top()).toBe(settings);
    expect(settings.inert).toBe(false);
    expect(home.inert).toBe(true);
    expect(board.inert).toBe(true);
    expect(Number(settings.style.zIndex)).toBeGreaterThan(Number(home.style.zIndex));
    stack.close(settings);
    stack.open(board, null);
    expect(stack.top()).toBe(board); // closing unpins
  });
});
