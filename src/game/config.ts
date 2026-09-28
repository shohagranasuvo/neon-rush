export const COLORS = {
  void: '#07040f',
  indigo: '#140c24',
  magenta: '#ff2d95',
  cyan: '#3df5ff',
  amber: '#ffb347',
  violet: '#7b5cff',
  white: '#f4f0ff',
  dim: '#8a7aa8',
} as const;

export const LANES = 3;
export const LANE_WIDTH = 1.15;
export const PLAYER_Z = 2.2;

export const BASE_SPEED = 18;
export const MAX_SPEED = 46;
export const ACCEL = 0.42;
export const LANE_LERP = 14;
export const JUMP_DUR = 0.48;
export const SLIDE_DUR = 0.42;
export const COOLDOWN = 0.12;
export const INVULN = 1.15;
export const MAX_HP = 3;

export const SPAWN_START = 1.15;
export const SPAWN_MIN = 0.38;
export const SPAWN_DECAY = 0.012;

export const STORAGE_KEY = 'neon-rush-v1';

export type Quality = 'low' | 'med' | 'high';

export interface Settings {
  master: number;
  sfx: number;
  music: number;
  shake: boolean;
  reduced: boolean;
  quality: Quality;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.7,
  sfx: 0.85,
  music: 0.45,
  shake: true,
  reduced: false,
  quality: 'high',
};

export const QUALITY = {
  low: { particles: 40, buildings: 8, glow: false, stars: 40 },
  med: { particles: 110, buildings: 14, glow: true, stars: 80 },
  high: { particles: 220, buildings: 22, glow: true, stars: 140 },
} as const;
