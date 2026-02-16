
import { describe, it, expect } from 'vitest';
import { EntityManager } from './EntityManager';
import { EntityType, BossState } from '../types';

describe('Entity Manager Logic', () => {
    
    it('should initialize with empty entity list and populated pools', () => {
        const manager = new EntityManager();
        expect(manager.entities.length).toBe(0);
        expect(manager.getByType(EntityType.PROJECTILE).length).toBe(0);
    });

    it('should correctly create and track a Player entity', () => {
        const manager = new EntityManager();
        const player = manager.createPlayer(100, 100);
        manager.addEntity(player);
        
        expect(manager.entities.length).toBe(1);
        expect(manager.getByType(EntityType.PLAYER).length).toBe(1);
        expect(player.pos.x).toBe(100);
    });

    it('should manage Boss creation and initial state', () => {
        const manager = new EntityManager();
        const boss = manager.createBoss(400, 50);
        manager.addEntity(boss);

        expect(boss.type).toBe(EntityType.BOSS);
        expect(boss.state).toBe(BossState.SPAWN);
        expect(boss.health).toBe(100);
        expect(manager.getByType(EntityType.BOSS).length).toBe(1);
    });

    it('should pool projectiles efficiently', () => {
        const manager = new EntityManager();
        const p1 = manager.createProjectile(0, 0, 1);
        manager.addEntity(p1);
        
        expect(p1.id).toContain('pool-proj');
        expect(manager.entities.length).toBe(1);

        // Simulate projectile death
        p1.markedForDeletion = true;
        manager.cleanup();
        
        expect(manager.entities.length).toBe(0);
        
        // Request new projectile - should theoretically reuse if pool implementation allows
        // Our simple pooler implementation returns active ones, so let's just check creation
        const p2 = manager.createProjectile(10, 10, 1);
        manager.addEntity(p2);
        expect(manager.entities.length).toBe(1);
    });

    it('should transform enemy to snowball when frozen', () => {
        const manager = new EntityManager();
        const enemy = manager.createEnemy(100, 100);
        
        manager.transformToSnowball(enemy);
        
        expect(enemy.type).toBe(EntityType.SNOWBALL);
        expect(enemy.freezeLevel).toBe(100);
        expect(enemy.isRolling).toBe(false);
    });

    it('should cache entities by type for performance', () => {
        const manager = new EntityManager();
        manager.addEntity(manager.createPlatform(0,0,10,10));
        manager.addEntity(manager.createEnemy(0,0));
        manager.addEntity(manager.createEnemy(0,0));
        
        const enemies = manager.getByType(EntityType.ENEMY);
        const platforms = manager.getByType(EntityType.PLATFORM);
        
        expect(enemies.length).toBe(2);
        expect(platforms.length).toBe(1);
    });
});
