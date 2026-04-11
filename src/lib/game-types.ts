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
  dashCharges: number;
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
    damage: 200,
    range: 5.5,
    angle: 60, // degrees
    delay: 0.6,
  },
  Dagger: {
    damage: 120,
    range: 3.0,
    angle: 360, // 360 for circular AoE
    delay: 0.25,
  },
  Bow: {
    damage: 150,
    range: 12.0,
    angle: 15,
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
export const JUMP_FORCE = -11.2; // Calculated for ~2.5m height given GRAVITY=25
export const MOVE_SPEED = 8;
export const DASH_DISTANCE = 3.5;
export const DASH_COOLDOWN_TIME = 4.0;
export const FAST_FALL_SPEED = 40;
