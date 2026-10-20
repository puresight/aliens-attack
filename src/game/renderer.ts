import {
  ALIEN_HALF_H,
  ALIEN_HALF_W,
  BARRIER_BLOCK,
  BARRIER_HP,
  COLORS,
  KIND_COLORS,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_H,
  PLAYER_W,
} from './constants';
import type { Alien, BarrierBlock, Particle, Player, RenderState, Star } from './types';

function drawStars(ctx: CanvasRenderingContext2D, stars: Star[], time: number): void {
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(time * 2.2 + s.phase);
    ctx.globalAlpha = tw * 0.8;
    ctx.fillStyle = COLORS.star;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, time: number, invuln: boolean): void {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (invuln) {
    ctx.globalAlpha = 0.35 + 0.3 * Math.sin(time * 16);
  }

  // thruster flame (flickering triangle below the hull)
  const flame = 12 + Math.sin(time * 30) * 5;
  const grad = ctx.createLinearGradient(0, PLAYER_H / 2 - 2, 0, PLAYER_H / 2 + flame);
  grad.addColorStop(0, COLORS.thruster);
  grad.addColorStop(1, 'rgba(251, 146, 60, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-7, PLAYER_H / 2 - 2);
  ctx.lineTo(7, PLAYER_H / 2 - 2);
  ctx.lineTo(0, PLAYER_H / 2 + flame);
  ctx.closePath();
  ctx.fill();

  // delta/chevron fighter: cyan vector outline
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COLORS.player;
  ctx.fillStyle = COLORS.playerFill;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_H / 2);
  ctx.lineTo(PLAYER_W / 2, PLAYER_H / 2);
  ctx.lineTo(0, PLAYER_H / 2 - 8);
  ctx.lineTo(-PLAYER_W / 2, PLAYER_H / 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // cockpit accent
  ctx.strokeStyle = '#f0abfc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_H / 2 + 7);
  ctx.lineTo(0, 2);
  ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawScout(ctx: CanvasRenderingContext2D, time: number): void {
  // magenta diamond drone with pulsing core
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  ctx.beginPath();
  ctx.moveTo(0, -ALIEN_HALF_H - 2);
  ctx.lineTo(ALIEN_HALF_W, 0);
  ctx.lineTo(0, ALIEN_HALF_H + 2);
  ctx.lineTo(-ALIEN_HALF_W, 0);
  ctx.closePath();
  ctx.strokeStyle = KIND_COLORS.scout;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(232, 121, 249, 0.18)';
  ctx.fill();
  const r = 3.2 + pulse * 2.4;
  ctx.fillStyle = KIND_COLORS.scout;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawCruiser(ctx: CanvasRenderingContext2D, time: number): void {
  // yellow hexagonal multi-pod: center hex + two side pods
  ctx.strokeStyle = KIND_COLORS.cruiser;
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(253, 224, 71, 0.15)';
  const hex = (cx: number, r: number) => {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 6 + (i * Math.PI) / 3;
      const px = cx + Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  hex(0, ALIEN_HALF_H);
  hex(-ALIEN_HALF_W + 2, 7);
  hex(ALIEN_HALF_W - 2, 7);
  // blinking pods
  const blink = Math.sin(time * 6) > 0;
  ctx.fillStyle = KIND_COLORS.cruiser;
  if (blink) {
    ctx.fillRect(-ALIEN_HALF_W + 1, -2, 3, 3);
    ctx.fillRect(ALIEN_HALF_W - 4, -2, 3, 3);
  }
}

function drawDreadnought(ctx: CanvasRenderingContext2D): void {
  // orange crab-like angular sentinel
  ctx.strokeStyle = KIND_COLORS.dreadnought;
  ctx.lineWidth = 2;
  ctx.fillStyle = 'rgba(251, 146, 60, 0.16)';
  ctx.beginPath();
  ctx.moveTo(-ALIEN_HALF_W, -4);
  ctx.lineTo(-ALIEN_HALF_W - 6, 4);
  ctx.lineTo(-ALIEN_HALF_W + 6, ALIEN_HALF_H - 2);
  ctx.lineTo(-6, ALIEN_HALF_H - 6);
  ctx.lineTo(0, ALIEN_HALF_H - 12);
  ctx.lineTo(6, ALIEN_HALF_H - 6);
  ctx.lineTo(ALIEN_HALF_W - 6, ALIEN_HALF_H - 2);
  ctx.lineTo(ALIEN_HALF_W + 6, 4);
  ctx.lineTo(ALIEN_HALF_W, -4);
  ctx.lineTo(0, -ALIEN_HALF_H);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = KIND_COLORS.dreadnought;
  ctx.fillRect(-3, -4, 2, 3);
  ctx.fillRect(1, -4, 2, 3);
}

function drawAliens(ctx: CanvasRenderingContext2D, aliens: Alien[], time: number): void {
  for (const a of aliens) {
    if (!a.alive) continue;
    ctx.save();
    ctx.translate(a.x, a.y);
    if (a.kind === 'scout') drawScout(ctx, time);
    else if (a.kind === 'cruiser') drawCruiser(ctx, time);
    else drawDreadnought(ctx);
    ctx.restore();
  }
}

function drawBullets(ctx: CanvasRenderingContext2D, state: RenderState): void {
  for (const b of state.bullets) {
    if (b.from === 'player') {
      ctx.strokeStyle = COLORS.playerBullet;
      ctx.lineWidth = 3;
      ctx.shadowColor = COLORS.playerBullet;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 12);
      ctx.lineTo(b.x, b.y + 4);
      ctx.stroke();
    } else {
      ctx.fillStyle = COLORS.alienBullet;
      ctx.shadowColor = COLORS.alienBullet;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, 3, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
}

function drawBarriers(ctx: CanvasRenderingContext2D, blocks: BarrierBlock[]): void {
  for (const blk of blocks) {
    if (blk.hp <= 0) continue;
    const ratio = blk.hp / BARRIER_HP;
    ctx.fillStyle =
      ratio > 2 / 3
        ? COLORS.barrier
        : ratio > 1 / 3
          ? 'rgba(74, 222, 128, 0.55)'
          : 'rgba(74, 222, 128, 0.25)';
    ctx.fillRect(blk.x, blk.y, BARRIER_BLOCK - 1.5, BARRIER_BLOCK - 1.5);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawFieldLines(ctx: CanvasRenderingContext2D, time: number): void {
  // scrolling horizon grid for motion feel
  ctx.strokeStyle = COLORS.line;
  ctx.lineWidth = 1;
  const scroll = (time * 28) % 48;
  for (let y = LOGICAL_H; y > 640; y -= 48) {
    ctx.beginPath();
    ctx.moveTo(0, y - scroll);
    ctx.lineTo(LOGICAL_W, y - scroll);
    ctx.stroke();
  }
}

export function renderGame(ctx: CanvasRenderingContext2D, state: RenderState): void {
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  ctx.save();
  if (state.shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * state.shake,
      (Math.random() - 0.5) * state.shake
    );
  }

  drawFieldLines(ctx, state.time);
  drawStars(ctx, state.stars, state.time);
  drawBarriers(ctx, state.barriers);
  drawAliens(ctx, state.aliens, state.time);
  if (state.player) drawPlayer(ctx, state.player, state.time, state.playerInvulnerable);
  drawBullets(ctx, state);
  drawParticles(ctx, state.particles);

  ctx.restore();
}
