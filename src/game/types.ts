export type GameStatus = 'menu' | 'playing' | 'paused' | 'waveClear' | 'gameOver';

export type AlienKind = 'scout' | 'cruiser' | 'dreadnought';

export interface Player {
  x: number;
  y: number;
  cooldown: number;
}

export interface Alien {
  kind: AlienKind;
  col: number;
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  alive: boolean;
}

export interface Bullet {
  x: number;
  y: number;
  vy: number;
  from: 'player' | 'alien';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface BarrierBlock {
  x: number;
  y: number;
  hp: number;
}

export interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
}

export interface PublicState {
  status: GameStatus;
  score: number;
  highScore: number;
  wave: number;
  lives: number;
  newHigh: boolean;
}

export interface RenderState {
  stars: Star[];
  barriers: BarrierBlock[];
  aliens: Alien[];
  bullets: Bullet[];
  particles: Particle[];
  player: Player | null;
  playerInvulnerable: boolean;
  shake: number;
  time: number;
}
