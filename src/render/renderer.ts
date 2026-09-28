import { COLORS, LANE_WIDTH, PLAYER_Z, QUALITY, type Quality } from '../game/config';
import { clamp } from '../engine/math';
import type { World } from '../game/world';
import type { Obstacle, Particle, Pickup, Player } from '../game/entities';

const VANISH_Y = 0.28;
const HORIZON = 0.32;

interface Cam {
  w: number;
  h: number;
  shakeX: number;
  shakeY: number;
}

function project(x: number, y: number, z: number, cam: Cam): { x: number; y: number; s: number } {
  const depth = Math.max(0.35, z);
  const persp = 6.2 / depth;
  return {
    x: cam.w * 0.5 + x * persp * cam.w * 0.18 + cam.shakeX,
    y: cam.h * HORIZON - y * persp * cam.h * 0.12 + depth * cam.h * 0.018 + cam.shakeY,
    s: persp,
  };
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private stars: { x: number; y: number; z: number; s: number }[] = [];
  private buildings: { lane: number; z: number; h: number; w: number; hue: number }[] = [];
  private trail: { x: number; y: number; z: number; a: number }[] = [];
  private t = 0;
  quality: Quality = 'high';
  reduced = false;
  shakeEnabled = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.seedDecor();
  }

  private seedDecor(): void {
    this.stars = [];
    this.buildings = [];
    const q = QUALITY[this.quality];
    for (let i = 0; i < q.stars; i++) {
      this.stars.push({
        x: Math.random() * 2 - 1,
        y: Math.random(),
        z: Math.random() * 80 + 4,
        s: Math.random() * 1.6 + 0.3,
      });
    }
    for (let i = 0; i < q.buildings; i++) {
      this.buildings.push({
        lane: Math.random() < 0.5 ? -2.6 : 2.6,
        z: Math.random() * 90 + 8,
        h: 2 + Math.random() * 6,
        w: 0.7 + Math.random() * 1.2,
        hue: 260 + Math.random() * 80,
      });
    }
  }

  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    this.seedDecor();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality === 'low' ? 1 : 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  draw(w: World, alpha: number): void {
    this.t += 1 / 60;
    const q = QUALITY[this.quality];
    const ctx = this.ctx;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const shakeAmp = w.shake * (this.reduced || !this.shakeEnabled ? 0 : 14);
    const cam: Cam = {
      w: W,
      h: H,
      shakeX: Math.sin(this.t * 54) * shakeAmp,
      shakeY: Math.cos(this.t * 47) * shakeAmp * 0.6,
    };

    this.sky(ctx, W, H, w);
    this.city(ctx, cam, w, q.buildings);
    this.road(ctx, cam, w);
    this.pickups(ctx, cam, w);
    this.obstacles(ctx, cam, w);
    if (w.phase === 'playing' || w.phase === 'paused' || w.phase === 'over') {
      this.player(ctx, cam, w.player, w);
    }
    this.particles(ctx, cam, w);
    if (w.flash > 0) {
      ctx.fillStyle = `rgba(255,45,149,${w.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (w.nearMiss > 0) {
      ctx.strokeStyle = `rgba(61,245,255,${w.nearMiss})`;
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 8, W - 16, H - 16);
    }
    void alpha;
  }

  private sky(ctx: CanvasRenderingContext2D, W: number, H: number, w: World): void {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#090614');
    g.addColorStop(0.35, '#160b2c');
    g.addColorStop(0.62, '#24103a');
    g.addColorStop(1, '#07040f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    const sunY = H * VANISH_Y;
    const sun = ctx.createRadialGradient(W * 0.5, sunY, 4, W * 0.5, sunY, H * 0.42);
    sun.addColorStop(0, 'rgba(255,45,149,0.55)');
    sun.addColorStop(0.25, 'rgba(123,92,255,0.22)');
    sun.addColorStop(1, 'rgba(7,4,15,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    ctx.beginPath();
    ctx.arc(W * 0.5, sunY, 28 + Math.sin(this.t) * 2, 0, Math.PI * 2);
    ctx.fillStyle = '#ff2d95';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.5, sunY, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#ffb347';
    ctx.fill();

    for (const s of this.stars) {
      s.z -= w.speed * 0.015;
      if (s.z < 1) s.z = 80;
      const p = project(s.x * 8, 3 + s.y * 4, s.z, { w: W, h: H, shakeX: 0, shakeY: 0 });
      ctx.fillStyle = `rgba(244,240,255,${0.35 + (s.s / 2) * 0.5})`;
      ctx.fillRect(p.x, p.y, s.s, s.s);
    }
  }

  private city(ctx: CanvasRenderingContext2D, cam: Cam, w: World, count: number): void {
    for (const b of this.buildings) {
      b.z -= w.speed * 0.022;
      if (b.z < 2) {
        b.z = 70 + Math.random() * 40;
        b.h = 2 + Math.random() * 6;
        b.hue = 260 + Math.random() * 80;
      }
    }
    const sorted = [...this.buildings].sort((a, b) => b.z - a.z).slice(0, count);
    for (const b of sorted) {
      const base = project(b.lane, 0, b.z, cam);
      const top = project(b.lane, b.h, b.z, cam);
      const half = b.w * base.s * 22;
      const h = base.y - top.y;
      ctx.fillStyle = `hsla(${b.hue}, 70%, 12%, 0.9)`;
      ctx.fillRect(base.x - half, top.y, half * 2, h);
      ctx.strokeStyle = `hsla(${b.hue}, 90%, 60%, 0.35)`;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(base.x - half, top.y, half * 2, h);
      const rows = Math.max(2, Math.floor(b.h * 2));
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = r % 3 === 0 ? 'rgba(255,45,149,0.35)' : 'rgba(61,245,255,0.22)';
        ctx.fillRect(base.x - half * 0.6, top.y + 8 + r * (h / rows), half * 0.3, 3);
        ctx.fillRect(base.x + half * 0.2, top.y + 8 + r * (h / rows), half * 0.3, 3);
      }
    }
  }

  private road(ctx: CanvasRenderingContext2D, cam: Cam, w: World): void {
    const farL = project(-LANE_WIDTH * 1.7, 0, 70, cam);
    const farR = project(LANE_WIDTH * 1.7, 0, 70, cam);
    const nearL = project(-LANE_WIDTH * 1.7, 0, 0.6, cam);
    const nearR = project(LANE_WIDTH * 1.7, 0, 0.6, cam);

    ctx.beginPath();
    ctx.moveTo(farL.x, farL.y);
    ctx.lineTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.lineTo(nearL.x, nearL.y);
    ctx.closePath();
    const rg = ctx.createLinearGradient(0, farL.y, 0, nearL.y);
    rg.addColorStop(0, '#1a0f33');
    rg.addColorStop(1, '#0b0718');
    ctx.fillStyle = rg;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,45,149,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(farL.x, farL.y);
    ctx.lineTo(nearL.x, nearL.y);
    ctx.moveTo(farR.x, farR.y);
    ctx.lineTo(nearR.x, nearR.y);
    ctx.stroke();

    for (let i = -1; i <= 1; i += 2) {
      const f = project(i * LANE_WIDTH * 0.5, 0, 70, cam);
      const n = project(i * LANE_WIDTH * 0.5, 0, 0.6, cam);
      ctx.strokeStyle = 'rgba(61,245,255,0.28)';
      ctx.setLineDash([18, 22]);
      ctx.lineDashOffset = -(w.distance * 4);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(n.x, n.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const gridN = 16;
    for (let i = 0; i < gridN; i++) {
      const z = ((i * 5 + (w.distance % 5)) % (gridN * 5 / 2)) + 1;
      const l = project(-LANE_WIDTH * 1.7, 0, z, cam);
      const r = project(LANE_WIDTH * 1.7, 0, z, cam);
      ctx.strokeStyle = `rgba(123,92,255,${0.08 + (1 - z / 40) * 0.15})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
    }
  }

  private obstacles(ctx: CanvasRenderingContext2D, cam: Cam, w: World): void {
    const sorted = [...w.obstacles].sort((a, b) => b.z - a.z);
    for (const o of sorted) this.drawObstacle(ctx, cam, o);
  }

  private drawObstacle(ctx: CanvasRenderingContext2D, cam: Cam, o: Obstacle): void {
    const x = (o.lane - 1) * LANE_WIDTH;
    const y = o.kind === 'high' ? 0.85 : o.kind === 'drone' ? 0.95 : 0;
    const p = project(x, y, o.z, cam);
    const s = p.s;
    if (o.kind === 'drone') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(this.t * 6 + o.lane) * 0.15);
      ctx.fillStyle = '#3df5ff';
      ctx.shadowColor = '#3df5ff';
      ctx.shadowBlur = QUALITY[this.quality].glow ? 16 : 0;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff2d95';
      ctx.beginPath();
      ctx.arc(0, 0, 5 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.shadowBlur = 0;
      return;
    }
    const bw = 36 * s * (o.kind === 'low' ? 1.1 : 1);
    const bh = o.kind === 'low' ? 16 * s : o.kind === 'high' ? 22 * s : 48 * s;
    const color = o.kind === 'low' ? COLORS.amber : o.kind === 'high' ? COLORS.violet : COLORS.magenta;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = QUALITY[this.quality].glow ? 18 : 0;
    const yOff = o.kind === 'high' ? -bh * 0.2 : 0;
    roundRect(ctx, p.x - bw / 2, p.y - bh + yOff, bw, bh, 4 * s);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(244,240,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (o.kind === 'high') {
      ctx.fillStyle = 'rgba(7,4,15,0.45)';
      ctx.fillRect(p.x - bw / 2, p.y + 4, bw, 40 * s);
    }
  }

  private pickups(ctx: CanvasRenderingContext2D, cam: Cam, w: World): void {
    for (const pk of w.pickups) this.drawPickup(ctx, cam, pk);
  }

  private drawPickup(ctx: CanvasRenderingContext2D, cam: Cam, pk: Pickup): void {
    const x = (pk.lane - 1) * LANE_WIDTH;
    const p = project(x, 0.55 + Math.sin(pk.spin) * 0.12, pk.z, cam);
    const s = p.s;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(pk.spin);
    const col = pk.kind === 'shard' ? COLORS.amber : pk.kind === 'shield' ? COLORS.cyan : COLORS.violet;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = QUALITY[this.quality].glow ? 14 : 0;
    if (pk.kind === 'shard') {
      ctx.beginPath();
      ctx.moveTo(0, -12 * s);
      ctx.lineTo(8 * s, 0);
      ctx.lineTo(0, 12 * s);
      ctx.lineTo(-8 * s, 0);
      ctx.closePath();
      ctx.fill();
    } else if (pk.kind === 'shield') {
      ctx.beginPath();
      ctx.arc(0, 0, 10 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.white;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(0, 0, 10 * s, 0, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  private player(ctx: CanvasRenderingContext2D, cam: Cam, pl: Player, w: World): void {
    const p = project(pl.laneX, pl.y, PLAYER_Z, cam);
    const s = p.s;
    const blink = pl.invuln > 0 && Math.floor(this.t * 20) % 2 === 0;
    if (blink) ctx.globalAlpha = 0.35;

    this.trail.push({ x: pl.laneX, y: pl.y, z: PLAYER_Z + 0.4, a: 1 });
    if (this.trail.length > 18) this.trail.shift();
    for (let i = 0; i < this.trail.length; i++) {
      const tr = this.trail[i]!;
      tr.a *= 0.88;
      const tp = project(tr.x, tr.y, tr.z + (this.trail.length - i) * 0.12, cam);
      ctx.fillStyle = `rgba(61,245,255,${tr.a * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(tp.x, tp.y + 8, 10 * tp.s, 4 * tp.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    const lean = clamp((pl.laneX - (pl.lane - 1) * LANE_WIDTH) * 0.4, -0.35, 0.35);
    ctx.rotate(lean);
    const sliding = pl.slideT > 0;
    const scaleY = sliding ? 0.55 : 1;

    ctx.shadowColor = pl.shield ? COLORS.cyan : COLORS.magenta;
    ctx.shadowBlur = QUALITY[this.quality].glow ? 22 : 0;

    ctx.fillStyle = '#1a1028';
    ctx.beginPath();
    ctx.ellipse(0, 18 * s * scaleY, 22 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.magenta;
    roundRect(ctx, -16 * s, -10 * s * scaleY, 32 * s, 22 * s * scaleY, 6 * s);
    ctx.fill();

    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.moveTo(-6 * s, -10 * s * scaleY);
    ctx.lineTo(0, -28 * s * scaleY);
    ctx.lineTo(6 * s, -10 * s * scaleY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.fillRect(-10 * s, 0, 6 * s, 4 * s);
    ctx.fillRect(4 * s, 0, 6 * s, 4 * s);

    if (pl.shield) {
      ctx.strokeStyle = `rgba(61,245,255,${0.6 + Math.sin(this.t * 8) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 34 * s, 28 * s * scaleY, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (w.combo >= 8) {
      ctx.fillStyle = 'rgba(255,179,71,0.15)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 48, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private particles(ctx: CanvasRenderingContext2D, cam: Cam, w: World): void {
    for (const pt of w.particles) this.drawParticle(ctx, cam, pt);
  }

  private drawParticle(ctx: CanvasRenderingContext2D, cam: Cam, pt: Particle): void {
    const p = project(pt.x, pt.y, pt.z, cam);
    const a = clamp(pt.life / pt.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    if (pt.spark) {
      ctx.fillRect(p.x, p.y, pt.size * p.s, pt.size * p.s * 0.3);
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, pt.size * p.s * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

