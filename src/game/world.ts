import {
  ACCEL,
  BASE_SPEED,
  COOLDOWN,
  INVULN,
  JUMP_DUR,
  LANE_LERP,
  LANE_WIDTH,
  LANES,
  MAX_HP,
  MAX_SPEED,
  PLAYER_Z,
  SLIDE_DUR,
  SPAWN_DECAY,
  SPAWN_MIN,
  SPAWN_START,
} from './config';
import { Pool } from '../engine/pool';
import { clamp, lerp, Rng } from '../engine/math';
import type { Obstacle, ObstacleKind, Particle, Pickup, PickupKind, Player } from './entities';
import { makePlayer } from './entities';

export type Phase = 'boot' | 'menu' | 'how' | 'settings' | 'credits' | 'playing' | 'paused' | 'over';

export interface World {
  phase: Phase;
  prevPhase: Phase;
  player: Player;
  obstacles: Obstacle[];
  pickups: Pickup[];
  particles: Particle[];
  speed: number;
  distance: number;
  score: number;
  combo: number;
  comboT: number;
  bestCombo: number;
  time: number;
  spawnT: number;
  spawnEvery: number;
  shake: number;
  flash: number;
  nearMiss: number;
  newHigh: boolean;
  seed: number;
  rng: Rng;
}

const obPool = new Pool<Obstacle>(
  () => ({ alive: false, kind: 'barrier', lane: 0, z: 0, w: 0.7, h: 1 }),
  (o) => {
    o.alive = true;
  },
  40,
);
const pkPool = new Pool<Pickup>(
  () => ({ alive: false, kind: 'shard', lane: 0, z: 0, spin: 0 }),
  (p) => {
    p.alive = true;
    p.spin = 0;
  },
  30,
);
const ptPool = new Pool<Particle>(
  () => ({
    alive: false,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    life: 0,
    max: 1,
    size: 2,
    color: '#fff',
    spark: false,
  }),
  (p) => {
    p.alive = true;
  },
  260,
);

export function createWorld(): World {
  return {
    phase: 'menu',
    prevPhase: 'menu',
    player: makePlayer(),
    obstacles: [],
    pickups: [],
    particles: [],
    speed: BASE_SPEED,
    distance: 0,
    score: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
    time: 0,
    spawnT: 0.4,
    spawnEvery: SPAWN_START,
    shake: 0,
    flash: 0,
    nearMiss: 0,
    newHigh: false,
    seed: (Math.random() * 1e9) | 0,
    rng: new Rng((Math.random() * 1e9) | 0),
  };
}

export function resetRun(w: World): void {
  recycleAll(w);
  w.player = makePlayer();
  w.speed = BASE_SPEED;
  w.distance = 0;
  w.score = 0;
  w.combo = 0;
  w.comboT = 0;
  w.bestCombo = 0;
  w.time = 0;
  w.spawnT = 1.6;
  w.spawnEvery = SPAWN_START;
  w.shake = 0;
  w.flash = 0;
  w.nearMiss = 0;
  w.newHigh = false;
  w.seed = (Math.random() * 1e9) | 0;
  w.rng = new Rng(w.seed);
}

function recycleAll(w: World): void {
  for (const o of w.obstacles) {
    o.alive = false;
    obPool.release(o);
  }
  for (const p of w.pickups) {
    p.alive = false;
    pkPool.release(p);
  }
  for (const p of w.particles) {
    p.alive = false;
    ptPool.release(p);
  }
  w.obstacles.length = 0;
  w.pickups.length = 0;
  w.particles.length = 0;
}

export function spawnParticle(
  w: World,
  opts: Partial<Particle> & { x: number; y: number; z: number },
  cap: number,
): void {
  if (w.particles.length >= cap) return;
  const p = ptPool.acquire();
  p.x = opts.x;
  p.y = opts.y;
  p.z = opts.z;
  p.vx = opts.vx ?? 0;
  p.vy = opts.vy ?? 0;
  p.vz = opts.vz ?? 0;
  p.life = opts.life ?? 0.5;
  p.max = opts.max ?? p.life;
  p.size = opts.size ?? 3;
  p.color = opts.color ?? '#3df5ff';
  p.spark = opts.spark ?? false;
  w.particles.push(p);
}

function spawnObstacle(w: World, kind: ObstacleKind, lane: number, z: number): void {
  const o = obPool.acquire();
  o.kind = kind;
  o.lane = lane;
  o.z = z;
  o.w = kind === 'drone' ? 0.55 : 0.82;
  o.h = kind === 'low' ? 0.45 : kind === 'high' ? 0.7 : 1.05;
  w.obstacles.push(o);
}

function spawnPickup(w: World, kind: PickupKind, lane: number, z: number): void {
  const p = pkPool.acquire();
  p.kind = kind;
  p.lane = lane;
  p.z = z;
  w.pickups.push(p);
}

function burst(w: World, x: number, y: number, z: number, color: string, n: number, cap: number): void {
  for (let i = 0; i < n; i++) {
    spawnParticle(
      w,
      {
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 0.4,
        vz: (Math.random() - 0.5) * 3,
        life: 0.35 + Math.random() * 0.4,
        max: 0.75,
        size: 2 + Math.random() * 3,
        color,
        spark: Math.random() > 0.4,
      },
      cap,
    );
  }
}

export interface SimInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  slide: boolean;
  pointerLane: number | null;
}

export interface SimEvents {
  collect: PickupKind | null;
  hit: boolean;
  shielded: boolean;
  jump: boolean;
  slide: boolean;
  nearMiss: boolean;
  died: boolean;
}

export function simulate(w: World, dt: number, input: SimInput, particleCap: number): SimEvents {
  const ev: SimEvents = {
    collect: null,
    hit: false,
    shielded: false,
    jump: false,
    slide: false,
    nearMiss: false,
    died: false,
  };
  const p = w.player;
  w.time += dt;
  w.speed = Math.min(MAX_SPEED, w.speed + ACCEL * dt);
  w.distance += w.speed * dt;
  w.score += w.speed * dt * (1 + w.combo * 0.15);
  w.comboT = Math.max(0, w.comboT - dt);
  if (w.comboT <= 0) w.combo = 0;
  w.shake = Math.max(0, w.shake - dt * 6);
  w.flash = Math.max(0, w.flash - dt * 3);
  w.nearMiss = Math.max(0, w.nearMiss - dt);

  p.coolT = Math.max(0, p.coolT - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.magnet = Math.max(0, p.magnet - dt);

  if (input.pointerLane !== null) p.lane = input.pointerLane;
  else {
    if (input.left) p.lane = Math.max(0, p.lane - 1);
    if (input.right) p.lane = Math.min(LANES - 1, p.lane + 1);
  }

  const targetX = (p.lane - 1) * LANE_WIDTH;
  p.laneX = lerp(p.laneX, targetX, 1 - Math.exp(-LANE_LERP * dt));

  if (input.jump && p.coolT <= 0 && p.jumpT <= 0 && p.slideT <= 0) {
    p.jumpT = JUMP_DUR;
    p.coolT = COOLDOWN;
    ev.jump = true;
  }
  if (input.slide && p.coolT <= 0 && p.jumpT <= 0 && p.slideT <= 0) {
    p.slideT = SLIDE_DUR;
    p.coolT = COOLDOWN;
    ev.slide = true;
  }

  if (p.jumpT > 0) {
    p.jumpT -= dt;
    const t = 1 - clamp(p.jumpT / JUMP_DUR, 0, 1);
    p.y = Math.sin(t * Math.PI) * 1.35;
    if (p.jumpT <= 0) p.y = 0;
  } else if (p.slideT > 0) {
    p.slideT -= dt;
    p.y = -0.35;
    if (p.slideT <= 0) p.y = 0;
  } else {
    p.y = lerp(p.y, 0, 1 - Math.exp(-18 * dt));
  }

  w.spawnT -= dt;
  if (w.spawnT <= 0) {
    wave(w);
    w.spawnEvery = Math.max(SPAWN_MIN, w.spawnEvery - SPAWN_DECAY);
    w.spawnT = w.spawnEvery * (0.85 + w.rng.next() * 0.35);
  }

  const move = w.speed * dt;
  for (let i = w.obstacles.length - 1; i >= 0; i--) {
    const o = w.obstacles[i]!;
    o.z -= move;
    if (o.z < -2) {
      o.alive = false;
      obPool.release(o);
      w.obstacles.splice(i, 1);
      continue;
    }
    if (Math.abs(o.z - PLAYER_Z) < 1.1 && o.lane !== p.lane && Math.abs(o.z - PLAYER_Z) < 0.55) {
      w.nearMiss = 0.25;
      ev.nearMiss = true;
    }
    if (hits(p, o)) {
      if (p.shield) {
        p.shield = false;
        ev.shielded = true;
        burst(w, p.laneX, 0.4, PLAYER_Z, '#3df5ff', 18, particleCap);
        o.alive = false;
        obPool.release(o);
        w.obstacles.splice(i, 1);
        continue;
      }
      if (p.invuln <= 0) {
        p.hp -= 1;
        p.invuln = INVULN;
        w.shake = 0.55;
        w.flash = 0.35;
        w.combo = 0;
        ev.hit = true;
        burst(w, p.laneX, 0.4, PLAYER_Z, '#ff2d95', 24, particleCap);
        if (p.hp <= 0) {
          ev.died = true;
        }
      }
    }
  }

  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const pk = w.pickups[i]!;
    pk.z -= move;
    pk.spin += dt * 4;
    if (p.magnet > 0 && pk.kind === 'shard') {
      const dx = p.lane - pk.lane;
      if (Math.abs(dx) <= 1 && pk.z < 18) pk.lane = p.lane;
    }
    if (pk.z < -2) {
      pk.alive = false;
      pkPool.release(pk);
      w.pickups.splice(i, 1);
      continue;
    }
    if (Math.abs(pk.z - PLAYER_Z) < 0.9 && pk.lane === p.lane && p.y > -0.2) {
      if (pk.kind === 'shard') {
        w.combo += 1;
        w.comboT = 2.4;
        w.bestCombo = Math.max(w.bestCombo, w.combo);
        w.score += 25 * (1 + w.combo * 0.2);
        ev.collect = 'shard';
        burst(w, (pk.lane - 1) * LANE_WIDTH, 0.6, PLAYER_Z, '#ffb347', 12, particleCap);
      } else if (pk.kind === 'shield') {
        p.shield = true;
        ev.collect = 'shield';
        burst(w, p.laneX, 0.6, PLAYER_Z, '#3df5ff', 16, particleCap);
      } else {
        p.magnet = 6;
        ev.collect = 'magnet';
        burst(w, p.laneX, 0.6, PLAYER_Z, '#7b5cff', 16, particleCap);
      }
      pk.alive = false;
      pkPool.release(pk);
      w.pickups.splice(i, 1);
    }
  }

  for (let i = w.particles.length - 1; i >= 0; i--) {
    const pt = w.particles[i]!;
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.z += pt.vz * dt;
    pt.vy -= 4 * dt;
    if (pt.life <= 0) {
      pt.alive = false;
      ptPool.release(pt);
      w.particles.splice(i, 1);
    }
  }

  if (particleCap > 40) {
    spawnParticle(
      w,
      {
        x: p.laneX + (Math.random() - 0.5) * 0.12,
        y: p.y * 0.4,
        z: PLAYER_Z + 0.8,
        vx: (Math.random() - 0.5) * 0.4,
        vy: Math.random() * 0.3,
        vz: 6 + Math.random() * 4,
        life: 0.28,
        max: 0.28,
        size: 2.2,
        color: p.shield ? '#3df5ff' : '#ff2d95',
        spark: true,
      },
      particleCap,
    );
  }

  p.hp = clamp(p.hp, 0, MAX_HP);
  return ev;
}

function hits(p: Player, o: Obstacle): boolean {
  if (o.lane !== p.lane) return false;
  if (Math.abs(o.z - PLAYER_Z) > 0.7) return false;
  if (o.kind === 'low') return p.jumpT <= 0;
  if (o.kind === 'high') return p.slideT <= 0;
  if (o.kind === 'drone') return p.y < 0.9;
  return p.y < 0.85 && p.slideT <= 0;
}

function wave(w: World): void {
  const z = 42 + w.rng.range(0, 8);
  const dens = clamp((w.speed - BASE_SPEED) / (MAX_SPEED - BASE_SPEED), 0, 1);
  const tutorial = w.time < 8;
  const pattern = tutorial ? 0 : w.rng.int(0, 6);
  const occupied = new Set<number>();

  const place = (lane: number, kind: ObstacleKind, extraZ = 0) => {
    occupied.add(lane);
    spawnObstacle(w, kind, lane, z + extraZ);
  };

  if (pattern === 0) {
    place(w.rng.int(0, 2), w.rng.pick(['barrier', 'low', 'high'] as const));
  } else if (pattern === 1) {
    const skip = w.rng.int(0, 2);
    for (let l = 0; l < 3; l++) if (l !== skip) place(l, 'barrier');
  } else if (pattern === 2) {
    place(0, 'low');
    place(2, 'high');
  } else if (pattern === 3) {
    place(w.rng.int(0, 2), 'drone', w.rng.range(-2, 2));
    if (dens > 0.4) place(w.rng.int(0, 2), 'barrier', 6);
  } else if (pattern === 4) {
    place(1, 'barrier');
    place(0, 'low', 4);
    place(2, 'high', 4);
  } else {
    const k: ObstacleKind = dens > 0.6 ? 'drone' : 'barrier';
    place(w.rng.int(0, 2), k);
    if (w.rng.chance(0.5)) place(w.rng.int(0, 2), 'low', 5);
  }

  if (w.rng.chance(0.55)) {
    let lane = w.rng.int(0, 2);
    if (occupied.has(lane)) {
      lane = [0, 1, 2].find((l) => !occupied.has(l)) ?? lane;
    }
    const kind: PickupKind = w.rng.chance(0.12) ? 'shield' : w.rng.chance(0.16) ? 'magnet' : 'shard';
    spawnPickup(w, kind, lane, z + w.rng.range(2, 7));
  }

  if (w.rng.chance(0.35)) {
    const lane = w.rng.int(0, 2);
    spawnPickup(w, 'shard', lane, z + 10);
  }
}
