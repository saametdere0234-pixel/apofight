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
  stamina: number;
  facing: 'left' | 'right';
  isJumping: boolean;
  jumpCount: number;
  dashCharges: number;
  dashRechargeProgress: number; // 0 to DASH_COOLDOWN_TIME
  lastAttackTime: number;
  lastAttackAngle?: number; // Synced angle for VFX
  roundsWon: number;
  slowUntil?: number; // Timestamp until which the player is slowed
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
    damage: 300,
    range: 5.5,
    angle: 60, // degrees
    delay: 2.0, // 2 seconds between attacks
  },
  Dagger: {
    damage: 200,
    range: 3.0,
    angle: 360, // 360 for circular AoE
    delay: 0.5, // 0.5 seconds between attacks
  },
  Bow: {
    damage: 100,
    range: 12.0,
    angle: 15,
    delay: 2.0, // 2 seconds between attacks
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
export const DASH_DISTANCE = 5.0; // Increased dash distance
export const DASH_COOLDOWN_TIME = 4.0;
export const FAST_FALL_SPEED = 40;

export const STAMINA_MAX = 100;
export const STAMINA_REGEN_RATE = 10; // per second
export const STAMINA_DASH_COST = 30;
export const STAMINA_ATTACK_COST = 25;
