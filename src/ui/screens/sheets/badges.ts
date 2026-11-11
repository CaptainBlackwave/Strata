/**
 * The badge shelf in the Profile sheet, the badge row of the win card, and the quiet award used
 * away from the win card (design/gdd/badges.md §3.5–§3.8). The rules are the pure core/badges.ts.
 * Badges are recognition only: nothing here touches the wallet (D76).
 */
import { type Badge, type EventBadgeConfig, awardBadges, backfillBadges, badgeProgress, badgeProgressOf, eventBadgeIds, isWeeklyBadgeId } from '../../../core/badges';
import { badgeSvg, medalSvg } from '../../badge-art';
import { t } from '../../strings';
import { $ } from '../../dom';
import { config, state } from '../../state';

/** The catalogue entry of an id, or undefined for a weekly or unknown id. */
function badgeOf(id: string): Badge | undefined {
  return config.badges.list.find((b) => b.id === id);
}

/** A badge's player-facing name and description, from the string table. */
function textOf(badge: Badge): { name: string; desc: string } {
  return (t.badges as Record<string, { name: string; desc: string }>)[badge.name] ?? { name: badge.id, desc: '' };
}

/** A weekly id's year and week: `weekly-2026-W46` → [2026, 46]. */
function weekOf(id: string): [number, number] {
  const [, year, week] = /^weekly-(\d{4})-W(\d{2})$/.exec(id)!;
  return [Number(year), Number(week)];
}

/** Whether `id` is an event's prize badge (sprint 17): not in the catalogue, never awarded by a rule. */
function isEventBadge(id: string): boolean {
  return eventBadgeIds(config as unknown as EventBadgeConfig).includes(id);
}

/** The name shown for any earned id: a catalogue name, "Week 46, 2026" for a weekly badge, or an event's name. */
export function badgeName(id: string): string {
  const b = badgeOf(id);
  return b ? textOf(b).name : isWeeklyBadgeId(id) ? t.badgeWeekly(...weekOf(id)) : (t.event.badges[id]?.name ?? id);
}

/** The medallion markup for any earned id: an event badge is an icy medallion with a snowflake. */
function artOf(id: string): string {
  const b = badgeOf(id);
  return b ? badgeSvg(b, config) : isEventBadge(id) ? medalSvg('event', 'snowflake') : medalSvg('weekly', 'weekly');
}

/** Load-time back-fill (badges.md §3.5): adds every badge already met to the save, with no notice. */
export function backfillSaveBadges(): void {
  state.save.badges = backfillBadges(state.save, config);
}

/**
 * Awards any badge now met away from the win card (a scene purchase, §3.4). Returns the new badges'
 * names for the caller's toast; the caller writes the save.
 */
export function awardBadgesNow(): string[] {
  const r = awardBadges(state.save.badges, badgeProgressOf(state.save, config), config);
  state.save.badges = r.badges;
  return r.fresh.map(badgeName);
}

/** The win card's single badge row (§3.6): the first badge's medallion and one combined line. Null when none. */
export function badgeRow(ids: readonly string[]): HTMLElement | null {
  if (!ids.length) return null;
  const row = document.createElement('div');
  row.className = 'win-shell win-unlock win-badge';
  const art = document.createElement('span');
  art.className = 'win-shell-art';
  art.innerHTML = artOf(ids[0]);
  const text = document.createElement('span');
  text.textContent = t.newBadges(ids.map(badgeName));
  row.append(art, text);
  return row;
}

/** One shelf tile: medallion, name, description, and for a not-yet badge its progress line. */
function tile(art: string, name: string, desc: string, progress: string | null): HTMLElement {
  const li = document.createElement('li');
  li.className = `badge-tile${progress === null ? ' earned' : ' locked'}`;
  li.innerHTML = `${art}<span class="badge-text"><b class="badge-name"></b><span class="badge-desc"></span></span>`;
  li.querySelector('.badge-name')!.textContent = name;
  li.querySelector('.badge-desc')!.textContent = desc;
  if (progress !== null) {
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = `, ${t.badgeLockedSr}. `;
    li.querySelector('.badge-name')!.after(sr);
    const p = document.createElement('span');
    p.className = 'badge-prog';
    p.textContent = progress;
    li.querySelector('.badge-text')!.append(p);
  }
  return li;
}

/** Fills the shelf (§3.8): the count, then every catalogue badge in order, then any weekly badges earned. */
export function renderBadgeShelf(): void {
  const progress = badgeProgressOf(state.save, config);
  const earned = new Set(state.save.badges);
  const list = config.badges.list;
  $('badges-count').textContent = t.badgesCount(list.filter((b) => earned.has(b.id)).length, list.length);
  const tiles = list.map((b) => {
    const { name, desc } = textOf(b);
    if (earned.has(b.id)) return tile(badgeSvg(b, config), name, desc, null);
    const { have, need } = badgeProgress(b, progress);
    const key = (b.rule.kind === 'count' ? b.rule.of : b.rule.kind) as keyof typeof t.badgeCount;
    return tile(badgeSvg(b, config), name, desc, t.badgeCount[key](have, need));
  });
  const events = state.save.badges.filter(isEventBadge).map((id) => tile(artOf(id), badgeName(id), t.event.badges[id]?.desc ?? '', null)); // sprint 17
  const weekly = state.save.badges.filter(isWeeklyBadgeId).map((id) => tile(artOf(id), badgeName(id), t.badgeWeeklyDesc, null));
  $('badge-shelf').replaceChildren(...tiles, ...events, ...weekly);
}
