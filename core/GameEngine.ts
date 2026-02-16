
import { EntityManager } from '../entities/EntityManager';
import { Physics } from './Physics';
import { InputManager } from './InputManager';
import { GeminiDirector } from '../ai/GeminiDirector';
import { EntityType, EnemyState, GameState, WaveConfig, Entity, PowerUpType, PlatformConfig, BossState } from '../types';
import { PHYSICS, WORLD, GAMEPLAY } from '../utils/constants';
import { Renderer } from './Renderer';
import { SoundManager } from './SoundManager';

export class GameEngine {
  entityManager: EntityManager;
  inputManager: InputManager;
  director: GeminiDirector;
  soundManager: SoundManager;
  
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  state: GameState = GameState.MENU;
  score: number = 0;
  wave: number = 0;
  
  // Loop vars
  animationFrameId: number = 0;
  lastTime: number = 0;
  accumulator: number = 0;
  readonly TIMESTEP: number = 1000 / 60; // 60 FPS fixed update

  // Wave vars
  currentWaveConfig: WaveConfig | null = null;
  spawnTimer: number = 0;
  enemiesSpawned: number = 0;
  waveStartTime: number = 0;
  blizzardActive: boolean = false;
  bossActive: boolean = false;
  
  // Gameplay vars
  shotCooldown: number = 0;
  levelCompleteTimer: number = 0;
  shakeTimer: number = 0; // Screen shake duration
  
  onUIUpdate: (data: any) => void;
  isDestroyed: boolean = false;

  constructor(canvas: HTMLCanvasElement, onUIUpdate: (data: any) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!; // Alpha false for performance
    this.entityManager = new EntityManager();
    this.inputManager = new InputManager();
    this.director = new GeminiDirector();
    this.soundManager = new SoundManager();
    this.onUIUpdate = onUIUpdate;

    // Correct canvas size for high DPI
    const dpr = window.devicePixelRatio || 1;
    canvas.width = WORLD.WIDTH * dpr;
    canvas.height = WORLD.HEIGHT * dpr;
    this.ctx.scale(dpr, dpr);
    canvas.style.width = `${WORLD.WIDTH}px`;
    canvas.style.height = `${WORLD.HEIGHT}px`;
    
    // Initial UI Sync for Audio
    this.onUIUpdate({ isMuted: this.soundManager.isMuted });
    
    // Start Menu Music logic handled in App or after first interaction
  }

  toggleAudio() {
      const isMuted = this.soundManager.toggleMute();
      this.onUIUpdate({ isMuted });
  }

  // Initial setup for a fresh game start
  initWorld() {
    this.entityManager.reset();
    
    // 1. Static Arena (Floor) - Platform
    this.entityManager.addEntity(
      this.entityManager.createPlatform(0, WORLD.HEIGHT - WORLD.FLOOR_HEIGHT, WORLD.WIDTH, WORLD.FLOOR_HEIGHT)
    );
    
    // 2. Visible Side Walls - Solid Walls
    const WALL_THICKNESS = 32;
    this.entityManager.addEntity(this.entityManager.createWall(0, 0, WALL_THICKNESS, WORLD.HEIGHT));
    this.entityManager.addEntity(this.entityManager.createWall(WORLD.WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, WORLD.HEIGHT));

    // 3. Player (Spawn center)
    this.entityManager.addEntity(this.entityManager.createPlayer(WORLD.WIDTH / 2, WORLD.HEIGHT - 100));
  }
  
  // Rebuilds floating platforms for a new wave
  applyLevelLayout(layout?: PlatformConfig[]) {
      // Remove existing floating platforms (but keep Floor/Walls)
      const entitiesToKeep = this.entityManager.entities.filter(e => {
          if (e.type === EntityType.PLATFORM) {
              // Keep if it's the floor (at the bottom)
              if (e.pos.y >= WORLD.HEIGHT - WORLD.FLOOR_HEIGHT) return true;
              return false;
          }
          return true;
      });
      
      this.entityManager.entities = [];
      this.entityManager.reset(); // This clears cache, so we need to re-add everything
      
      // Re-add kept entities
      entitiesToKeep.forEach(e => this.entityManager.addEntity(e));
      
      // Add new layout
      if (layout) {
          layout.forEach(p => {
              this.entityManager.addEntity(
                  this.entityManager.createPlatform(p.x, p.y, p.w, p.h)
              );
          });
      } else {
          // Default layout
           const platforms = [
            [100, 400], [500, 400],
            [300, 250],
            [100, 100], [500, 100]
          ];
          platforms.forEach(p => {
            this.entityManager.addEntity(
                this.entityManager.createPlatform(p[0], p[1], 200, 20)
            );
          });
      }

      // Reset Player Position to safe spot if they are inside a new platform
      const player = this.entityManager.getByType(EntityType.PLAYER)[0];
      if (player) {
          player.pos.x = WORLD.WIDTH / 2;
          player.pos.y = WORLD.HEIGHT - 100; // Reset to floor
          player.vel.x = 0;
          player.vel.y = 0;
      }
  }

  destroy() {
      this.isDestroyed = true;
      this.soundManager.stopMusic();
      cancelAnimationFrame(this.animationFrameId);
      this.inputManager.cleanup();
  }

  // Restart method for Game Over screen
  restart() {
      this.state = GameState.MENU; // Briefly switch to menu or reset state logic
      this.score = 0;
      this.wave = 0;
      this.enemiesSpawned = 0;
      this.spawnTimer = 0;
      this.levelCompleteTimer = 0;
      this.isDestroyed = false; // Revive if needed, though usually we don't set destroyed unless component unmounts
      
      // Stop any audio if needed
      this.soundManager.resume();

      this.initWorld();
      this.startWave();
      this.state = GameState.PLAYING;
      
      // Update UI
      this.onUIUpdate({
          score: 0,
          wave: 1,
          lives: 3,
          message: "REBOOTING SYSTEM...",
          gameOver: false,
          blizzard: false
      });
  }

  async startWave() {
    if (this.isDestroyed) return;
    this.wave++;
    this.waveStartTime = Date.now();
    this.levelCompleteTimer = 0;
    this.onUIUpdate({ message: "CONTACTING AI DIRECTOR..." });
    
    // Check for BOSS Level (Every 5 levels)
    const isBossLevel = this.wave % 5 === 0;
    this.bossActive = isBossLevel;

    // Get player stats to pass to AI
    const players = this.entityManager.getByType(EntityType.PLAYER);
    const player = players.length > 0 ? players[0] : null;
    const lives = player ? player.health : 0;

    let config: WaveConfig;
    
    if (isBossLevel) {
        config = {
            enemyCount: 1, // Only the boss
            spawnInterval: 9999,
            enemySpeed: 2,
            aggressiveness: 1,
            specialEvent: 'BOSS',
            message: "WARNING: BOSS APPROACHING",
            enemyTheme: { name: "GLACIAL TITAN", color: "#ef4444", description: "Apex Predator" },
            layout: [] // Clear arena for boss
        };
    } else {
        config = await this.director.generateWave(this.wave, {
            score: this.score,
            timeTaken: (Date.now() - this.waveStartTime) / 1000
        });
    }

    if (this.isDestroyed) return;

    this.currentWaveConfig = config;
    
    // APPLY NEW LEVEL LAYOUT
    this.applyLevelLayout(config.layout);

    this.enemiesSpawned = 0;
    this.spawnTimer = 0;
    this.blizzardActive = config.specialEvent === 'BLIZZARD';
    
    // Music Switch
    if (isBossLevel) {
        this.soundManager.playTrack('BOSS');
    } else {
        this.soundManager.playTrack('GAME');
    }
    
    this.onUIUpdate({ 
      wave: this.wave, 
      score: this.score, 
      lives: lives,
      message: config.message,
      blizzard: this.blizzardActive,
      enemyTheme: config.enemyTheme // Pass the new enemy theme to UI
    });
  }

  start() {
    this.soundManager.resume(); // Ensure AudioContext is ready
    this.soundManager.playTrack('GAME');
    this.state = GameState.PLAYING;
    this.score = 0;
    this.wave = 0;
    this.initWorld(); // Basic setup
    this.startWave(); // Will fetch layout and spawn first wave
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  loop(currentTime: number) {
    if (this.isDestroyed) return;
    if (this.state !== GameState.PLAYING) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += deltaTime;

    // Cap accumulator to prevent spiral of death
    if (this.accumulator > 200) this.accumulator = 200;

    while (this.accumulator >= this.TIMESTEP) {
      this.update(this.TIMESTEP / 1000); // Fixed dt in seconds
      this.accumulator -= this.TIMESTEP;
    }

    this.draw();
    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt: number) {
    const input = this.inputManager.getState();
    const players = this.entityManager.getByType(EntityType.PLAYER);
    const player = players.length > 0 ? players[0] : null;
    
    // Cached Access for Map Objects
    const platforms = this.entityManager.getByType(EntityType.PLATFORM);
    const walls = this.entityManager.getByType(EntityType.WALL);
    const mapObjects = [...platforms, ...walls];

    // --- SPAWNER LOGIC ---
    if (this.currentWaveConfig && this.enemiesSpawned < this.currentWaveConfig.enemyCount) {
      this.spawnTimer++;
      if (this.spawnTimer >= this.currentWaveConfig.spawnInterval) {
        if (this.currentWaveConfig.specialEvent === 'BOSS') {
            // Spawn BOSS
            const boss = this.entityManager.createBoss(WORLD.WIDTH/2 - 32, 50);
            this.entityManager.addEntity(boss);
            this.enemiesSpawned++;
            this.onUIUpdate({ bossHealth: boss.health, bossMaxHealth: boss.maxHealth }); // Init Boss HP Bar
        } else {
            // Normal Spawn
            const x = Math.random() * (WORLD.WIDTH - 150) + 75; 
            const y = 50;
            if (player && Math.abs(x - player.pos.x) > GAMEPLAY.SPAWN_SAFE_RADIUS) {
                const color = this.currentWaveConfig.enemyTheme?.color || '#ef4444';
                const enemy = this.entityManager.createEnemy(x, y, color);
                enemy.vel.x = (this.currentWaveConfig.enemySpeed) * (Math.random() > 0.5 ? 1 : -1);
                this.entityManager.addEntity(enemy);
                this.enemiesSpawned++;
                this.spawnTimer = 0;
            }
        }
      }
    } else if (this.currentWaveConfig && this.enemiesSpawned >= this.currentWaveConfig.enemyCount) {
        // Check if level cleared
        const activeEnemies = this.entityManager.getByType(EntityType.ENEMY);
        const activeSnowballs = this.entityManager.getByType(EntityType.SNOWBALL);
        const activeBosses = this.entityManager.getByType(EntityType.BOSS);
        
        let count = 0;
        activeEnemies.forEach(e => { if (!e.markedForDeletion) count++; });
        activeSnowballs.forEach(e => { if (!e.markedForDeletion) count++; });
        activeBosses.forEach(e => { if (!e.markedForDeletion) count++; });

        if (count === 0) {
            if (this.levelCompleteTimer === 0) {
                // Level complete triggered
                this.levelCompleteTimer = Date.now();
                this.onUIUpdate({ message: "LEVEL COMPLETE - PROCEEDING...", bossHealth: null });
                this.soundManager.playPowerUp(); 
            } else if (Date.now() - this.levelCompleteTimer > 2000) {
                // After 2 seconds, start next level
                this.startWave();
            }
        }
    }

    // --- ENTITY UPDATE LOOP ---
    
    // Shoot Logic Cooldown
    if (this.shotCooldown > 0) this.shotCooldown--;

    if (input.shoot && player && this.shotCooldown <= 0) {
       const projectiles = this.entityManager.getByType(EntityType.PROJECTILE);
       if (projectiles.length < 5) { // Allow more bullets with powerups
             const mult = player.rangeMultiplier || 1;
             this.entityManager.addEntity(
                this.entityManager.createProjectile(
                    player.pos.x + (player.direction === 1 ? player.size.x : -10), 
                    player.pos.y + 10, 
                    player.direction!,
                    mult
                )
             );
             // Base 12 frames, reduced by multiplier
             this.shotCooldown = Math.max(4, 12 / (player.fireRateMultiplier || 1));
             this.soundManager.playShoot(); 
       }
    }

    // Iterate through all entities for physics
    this.entityManager.entities.forEach(e => {
      // Particles decay
      if (e.type === EntityType.PARTICLE) {
          if (e.ttl) e.ttl--;
          if (e.ttl !== undefined && e.ttl <= 0) e.markedForDeletion = true;
          e.pos.x += e.vel.x;
          e.pos.y += e.vel.y;
          return; // Skip physics for particles
      }

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
          this.soundManager.playJump();
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
             if (Math.random() < 0.005) {
                 e.vel.y = PHYSICS.JUMP_FORCE;
             }
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
      
      // --- BOSS LOGIC ---
      if (e.type === EntityType.BOSS) {
          this.updateBossAI(e, player);
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
             if (Math.abs(e.vel.x) < 0.1) {
                 e.markedForDeletion = true; // Stopped snowballs break
                 this.entityManager.createParticleExplosion(e.pos.x + 16, e.pos.y + 16, '#e0f2fe');
             }
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

    // --- COLLISION RESOLUTION ---
    this.handleCollisions(player);
    
    this.entityManager.cleanup();
  }
  
  updateBossAI(boss: Entity, player: Entity | null) {
      if (boss.state === BossState.SPAWN) {
          // Drop from sky
          if (boss.isGrounded) {
              boss.state = BossState.PHASE_1;
              this.shakeTimer = 20; // Landing impact
              this.soundManager.playExplosion();
          }
          return;
      }
      
      if (boss.state === BossState.STUNNED) {
          // Frozen logic
           boss.vel.x = 0;
           if (boss.freezeLevel !== undefined) {
                boss.freezeLevel -= GAMEPLAY.FREEZE_DECAY * 2; // Thaws faster than minions
                if (boss.freezeLevel <= 0) {
                     // Break out!
                     boss.state = BossState.ENRAGED;
                     boss.color = '#ef4444'; // Red Enraged
                     this.shakeTimer = 10;
                     this.soundManager.playExplosion();
                     this.entityManager.createParticleExplosion(boss.pos.x+32, boss.pos.y+32, '#a5f3fc');
                }
            }
            return;
      }

      // Active AI (PHASE 1, 2, ENRAGED)
      const speed = (boss.state === BossState.ENRAGED) ? 3 : 1.5;
      
      if (boss.isGrounded && player) {
          // Chase Player
          const dx = player.pos.x - boss.pos.x;
          boss.direction = dx > 0 ? 1 : -1;
          boss.vel.x = boss.direction * speed;
          
          // Random Jump
          if (Math.random() < 0.01) boss.vel.y = PHYSICS.JUMP_FORCE;
      }
      
      // Attacks
      if (boss.attackCooldown && boss.attackCooldown > 0) {
          boss.attackCooldown--;
      } else {
          // Attack!
          // 50/50 Chance between Shoot or nothing
          if (Math.random() > 0.5) {
             // Spread Shot
             for(let i=-1; i<=1; i++) {
                 // Boss creates projectiles but they need to be ENEMY_PROJECTILE type if we had one
                 // For now, reuse regular projectile but maybe give it different color in Renderer
                 // NOTE: In collision logic, we need to make sure Boss Projectiles hurt Player
                 // Currently only Enemy Bodies hurt Player. 
                 // Simple hack: Spawn a "mini enemy" projectile or just collision check Logic update needed.
                 // For Hackathon: Just spawn enemies (minions)
                 if (this.entityManager.getByType(EntityType.ENEMY).length < 5) {
                     const minion = this.entityManager.createEnemy(boss.pos.x, boss.pos.y - 20);
                     minion.vel.y = -5;
                     minion.vel.x = i * 2;
                     this.entityManager.addEntity(minion);
                 }
             }
          }
          boss.attackCooldown = (boss.state === BossState.ENRAGED) ? 60 : 120;
      }
  }

  handleCollisions(player: Entity | null) {
    const projectiles = this.entityManager.getByType(EntityType.PROJECTILE);
    const enemies = this.entityManager.getByType(EntityType.ENEMY);
    const snowballs = this.entityManager.getByType(EntityType.SNOWBALL);
    const powerUps = this.entityManager.getByType(EntityType.POWERUP);
    const bosses = this.entityManager.getByType(EntityType.BOSS);
    
    // 1. Projectile vs Enemy/Boss
    [...projectiles].forEach(p => {
        if (p.markedForDeletion) return;
        
        // Vs Enemies
        for (const enemy of enemies) {
             if (enemy.markedForDeletion || enemy.type !== EntityType.ENEMY) continue;
             if (Physics.checkCollision(p, enemy)) {
                p.markedForDeletion = true;
                if (enemy.state !== EnemyState.FROZEN) {
                    enemy.freezeLevel = (enemy.freezeLevel || 0) + GAMEPLAY.FREEZE_PER_SHOT;
                    enemy.state = EnemyState.STUNNED;
                    this.soundManager.playEnemyHit();
                    if (enemy.freezeLevel >= 100) {
                        this.entityManager.transformToSnowball(enemy);
                        this.soundManager.playJump(); 
                    }
                }
                break;
            }
        }
        
        // Vs Bosses
        if (!p.markedForDeletion) {
            for (const boss of bosses) {
                if (boss.markedForDeletion) continue;
                if (Physics.checkCollision(p, boss)) {
                    p.markedForDeletion = true;
                    // Boss Logic
                    if (boss.state !== BossState.STUNNED) {
                         // Boss takes 5 shots to freeze
                         boss.freezeLevel = (boss.freezeLevel || 0) + 20; 
                         this.soundManager.playEnemyHit();
                         if (boss.freezeLevel >= 100) {
                             boss.state = BossState.STUNNED;
                             boss.color = '#a5f3fc'; // Ice Color
                             this.soundManager.playJump();
                             // Boss stays stunned for a bit, player must push
                         }
                    }
                    break;
                }
            }
        }
    });

    // 2. Player vs Snowball/Boss (Kick)
    if (player) {
        // Kick Snowballs
        snowballs.forEach(s => {
            if (s.markedForDeletion) return;
            if (Physics.checkCollision(player, s)) {
                if (!s.isRolling) {
                    s.isRolling = true;
                    const dir = player.pos.x < s.pos.x ? 1 : -1;
                    s.vel.x = dir * PHYSICS.SNOWBALL_ROLL_SPEED;
                    s.vel.y = -2; 
                    this.score += 500;
                    this.onUIUpdate({ score: this.score });
                    this.soundManager.playJump();
                    this.shakeTimer = 5;
                }
            }
        });
        
        // Kick Stunned Boss
        bosses.forEach(boss => {
            if (boss.markedForDeletion) return;
            if (boss.state === BossState.STUNNED && Physics.checkCollision(player, boss)) {
                 // DAMAGE BOSS
                 boss.health = (boss.health || 100) - 34; // 3 hits to kill
                 this.score += 5000;
                 this.shakeTimer = 20;
                 this.soundManager.playExplosion();
                 this.entityManager.createParticleExplosion(boss.pos.x + 32, boss.pos.y + 32, '#ef4444');
                 
                 // Update HP Bar
                 this.onUIUpdate({ score: this.score, bossHealth: boss.health });
                 
                 if (boss.health <= 0) {
                     boss.markedForDeletion = true;
                     this.soundManager.playPowerUp(); // Victory Sound
                     this.onUIUpdate({ bossHealth: null });
                     // Spawn Powerups
                     this.entityManager.addEntity(this.entityManager.createPowerUp(boss.pos.x, boss.pos.y, PowerUpType.RAPID));
                 } else {
                     // Reset Boss to Angry
                     boss.state = BossState.ENRAGED;
                     boss.freezeLevel = 0;
                     boss.color = '#ef4444';
                     boss.vel.y = -10; // Jump away
                 }
            }
        });
    }

    // 3. Snowball vs Enemies/Bosses (Wipeout)
    snowballs.forEach(s => {
        if (!s.isRolling || s.markedForDeletion) return;
        
        enemies.forEach(e => {
            if (e.markedForDeletion || e.type !== EntityType.ENEMY) return;
            if (Physics.checkCollision(s, e)) {
                e.markedForDeletion = true;
                this.score += 1000;
                this.entityManager.createParticleExplosion(e.pos.x + 16, e.pos.y + 16, e.color);
                this.soundManager.playExplosion();
                this.shakeTimer = 10;
            }
        });
        
        // Snowball hits Boss (Tiny Damage)
        bosses.forEach(b => {
             if (b.markedForDeletion) return;
             if (Physics.checkCollision(s, b) && b.state !== BossState.STUNNED) {
                 b.health = (b.health || 100) - 5; // Small chip damage
                 this.entityManager.createParticleExplosion(b.pos.x + 32, b.pos.y + 32, '#fff');
                 this.onUIUpdate({ bossHealth: b.health });
                 // Snowball breaks on boss
                 s.markedForDeletion = true; 
                 this.soundManager.playExplosion();
             }
        });
    });

    // 4. Player vs PowerUp
    if (player) {
        powerUps.forEach(pu => {
            if (pu.markedForDeletion) return;
            if (Physics.checkCollision(player, pu)) {
                pu.markedForDeletion = true;
                this.score += 200;
                this.soundManager.playPowerUp();
                
                // Apply Stats
                if (pu.powerUpType === PowerUpType.SPEED) player.moveSpeedMultiplier = (player.moveSpeedMultiplier || 1) + 0.2;
                if (pu.powerUpType === PowerUpType.RAPID) player.fireRateMultiplier = (player.fireRateMultiplier || 1) + 0.3;
                if (pu.powerUpType === PowerUpType.RANGE) player.rangeMultiplier = (player.rangeMultiplier || 1) + 0.5;
                
                this.onUIUpdate({ score: this.score });
            }
        });
    }

    // 5. Player vs Enemy/Boss (Damage)
    if (player) {
        const now = Date.now();
        const isInvulnerable = player.invulnerableUntil && now < player.invulnerableUntil;

        if (!isInvulnerable) {
            // Vs Enemy
            enemies.forEach(e => {
                 if (e.markedForDeletion || e.type !== EntityType.ENEMY) return;
                 if (e.state === EnemyState.WALK && Physics.checkCollision(player, e)) {
                     this.playerTakeDamage(player);
                 }
            });
            // Vs Boss
            bosses.forEach(b => {
                if (b.markedForDeletion) return;
                if (b.state !== BossState.STUNNED && Physics.checkCollision(player, b)) {
                    this.playerTakeDamage(player);
                }
            });
        }
    }
  }

  playerTakeDamage(player: Entity) {
      player.health = (player.health || 1) - 1;
      this.onUIUpdate({ lives: player.health });
      this.shakeTimer = 20;
      this.soundManager.playExplosion();

      if (player.health <= 0) {
          this.state = GameState.GAME_OVER;
          this.soundManager.stopMusic();
          this.onUIUpdate({ message: "GAME OVER", gameOver: true });
      } else {
          player.invulnerableUntil = Date.now() + 2000;
          player.pos.y = 100; 
          player.pos.x = WORLD.WIDTH / 2;
          player.vel.x = 0;
          player.vel.y = 0;
      }
  }

  draw() {
    this.ctx.save();
    
    // Screen Shake
    if (this.shakeTimer > 0) {
        const intensity = this.shakeTimer; // decay
        const dx = (Math.random() - 0.5) * intensity;
        const dy = (Math.random() - 0.5) * intensity;
        this.ctx.translate(dx, dy);
        this.shakeTimer--;
    }

    // Clear
    this.ctx.fillStyle = '#050505'; 
    this.ctx.fillRect(-20, -20, WORLD.WIDTH + 40, WORLD.HEIGHT + 40); 
    
    // Blizzard FX
    if (this.blizzardActive) {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for(let i=0; i<50; i++) {
            this.ctx.fillRect(Math.random() * WORLD.WIDTH, Math.random() * WORLD.HEIGHT, 2, 2);
        }
    }

    // Draw Entities
    this.entityManager.entities.forEach(e => {
        // Handle transparency for invulnerability
        if (e.type === EntityType.PLAYER && e.invulnerableUntil && Date.now() < e.invulnerableUntil) {
             if (Math.floor(Date.now() / 50) % 2 === 0) {
                 this.ctx.globalAlpha = 0.3;
             } else {
                 this.ctx.globalAlpha = 0.8;
             }
        } else {
             this.ctx.globalAlpha = 1.0;
        }

        Renderer.drawEntity(this.ctx, e);
        
        this.ctx.globalAlpha = 1.0;

        // Draw Freeze Bar (Small enemies)
        if (e.type === EntityType.ENEMY && e.freezeLevel && e.freezeLevel > 0 && e.freezeLevel < 100) {
            this.ctx.fillStyle = '#1e293b';
            this.ctx.fillRect(e.pos.x, e.pos.y - 6, e.size.x, 4);
            this.ctx.fillStyle = '#67e8f9';
            this.ctx.fillRect(e.pos.x, e.pos.y - 6, (e.size.x * e.freezeLevel) / 100, 4);
        }
    });

    this.ctx.restore();
  }
}
