/**
 * The daily goals' words for Home and the win card (sprint 16, D137; design/gdd/daily-goals.md),
 * DOM-free so they are unit-tested. The rules are the pure core/goals.ts.
 */
import { type Goal, type GoalsConfig, type GoalsState, goalsFor } from '../../core/goals';
import { t } from '../strings';

/** One row of the Home card. `progress` is "12/25"; a done row shows a tick instead. */
export interface GoalRow {
  readonly text: string;
  readonly have: number;
  readonly target: number;
  readonly done: boolean;
  readonly progress: string;
}

/** The Home card: three rows and its last line. */
export interface GoalsCard {
  readonly rows: GoalRow[];
  readonly allDone: boolean;
  /** "+50 when all three are done", or "All done". */
  readonly foot: string;
}

/** A goal's words, e.g. "Seal 25 jars". */
export function goalText(goal: Goal): string {
  return t.goals.text[goal.kind]?.(goal.target) ?? goal.kind;
}

/**
 * Today's card from the save. Progress counts only when the save is for `today`; any other date
 * (an old day, or a clock moved back) shows today's goals at zero and changes nothing.
 * Example: `goalsCard(save.goals, dailyKey(state.clock), config)`.
 */
export function goalsCard(saved: GoalsState, today: string, config: GoalsConfig): GoalsCard {
  const goals = goalsFor(today, config);
  const mine = saved.date === today ? saved : null;
  const rows = goals.map((g, i) => {
    const have = Math.min(g.target, mine?.progress[i] ?? 0);
    const done = (mine?.done.includes(i) ?? false) || have >= g.target;
    return { text: goalText(g), have, target: g.target, done, progress: t.goals.progress(have, g.target) };
  });
  const allDone = rows.length > 0 && rows.every((r) => r.done);
  return { rows, allDone, foot: allDone ? t.goals.allDone : t.goals.bonusLeft(config.goals.bonus, goals.length) };
}

/** The win card's rows for goals this win reached, then the all-goals bonus if it was paid now. */
export function goalWinRows(paid: readonly { readonly goal: Goal; readonly coins: number }[], bonus: number): string[] {
  return [...paid.map((p) => t.goals.winRow(goalText(p.goal), p.coins)), ...(bonus > 0 ? [t.goals.winBonus(bonus)] : [])];
}
