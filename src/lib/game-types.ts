
export type WeaponClass = 'Sword' | 'Dagger' | 'Bow';

export interface PlayerProfile {
  id: string;
  name: string;
  color: string;
  weaponClass: WeaponClass;
  avatarUrl?: string;
  playerId?: string; // 8-digit unique ID
  gold?: number;
  isOnline?: boolean;
  currentRoomId?: string; // Track current room for invites/joins
  friends?: string[]; // Array of internal IDs
  friendRequests?: string[]; // Array of internal IDs who sent requests
  unlockedAuras?: string[]; // Array of color strings/IDs unlocked
  noBorderOwned?: boolean; // If they purchased the No Border setting
  noBorderEnabled?: boolean; // If they have the setting turned on
  adminRewardClaimed?: boolean; // Tracking for special grants
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderColor: string;
  text: string;
  timestamp: number;
}

export interface GameInvitation {
  id: string;
  senderId: string;
  senderName: string;
  senderPlayerId: string;
  senderAvatarUrl?: string;
  roomId?: string; // Room ID (not needed for friend requests)
  type: 'invite' | 'join_request' | 'friend_request';
  timestamp: number;
  status?: 'pending' | 'accepted' | 'rejected';
}

export interface Projectile {
  id: string;
  ownerId: string;
  startX: number;
  startY: number;
  vx: number;
  vy: number;
  startTime: number;
  range: number;
  damage: number;
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
  stunnedUntil?: number; // Timestamp until which the player is stunned
  stunCooldownUntil?: number; // Timestamp until which the player is immune to stun
  isReady?: boolean; // For Play Again synchronization
  deathTime?: number; // Timestamp when HP reached 0
  team?: 'A' | 'B'; // Team assignment: A=Red, B=Blue
  // Dash Physics
  isDashing?: boolean;
  dashTimeLeft?: number;
  dashDirX?: number;
  dashDirY?: number;
  emojiStartTime?: number; // Timestamp when emoji was triggered
  emojiUntil?: number; // Timestamp until which the emoji is shown
  emojiCooldownUntil?: number; // Cooldown for emojis
}

export interface GameEffect {
  id: string;
  x: number;
  y: number;
  amount: number;
  type: 'damage' | 'heal';
  timestamp: number;
  team?: 'A' | 'B'; // Team that caused the effect
}

export interface GameRoom {
  id: string;
  shortId: string; // 6-digit unique lobby ID
  name: string;
  createdBy: string; // The ID of the host
  players: Record<string, GamePlayer>;
  effects?: Record<string, GameEffect>; // Synced combat effects
  projectiles?: Record<string, Projectile>;
  chat?: Record<string, ChatMessage>; // Real-time chat messages
  status: 'lobby' | 'starting' | 'playing' | 'celebrating' | 'round_over' | 'finished';
  currentRound: number;
  lastUpdate: number;
  maxPlayers: number;
  isTeamMode?: boolean;
  teamAScore?: number; // Red team score
  teamBScore?: number; // Blue team score
  startTime?: number; // Server timestamp for the start of the match
  lastWinnerName?: string; // Name of the last round winner
  lastWinnerTeam?: 'A' | 'B'; // Team that won the round
  celebrationStartTime?: number; // Timestamp for the sunglasses animation
}

export const WEAPON_STATS = {
  Sword: {
    damage: 200,
    range: 5.0, 
    angle: 70, 
    delay: 2.0, 
    maxHp: 1000,
    maxStamina: 100,
    moveSpeed: 8,
    dashCooldown: 4.0,
    staminaAttackCost: 25
  },
  Dagger: {
    damage: 250, 
    range: 2.8, 
    angle: 360,
    delay: 1.1,
    maxHp: 800,
    maxStamina: 125,
    moveSpeed: 10.5,
    dashCooldown: 2.5,
    staminaAttackCost: 15
  },
  Bow: {
    damage: 200,
    range: 14.0,
    angle: 5, 
    delay: 2.0,
    maxHp: 1000,
    maxStamina: 100,
    moveSpeed: 8,
    dashCooldown: 4.0,
    staminaAttackCost: 25,
    projectileDuration: 1000 // 1.0 second to travel max range
  },
};

export const ARENA_WIDTH = 40; // meters wide
export const ARENA_HEIGHT = 20; // meters high
export const GROUND_Y = 18; // Ground level from top
export const PIXELS_PER_METER = 25;
export const PLAYER_WIDTH = 1.2;
export const PLAYER_HEIGHT = 2.2;
export const GRAVITY = 25;
export const JUMP_FORCE = -11.2; 
export const MOVE_SPEED_DEFAULT = 8;
export const DASH_DISTANCE = 5.0; 
export const DASH_DURATION = 0.2; 
export const DASH_COOLDOWN_TIME = 4.0; // Default fallback
export const FAST_FALL_SPEED = 40;

export const STAMINA_MAX_DEFAULT = 100;
export const STAMINA_REGEN_RATE = 10; // per second
export const STAMINA_DASH_COST = 30;
export const STAMINA_DASH_COST_DAGGER = 20;
export const STAMINA_ATTACK_COST = 25;

export const STUN_DURATION = 2000; // ms
export const STUN_COOLDOWN = 10000; // ms

export const EMOJI_COOLDOWN = 4000; // 4 seconds
export const EMOJI_DURATION = 2000; // 2 seconds animation

export const SPAWN_POINTS = [
  { x: 2, y: GROUND_Y - PLAYER_HEIGHT }, // Far Left
  { x: ARENA_WIDTH - 2 - PLAYER_WIDTH, y: GROUND_Y - PLAYER_HEIGHT }, // Far Right
  { x: 10, y: GROUND_Y - PLAYER_HEIGHT }, // Left Center
  { x: 30, y: GROUND_Y - PLAYER_HEIGHT }, // Right Center
  { x: 16, y: GROUND_Y - PLAYER_HEIGHT }, // Middle Left
  { x: 24, y: GROUND_Y - PLAYER_HEIGHT }  // Middle Right
];
