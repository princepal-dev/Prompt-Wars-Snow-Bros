import { Entity, Rect, Vector2, EntityType } from '../types';
import { PHYSICS, WORLD } from '../utils/constants';

export class Physics {
  /**
   * Optimized AABB Collision Detection
   * Avoids creating new objects for Rects during every check
   */
  static checkCollision(e1: Entity, e2: Entity): boolean {
    return (
      e1.pos.x < e2.pos.x + e2.size.x &&
      e1.pos.x + e1.size.x > e2.pos.x &&
      e1.pos.y < e2.pos.y + e2.size.y &&
      e1.pos.y + e1.size.y > e2.pos.y
    );
  }

  // Legacy support if needed, but discouraged in loop
  static getRect(e: Entity): Rect {
    return { x: e.pos.x, y: e.pos.y, w: e.size.x, h: e.size.y };
  }

  static applyGravity(e: Entity) {
    if (!e.isGrounded) {
      e.vel.y += PHYSICS.GRAVITY;
      // Terminal velocity
      if (e.vel.y > PHYSICS.TERMINAL_VELOCITY) {
        e.vel.y = PHYSICS.TERMINAL_VELOCITY;
      }
    }
  }

  static resolveMapCollisions(entity: Entity, mapObjects: Entity[]) {
    entity.isGrounded = false;
    
    // 1. World Boundaries
    if (entity.pos.x < 0) {
      entity.pos.x = 0;
      entity.vel.x = 0;
      if (entity.type === EntityType.SNOWBALL && entity.isRolling) entity.markedForDeletion = true;
    } else if (entity.pos.x + entity.size.x > WORLD.WIDTH) {
      entity.pos.x = WORLD.WIDTH - entity.size.x;
      entity.vel.x = 0;
      if (entity.type === EntityType.SNOWBALL && entity.isRolling) entity.markedForDeletion = true;
    }

    if (entity.pos.y > WORLD.HEIGHT) {
      if (entity.type === EntityType.PLAYER) {
        entity.pos.y = 0;
        entity.pos.x = WORLD.WIDTH / 2;
        entity.vel.y = 0;
      } else {
        entity.markedForDeletion = true;
      }
      return;
    }

    // 2. Object Collisions (Platforms and Walls)
    // Optimization: Inline checks instead of calling getRect
    for (const obj of mapObjects) {
      if (Physics.checkCollision(entity, obj)) {
        
        if (obj.type === EntityType.WALL) {
           Physics.resolveSolidCollision(entity, obj);
        } else if (obj.type === EntityType.PLATFORM) {
           // One-way platform logic
           const prevY = entity.pos.y - entity.vel.y;
           // Allow small threshold for landing
           if (entity.vel.y >= 0 && prevY + entity.size.y <= obj.pos.y + 14) {
             entity.pos.y = obj.pos.y - entity.size.y;
             entity.vel.y = 0;
             entity.isGrounded = true;
           }
        }
      }
    }
  }

  static resolveSolidCollision(e: Entity, wall: Entity) {
    // Find intersection depth
    // Center points
    const eCx = e.pos.x + e.size.x / 2;
    const eCy = e.pos.y + e.size.y / 2;
    const wCx = wall.pos.x + wall.size.x / 2;
    const wCy = wall.pos.y + wall.size.y / 2;

    const dx = eCx - wCx;
    const dy = eCy - wCy;

    const combinedHalfW = (e.size.x / 2) + (wall.size.x / 2);
    const combinedHalfH = (e.size.y / 2) + (wall.size.y / 2);

    const overlapX = combinedHalfW - Math.abs(dx);
    const overlapY = combinedHalfH - Math.abs(dy);

    if (overlapX < overlapY) {
      // Resolve X (Horizontal Collision)
      if (dx > 0) {
        e.pos.x += overlapX; // Push right
      } else {
        e.pos.x -= overlapX; // Push left
      }
      e.vel.x = 0;
      
      // If snowball hits wall, break
      if (e.type === EntityType.SNOWBALL && e.isRolling) {
          e.markedForDeletion = true;
      }
    } else {
      // Resolve Y (Vertical Collision)
      if (dy > 0) {
        e.pos.y += overlapY; // Push down (hit head)
        e.vel.y = 0; 
      } else {
        e.pos.y -= overlapY; // Push up (stand on top)
        e.vel.y = 0;
        e.isGrounded = true;
      }
    }
  }

  static move(entity: Entity) {
    entity.pos.x += entity.vel.x;
    entity.pos.y += entity.vel.y;
  }
}