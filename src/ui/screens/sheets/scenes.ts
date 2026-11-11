/** The Scenes sheet: preview, buy and use (sprint 4). */
import { buyTheme, isOwned, themeById } from '../../../core/themes';
import { type FocusTarget } from '../../layers';
import { writeSave } from '../../storage';
import { t } from '../../strings';
import { $, closeLayer, openLayer, showToast } from '../../dom';
import { updateHud } from '../hud';
import { seasonBadge } from '../../clock';
import { audio, config, state } from '../../state';
import { applyTheme, currentTheme } from '../../theme';
import { awardBadgesNow } from './badges';

let previewing: string | null = null;

export function openScenes(opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  previewing = currentTheme();
  renderScenes();
  openLayer($('scenes'), $('scene-grid').querySelector<HTMLElement>('[aria-pressed="true"]'), opener);
}

export function renderScenes(): void {
  $('scenes-coins').textContent = String(state.save.wallet.coins);
  // Use or Buy turns clock-matching off, so the switch re-syncs on every render (UX-scenes-1).
  $<HTMLInputElement>('set-auto').checked = state.save.themes.auto;
  const grid = $('scene-grid');
  grid.replaceChildren(
    ...[...config.themes.list].sort((a, b) => (a.earned ?? 0) - (b.earned ?? 0) || a.price - b.price).map((theme) => { // streak-only scenes last
      const owned = isOwned(theme, state.save.themes.owned);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'scene-card';
      card.dataset.id = theme.id;
      card.setAttribute('aria-pressed', String(previewing === theme.id));
      const k = theme.tokens;
      card.innerHTML = `<span class="scene-swatch" style="--sw-edge:${k.glassEdge};background:radial-gradient(120% 50% at 50% 115%, ${k.sea} 0 40%, transparent 41%),radial-gradient(80% 70% at 80% 0, ${k.sky} 0 35%, transparent 60%),linear-gradient(${k.bgTop}, ${k.bgBottom})"><i></i><i></i><i></i></span><span class="scene-name"></span><span class="scene-status"></span>`;
      card.querySelector('.scene-swatch')!.setAttribute('data-scene', theme.id);
      card.querySelector('.scene-name')!.textContent = theme.name;
      const badges = [seasonBadge(theme, state.clock, { southern: state.save.settings.southern }) && ['season', t.sceneInSeason], (theme.tier ?? 1) > 1 && ['tier', t.sceneAnimated]].filter(Boolean) as string[][];
      if (badges.length) {
        const row = document.createElement('span');
        row.className = 'scene-badges';
        for (const [cls, text] of badges) {
          const b = document.createElement('span');
          b.className = `scene-badge ${cls}`;
          b.textContent = text;
          row.appendChild(b);
        }
        card.querySelector('.scene-name')!.after(row);
      }
      const status = card.querySelector('.scene-status') as HTMLElement;
      const inUse = owned && currentTheme() === theme.id;
      const locked = !owned && theme.earned !== undefined; // streak-only (sprint 16): never a price
      status.textContent = inUse ? t.sceneInUse : owned ? t.sceneOwned : locked ? t.track.locked(theme.earned!) : String(theme.price);
      status.classList.toggle('price', !owned && !locked);
      status.classList.toggle('locked', locked);
      if (!owned && !locked) {
        const unit = document.createElement('span'); // "300 coins", not a bare number (UX-scenes-3)
        unit.className = 'sr-only';
        unit.textContent = ` ${t.coins}`;
        status.append(unit);
      }
      card.addEventListener('click', () => {
        previewing = theme.id;
        applyTheme(theme.id);
        audio.play('select');
        renderScenes();
        $('scene-grid').querySelector<HTMLElement>(`[data-id="${theme.id}"]`)?.focus(); // keep focus on the rebuilt card
      });
      return card;
    }),
  );
  const theme = themeById(config, previewing ?? config.themes.default);
  const owned = isOwned(theme, state.save.themes.owned);
  const btn = $<HTMLButtonElement>('btn-scene-buy');
  const inUse = owned && currentTheme() === theme.id;
  btn.hidden = inUse;
  $('scene-previewing').textContent = previewing !== currentTheme() ? t.scenePreviewing(theme.name) : ''; // UX-scenes-4
  const locked = !owned && theme.earned !== undefined;
  btn.disabled = locked || (!owned && state.save.wallet.coins < theme.price);
  btn.textContent = owned ? t.sceneUse(theme.name) : locked ? t.track.locked(theme.earned!) : state.save.wallet.coins >= theme.price ? t.sceneBuy(theme.name, theme.price) : t.sceneNeed(theme.price, state.save.wallet.coins);
  $('scenes-auto-note').textContent = t.matchClockNote;
}

export function confirmScene(): void {
  if (!previewing) return;
  const theme = themeById(config, previewing);
  const owned = isOwned(theme, state.save.themes.owned);
  if (!owned && theme.earned !== undefined) return; // streak-only: granted by the track, never bought
  if (!owned) {
    const r = buyTheme(state.save.wallet, state.save.themes.owned, theme.id, config);
    if (!r.ok) return;
    state.save.wallet = r.wallet;
    state.save.themes = { ...state.save.themes, owned: r.owned };
    audio.play('sceneBought');
    const badges = awardBadgesNow(); // owning more scenes can earn a badge (badges.md §3.7); saved just below
    showToast(badges.length ? `${t.sceneBought(theme.name)} · ${t.newBadges(badges)}` : t.sceneBought(theme.name));
  }
  // Choosing a scene by hand pins it (turns clock-matching off).
  state.save.themes = { ...state.save.themes, selected: theme.id, auto: false };
  writeSave(state.save);
  applyTheme(currentTheme());
  $('home-coins').textContent = String(state.save.wallet.coins);
  updateHud();
  renderScenes();
}

export function closeScenes(): void {
  closeLayer($('scenes'));
  previewing = null;
  applyTheme(currentTheme()); // drop any unpurchased preview
}

/** Wires the Scenes sheet (opened from Home and from Settings). */
export function wireScenes(): void {
  $('btn-scenes').addEventListener('click', () => {
    if (!$('scenes-new').hidden) {
      state.save.onboarding.scenesNewSeen = true; // the mark has done its job (D82 R4)
      writeSave(state.save);
      $('scenes-new').hidden = true;
    }
    openScenes();
  });
  // Sub-screens open over Settings, so closing one returns to it with focus on its button (UX-settings-4).
  $('btn-scenes-2').addEventListener('click', () => openScenes());
  $('btn-scene-buy').addEventListener('click', confirmScene);
  $('btn-close-scenes').addEventListener('click', closeScenes);
  $<HTMLInputElement>('set-auto').addEventListener('change', (e) => {
    state.save.themes = { ...state.save.themes, auto: (e.target as HTMLInputElement).checked };
    writeSave(state.save);
    previewing = currentTheme();
    applyTheme(previewing);
    renderScenes();
  });
}
