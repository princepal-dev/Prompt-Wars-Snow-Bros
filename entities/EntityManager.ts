
import { Entity, EntityType, EnemyState, PowerUpType, BossState } from '../types';
import { PHYSICS, WORLD, GAMEPLAY } from '../utils/constants';

// Simple Object Pooler
class EntityPool {
  private pool: Entity[] = [];
  private factory: () => Entity;

  constructor(factory: () => Entity, initialSize: number) {
    this.factory = factory;
    for (let i = 0; i < initialSize; i++) {
      const e = this.factory();
      e.markedForDeletion = true; // Start inactive
      this.pool.push(e);
    }
  }

  get(): Entity {
    // Find inactive entity
    const entity = this.pool.find(e => e.markedForDeletion);
    if (entity) {
      entity.markedForDeletion = false;
      return entity;
    }
    // Expand pool if necessary (or return new if dynamic)
    const newEntity = this.factory();
    this.pool.push(newEntity);
    return newEntity;
  }
}

export class EntityManager {
  entities: Entity[] = [];
  // Cache entities by type to avoid iterating the whole array every frame
  private entityCache: Map<EntityType, Entity[]> = new Map();
  
  private particlePool: EntityPool;
  private projectilePool: EntityPool;
  
  nextId = 0;

  constructor() {
    this.resetCache();
    
    // Initialize Pools
    this.particlePool = new EntityPool(() => ({
        id: `pool-part-${Math.random()}`,
        type: EntityType.PARTICLE,
        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
        size: { x: 0, y: 0 },
        color: '#fff',
        isGrounded: false,
        markedForDeletion: true // Default to dead
    }), 100); // Pre-allocate 100 particles

    this.projectilePool = new EntityPool(() => ({
        id: `pool-proj-${Math.random()}`,
        type: EntityType.PROJECTILE,
        pos: { x: 0, y: 0 },
        vel: { x: 0, y: 0 },
        size: { x: 16, y: 16 },
        color: '#67e8f9',
        isGrounded: false,
        markedForDeletion: true
    }), 20); // Pre-allocate 20 projectiles
  }

  private resetCache() {
    Object.values(EntityType).forEach(type => {
      this.entityCache.set(type as EntityType, []);
    });
  }

  addEntity(e: Entity) {
    this.entities.push(e);
    const cache = this.entityCache.get(e.type);
    if (cache) cache.push(e);
  }

  getByType(type: EntityType): Entity[] {
    return this.entityCache.get(type) || [];
  }

  // --- Factories ---

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

  createEnemy(x: number, y: number, color: string = '#ef4444'): Entity {
    return {
      id: `enemy-${this.nextId++}`,
      type: EntityType.ENEMY,
      pos: { x, y },
      size: { x: 32, y: 32 },
      vel: { x: 0, y: 0 },
      color: color,
      isGrounded: false,
      markedForDeletion: false,
      state: EnemyState.WALK,
      freezeLevel: 0,
      direction: Math.random() > 0.5 ? 1 : -1
    };
  }

  createBoss(x: number, y: number): Entity {
      return {
          id: `boss-${this.nextId++}`,
          type: EntityType.BOSS,
          pos: { x, y },
          size: { x: 64, y: 64 }, // Bigger than normal
          vel: { x: 0, y: 0 },
          color: '#f87171', // Red base
          isGrounded: false,
          markedForDeletion: false,
          state: BossState.SPAWN,
          freezeLevel: 0,
          health: 100, // High health
          maxHealth: 100,
          direction: 1,
          bossPhaseTimer: 0,
          attackCooldown: 100
      };
  }

  createProjectile(x: number, y: number, direction: number, rangeMult: number = 1): Entity {
    // USE POOL
    const p = this.projectilePool.get();
    
    // Reset properties
    p.pos.x = x;
    p.pos.y = y;
    p.vel.x = direction * PHYSICS.PROJECTILE_SPEED;
    p.vel.y = 0;
    p.isGrounded = false;
    p.markedForDeletion = false;
    p.ttl = 60 * rangeMult;
    
    return p;
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

  // Visuals
  createParticleExplosion(x: number, y: number, color: string) {
      for (let i = 0; i < 15; i++) {
          // USE POOL
          const p = this.particlePool.get();
          
          const size = Math.random() * 4 + 2;
          const speed = Math.random() * 4 + 1;
          const angle = Math.random() * Math.PI * 2;
          
          p.pos.x = x;
          p.pos.y = y;
          p.size.x = size;
          p.size.y = size;
          p.vel.x = Math.cos(angle) * speed;
          p.vel.y = Math.sin(angle) * speed;
          p.color = color;
          p.markedForDeletion = false;
          p.ttl = Math.random() * 30 + 15;
          
          this.addEntity(p);
      }
  }

  // Convert enemy to snowball
  transformToSnowball(enemy: Entity) {
    enemy.type = EntityType.SNOWBALL;
    enemy.color = '#f0f9ff';
    enemy.freezeLevel = 100;
    enemy.state = EnemyState.FROZEN;
    enemy.isRolling = false;
    enemy.vel.x = 0;
    
    // Maintain boss ID/Health if it's a boss so it can revert
    // But for simplicity in this arcade engine, we treat Boss Frozen state differently in Logic,
    // we DON'T transform Boss type to SNOWBALL type, we just change Boss State to STUNNED.
  }
  
  // Clean up
  cleanup() {
    const aliveEntities: Entity[] = [];
    this.resetCache();

    for (const e of this.entities) {
      if (!e.markedForDeletion) {
        aliveEntities.push(e);
        const cache = this.entityCache.get(e.type);
        if (cache) cache.push(e);
      }
      // If it is marked for deletion, it just stays in the pool (if pooled) 
      // or gets GC'd (if not pooled)
    }
    this.entities = aliveEntities;
  }

  reset() {
    this.entities = [];
    this.resetCache();
  }
}
