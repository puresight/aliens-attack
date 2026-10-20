import type { AlienKind } from './types';

// Logical canvas resolution — 9:16 portrait, all game math happens here.
export const LOGICAL_W = 540;
export const LOGICAL_H = 960;

export const PLAYER_Y = 880;
export const PLAYER_SPEED = 340;
export const PLAYER_W = 38;
export const PLAYER_H = 28;
export const PLAYER_BULLET_SPEED = 720;
export const PLAYER_FIRE_COOLDOWN = 0.34;
export const PLAYER_RESPAWN_INVULN = 2;
export const PLAYER_MIN_X = 30;
export const PLAYER_MAX_X = LOGICAL_W - 30;

export const ALIEN_COLS = 8;
export const ALIEN_ROWS = 5;
export const ALIEN_CELL_W = 58;
export const ALIEN_CELL_H = 46;
export const ALIEN_START_Y = 120;
export const ALIEN_W = 34;
export const ALIEN_H = 26;
export const ALIEN_HALF_W = ALIEN_W / 2;
export const ALIEN_HALF_H = ALIEN_H / 2;

export const FLEET_STEP_X = 12;
export const FLEET_DROP_Y = 24;
export const FLEET_MARGIN = 24;

export const ALIEN_BULLET_SPEED_BASE = 250;
export const ALIEN_BULLET_SPEED_PER_WAVE = 18;

export const ALIEN_POINTS: Record<AlienKind, number> = {
  scout: 30,
  cruiser: 20,
  dreadnought: 10,
};

export const BARRIER_Y = 690;
export const BARRIER_BLOCK = 12;
export const BARRIER_HP = 3;
export const BARRIER_CENTERS = [100, 270, 440];

export const COLORS = {
  bg: '#050810',
  player: '#22d3ee',
  playerFill: '#0e3a47',
  thruster: '#fb923c',
  scout: '#e879f9',
  cruiser: '#fde047',
  dreadnought: '#fb923c',
  playerBullet: '#67e8f9',
  alienBullet: '#f87171',
  barrier: '#4ade80',
  star: '#a5f3fc',
  line: 'rgba(34, 211, 238, 0.18)',
};

export const KIND_COLORS: Record<AlienKind, string> = {
  scout: COLORS.scout,
  cruiser: COLORS.cruiser,
  dreadnought: COLORS.dreadnought,
};
