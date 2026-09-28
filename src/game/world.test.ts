import { describe, expect, it } from 'vitest';
import { createWorld, resetRun, simulate, type SimInput } from './world';
import { BASE_SPEED, LANES } from './config';
import { clamp, lerp, Rng } from '../engine/math';
import { loadSave, writeSave } from './storage';

const idle: SimInput = { left: false, right: false, jump: false, slide: false, pointerLane: null };

describe('math', () => {
  it('clamps and lerps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it('rng is deterministic', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(a.next()).toBe(b.next());
    expect(a.int(0, 2)).toBe(b.int(0, 2));
  });
});

describe('world', () => {
  it('starts in menu with full health', () => {
    const w = createWorld();
    expect(w.phase).toBe('menu');
    expect(w.player.hp).toBe(3);
    expect(w.speed).toBe(BASE_SPEED);
    expect(w.player.lane).toBe(1);
  });

  it('resetRun zeros score and keeps 3 lanes valid', () => {
    const w = createWorld();
    w.score = 999;
    w.player.lane = 2;
    resetRun(w);
    expect(w.score).toBe(0);
    expect(w.player.lane).toBe(1);
    expect(w.player.lane).toBeGreaterThanOrEqual(0);
    expect(w.player.lane).toBeLessThan(LANES);
  });

  it('jump raises player then lands', () => {
    const w = createWorld();
    simulate(w, 1 / 60, { ...idle, jump: true }, 200);
    expect(w.player.jumpT).toBeGreaterThan(0);
    for (let i = 0; i < 80; i++) simulate(w, 1 / 60, idle, 200);
    expect(w.player.jumpT).toBeLessThanOrEqual(0);
    expect(w.player.y).toBeLessThan(0.2);
  });

  it('left/right change lane', () => {
    const w = createWorld();
    simulate(w, 1 / 60, { ...idle, left: true }, 200);
    expect(w.player.lane).toBe(0);
    simulate(w, 1 / 60, { ...idle, right: true }, 200);
    expect(w.player.lane).toBe(1);
  });

  it('score and distance grow over time', () => {
    const w = createWorld();
    for (let i = 0; i < 120; i++) simulate(w, 1 / 60, idle, 200);
    expect(w.score).toBeGreaterThan(0);
    expect(w.distance).toBeGreaterThan(0);
    expect(w.speed).toBeGreaterThan(BASE_SPEED);
  });

  it('barriers hit standing player', () => {
    const w = createWorld();
    w.obstacles.push({ alive: true, kind: 'barrier', lane: 1, z: 2.2, w: 0.8, h: 1 });
    const ev = simulate(w, 1 / 60, idle, 200);
    expect(ev.hit).toBe(true);
    expect(w.player.hp).toBe(2);
  });

  it('jump clears low obstacles', () => {
    const w = createWorld();
    simulate(w, 1 / 60, { ...idle, jump: true }, 200);
    w.obstacles.push({ alive: true, kind: 'low', lane: 1, z: 2.2, w: 0.8, h: 0.4 });
    const ev = simulate(w, 1 / 60, idle, 200);
    expect(ev.hit).toBe(false);
  });

  it('slide clears high obstacles', () => {
    const w = createWorld();
    simulate(w, 1 / 60, { ...idle, slide: true }, 200);
    w.obstacles.push({ alive: true, kind: 'high', lane: 1, z: 2.2, w: 0.8, h: 0.7 });
    const ev = simulate(w, 1 / 60, idle, 200);
    expect(ev.hit).toBe(false);
  });

  it('collecting shards increases combo and score', () => {
    const w = createWorld();
    const before = w.score;
    w.pickups.push({ alive: true, kind: 'shard', lane: 1, z: 2.2, spin: 0 });
    const ev = simulate(w, 1 / 60, idle, 200);
    expect(ev.collect).toBe('shard');
    expect(w.combo).toBe(1);
    expect(w.score).toBeGreaterThan(before);
  });

  it('shield absorbs a hit', () => {
    const w = createWorld();
    w.player.shield = true;
    w.obstacles.push({ alive: true, kind: 'barrier', lane: 1, z: 2.2, w: 0.8, h: 1 });
    const ev = simulate(w, 1 / 60, idle, 200);
    expect(ev.shielded).toBe(true);
    expect(ev.hit).toBe(false);
    expect(w.player.hp).toBe(3);
    expect(w.player.shield).toBe(false);
  });

  it('three hits kill', () => {
    const w = createWorld();
    let died = false;
    for (let i = 0; i < 3; i++) {
      w.player.invuln = 0;
      w.obstacles.push({ alive: true, kind: 'barrier', lane: 1, z: 2.2, w: 0.8, h: 1 });
      const ev = simulate(w, 1 / 60, idle, 200);
      if (ev.died) died = true;
      w.obstacles.length = 0;
    }
    expect(died).toBe(true);
    expect(w.player.hp).toBe(0);
  });
});

describe('storage', () => {
  it('roundtrips and recovers garbage', () => {
    const mem: Record<string, string> = {};
    const store = {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      key: () => null,
      length: 0,
    };
    (globalThis as unknown as { localStorage: Storage }).localStorage = store as unknown as Storage;
    const a = loadSave();
    a.highScore = 1234;
    writeSave(a);
    expect(loadSave().highScore).toBe(1234);
    mem['neon-rush-v1'] = '{not json';
    expect(loadSave().highScore).toBe(0);
  });
});
