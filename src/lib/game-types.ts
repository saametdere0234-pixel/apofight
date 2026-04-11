export type WeaponClass = 'Sword' | 'Dagger' | 'Bow';

export interface PlayerProfile {
  id: string;
  name: string;
  color: string;
  weaponClass: WeaponClass;
  medals: number;
}

export interface GamePlayer extends PlayerProfile {
  x: number;
  y: number;
  vy: number; // Vertical velocity for gravity
  hp: number;
  facing: 'left' | 'right';
  isJumping: boolean;
  dashCooldown: number;
  lastAttackTime: number;
  roundsWon: number;
}

export interface GameRoom {
  id: string;
  name: string;
  players: Record<string, GamePlayer>;
  status: 'lobby' | 'playing' | 'round_over' | 'finished';
  currentRound: number;
  lastUpdate: number;
}

export const WEAPON_STATS = {
  Sword: {
    damage: 150,
    range: 2.5,
    width: 1.5,
    delay: 0.4,
  },
  Dagger: {
    damage: 100,
    range: 1.8,
    width: 1.2,
    delay: 0.2,
  },
  Bow: {
    damage: 120,
    range: 12.0,
    width: 0.5,
    delay: 0.8,
  },
};

export const ARENA_WIDTH = 40; // meters wide
export const ARENA_HEIGHT = 20; // meters high
export const GROUND_Y = 18; // Ground level from top
export const PIXELS_PER_METER = 25;
export const PLAYER_WIDTH = 1.2;
export const PLAYER_HEIGHT = 2.2;
export const GRAVITY = 25;
export const JUMP_FORCE = -12;
export const MOVE_SPEED = 8;
