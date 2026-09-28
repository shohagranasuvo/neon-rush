export type ObstacleKind = 'barrier' | 'low' | 'high' | 'drone';
export type PickupKind = 'shard' | 'shield' | 'magnet';

export interface Player {
  lane: number;
  laneX: number;
  y: number;
  jumpT: number;
  slideT: number;
  coolT: number;
  invuln: number;
  hp: number;
  magnet: number;
  shield: boolean;
  skin: string;
}

export interface Obstacle {
  alive: boolean;
  kind: ObstacleKind;
  lane: number;
  z: number;
  w: number;
  h: number;
}

export interface Pickup {
  alive: boolean;
  kind: PickupKind;
  lane: number;
  z: number;
  spin: number;
}

export interface Particle {
  alive: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  size: number;
  color: string;
  spark: boolean;
}

export const makePlayer = (): Player => ({
  lane: 1,
  laneX: 0,
  y: 0,
  jumpT: 0,
  slideT: 0,
  coolT: 0,
  invuln: 0,
  hp: 3,
  magnet: 0,
  shield: false,
  skin: 'default',
});
