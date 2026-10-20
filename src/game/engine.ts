import { AudioEngine } from '@/lib/audio';
import { loadHighScore, saveHighScore } from '@/lib/storage';
import {
  ALIEN_BULLET_SPEED_BASE,
  ALIEN_BULLET_SPEED_PER_WAVE,
  ALIEN_CELL_H,
  ALIEN_CELL_W,
  ALIEN_COLS,
  ALIEN_POINTS,
  ALIEN_ROWS,
  ALIEN_START_Y,
  BARRIER_BLOCK,
  BARRIER_CENTERS,
  BARRIER_HP,
  BARRIER_Y,
  FLEET_DROP_Y,
  FLEET_MARGIN,
  FLEET_STEP_X,
  KIND_COLORS,
  LOGICAL_H,
  LOGICAL_W,
  PLAYER_BULLET_SPEED,
  PLAYER_FIRE_COOLDOWN,
  PLAYER_MAX_X,
  PLAYER_MIN_X,
  PLAYER_RESPAWN_INVULN,
  PLAYER_SPEED,
  PLAYER_Y,
} from './constants';
import { renderGame } from './renderer';
import type {
  Alien,
  AlienKind,
  BarrierBlock,
  Bullet,
  GameStatus,
  Particle,
  Player,
  PublicState,
  RenderState,
  Ring,
  Star,
} from './types';

function vibrate(pattern: number | number[], enabled: boolean): void {
  if (!enabled) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

const STAR_COUNT = 70;

export class GameEngine {
  status: GameStatus = 'menu';
  private ctx: CanvasRenderingContext2D;
  private audio: AudioEngine;
  private haptics = true;
  private raf = 0;
  private lastTs = 0;
  private time = 0;
  private running = false;

  private score = 0;
  private highScore = 0;
  private wave = 0;
  private lives = 3;
  private newHigh = false;

  private stars: Star[] = [];
  private aliens: Alien[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private barriers: BarrierBlock[] = [];
  private player: Player = { x: LOGICAL_W / 2, y: PLAYER_Y, cooldown: 0 };
  private invuln = 0;
  private shake = 0;

  private fleetOffsetX = 0;
  private fleetOffsetY = 0;
  private fleetDir = 1;
  private fleetStepTimer = 0;
  private marchStep = 0;
  private marchTimer = 0;
  private alienFireTimer = 0;
  private waveClearTimer = 0;

  private moveLeft = false;
  private moveRight = false;
  private firing = false;
  private fireHeld = false;
  private aimTarget: number | null = null;

  onState: (s: PublicState) => void = () => {};

  constructor(ctx: CanvasRenderingContext2D, audio: AudioEngine) {
    this.ctx = ctx;
    this.audio = audio;
    this.highScore = loadHighScore();
    this.initStars();
    this.startLoop();
  }

  setHaptics(enabled: boolean): void {
    this.haptics = enabled;
  }

  private initStars(): void {
    this.stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * LOGICAL_W,
      y: Math.random() * LOGICAL_H,
      speed: 12 + Math.random() * 40,
      size: Math.random() < 0.8 ? 1.5 : 2.5,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  private emit(): void {
    this.onState({
      status: this.status,
      score: this.score,
      highScore: this.highScore,
      wave: this.wave,
      lives: this.lives,
      newHigh: this.newHigh,
      multiplier: this.multiplier(),
    });
  }

  private multiplier(): number {
    return 1 + Math.floor((this.wave - 1) / 2);
  }

  getPublicState(): PublicState {
    return {
      status: this.status,
      score: this.score,
      highScore: this.highScore,
      wave: this.wave,
      lives: this.lives,
      newHigh: this.newHigh,
      multiplier: this.multiplier(),
    };
  }

  private startLoop(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    const frame = (ts: number) => {
      const dt = Math.min((ts - this.lastTs) / 1000, 0.05);
      this.lastTs = ts;
      this.update(dt);
      renderGame(this.ctx, this.getRenderState());
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  private getRenderState(): RenderState {
    return {
      stars: this.stars,
      barriers: this.barriers,
      aliens: this.aliens,
      bullets: this.bullets,
      particles: this.particles,
      rings: this.rings,
      player: this.status === 'menu' ? null : this.player,
      playerInvulnerable: this.invuln > 0,
      shake: this.shake,
      time: this.time,
    };
  }

  // ---- input ----

  setMove(dir: 'left' | 'right', active: boolean): void {
    if (dir === 'left') this.moveLeft = active;
    else this.moveRight = active;
  }

  setFire(active: boolean): void {
    this.fireHeld = active;
  }

  tapFire(): void {
    this.firing = true;
  }

  setAim(x: number | null): void {
    this.aimTarget = x;
  }

  // ---- game flow ----

  startGame(): void {
    this.score = 0;
    this.wave = 0;
    this.lives = 3;
    this.newHigh = false;
    this.bullets = [];
    this.particles = [];
    this.player = { x: LOGICAL_W / 2, y: PLAYER_Y, cooldown: 0 };
    this.invuln = 0;
    this.shake = 0;
    this.nextWave();
    this.status = 'playing';
    this.emit();
  }

  togglePause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
      this.setMove('left', false);
      this.setMove('right', false);
      this.setFire(false);
    } else if (this.status === 'paused') {
      this.status = 'playing';
    }
    this.emit();
  }

  toMenu(): void {
    this.status = 'menu';
    this.aliens = [];
    this.bullets = [];
    this.barriers = [];
    this.particles = [];
    this.emit();
  }

  private nextWave(): void {
    this.wave += 1;
    this.buildFleet();
    this.buildBarriers();
    this.fleetOffsetX = 0;
    this.fleetOffsetY = 0;
    this.fleetDir = 1;
    this.fleetStepTimer = 0;
    this.marchTimer = 0;
    this.alienFireTimer = 1.2;
    this.bullets = [];
  }

  private buildFleet(): void {
    this.aliens = [];
    for (let row = 0; row < ALIEN_ROWS; row++) {
      const kind: AlienKind =
        row === 0 ? 'scout' : row <= 2 ? 'cruiser' : 'dreadnought';
      for (let col = 0; col < ALIEN_COLS; col++) {
        const baseX = LOGICAL_W / 2 + (col - (ALIEN_COLS - 1) / 2) * ALIEN_CELL_W;
        const y = ALIEN_START_Y + row * ALIEN_CELL_H;
        this.aliens.push({ kind, col, baseX, baseY: y, x: baseX, y, alive: true });
      }
    }
  }

  private buildBarriers(): void {
    this.barriers = [];
    const cols = 7;
    const rows = 4;
    for (const cx of BARRIER_CENTERS) {
      const startX = cx - (cols * BARRIER_BLOCK) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // carve a notch out of the bottom-middle for a dome/arch shape
          if (r >= rows - 2 && c > 1 && c < cols - 2) continue;
          this.barriers.push({
            x: startX + c * BARRIER_BLOCK,
            y: BARRIER_Y + r * BARRIER_BLOCK,
            hp: BARRIER_HP,
          });
        }
      }
    }
  }

  // ---- update ----

  private update(dt: number): void {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 30);

    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > LOGICAL_H) {
        s.y = -4;
        s.x = Math.random() * LOGICAL_W;
      }
    }

    this.updateParticles(dt);

    if (this.status === 'playing') {
      this.updateMarch(dt);
    }

    if (this.status !== 'playing') return;

    if (this.invuln > 0) this.invuln -= dt;
    this.updatePlayer(dt);
    this.updateFleet(dt);
    this.updateBullets(dt);
    this.updateAlienFire(dt);
    this.checkBarrierCrush();
    this.checkWaveClear();
  }

  private updatePlayer(dt: number): void {
    if (this.aimTarget !== null) {
      // drag-to-aim: ship eases toward the thumb for smooth analog steering
      const diff = this.aimTarget - this.player.x;
      this.player.x += diff * Math.min(1, dt * 14);
      this.player.x = Math.max(PLAYER_MIN_X, Math.min(PLAYER_MAX_X, this.player.x));
    } else {
      let dir = 0;
      if (this.moveLeft) dir -= 1;
      if (this.moveRight) dir += 1;
      this.player.x = Math.max(
        PLAYER_MIN_X,
        Math.min(PLAYER_MAX_X, this.player.x + dir * PLAYER_SPEED * dt)
      );
    }

    this.player.cooldown -= dt;
    const wantsFire = this.fireHeld || this.firing;
    this.firing = false;
    if (wantsFire && this.player.cooldown <= 0) {
      this.player.cooldown = PLAYER_FIRE_COOLDOWN;
      this.bullets.push({
        x: this.player.x,
        y: this.player.y - 18,
        vy: -PLAYER_BULLET_SPEED,
        from: 'player',
      });
      this.audio.laser();
    }
  }

  private aliveCount(): number {
    let n = 0;
    for (const a of this.aliens) if (a.alive) n++;
    return n;
  }

  private updateMarch(dt: number): void {
    const alive = this.aliveCount();
    if (alive === 0) return;
    // accelerate from ~900ms/step at full rack to ~120ms at 1 alien
    const interval = Math.max(0.12, 0.12 + (alive - 1) * ((0.9 - 0.12) / 39));
    this.marchTimer -= dt;
    if (this.marchTimer > 0) return;
    this.marchTimer = interval;
    this.audio.march(this.marchStep);
    this.marchStep = (this.marchStep + 1) % 4;
  }

  private updateFleet(dt: number): void {
    const total = ALIEN_COLS * ALIEN_ROWS;
    const alive = this.aliveCount();
    if (alive === 0) return;

    const ratio = alive / total;
    const waveBoost = 1 + (this.wave - 1) * 0.09;
    const interval = Math.max(0.05, (0.06 + ratio * 0.62) / waveBoost);

    this.fleetStepTimer += dt;
    if (this.fleetStepTimer < interval) return;
    this.fleetStepTimer = 0;

    const nextOffset = this.fleetOffsetX + this.fleetDir * FLEET_STEP_X;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const a of this.aliens) {
      if (!a.alive) continue;
      const x = a.baseX + nextOffset;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    if (maxX > LOGICAL_W - FLEET_MARGIN || minX < FLEET_MARGIN) {
      this.fleetDir *= -1;
      this.fleetOffsetY += FLEET_DROP_Y;
    } else {
      this.fleetOffsetX = nextOffset;
    }

    for (const a of this.aliens) {
      a.x = a.baseX + this.fleetOffsetX;
      a.y = a.baseY + this.fleetOffsetY;
    }
  }

  private updateBullets(dt: number): void {
    const keep: Bullet[] = [];
    for (const b of this.bullets) {
      b.y += b.vy * dt;
      if (b.y < -20 || b.y > LOGICAL_H + 20) continue;

      if (this.bulletHitBarrier(b)) continue;

      if (b.from === 'player') {
        if (this.bulletHitAlien(b)) continue;
      } else {
        if (this.bulletHitPlayer(b)) continue;
      }
      keep.push(b);
    }
    this.bullets = keep;
  }

  private bulletHitBarrier(b: Bullet): boolean {
    for (const blk of this.barriers) {
      if (blk.hp <= 0) continue;
      if (
        b.x >= blk.x - 1 &&
        b.x <= blk.x + BARRIER_BLOCK + 1 &&
        b.y >= blk.y - 6 &&
        b.y <= blk.y + BARRIER_BLOCK + 2
      ) {
        blk.hp -= 1;
        this.audio.barrierHit();
        this.burst(b.x, b.y, b.from === 'player' ? KIND_COLORS.scout : '#f87171', 5);
        return true;
      }
    }
    return false;
  }

  private bulletHitAlien(b: Bullet): boolean {
    for (const a of this.aliens) {
      if (!a.alive) continue;
      if (Math.abs(b.x - a.x) <= 20 && Math.abs(b.y - a.y) <= 16) {
        a.alive = false;
        const mult = this.multiplier();
        this.score += ALIEN_POINTS[a.kind] * mult;
        this.burst(a.x, a.y, KIND_COLORS[a.kind], 16 + mult * 2);
        this.rings.push({
          x: a.x,
          y: a.y,
          r: 6,
          maxR: 30 + mult * 6,
          life: 0.45,
          maxLife: 0.45,
          color: KIND_COLORS[a.kind],
        });
        if (this.score > this.highScore) {
          this.highScore = this.score;
          if (!this.newHigh) this.newHigh = true;
        }
        this.audio.explosion(false);
        this.shake = Math.max(this.shake, 3);
        return true;
      }
    }
    return false;
  }

  private bulletHitPlayer(b: Bullet): boolean {
    if (this.invuln > 0) return false;
    if (Math.abs(b.x - this.player.x) <= 18 && Math.abs(b.y - this.player.y) <= 14) {
      this.bullets = this.bullets.filter((x) => x !== b);
      this.playerHit();
      return true;
    }
    return false;
  }

  private playerHit(): void {
    this.lives -= 1;
    this.audio.playerHit();
    this.audio.explosion(true);
    this.burst(this.player.x, this.player.y, '#22d3ee', 26);
    this.shake = 10;
    vibrate([80, 40, 120], this.haptics);
    if (this.lives <= 0) {
      this.gameOver();
    } else {
      this.invuln = PLAYER_RESPAWN_INVULN;
      this.player.x = LOGICAL_W / 2;
    }
  }

  private gameOver(): void {
    this.status = 'gameOver';
    if (this.score >= this.highScore && this.score > 0) {
      this.highScore = this.score;
      this.newHigh = true;
      saveHighScore(this.score);
    }
    this.audio.gameOver();
    vibrate([200, 80, 200, 80, 300], this.haptics);
    this.emit();
  }

  private updateAlienFire(dt: number): void {
    if (this.aliveCount() === 0) return;
    this.alienFireTimer -= dt;
    if (this.alienFireTimer > 0) return;
    const interval = Math.max(0.3, 0.95 - this.wave * 0.05);
    this.alienFireTimer = interval * (0.6 + Math.random() * 0.8);

    // lowest alive alien in a random column fires
    const cols = new Map<number, Alien>();
    for (const a of this.aliens) {
      if (!a.alive) continue;
      const cur = cols.get(a.col);
      if (!cur || a.y > cur.y) cols.set(a.col, a);
    }
    const shooters = Array.from(cols.values());
    if (shooters.length === 0) return;
    const shooter = shooters[Math.floor(Math.random() * shooters.length)];
    this.bullets.push({
      x: shooter.x,
      y: shooter.y + 14,
      vy: ALIEN_BULLET_SPEED_BASE + ALIEN_BULLET_SPEED_PER_WAVE * (this.wave - 1),
      from: 'alien',
    });
    this.audio.alienLaser();
  }

  private checkBarrierCrush(): void {
    for (const a of this.aliens) {
      if (!a.alive) continue;
      if (a.y + 14 < BARRIER_Y - 4) continue;
      for (const blk of this.barriers) {
        if (
          blk.hp > 0 &&
          blk.x + BARRIER_BLOCK > a.x - 18 &&
          blk.x < a.x + 18 &&
          blk.y + BARRIER_BLOCK > a.y - 14 &&
          blk.y < a.y + 14
        ) {
          blk.hp = 0;
        }
      }
    }
    // fleet reached the player's line -> invasion
    for (const a of this.aliens) {
      if (a.alive && a.y >= PLAYER_Y - 30) {
        this.lives = 0;
        this.gameOver();
        return;
      }
    }
  }

  private checkWaveClear(): void {
    if (this.aliveCount() > 0) return;
    if (this.status !== 'playing') return;
    this.status = 'waveClear';
    this.score += 100 * this.wave * this.multiplier();
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.newHigh = true;
    }
    this.audio.waveClear();
    this.emit();
    this.waveClearTimer = 2.4;
    const resume = () => {
      if (this.status !== 'waveClear') return;
      this.nextWave();
      this.status = 'playing';
      this.emit();
    };
    window.setTimeout(resume, this.waveClearTimer * 1000);
  }

  private burst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 180;
      const life = 0.3 + Math.random() * 0.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private updateParticles(dt: number): void {
    const keep: Particle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy = p.vy * 0.98 + 60 * dt;
      keep.push(p);
    }
    this.particles = keep;

    const keepRings: Ring[] = [];
    for (const r of this.rings) {
      r.life -= dt;
      if (r.life <= 0) continue;
      r.r += ((r.maxR - r.r) * dt) / (r.life + 0.05);
      keepRings.push(r);
    }
    this.rings = keepRings;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.running = false;
  }
}
