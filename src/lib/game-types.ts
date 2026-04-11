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
  hp: number;
  angle: number;
  isDashing: boolean;
  dashCooldown: number;
  lastAttackTime: number;
  isAttacking: boolean;
  attackProgress: number; // For charging or swing timing
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
    range: 1.5,
    delay: 0.5,
    tolerance: 0.8, // Radians for arc
  },
  Dagger: {
    damage: 250,
    range: 1.0,
    delay: 0.2,
    tolerance: 0.2,
  },
  Bow: {
    damage: 150,
    range: 8.0,
    delay: 0.2, // Global cooldown
    maxCharge: 3.0,
    tolerance: 0,
  },
};

export const ARENA_SIZE = 30; // meters
export const PIXELS_PER_METER = 20;
export const PLAYER_WIDTH = 1.5;
export const PLAYER_HEIGHT = 2.0;