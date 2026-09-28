import './style.css';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { QUALITY, type Settings } from './game/config';
import { AudioBus } from './game/audio';
import { createWorld, resetRun, simulate, type World } from './game/world';
import { loadSave, writeSave, type SaveData } from './game/storage';
import { Renderer } from './render/renderer';
import { hideMenu, mountUI, showMenu, showToast, updateHud } from './ui/hud';

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('#app missing');
mountUI(root);

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const renderer = new Renderer(canvas);
const input = new Input();
input.bind();

let save: SaveData = loadSave();
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  save.settings.reduced = true;
  save.settings.shake = false;
}
const audio = new AudioBus(save.settings);
renderer.setQuality(save.settings.quality);
renderer.reduced = save.settings.reduced;
renderer.shakeEnabled = save.settings.shake;

const world: World = createWorld();
let lastHighNotified = save.highScore;

const loop = new Loop(tick, draw);
loop.start();
paintMenu();

window.addEventListener('pointerdown', () => void audio.unlock(), { once: true });
window.addEventListener('keydown', () => void audio.unlock(), { once: true });

document.getElementById('overlay')!.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const act = t.dataset.act;
  if (!act) return;
  audio.ui();
  handleAction(act);
});

document.getElementById('overlay')!.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement | HTMLSelectElement;
  if (!t.id) return;
  applySettingControl(t);
});

function handleAction(act: string): void {
  switch (act) {
    case 'play':
      startRun();
      break;
    case 'how':
      world.prevPhase = world.phase;
      world.phase = 'how';
      paintMenu();
      break;
    case 'settings':
      world.prevPhase = world.phase === 'paused' ? 'paused' : world.phase;
      world.phase = 'settings';
      paintMenu();
      break;
    case 'credits':
      world.phase = 'credits';
      paintMenu();
      break;
    case 'back':
      world.phase = world.prevPhase === 'paused' ? 'paused' : 'menu';
      paintMenu();
      break;
    case 'resume':
      world.phase = 'playing';
      hideMenu();
      break;
    case 'restart':
      startRun();
      break;
    case 'menu':
      world.phase = 'menu';
      paintMenu();
      break;
    default:
      break;
  }
}

function startRun(): void {
  resetRun(world);
  world.phase = 'playing';
  lastHighNotified = save.highScore;
  hideMenu();
  void audio.unlock();
  if (save.runs === 0) showToast('A/D lanes  ·  W jump  ·  S slide');
}

function tick(): void {
  const w = world;

  if (input.just('KeyM')) {
    audio.toggleMute();
    showToast(audio.muted ? 'audio off' : 'audio on');
  }

  if (w.phase === 'playing') {
    if (input.just('Escape') || input.just('KeyP')) {
      w.phase = 'paused';
      paintMenu();
      input.endFrame();
      return;
    }
    const ev = simulate(w, loop.dt, readSim(), QUALITY[save.settings.quality].particles);
    if (ev.jump) audio.jump();
    if (ev.slide) audio.slide();
    if (ev.collect === 'shard') audio.collect();
    if (ev.collect === 'shield') {
      audio.shield();
      showToast('aegis online');
    }
    if (ev.collect === 'magnet') {
      audio.magnet();
      showToast('gravity well');
    }
    if (ev.hit) audio.hit();
    if (ev.shielded) {
      audio.shield();
      showToast('aegis spent');
    }
    if (Math.floor(w.score) > lastHighNotified && lastHighNotified > 0 && w.score > save.highScore) {
      lastHighNotified = Math.floor(w.score) + 999999;
      w.newHigh = true;
      audio.highscore();
      showToast('new high score');
    }
    if (ev.died) {
      finishRun();
    }
  } else if (w.phase === 'paused') {
    if (input.just('Escape') || input.just('KeyP')) {
      w.phase = 'playing';
      hideMenu();
    }
  } else if (w.phase === 'menu') {
    if (input.just('Enter') || input.just('Space')) startRun();
  } else if (w.phase === 'over') {
    if (input.just('Enter') || input.just('Space')) startRun();
  }

  input.endFrame();
}

function readSim() {
  const left = input.just('ArrowLeft') || input.just('KeyA');
  const right = input.just('ArrowRight') || input.just('KeyD');
  const jump = input.just('ArrowUp') || input.just('KeyW') || input.just('Space') || input.just('JumpTap');
  const slide = input.just('ArrowDown') || input.just('KeyS') || input.just('ControlLeft') || input.just('SlideTap');
  return { left, right, jump, slide, pointerLane: input.pointerLane };
}

function finishRun(): void {
  const w = world;
  w.phase = 'over';
  audio.gameover();
  save.runs += 1;
  const score = Math.floor(w.score);
  if (score > save.highScore) {
    save.highScore = score;
    w.newHigh = true;
  }
  save.bestCombo = Math.max(save.bestCombo, w.bestCombo);
  save.longestRun = Math.max(save.longestRun, Math.floor(w.time));
  writeSave(save);
  paintMenu();
}

function draw(alpha: number): void {
  renderer.reduced = save.settings.reduced;
  renderer.shakeEnabled = save.settings.shake;
  renderer.setQuality(save.settings.quality);
  renderer.draw(world, alpha);
  updateHud(world, save);
}

function paintMenu(): void {
  const w = world;
  if (w.phase === 'playing') {
    hideMenu();
    return;
  }
  if (w.phase === 'menu') {
    showMenu({
      kicker: 'sector 9 · night cycle',
      title: 'NEON<br>RUSH',
      tag: 'outrun the grid. don\'t blink.',
      hint: `best ${save.highScore.toLocaleString()}  ·  runs ${save.runs}  ·  enter to ride`,
      actions: [
        { id: 'play', label: 'Ride', primary: true },
        { id: 'how', label: 'How to ride' },
        { id: 'settings', label: 'Tune' },
        { id: 'credits', label: 'Credits' },
      ],
    });
    return;
  }
  if (w.phase === 'how') {
    showMenu({
      kicker: 'briefing',
      title: 'HOW TO<br>RIDE',
      tag: 'three lanes. one bike. zero second chances.',
      body: `
        <strong>A / D</strong> or <kbd>←</kbd> <kbd>→</kbd> — switch lanes<br>
        <strong>W / Space</strong> — jump low gates<br>
        <strong>S</strong> — slide under high beams<br>
        Tap left/right thirds of the screen on touch.<br><br>
        Grab <strong>shards</strong> to stack a rush multiplier.
        <strong>Aegis</strong> eats one crash. <strong>Pull</strong> yanks shards into your lane.<br>
        Speed never lets up. Three hits and the grid takes you.
      `,
      actions: [
        { id: 'play', label: 'Ride', primary: true },
        { id: 'back', label: 'Back' },
      ],
    });
    return;
  }
  if (w.phase === 'settings') {
    const s = save.settings;
    showMenu({
      kicker: 'cockpit',
      title: 'TUNE',
      tag: 'feel, volume, fidelity.',
      body: settingsHtml(s),
      actions: [{ id: 'back', label: 'Back', primary: true }],
      hint: 'M mutes. Esc pauses in-run.',
    });
    return;
  }
  if (w.phase === 'credits') {
    showMenu({
      kicker: 'colophon',
      title: 'CREDITS',
      tag: 'built for the browser, not the store.',
      body: `
        NEON RUSH — a lane-running night ride.<br>
        Engine, art, and synth are original / procedural.<br>
        Type: Syne + IBM Plex Mono (Google Fonts, OFL).<br>
        No copyrighted game assets were used.
      `,
      actions: [{ id: 'back', label: 'Back', primary: true }],
    });
    return;
  }
  if (w.phase === 'paused') {
    showMenu({
      kicker: 'hold',
      title: 'PAUSED',
      tag: 'the grid waits. barely.',
      hint: 'Esc or P to resume',
      actions: [
        { id: 'resume', label: 'Resume', primary: true },
        { id: 'restart', label: 'Restart' },
        { id: 'settings', label: 'Tune' },
        { id: 'menu', label: 'Main menu' },
      ],
    });
    return;
  }
  if (w.phase === 'over') {
    const score = Math.floor(w.score);
    showMenu({
      kicker: w.newHigh ? 'new record' : 'signal lost',
      title: 'GRID<br>TOOK YOU',
      tag: w.newHigh ? 'you rewrote the board.' : 'the city keeps your name for a second.',
      body: `
        score <strong>${score.toLocaleString()}</strong><br>
        best <strong>${save.highScore.toLocaleString()}</strong><br>
        rush combo <strong>×${w.bestCombo}</strong><br>
        time <strong>${w.time.toFixed(1)}s</strong> · ${Math.floor(w.distance)} m
      `,
      hint: 'enter / space to ride again',
      actions: [
        { id: 'restart', label: 'Ride again', primary: true },
        { id: 'menu', label: 'Main menu' },
      ],
    });
  }
}

function settingsHtml(s: Settings): string {
  return `
    <label class="settings-row">master <input id="set-master" type="range" min="0" max="1" step="0.01" value="${s.master}"></label>
    <label class="settings-row">fx <input id="set-sfx" type="range" min="0" max="1" step="0.01" value="${s.sfx}"></label>
    <label class="settings-row">music <input id="set-music" type="range" min="0" max="1" step="0.01" value="${s.music}"></label>
    <label class="settings-row toggle"><span>screen shake</span><input id="set-shake" type="checkbox" ${s.shake ? 'checked' : ''}></label>
    <label class="settings-row toggle"><span>reduced motion</span><input id="set-reduced" type="checkbox" ${s.reduced ? 'checked' : ''}></label>
    <label class="settings-row">quality
      <select id="set-quality">
        <option value="low" ${s.quality === 'low' ? 'selected' : ''}>low</option>
        <option value="med" ${s.quality === 'med' ? 'selected' : ''}>med</option>
        <option value="high" ${s.quality === 'high' ? 'selected' : ''}>high</option>
      </select>
    </label>
  `;
}

function applySettingControl(el: HTMLInputElement | HTMLSelectElement): void {
  const s = save.settings;
  if (el.id === 'set-master') s.master = Number((el as HTMLInputElement).value);
  if (el.id === 'set-sfx') s.sfx = Number((el as HTMLInputElement).value);
  if (el.id === 'set-music') s.music = Number((el as HTMLInputElement).value);
  if (el.id === 'set-shake') s.shake = (el as HTMLInputElement).checked;
  if (el.id === 'set-reduced') s.reduced = (el as HTMLInputElement).checked;
  if (el.id === 'set-quality') s.quality = el.value as Settings['quality'];
  renderer.reduced = s.reduced;
  renderer.setQuality(s.quality);
  audio.apply(s);
  writeSave(save);
}
