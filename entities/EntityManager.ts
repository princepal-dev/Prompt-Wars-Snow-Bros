import { Entity, EntityType, EnemyState, PowerUpType, Vector2 } from '../types';
import { PHYSICS, WORLD, GAMEPLAY } from '../utils/constants';

export class EntityManager {
  entities: Entity[] = [];
  nextId = 0;

  createPlatform(x: number, y: number, w: number, h: number): Entity {
    return {
      id: `plat-${this.nextId++}`,
      type: EntityType.PLATFORM,
      pos: { x, y },
      size: { x: w, y: h },
      vel: { x: 0, y: 0 },
      color: '#1e293b',
      isGrounded: true,
      markedForDeletion: false
    };
  }

  createWall(x: number, y: number, w: number, h: number): Entity {
    return {
      id: `wall-${this.nextId++}`,
      type: EntityType.WALL,
      pos: { x, y },
      size: { x: w, y: h },
      vel: { x: 0, y: 0 },
      color: '#334155', // Slate 700
      isGrounded: true,
      markedForDeletion: false
    };
  }

  createPlayer(x: number, y: number): Entity {
    return {
      id: 'player',
      type: EntityType.PLAYER,
      pos: { x, y },
      size: { x: 32, y: 32 },
      vel: { x: 0, y: 0 },
      color: '#0ea5e9',
      isGrounded: false,
      markedForDeletion: false,
      direction: 1,
      health: 3,
      invulnerableUntil: 0,
      moveSpeedMultiplier: 1.0,
      fireRateMultiplier: 1.0,
      rangeMultiplier: 1.0
    };
  }

  createEnemy(x: number, y: number): Entity {
    return {
      id: `enemy-${this.nextId++}`,
      type: EntityType.ENEMY,
      pos: { x, y },
      size: { x: 32, y: 32 },
      vel: { x: 0, y: 0 },
      color: '#ef4444',
      isGrounded: false,
      markedForDeletion: false,
      state: EnemyState.WALK,
      freezeLevel: 0,
      direction: Math.random() > 0.5 ? 1 : -1
    };
  }

  createProjectile(x: number, y: number, direction: number, rangeMult: number = 1): Entity {
    return {
      id: `proj-${this.nextId++}`,
      type: EntityType.PROJECTILE,
      pos: { x, y },
      size: { x: 16, y: 16 },
      vel: { x: direction * PHYSICS.PROJECTILE_SPEED, y: 0 },
      color: '#67e8f9',
      isGrounded: false,
      markedForDeletion: false,
      ttl: 60 * rangeMult // frames
    };
  }

  createPowerUp(x: number, y: number, type: PowerUpType): Entity {
    let color = '#ffffff';
    switch(type) {
        case PowerUpType.SPEED: color = '#ef4444'; break; // Red
        case PowerUpType.RAPID: color = '#eab308'; break; // Yellow
        case PowerUpType.RANGE: color = '#3b82f6'; break; // Blue
    }
    return {
        id: `pu-${this.nextId++}`,
        type: EntityType.POWERUP,
        pos: { x, y },
        size: { x: 24, y: 24 },
        vel: { x: 0, y: 0 },
        color: color,
        isGrounded: false,
        markedForDeletion: false,
        powerUpType: type
    };
  }

  // Convert enemy to snowball
  transformToSnowball(enemy: Entity) {
    enemy.type = EntityType.SNOWBALL;
    enemy.color = '#f0f9ff';
    enemy.freezeLevel = 100;
    enemy.state = EnemyState.FROZEN;
    enemy.isRolling = false;
    // Reset velocity so it sits there until kicked
    enemy.vel.x = 0;
  }
  
  // Clean up
  cleanup() {
    this.entities = this.entities.filter(e => !e.markedForDeletion);
  }
}