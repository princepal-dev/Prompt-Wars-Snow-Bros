
import { describe, it, expect } from 'vitest';
import { Physics } from './Physics';
import { Entity, EntityType, Vector2 } from '../types';
import { PHYSICS, WORLD } from '../utils/constants';

describe('Physics Engine Logic', () => {
  const mockEntity = (type: EntityType, x: number, y: number, w: number, h: number): Entity => ({
    id: 'test-ent',
    type,
    pos: { x, y },
    size: { x: w, y: h },
    vel: { x: 0, y: 0 },
    color: 'red',
    isGrounded: false,
    markedForDeletion: false
  });

  describe('Collision Detection (AABB)', () => {
      it('should detect overlap correctly', () => {
        const a = mockEntity(EntityType.PLAYER, 0, 0, 32, 32);
        const b = mockEntity(EntityType.ENEMY, 10, 10, 32, 32); // Overlapping
        expect(Physics.checkCollision(a, b)).toBe(true);
      });

      it('should not detect non-overlap', () => {
        const a = mockEntity(EntityType.PLAYER, 0, 0, 32, 32);
        const b = mockEntity(EntityType.ENEMY, 40, 40, 32, 32); // Not overlapping
        expect(Physics.checkCollision(a, b)).toBe(false);
      });
      
      it('should detect touching edges as non-collision', () => {
          // Strictly speaking AABB usually requires overlap, touching is often false
          const a = mockEntity(EntityType.PLAYER, 0, 0, 10, 10);
          const b = mockEntity(EntityType.ENEMY, 10, 0, 10, 10);
          expect(Physics.checkCollision(a, b)).toBe(false);
      });
  });

  describe('Gravity', () => {
    it('should accelerate downward if not grounded', () => {
      const e = mockEntity(EntityType.PLAYER, 100, 100, 32, 32);
      e.vel.y = 0;
      Physics.applyGravity(e);
      expect(e.vel.y).toBe(PHYSICS.GRAVITY);
    });

    it('should clamp to terminal velocity', () => {
        const e = mockEntity(EntityType.PLAYER, 100, 100, 32, 32);
        e.vel.y = PHYSICS.TERMINAL_VELOCITY + 5;
        Physics.applyGravity(e);
        expect(e.vel.y).toBe(PHYSICS.TERMINAL_VELOCITY);
    });
  });

  describe('Map Collisions', () => {
      it('should stop at floor (world boundary)', () => {
          const e = mockEntity(EntityType.PLAYER, 100, WORLD.HEIGHT + 10, 32, 32);
          Physics.resolveMapCollisions(e, []);
          // Player wraps or resets logic specific:
          if (e.type === EntityType.PLAYER) {
             expect(e.pos.y).toBe(0); // Player wrap logic in code
          }
      });
      
      it('should land on platform', () => {
          const player = mockEntity(EntityType.PLAYER, 100, 190, 32, 32);
          player.vel.y = 5; // Falling
          
          const plat = mockEntity(EntityType.PLATFORM, 50, 200, 200, 20);
          
          // Pre-check condition: Player bottom (222) > Plat top (200)
          // Physics engine expects previous frame check usually, but here checks overlap + velocity
          
          Physics.resolveMapCollisions(player, [plat]);
          
          expect(player.isGrounded).toBe(true);
          expect(player.vel.y).toBe(0);
          expect(player.pos.y).toBe(plat.pos.y - player.size.y);
      });
      
      it('should fall through platform if moving up', () => {
          const player = mockEntity(EntityType.PLAYER, 100, 210, 32, 32);
          player.vel.y = -5; // Jumping up
          
          const plat = mockEntity(EntityType.PLATFORM, 50, 200, 200, 20);
          
          Physics.resolveMapCollisions(player, [plat]);
          
          expect(player.isGrounded).toBe(false);
          // Should not snap to top
          expect(player.pos.y).toBe(210); 
      });
  });
});
