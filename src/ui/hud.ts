import { MAX_HP } from '../game/config';
import type { World } from '../game/world';
import type { SaveData } from '../game/storage';

const $ = (id: string) => document.getElementById(id)!;

export function mountUI(root: HTMLElement): void {
  root.innerHTML = `
    <canvas id="game-canvas"></canvas>
    <div id="vignette"></div>
    <div id="scan"></div>

    <div id="hud" class="hidden">
      <div class="hud-tl">
        <div class="score-wrap">
          <span class="score-label">score</span>
          <span id="hud-score">0</span>
        </div>
        <div class="combo-wrap"><span id="hud-combo"></span></div>
      </div>
      <div class="hud-tr">
        <div class="hi">best <span id="hud-hi">0</span></div>
        <div class="spd"><span id="hud-spd">00</span><small>km</small></div>
      </div>
      <div class="hud-bl">
        <div id="hearts"></div>
        <div id="buffs"></div>
      </div>
      <div class="hud-br">
        <div id="dist">0 m</div>
      </div>
      <div id="toast"></div>
    </div>

    <div id="overlay" class="screen">
      <div class="menu-card" id="menu-card">
        <p class="kicker">sector 9 · night cycle</p>
        <h1 class="logo">NEON<br>RUSH</h1>
        <p class="tag">outrun the grid. don't blink.</p>
        <div class="menu-actions" id="menu-actions"></div>
        <p class="hint" id="menu-hint"></p>
      </div>
    </div>
  `;
}

export function renderHearts(hp: number, shield: boolean): string {
  let s = '';
  for (let i = 0; i < MAX_HP; i++) {
    s += `<span class="heart ${i < hp ? 'on' : 'off'}">${i < hp ? '◆' : '◇'}</span>`;
  }
  if (shield) s += `<span class="buff">AEGIS</span>`;
  return s;
}

export function updateHud(w: World, save: SaveData): void {
  const hud = $('hud');
  const playing = w.phase === 'playing' || w.phase === 'paused';
  hud.classList.toggle('hidden', !playing);
  if (!playing) return;
  $('hud-score').textContent = Math.floor(w.score).toLocaleString();
  $('hud-hi').textContent = Math.max(save.highScore, Math.floor(w.score)).toLocaleString();
  $('hud-spd').textContent = String(Math.floor(w.speed * 4.2)).padStart(3, '0');
  $('dist').textContent = `${Math.floor(w.distance)} m`;
  const combo = $('hud-combo');
  if (w.combo >= 2) {
    combo.textContent = `×${w.combo} rush`;
    combo.style.opacity = '1';
    combo.style.color = w.combo >= 8 ? '#ffb347' : '#3df5ff';
  } else {
    combo.style.opacity = '0';
  }
  $('hearts').innerHTML = renderHearts(w.player.hp, w.player.shield);
  const buffs = $('buffs');
  buffs.textContent = w.player.magnet > 0 ? `PULL ${w.player.magnet.toFixed(1)}s` : '';
}

export function showToast(msg: string): void {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  window.setTimeout(() => el.classList.remove('show'), 1400);
}

export interface MenuSpec {
  title?: string;
  kicker?: string;
  tag?: string;
  body?: string;
  hint?: string;
  actions: { id: string; label: string; primary?: boolean }[];
}

export function showMenu(spec: MenuSpec): void {
  $('overlay').classList.remove('hidden');
  $('overlay').classList.add('in');
  const kicker = document.querySelector('.kicker') as HTMLElement;
  const logo = document.querySelector('.logo') as HTMLElement;
  const tag = document.querySelector('.tag') as HTMLElement;
  kicker.textContent = spec.kicker ?? 'sector 9 · night cycle';
  if (spec.title) logo.innerHTML = spec.title;
  tag.textContent = spec.tag ?? '';
  const actions = $('menu-actions');
  actions.innerHTML = spec.body ? `<div class="body-copy">${spec.body}</div>` : '';
  for (const a of spec.actions) {
    const b = document.createElement('button');
    b.className = a.primary ? 'btn primary' : 'btn';
    b.dataset.act = a.id;
    b.textContent = a.label;
    actions.appendChild(b);
  }
  $('menu-hint').textContent = spec.hint ?? '';
}

export function hideMenu(): void {
  $('overlay').classList.add('hidden');
  $('overlay').classList.remove('in');
}

export { $ };
