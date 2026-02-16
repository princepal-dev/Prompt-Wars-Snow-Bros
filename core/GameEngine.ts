
import { EntityManager } from '../entities/EntityManager';
import { Physics } from './Physics';
import { InputManager } from './InputManager';
import { GeminiDirector } from '../ai/GeminiDirector';
import { EntityType, EnemyState, GameState, WaveConfig, Entity, PowerUpType, PlatformConfig, BossState, PlayerState } from '../types';
import { PHYSICS, WORLD, GAMEPLAY } from '../utils/constants';
import { Renderer } from './Renderer';
import { SoundManager } from './SoundManager';
import { NetworkManager } from './NetworkManager';

export class GameEngine {
  entityManager: EntityManager;
  inputManager: InputManager;
  director: GeminiDirector;
  soundManager: SoundManager;
  networkManager: NetworkManager;
  
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  state: GameState = GameState.MENU;
  score: number = 0;
  wave: number = 0;
  
  // Loop vars
  animationFrameId: number = 0;
  lastTime: number = 0;
  accumulator: number = 0;
  readonly TIMESTEP: number = 1000 / 60; 

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
  shakeTimer: number = 0; 
  
  // Multiplayer
  isMultiplayer: boolean = false;
  roomId: string = "";
  
  onUIUpdate: (data: any) => void;
  isDestroyed: boolean = false;

  constructor(canvas: HTMLCanvasElement, onUIUpdate: (data: any) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!; 
    this.entityManager = new EntityManager();
    this.inputManager = new InputManager();
    this.director = new GeminiDirector();
    this.soundManager = new SoundManager();
    this.networkManager = new NetworkManager();
    this.onUIUpdate = onUIUpdate;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = WORLD.WIDTH * dpr;
    canvas.height = WORLD.HEIGHT * dpr;
    this.ctx.scale(dpr, dpr);
    canvas.style.width = `${WORLD.WIDTH}px`;
    canvas.style.height = `${WORLD.HEIGHT}px`;
    
    this.onUIUpdate({ isMuted: this.soundManager.isMuted });
    
    // Bind network updates (if connected)
    this.networkManager.onStateUpdate = (serverState) => {
        // In a full implementation, we would interpolate entities here
        // For now, we assume local simulation for smoother hackathon demo
        // but this hook is where you'd overwrite this.entityManager entities
    };
  }

  toggleAudio() {
      const isMuted = this.soundManager.toggleMute();
      this.onUIUpdate({ isMuted });
  }

  initWorld() {
    this.entityManager.reset();
    
    // Platform & Walls
    this.entityManager.addEntity(
      this.entityManager.createPlatform(0, WORLD.HEIGHT - WORLD.FLOOR_HEIGHT, WORLD.WIDTH, WORLD.FLOOR_HEIGHT)
    );
    const WALL_THICKNESS = 32;
    this.entityManager.addEntity(this.entityManager.createWall(0, 0, WALL_THICKNESS, WORLD.HEIGHT));
    this.entityManager.addEntity(this.entityManager.createWall(WORLD.WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, WORLD.HEIGHT));

    // Player 1
    const p1 = this.entityManager.createPlayer(WORLD.WIDTH / 2 - 30, WORLD.HEIGHT - 100);
    p1.id = 'player-1'; 
    p1.state = PlayerState.ALIVE;
    this.entityManager.addEntity(p1);

    // Player 2 (If Multiplayer)
    if (this.isMultiplayer) {
        const p2 = this.entityManager.createPlayer(WORLD.WIDTH / 2 + 30, WORLD.HEIGHT - 100);
        p2.id = 'player-2';
        p2.color = '#10b981'; // Green for P2
        p2.state = PlayerState.ALIVE;
        this.entityManager.addEntity(p2);
    }
  }
  
  applyLevelLayout(layout?: PlatformConfig[]) {
      const entitiesToKeep = this.entityManager.entities.filter(e => {
          if (e.type === EntityType.PLATFORM) {
              if (e.pos.y >= WORLD.HEIGHT - WORLD.FLOOR_HEIGHT) return true;
              return false;
          }
          if (e.type === EntityType.PLAYER) return true; // Keep players
          return true;
      });
      
      this.entityManager.entities = [];
      this.entityManager.reset(); 
      entitiesToKeep.forEach(e => this.entityManager.addEntity(e));
      
      if (layout) {
          layout.forEach(p => {
              this.entityManager.addEntity(
                  this.entityManager.createPlatform(p.x, p.y, p.w, p.h)
              );
          });
      } else {
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

      // Reset Players
      this.entityManager.getByType(EntityType.PLAYER).forEach(p => {
          p.pos.y = WORLD.HEIGHT - 100;
          p.vel.x = 0; p.vel.y = 0;
      });
  }

  destroy() {
      this.isDestroyed = true;
      this.soundManager.stopMusic();
      this.networkManager.disconnect();
      cancelAnimationFrame(this.animationFrameId);
      this.inputManager.cleanup();
  }

  restart() {
      this.state = GameState.MENU;
      this.score = 0;
      this.wave = 0;
      this.enemiesSpawned = 0;
      this.spawnTimer = 0;
      this.levelCompleteTimer = 0;
      this.isDestroyed = false;
      
      this.soundManager.resume();
      this.initWorld();
      this.startWave();
      this.state = GameState.PLAYING;
      
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
    
    // FORCE BOSS LEVEL IF LEVEL 5 OR DEBUG
    const isBossLevel = this.wave % 5 === 0;
    this.bossActive = isBossLevel;

    const players = this.entityManager.getByType(EntityType.PLAYER);
    const p1 = players[0];
    const lives = p1 ? p1.health : 0;

    let config: WaveConfig;
    
    if (isBossLevel) {
        config = {
            enemyCount: 1, 
            spawnInterval: 9999,
            enemySpeed: 2,
            aggressiveness: 1,
            specialEvent: 'BOSS',
            message: "WARNING: CLASS 5 TITAN DETECTED",
            enemyTheme: { name: "GLACIAL TITAN", color: "#ef4444", description: "Apex Predator" },
            layout: [] // Arena Cleared
        };
    } else {
        config = await this.director.generateWave(this.wave, {
            score: this.score,
            timeTaken: (Date.now() - this.waveStartTime) / 1000
        });
    }

    if (this.isDestroyed) return;

    this.currentWaveConfig = config;
    this.applyLevelLayout(config.layout);

    this.enemiesSpawned = 0;
    this.spawnTimer = 0;
    this.blizzardActive = config.specialEvent === 'BLIZZARD';
    
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
      enemyTheme: config.enemyTheme
    });
  }

  start(isMultiplayer: boolean = false, roomId: string = "") {
    this.isMultiplayer = isMultiplayer;
    this.roomId = roomId;
    
    if (this.isMultiplayer) {
        this.networkManager.connect('ws://localhost:3000'); // Mock URL
        this.networkManager.joinRoom(roomId);
    }
    
    this.soundManager.resume();
    this.soundManager.playTrack('GAME');
    this.state = GameState.PLAYING;
    this.score = 0;
    this.wave = 0;
    this.initWorld();
    this.startWave();
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  loop(currentTime: number) {
    if (this.isDestroyed) return;
    if (this.state !== GameState.PLAYING) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += deltaTime;

    if (this.accumulator > 200) this.accumulator = 200;

    while (this.accumulator >= this.TIMESTEP) {
      this.update(this.TIMESTEP / 1000); 
      this.accumulator -= this.TIMESTEP;
    }

    this.draw();
    this.animationFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  update(dt: number) {
    const input = this.inputManager.getState();
    if (this.isMultiplayer) {
        this.networkManager.sendInput(input);
    }

    const players = this.entityManager.getByType(EntityType.PLAYER);
    const platforms = this.entityManager.getByType(EntityType.PLATFORM);
    const walls = this.entityManager.getByType(EntityType.WALL);
    const mapObjects = [...platforms, ...walls];

    // --- SPAWNER LOGIC ---
    if (this.currentWaveConfig && this.enemiesSpawned < this.currentWaveConfig.enemyCount) {
      this.spawnTimer++;
      if (this.spawnTimer >= this.currentWaveConfig.spawnInterval) {
        if (this.currentWaveConfig.specialEvent === 'BOSS') {
            const boss = this.entityManager.createBoss(WORLD.WIDTH/2 - 32, -100);
            this.entityManager.addEntity(boss);
            this.enemiesSpawned++;
            this.onUIUpdate({ bossHealth: boss.health, bossMaxHealth: boss.maxHealth });
        } else {
            const x = Math.random() * (WORLD.WIDTH - 150) + 75; 
            const y = 50;
            const color = this.currentWaveConfig.enemyTheme?.color || '#ef4444';
            const enemy = this.entityManager.createEnemy(x, y, color);
            enemy.vel.x = (this.currentWaveConfig.enemySpeed) * (Math.random() > 0.5 ? 1 : -1);
            this.entityManager.addEntity(enemy);
            this.enemiesSpawned++;
            this.spawnTimer = 0;
        }
      }
    } else {
        // Win Condition Check
        const activeEnemies = this.entityManager.getByType(EntityType.ENEMY);
        const activeSnowballs = this.entityManager.getByType(EntityType.SNOWBALL);
        const activeBosses = this.entityManager.getByType(EntityType.BOSS);
        
        let count = 0;
        activeEnemies.forEach(e => { if (!e.markedForDeletion) count++; });
        activeSnowballs.forEach(e => { if (!e.markedForDeletion) count++; });
        activeBosses.forEach(e => { if (!e.markedForDeletion) count++; });

        if (count === 0 && this.enemiesSpawned >= (this.currentWaveConfig?.enemyCount || 0)) {
            if (this.levelCompleteTimer === 0) {
                this.levelCompleteTimer = Date.now();
                this.onUIUpdate({ message: "LEVEL COMPLETE", bossHealth: null });
                this.soundManager.playPowerUp(); 
            } else if (Date.now() - this.levelCompleteTimer > 2000) {
                this.startWave();
            }
        }
    }

    // --- ENTITY UPDATE LOOP ---
    if (this.shotCooldown > 0) this.shotCooldown--;

    this.entityManager.entities.forEach(e => {
      if (e.type === EntityType.PARTICLE) {
          if (e.ttl) e.ttl--;
          if (e.ttl !== undefined && e.ttl <= 0) e.markedForDeletion = true;
          e.pos.x += e.vel.x; e.pos.y += e.vel.y;
          return;
      }

      if (e.type !== EntityType.PLATFORM && e.type !== EntityType.PROJECTILE && e.type !== EntityType.WALL) {
        Physics.applyGravity(e);
      }

      // --- PLAYER LOGIC ---
      if (e.type === EntityType.PLAYER) {
        // Local Input for P1, or simple AI/Mock for P2 if not networked
        let myInput = input;
        
        // Multiplayer: Player 2 logic (Mocked for hackathon if no server)
        if (this.isMultiplayer && e.id === 'player-2') {
             // Mock P2 input: Follows P1 loosely
            const p1 = players.find(p => p.id === 'player-1');
            myInput = { left: false, right: false, up: false, down: false, jump: false, shoot: false };
            if (p1 && Math.abs(p1.pos.x - e.pos.x) > 50) {
                if (p1.pos.x > e.pos.x) myInput.right = true;
                else myInput.left = true;
            }
        }

        if (e.state === PlayerState.ALIVE) {
             // Movement
            const speedMult = e.moveSpeedMultiplier || 1;
            if (myInput.left) { e.vel.x = -PHYSICS.MAX_SPEED * speedMult; e.direction = -1; }
            else if (myInput.right) { e.vel.x = PHYSICS.MAX_SPEED * speedMult; e.direction = 1; }
            else { e.vel.x *= PHYSICS.FRICTION; }

            if (myInput.jump && e.isGrounded) {
                e.vel.y = PHYSICS.JUMP_FORCE;
                e.isGrounded = false;
                this.soundManager.playJump();
            }

            // Shooting (Only local player P1 triggers shots directly for now)
            if (myInput.shoot && this.shotCooldown <= 0 && e.id === 'player-1') {
                 // Spawning logic...
                 const projectiles = this.entityManager.getByType(EntityType.PROJECTILE);
                 if (projectiles.length < 5) {
                     const mult = e.rangeMultiplier || 1;
                     this.entityManager.addEntity(
                        this.entityManager.createProjectile(
                            e.pos.x + (e.direction === 1 ? e.size.x : -10), 
                            e.pos.y + 10, 
                            e.direction!,
                            mult
                        )
                     );
                     this.shotCooldown = Math.max(4, 12 / (e.fireRateMultiplier || 1));
                     this.soundManager.playShoot(); 
                 }
            }
        } else if (e.state === PlayerState.GHOST) {
            // Ghost movement (slower, floating)
            e.vel.x = 0; e.vel.y = 0; // Float
            const speed = 2;
            if (myInput.left) e.pos.x -= speed;
            if (myInput.right) e.pos.x += speed;
            if (myInput.up) e.pos.y -= speed;
            if (myInput.down) e.pos.y += speed;
        }
      }

      // --- ENEMY ---
      if (e.type === EntityType.ENEMY) {
        if (e.state === EnemyState.WALK) {
           if (e.isGrounded) {
             if (e.vel.x === 0) e.direction! *= -1;
             if (Math.random() < 0.01) e.direction! *= -1;
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
      
      // --- BOSS AI ---
      if (e.type === EntityType.BOSS) {
          this.updateBossAI(e, players);
      }

      // --- PROJECTILE ---
      if (e.type === EntityType.PROJECTILE) {
         e.ttl!--;
         if (e.ttl! <= 0) e.markedForDeletion = true;
      }

      // --- SNOWBALL ---
      if (e.type === EntityType.SNOWBALL) {
          if (e.isRolling) {
             if (Math.abs(e.vel.x) < 0.1) {
                 e.markedForDeletion = true;
                 this.entityManager.createParticleExplosion(e.pos.x + 16, e.pos.y + 16, '#e0f2fe');
             }
          } else {
              e.vel.x = 0;
          }
      }

      Physics.move(e);
      if (e.type !== EntityType.PROJECTILE && e.state !== PlayerState.GHOST) {
        Physics.resolveMapCollisions(e, mapObjects);
      }
    });

    this.handleCollisions(players);
    this.entityManager.cleanup();
  }
  
  updateBossAI(boss: Entity, players: Entity[]) {
      // 1. Spawn State
      if (boss.state === BossState.SPAWN) {
          if (boss.isGrounded) {
              boss.state = BossState.PHASE_1;
              this.shakeTimer = 20;
              this.soundManager.playExplosion();
          }
          return;
      }

      const hpPercent = (boss.health || 100) / (boss.maxHealth || 100);
      
      // 2. Phase Transitions
      if (boss.state === BossState.PHASE_1 && hpPercent < 0.7) {
          boss.state = BossState.PHASE_2;
          this.entityManager.createParticleExplosion(boss.pos.x+32, boss.pos.y+32, '#ef4444');
      } else if (boss.state === BossState.PHASE_2 && hpPercent < 0.3) {
          boss.state = BossState.PHASE_3; // ENRAGED / BLIZZARD
          this.blizzardActive = true;
          this.onUIUpdate({ blizzard: true });
          this.entityManager.createParticleExplosion(boss.pos.x+32, boss.pos.y+32, '#fff');
      }

      // 3. Phase Behavior
      if (boss.state === BossState.PHASE_1) {
          // Hover top, spawn minions
          boss.bossPhaseTimer = (boss.bossPhaseTimer || 0) + 1;
          
          // Move
          if (boss.pos.x < 100) boss.vel.x = 2;
          if (boss.pos.x > WORLD.WIDTH - 100) boss.vel.x = -2;
          if (boss.vel.x === 0) boss.vel.x = 2;

          // Spawn Minions every 3s (180 frames)
          if (boss.bossPhaseTimer > 180) {
              boss.bossPhaseTimer = 0;
              const m1 = this.entityManager.createEnemy(100, 100, '#ef4444');
              const m2 = this.entityManager.createEnemy(WORLD.WIDTH-100, 100, '#ef4444');
              this.entityManager.addEntity(m1);
              this.entityManager.addEntity(m2);
              this.soundManager.playEnemyHit();
          }
      }
      else if (boss.state === BossState.PHASE_2) {
          // Jump Slam
          boss.bossPhaseTimer = (boss.bossPhaseTimer || 0) + 1;
          
          if (boss.isGrounded && boss.bossPhaseTimer > 120) {
              // JUMP
              const target = players[Math.floor(Math.random() * players.length)];
              if (target) {
                  boss.vel.y = PHYSICS.JUMP_FORCE * 1.5;
                  const dx = target.pos.x - boss.pos.x;
                  boss.vel.x = dx / 30; // Aim to land in 30 frames
                  boss.bossPhaseTimer = 0;
              }
          }
          // On Land (handled by collision or next frame grounded check)
          if (boss.isGrounded && Math.abs(boss.vel.y) < 0.1 && boss.bossPhaseTimer === 1) {
              this.shakeTimer = 10;
              // Spawn minion on impact
              const m = this.entityManager.createEnemy(boss.pos.x, boss.pos.y - 50, '#ef4444');
              m.vel.y = -10;
              this.entityManager.addEntity(m);
          }
      }
      else if (boss.state === BossState.PHASE_3) {
          // Blizzard Center
          boss.vel.x = (WORLD.WIDTH/2 - boss.pos.x) * 0.1; // Move to center
          
          // Push players away (Wind)
          players.forEach(p => {
              p.vel.x += (Math.random() - 0.5) * 2; // Chaos wind
          });

          boss.bossPhaseTimer = (boss.bossPhaseTimer || 0) + 1;
          if (boss.bossPhaseTimer > 60) { // Fast spawn
               boss.bossPhaseTimer = 0;
               const m = this.entityManager.createEnemy(Math.random() * WORLD.WIDTH, 50, '#a5f3fc');
               this.entityManager.addEntity(m);
          }
      }
  }

  handleCollisions(players: Entity[]) {
    const projectiles = this.entityManager.getByType(EntityType.PROJECTILE);
    const enemies = this.entityManager.getByType(EntityType.ENEMY);
    const snowballs = this.entityManager.getByType(EntityType.SNOWBALL);
    const bosses = this.entityManager.getByType(EntityType.BOSS);
    
    // 1. Projectiles (Players Shooting)
    [...projectiles].forEach(p => {
        if (p.markedForDeletion) return;
        
        // Projectiles vs Boss -> NO DAMAGE (Immunue)
        for (const boss of bosses) {
            if (Physics.checkCollision(p, boss)) {
                p.markedForDeletion = true;
                // Deflect sound?
                this.soundManager.playEnemyHit(); 
                // Visual feedack "IMMUNE"
                break;
            }
        }

        // Projectiles vs Minions -> Freeze
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
    });

    // 2. Players vs Snowballs (Push)
    players.forEach(player => {
        if (player.state !== PlayerState.ALIVE) return;
        snowballs.forEach(s => {
            if (s.markedForDeletion) return;
            if (Physics.checkCollision(player, s)) {
                if (!s.isRolling) {
                    s.isRolling = true;
                    const dir = player.pos.x < s.pos.x ? 1 : -1;
                    s.vel.x = dir * PHYSICS.SNOWBALL_ROLL_SPEED;
                    s.vel.y = -2; 
                    this.soundManager.playJump();
                } else {
                    // Coop Boost?
                    // If moving same dir, speed up?
                }
            }
        });
    });
    
    // 3. Snowballs vs Boss (DAMAGE!)
    snowballs.forEach(s => {
        if (!s.isRolling || s.markedForDeletion) return;
        
        // Hit Boss
        bosses.forEach(b => {
             if (b.markedForDeletion) return;
             if (Physics.checkCollision(s, b)) {
                 b.health = (b.health || 100) - 100; // Big Damage
                 this.entityManager.createParticleExplosion(b.pos.x + 32, b.pos.y + 32, '#fff');
                 this.onUIUpdate({ bossHealth: b.health });
                 s.markedForDeletion = true; 
                 this.soundManager.playExplosion();
                 this.shakeTimer = 20;

                 if (b.health <= 0) {
                     b.state = BossState.DEFEATED;
                     b.markedForDeletion = true;
                     this.onUIUpdate({ bossHealth: null, message: "TARGET ELIMINATED" });
                     this.blizzardActive = false;
                 }
             }
        });
        
        // Hit Minions
        enemies.forEach(e => {
            if (e.markedForDeletion || e.type !== EntityType.ENEMY) return;
            if (Physics.checkCollision(s, e)) {
                e.markedForDeletion = true;
                this.entityManager.createParticleExplosion(e.pos.x + 16, e.pos.y + 16, e.color);
                this.soundManager.playExplosion();
            }
        });
    });

    // 4. Player vs Entities (Damage/Revive)
    const alivePlayers = players.filter(p => p.state === PlayerState.ALIVE);
    
    // Check Revive
    const ghostPlayers = players.filter(p => p.state === PlayerState.GHOST);
    if (ghostPlayers.length > 0 && alivePlayers.length > 0) {
        ghostPlayers.forEach(ghost => {
            alivePlayers.forEach(saver => {
                if (Physics.checkCollision(ghost, saver)) {
                    ghost.state = PlayerState.ALIVE;
                    ghost.health = 1;
                    ghost.color = '#0ea5e9'; // Reset color
                    this.onUIUpdate({ message: "OPERATOR REVIVED" });
                    this.soundManager.playPowerUp();
                }
            });
        });
    }

    // Check Damage
    alivePlayers.forEach(player => {
        const now = Date.now();
        if (player.invulnerableUntil && now < player.invulnerableUntil) return;

        // Hit by Enemy
        enemies.forEach(e => {
             if (e.markedForDeletion || e.type !== EntityType.ENEMY) return;
             if (e.state === EnemyState.WALK && Physics.checkCollision(player, e)) {
                 this.playerTakeDamage(player);
             }
        });
        
        // Hit by Boss
        bosses.forEach(b => {
            if (b.markedForDeletion) return;
            if (Physics.checkCollision(player, b)) {
                this.playerTakeDamage(player);
            }
        });
    });
    
    // Check Game Over (All players dead/ghost)
    const activeP = players.filter(p => p.state === PlayerState.ALIVE);
    if (activeP.length === 0 && players.length > 0) {
        this.state = GameState.GAME_OVER;
        this.soundManager.stopMusic();
        this.onUIUpdate({ message: "MISSION FAILED", gameOver: true });
    }
  }

  playerTakeDamage(player: Entity) {
      player.health = (player.health || 1) - 1;
      this.onUIUpdate({ lives: player.health }); // Only updates local player UI mostly
      this.shakeTimer = 20;
      this.soundManager.playExplosion();

      if (player.health <= 0) {
          player.state = PlayerState.GHOST;
          player.color = 'rgba(255,255,255,0.3)'; // Ghost visual
          player.invulnerableUntil = 0;
      } else {
          player.invulnerableUntil = Date.now() + 2000;
          player.vel.y = -10;
      }
  }

  draw() {
    this.ctx.save();
    
    // Screen Shake
    if (this.shakeTimer > 0) {
        const intensity = this.shakeTimer; 
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
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        for(let i=0; i<100; i++) {
            const wind = (Date.now() / 10) % WORLD.WIDTH;
            this.ctx.fillRect((Math.random() * WORLD.WIDTH + wind) % WORLD.WIDTH, Math.random() * WORLD.HEIGHT, 3, 1);
        }
    }

    // Draw Entities
    this.entityManager.entities.forEach(e => {
        Renderer.drawEntity(this.ctx, e);
        
        // Draw Freeze Bar
        if (e.type === EntityType.ENEMY && e.freezeLevel && e.freezeLevel > 0 && e.freezeLevel < 100) {
            this.ctx.fillStyle = '#1e293b';
            this.ctx.fillRect(e.pos.x, e.pos.y - 6, e.size.x, 4);
            this.ctx.fillStyle = '#67e8f9';
            this.ctx.fillRect(e.pos.x, e.pos.y - 6, (e.size.x * e.freezeLevel) / 100, 4);
        }
        
        // P2 Tag
        if (e.type === EntityType.PLAYER && e.id === 'player-2') {
             this.ctx.fillStyle = '#10b981';
             this.ctx.font = '10px monospace';
             this.ctx.fillText("P2", e.pos.x + 10, e.pos.y - 10);
        }
    });

    this.ctx.restore();
  }
}
