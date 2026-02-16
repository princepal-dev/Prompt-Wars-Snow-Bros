
export enum EntityType {
  PLAYER = 'PLAYER',
  ENEMY = 'ENEMY',
  PROJECTILE = 'PROJECTILE',
  PLATFORM = 'PLATFORM',
  SNOWBALL = 'SNOWBALL',
  PARTICLE = 'PARTICLE',
  WALL = 'WALL',
  POWERUP = 'POWERUP',
  BOSS = 'BOSS'
}

export enum EnemyState {
  WALK = 'WALK',
  STUNNED = 'STUNNED', // Partially frozen
  FROZEN = 'FROZEN',   // Fully frozen, becomes a Snowball entity logic
  DEAD = 'DEAD'
}

export enum BossState {
  SPAWN = 'SPAWN',
  PHASE_1 = 'PHASE_1', // Normal attacks
  PHASE_2 = 'PHASE_2', // Faster, more aggro
  STUNNED = 'STUNNED', // Frozen, waiting to be pushed
  ENRAGED = 'ENRAGED', // Just broke out of ice, very fast
  DEFEATED = 'DEFEATED'
}

export enum PowerUpType {
  SPEED = 'SPEED',
  RAPID = 'RAPID',
  RANGE = 'RANGE'
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vector2;
  vel: Vector2;
  size: Vector2;
  color: string;
  isGrounded: boolean;
  markedForDeletion: boolean;
  
  // Specific properties
  health?: number;
  maxHealth?: number;
  freezeLevel?: number; // 0 to 100
  state?: EnemyState | BossState;
  direction?: number; // 1 or -1
  ttl?: number; // Time to live (projectiles, particles)
  
  // PowerUps & Upgrades
  invulnerableUntil?: number;
  powerUpType?: PowerUpType;
  moveSpeedMultiplier?: number;
  fireRateMultiplier?: number;
  rangeMultiplier?: number;
  
  // Snowball specific
  isRolling?: boolean;
  
  // Boss specific
  bossPhaseTimer?: number;
  attackCooldown?: number;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jump: boolean;
  shoot: boolean;
}

export interface EnemyTheme {
  name: string;
  color: string; // Hex
  description: string;
}

export interface PlatformConfig {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WaveConfig {
  enemyCount: number;
  spawnInterval: number;
  enemySpeed: number;
  aggressiveness: number; // 0.0 to 1.0
  specialEvent?: 'BLIZZARD' | 'NONE' | 'BOSS';
  message: string;
  enemyTheme?: EnemyTheme; // AI generated visual theme
  layout?: PlatformConfig[]; // Dynamic level layout
}
