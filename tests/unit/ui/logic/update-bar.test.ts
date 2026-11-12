// Story: production/sprints/sprint-21.md A3 (D179): the calm "New version ready · Update" bar on Home,
// with the silent reload of 0.14.1 kept as the fallback, and Settings' "Works offline".
import { describe, expect, it } from 'vitest';
import { type UpdateEvent, type UpdatePhase, type UpdatePlace, updateStep, worksOffline } from '../../../../src/ui/logic/update';

/** Runs events from `none`, returning the last phase and every action taken. */
function run(steps: readonly [UpdateEvent, UpdatePlace][], from: UpdatePhase = 'none') {
  let phase = from;
  const actions: string[] = [];
  for (const [event, place] of steps) {
    const next = updateStep(phase, event, place);
    phase = next.phase;
    actions.push(next.action);
  }
  return { phase, actions };
}

describe('updateStep: the update bar (A3)', () => {
  it('a new version taking over on Home shows the bar, not a reload', () => {
    expect(updateStep('none', 'takeover', 'home')).toEqual({ phase: 'offered', action: 'bar' });
  });
  it('Update reloads, on Home only', () => {
    expect(updateStep('offered', 'tap', 'home')).toEqual({ phase: 'none', action: 'reload' });
    expect(updateStep('offered', 'tap', 'away').action).toBe('none');
    expect(updateStep('none', 'tap', 'home').action).toBe('none');
  });
  it('a takeover during a board waits, then shows the bar back on Home', () => {
    expect(run([['takeover', 'away'], ['place', 'over-home'], ['place', 'home']]).actions).toEqual(['none', 'none', 'bar']);
  });
  it('never reloads mid-board, even after the bar was passed by', () => {
    const r = run([['takeover', 'home'], ['place', 'away'], ['visible', 'away'], ['tap', 'away']]);
    expect(r.actions).not.toContain('reload');
    expect(r.phase).toBe('ignored');
  });
  it('a bar passed by for a board falls back to the silent reload on the next return to Home', () => {
    expect(run([['takeover', 'home'], ['place', 'away'], ['place', 'home']]).actions).toEqual(['bar', 'none', 'reload']);
  });
  it('a sheet over Home is not passing the bar by: it stays when the sheet closes', () => {
    expect(run([['takeover', 'home'], ['place', 'over-home'], ['place', 'home']])).toEqual({ phase: 'offered', actions: ['bar', 'none', 'none'] });
  });
  it('a bar left when the app went to the background reloads silently when it comes back on Home', () => {
    expect(run([['takeover', 'home'], ['hidden', 'home'], ['visible', 'home']]).actions).toEqual(['bar', 'none', 'reload']);
    expect(run([['takeover', 'home'], ['hidden', 'home'], ['visible', 'over-home']]).actions).toEqual(['bar', 'none', 'none']);
  });
  it('coming back to the foreground with no new version does nothing', () => {
    expect(run([['hidden', 'home'], ['visible', 'home']])).toEqual({ phase: 'none', actions: ['none', 'none'] });
  });
  it('a second takeover while the bar shows changes nothing', () => {
    expect(updateStep('offered', 'takeover', 'home')).toEqual({ phase: 'offered', action: 'none' });
  });
});

describe('worksOffline (A3)', () => {
  it('shows once the worker has cached the game, on this visit or an earlier one', () => {
    expect(worksOffline({ supported: true, controlledAtBoot: false, readyMessage: true })).toBe(true);
    expect(worksOffline({ supported: true, controlledAtBoot: true, readyMessage: false })).toBe(true);
  });
  it('stays hidden while the first install is still caching, and without a service worker', () => {
    expect(worksOffline({ supported: true, controlledAtBoot: false, readyMessage: false })).toBe(false);
    expect(worksOffline({ supported: false, controlledAtBoot: true, readyMessage: true })).toBe(false);
  });
});
