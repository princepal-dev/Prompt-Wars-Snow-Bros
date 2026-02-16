import { EntityManager } from '../entities/EntityManager';
import { Physics } from './Physics';
import { InputManager } from './InputManager';
import { GeminiDirector } from '../ai/GeminiDirector';
import { EntityType, EnemyState, GameState, WaveConfig, Entity, PowerUpType } from '../types';
import { PHYSICS, WORLD, GAMEPLAY } from '../utils/constants';
import { Renderer } from './Renderer';

export class GameEngine {
  entityManager: EntityManager;
  inputManager: InputManager;
  director: GeminiDirector;
  
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  state: GameState = GameState.MENU;
  score: number = 0;
  wave: number = 0;
  
  // Loop vars
  lastTime: number = 0;
  accumulator: number = 0;
  readonly TIMESTEP: number = 1000 / 60; // 60 FPS fixed update

  // Wave vars
  currentWaveConfig: WaveConfig | null = null;
  spawnTimer: number = 0;
  enemiesSpawned: number = 0;
  waveStartTime: number = 0;
  blizzardActive: boolean = false;
  
  // Gameplay vars
  shotCooldown: number = 0;
  
  onUIUpdate: (data: any) => void;

  constructor(canvas: HTMLCanvasElement, onUIUpdate: (data: any) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.entityManager = new EntityManager();
    this.inputManager = new InputManager();
    this.director = new GeminiDirector();
    this.onUIUpdate = onUIUpdate;

    // Correct canvas size for high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WORLD.WIDTH * dpr;
    canvas.height = WORLD.HEIGHT * dpr;
    this.ctx.scale(dpr, dpr);
    canvas.style.width = `${WORLD.WIDTH}px`;
    canvas.style.height = `${WORLD.HEIGHT}px`;

    this.initWorld();
  }

  initWorld() {
    this.entityManager.entities = [];
    
    // 1. Static Arena (Floor) - Platform
    this.entityManager.entities.push(
      this.entityManager.createPlatform(0, WORLD.HEIGHT - WORLD.FLOOR_HEIGHT, WORLD.WIDTH, WORLD.FLOOR_HEIGHT)
    );
    
    // 2. Side Walls - Solid Walls
    // Left Wall
    this.entityManager.entities.push(this.entityManager.createWall(-40, 0, 40, WORLD.HEIGHT));
    // Right Wall
    this.entityManager.entities.push(this.entityManager.createWall(WORLD.WIDTH, 0, 40, WORLD.HEIGHT));

    // 3. Platforms
    const platforms = [
      [100, 400], [500, 400],
      [300, 250],
      [100, 100], [500, 100]
    ];
    platforms.forEach(p => {
      this.entityManager.entities.push(
        this.entityManager.createPlatform(p[0], p[1], 200, 20)
      );
    });

    // 4. Player
    this.entityManager.entities.push(this.entityManager.createPlayer(400, 300));
  }

  async startWave() {
    this.wave++;
    this.waveStartTime = Date.now();
    this.onUIUpdate({ message: "AI GENERATING WAVE..." });
    
    // Get player stats to pass to AI
    const player = this.entityManager.entities.find(e => e.type === EntityType.PLAYER);
    const lives = player ? player.health : 0;

    const config = await this.director.generateWave(this.wave, {
      score: this.score,
      timeTaken: (Date.now() - this.waveStartTime) / 1000
    });

    this.currentWaveConfig = config;
    this.enemiesSpawned = 0;
    this.spawnTimer = 0;
    this.blizzardActive = config.specialEvent === 'BLIZZARD';
    
    this.onUIUpdate({ 
      wave: this.wave, 
      score: this.score, 
      lives: lives,
      message: config.message,
      blizzard: this.blizzardActive
    });
  }

  start() {
    this.state = GameState.PLAYING;
    this.score = 0;
    this.wave = 0;
    this.initWorld();
    this.startWave();
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(currentTime: number) {
    if (this.state !== GameState.PLAYING) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += deltaTime;

    while (this.accumulator >= this.TIMESTEP) {
      this.update(this.TIMESTEP / 1000); // Fixed dt in seconds
      this.accumulator -= this.TIMESTEP;
    }

    this.draw();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt: number) {
    const input = this.inputManager.getState();
    const player = this.entityManager.entities.find(e => e.type === EntityType.PLAYER);
    
    // Get all map objects (Platforms + Walls)
    const mapObjects = this.entityManager.entities.filter(e => 
        e.type === EntityType.PLATFORM || e.type === EntityType.WALL
    );

    // --- SPAWNER LOGIC ---
    if (this.currentWaveConfig && this.enemiesSpawned < this.currentWaveConfig.enemyCount) {
      this.spawnTimer++;
      if (this.spawnTimer >= this.currentWaveConfig.spawnInterval) {
        // Safe spawn check
        const x = Math.random() * (WORLD.WIDTH - 100) + 50;
        const y = 50;
        // Simple dist check from player
        if (player && Math.abs(x - player.pos.x) > GAMEPLAY.SPAWN_SAFE_RADIUS) {
            const enemy = this.entityManager.createEnemy(x, y);
            // Apply difficulty modifiers
            enemy.vel.x = (this.currentWaveConfig.enemySpeed) * (Math.random() > 0.5 ? 1 : -1);
            this.entityManager.entities.push(enemy);
            this.enemiesSpawned++;
            this.spawnTimer = 0;
        }
      }
    } else if (this.currentWaveConfig && this.enemiesSpawned >= this.currentWaveConfig.enemyCount) {
        // Check if wave cleared
        const activeEnemies = this.entityManager.entities.filter(e => e.type === EntityType.ENEMY || e.type === EntityType.SNOWBALL);
        if (activeEnemies.length === 0) {
            this.startWave();
        }
    }

    // --- ENTITY UPDATE LOOP ---
    
    // Shoot Logic Cooldown
    if (this.shotCooldown > 0) this.shotCooldown--;

    if (input.shoot && player && this.shotCooldown <= 0) {
       const projectiles = this.entityManager.entities.filter(e => e.type === EntityType.PROJECTILE);
       if (projectiles.length < 5) { // Allow more bullets with powerups
             const mult = player.rangeMultiplier || 1;
             this.entityManager.entities.push(
                this.entityManager.createProjectile(
                    player.pos.x + (player.direction === 1 ? player.size.x : -10), 
                    player.pos.y + 10, 
                    player.direction!,
                    mult
                )
             );
             // Base 12 frames, reduced by multiplier
             this.shotCooldown = Math.max(4, 12 / (player.fireRateMultiplier || 1)); 
       }
    }

    this.entityManager.entities.forEach(e => {
      // Gravity
      if (e.type !== EntityType.PLATFORM && e.type !== EntityType.PROJECTILE && e.type !== EntityType.WALL) {
        Physics.applyGravity(e);
      }

      // --- PLAYER LOGIC ---
      if (e.type === EntityType.PLAYER) {
        const speedMult = e.moveSpeedMultiplier || 1;
        // Left/Right
        if (input.left) { e.vel.x = -PHYSICS.MAX_SPEED * speedMult; e.direction = -1; }
        else if (input.right) { e.vel.x = PHYSICS.MAX_SPEED * speedMult; e.direction = 1; }
        else { e.vel.x *= PHYSICS.FRICTION; } // Friction

        // Jump
        if (input.jump && e.isGrounded) {
          e.vel.y = PHYSICS.JUMP_FORCE;
          e.isGrounded = false;
        }
      }

      // --- ENEMY LOGIC ---
      if (e.type === EntityType.ENEMY) {
        if (e.state === EnemyState.WALK) {
           // Basic patrol
           if (e.isGrounded) {
             // Change dir if hitting wall or random chance
             if (e.vel.x === 0) e.direction! *= -1;
             if (Math.random() < 0.01) e.direction! *= -1;
             
             // AI Jump
             if (Math.random() < 0.005) e.vel.y = PHYSICS.JUMP_FORCE;
           }
           e.vel.x = PHYSICS.MOVE_SPEED * e.direction!;
        } else if (e.state === EnemyState.STUNNED) {
            e.vel.x = 0;
            if (e.freezeLevel !== undefined) {
                e.freezeLevel -= GAMEPLAY.FREEZE_DECAY;
                if (e.freezeLevel <= 0) e.state = EnemyState.WALK;
            }
        }
      }

      // --- PROJECTILE LOGIC ---
      if (e.type === EntityType.PROJECTILE) {
         e.ttl!--;
         if (e.ttl! <= 0) e.markedForDeletion = true;
      }

      // --- SNOWBALL LOGIC ---
      if (e.type === EntityType.SNOWBALL) {
          // Friction slows it down if rolling
          if (e.isRolling) {
             // Maintain high speed
             if (Math.abs(e.vel.x) < 0.1) e.markedForDeletion = true; // Stopped snowballs break
          } else {
              e.vel.x = 0;
          }
      }

      // Physics Move
      Physics.move(e);
      
      // Resolve Map Collision (Platforms AND Walls)
      if (e.type !== EntityType.PROJECTILE) {
        Physics.resolveMapCollisions(e, mapObjects);
      }
    });

    // --- COLLISION RESOLUTION (Entity vs Entity) ---
    // 1. Projectile vs Enemy
    const projectiles = this.entityManager.entities.filter(e => e.type === EntityType.PROJECTILE);
    const enemies = this.entityManager.entities.filter(e => e.type === EntityType.ENEMY);
    
    projectiles.forEach(p => {
        enemies.forEach(enemy => {
            if (Physics.checkCollision(Physics.getRect(p), Physics.getRect(enemy))) {
                p.markedForDeletion = true;
                if (enemy.state !== EnemyState.FROZEN) {
                    enemy.freezeLevel = (enemy.freezeLevel || 0) + GAMEPLAY.FREEZE_PER_SHOT;
                    enemy.state = EnemyState.STUNNED;
                    if (enemy.freezeLevel >= 100) {
                        this.entityManager.transformToSnowball(enemy);
                    }
                }
            }
        });
    });

    // 2. Player vs Snowball (Kick)
    const snowballs = this.entityManager.entities.filter(e => e.type === EntityType.SNOWBALL);
    if (player) {
        snowballs.forEach(s => {
            if (Physics.checkCollision(Physics.getRect(player), Physics.getRect(s))) {
                if (!s.isRolling) {
                    s.isRolling = true;
                    // Kick in direction of player movement or relative position
                    const dir = player.pos.x < s.pos.x ? 1 : -1;
                    s.vel.x = dir * PHYSICS.SNOWBALL_ROLL_SPEED;
                    // Small hop
                    s.vel.y = -2; 
                    this.score += 500;
                    this.onUIUpdate({ score: this.score });
                }
            }
        });
    }

    // 3. Snowball vs Enemies (Wipeout + PowerUp Drop)
    snowballs.filter(s => s.isRolling).forEach(s => {
        enemies.forEach(e => {
            if (Physics.checkCollision(Physics.getRect(s), Physics.getRect(e))) {
                e.markedForDeletion = true;
                this.score += 1000;
                this.createParticles(e.pos.x, e.pos.y, '#ef4444');
                
                // Drop PowerUp Chance (30%)
                if (Math.random() < 0.3) {
                    const r = Math.random();
                    let type = PowerUpType.SPEED;
                    if (r > 0.33) type = PowerUpType.RAPID;
                    if (r > 0.66) type = PowerUpType.RANGE;
                    this.entityManager.entities.push(
                        this.entityManager.createPowerUp(e.pos.x, e.pos.y, type)
                    );
                }
            }
        });
    });

    // 4. Player vs PowerUp
    const powerUps = this.entityManager.entities.filter(e => e.type === EntityType.POWERUP);
    if (player) {
        powerUps.forEach(pu => {
            if (Physics.checkCollision(Physics.getRect(player), Physics.getRect(pu))) {
                pu.markedForDeletion = true;
                this.score += 200;
                
                // Apply Stats
                if (pu.powerUpType === PowerUpType.SPEED) player.moveSpeedMultiplier = (player.moveSpeedMultiplier || 1) + 0.2;
                if (pu.powerUpType === PowerUpType.RAPID) player.fireRateMultiplier = (player.fireRateMultiplier || 1) + 0.3;
                if (pu.powerUpType === PowerUpType.RANGE) player.rangeMultiplier = (player.rangeMultiplier || 1) + 0.5;
                
                this.onUIUpdate({ score: this.score });
            }
        });
    }

    // 5. Player vs Enemy (Damage & Lives)
    if (player) {
        // Check invulnerability
        const now = Date.now();
        const isInvulnerable = player.invulnerableUntil && now < player.invulnerableUntil;

        if (!isInvulnerable) {
            enemies.forEach(e => {
                 if (e.state === EnemyState.WALK && Physics.checkCollision(Physics.getRect(player), Physics.getRect(e))) {
                     player.health = (player.health || 1) - 1;
                     this.onUIUpdate({ lives: player.health });

                     if (player.health <= 0) {
                         this.state = GameState.GAME_OVER;
                         this.onUIUpdate({ message: "GAME OVER - REFRESH TO RESTART" });
                     } else {
                         // Respawn / Invulnerability
                         player.invulnerableUntil = now + 2000; // 2 seconds
                         player.pos.y = 100; // Drop from top
                         player.pos.x = WORLD.WIDTH / 2;
                         player.vel.x = 0;
                         player.vel.y = 0;
                         // Clear nearby enemies to prevent instant death loop?
                         // For now, top spawn is usually safe
                     }
                 }
            });
        }
    }

    this.entityManager.cleanup();
  }

  createParticles(x: number, y: number, color: string) {
      // Simple particle system would go here
  }

  draw() {
    this.ctx.fillStyle = '#050505'; // Clear background
    this.ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    
    if (this.blizzardActive) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for(let i=0; i<50; i++) {
            this.ctx.fillRect(Math.random() * WORLD.WIDTH, Math.random() * WORLD.HEIGHT, 2, 2);
        }
    }

    this.entityManager.entities.forEach(e => {
        // Handle transparency for invulnerability
        if (e.type === EntityType.PLAYER && e.invulnerableUntil && Date.now() < e.invulnerableUntil) {
             // Blink fast
             if (Math.floor(Date.now() / 50) % 2 === 0) {
                 this.ctx.globalAlpha = 0.3;
             } else {
                 this.ctx.globalAlpha = 0.8;
             }
        } else {
             this.ctx.globalAlpha = 1.0;
        }

        // Delegate drawing to Renderer
        Renderer.drawEntity(this.ctx, e);
        
        // Reset Alpha
        this.ctx.globalAlpha = 1.0;

        // Draw Freeze Bar if partially frozen
        if (e.type === EntityType.ENEMY && e.freezeLevel && e.freezeLevel > 0 && e.freezeLevel < 100) {
            this.ctx.fillStyle = '#1e293b';
            this.ctx.fillRect(e.pos.x, e.pos.y - 6, e.size.x, 4);
            
            this.ctx.fillStyle = '#67e8f9';
            this.ctx.fillRect(e.pos.x, e.pos.y - 6, (e.size.x * e.freezeLevel) / 100, 4);
        }
    });
  }
}