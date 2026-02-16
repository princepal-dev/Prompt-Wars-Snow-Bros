import { Entity, EntityType, EnemyState, PowerUpType } from '../types';

export class Renderer {
  
  static drawEntity(ctx: CanvasRenderingContext2D, e: Entity) {
    ctx.save();
    // Translate to entity position
    // We assume e.pos is top-left, so we might want to center operations relative to it
    ctx.translate(Math.floor(e.pos.x), Math.floor(e.pos.y));

    // Handle direction flipping for sprites
    // We assume default sprite faces RIGHT (direction = 1)
    if (e.direction === -1) {
       ctx.translate(e.size.x, 0);
       ctx.scale(-1, 1);
    }
    
    // Draw based on type
    switch (e.type) {
        case EntityType.PLAYER:
            Renderer.drawPlayer(ctx, e);
            break;
        case EntityType.ENEMY:
            Renderer.drawEnemy(ctx, e);
            break;
        case EntityType.SNOWBALL:
            Renderer.drawSnowball(ctx, e);
            break;
        case EntityType.PLATFORM:
        case EntityType.WALL:
            // Cancel flip for static objects if somehow they have direction -1
            if (e.direction === -1) {
                 ctx.scale(-1, 1);
                 ctx.translate(-e.size.x, 0);
            }
            Renderer.drawPlatform(ctx, e);
            break;
        case EntityType.PROJECTILE:
            Renderer.drawProjectile(ctx, e);
            break;
        case EntityType.POWERUP:
             if (e.direction === -1) {
                 ctx.scale(-1, 1);
                 ctx.translate(-e.size.x, 0);
            }
            Renderer.drawPowerUp(ctx, e);
            break;
    }

    ctx.restore();
  }

  static drawPlayer(ctx: CanvasRenderingContext2D, e: Entity) {
      // Snow Bro Character (32x32)
      
      // Animation state
      const isWalking = Math.abs(e.vel.x) > 0.1;
      const bob = isWalking ? Math.sin(Date.now() / 100) * 1 : 0;
      const legStride = isWalking ? Math.sin(Date.now() / 80) * 3 : 0;
      
      // Legs
      ctx.fillStyle = '#1e3a8a'; // Dark Blue Pants
      ctx.fillRect(8 - legStride, 20, 6, 12); // Back Leg
      ctx.fillRect(18 + legStride, 20, 6, 12); // Front Leg
      
      // Shoes
      ctx.fillStyle = '#ef4444'; // Red Shoes
      ctx.fillRect(6 - legStride, 28, 8, 4);
      ctx.fillRect(16 + legStride, 28, 8, 4);

      // Body (Overalls)
      ctx.fillStyle = '#0ea5e9'; // Cyan Blue
      ctx.beginPath();
      ctx.roundRect(6, 10 + bob, 20, 16, 4);
      ctx.fill();
      
      // Suspenders/Buttons
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(10, 14 + bob, 1.5, 0, Math.PI*2);
      ctx.arc(22, 14 + bob, 1.5, 0, Math.PI*2);
      ctx.fill();

      // Head
      ctx.fillStyle = '#fdba74'; // Skin tone
      ctx.beginPath();
      ctx.arc(16, 8 + bob, 7, 0, Math.PI * 2);
      ctx.fill();
      
      // Hat/Helmet
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(16, 6 + bob, 7.5, Math.PI, 0); // Top half
      ctx.fill();
      ctx.fillRect(14, 2 + bob, 4, 4); // Top knob

      // Goggles
      ctx.fillStyle = '#1e293b'; // Strap
      ctx.fillRect(9, 6 + bob, 14, 3);
      ctx.fillStyle = '#06b6d4'; // Lens
      ctx.fillRect(11, 5 + bob, 4, 4);
      ctx.fillRect(17, 5 + bob, 4, 4);
      ctx.fillStyle = '#ecfeff'; // Glint
      ctx.fillRect(12, 6 + bob, 1, 1);
      
      // Scarf (Flowing)
      ctx.fillStyle = '#fde047'; // Yellow
      ctx.fillRect(10, 13 + bob, 12, 3); // Neck part
      if (isWalking || !e.isGrounded) {
          ctx.beginPath();
          // Scarf tail
          const tailX = 8;
          const tailY = 14 + bob;
          const wave = Math.sin(Date.now()/50) * 3;
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(tailX - 8, tailY - 2 + wave);
          ctx.lineTo(tailX - 8, tailY + 4 + wave);
          ctx.lineTo(tailX, tailY + 4);
          ctx.fill();
      }
      
      // Gun/Hand
      ctx.fillStyle = '#475569';
      ctx.fillRect(20, 14 + bob, 8, 4); // Nozzle
      ctx.fillStyle = '#fdba74'; 
      ctx.beginPath();
      ctx.arc(20, 16 + bob, 3, 0, Math.PI*2); // Hand
      ctx.fill();
  }

  static drawEnemy(ctx: CanvasRenderingContext2D, e: Entity) {
      // Red Demon (32x32)
      
      const bounce = Math.abs(Math.sin(Date.now() / 150)) * 2;
      const walkWaddle = Math.sin(Date.now() / 100) * 2;
      
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(16, 30, 8, 3, 0, 0, Math.PI*2);
      ctx.fill();

      // Main Body
      ctx.fillStyle = e.state === EnemyState.STUNNED ? '#9ca3af' : '#dc2626'; // Greyish if stunned before freezing
      ctx.beginPath();
      // A slightly wide circle for body
      ctx.ellipse(16, 16 - bounce, 12 + (walkWaddle*0.5), 12 - (walkWaddle*0.5), 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Horns
      ctx.fillStyle = '#fcd34d'; // Yellow
      ctx.beginPath();
      ctx.moveTo(10, 8 - bounce);
      ctx.lineTo(6, 0 - bounce);
      ctx.lineTo(14, 6 - bounce);
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(22, 8 - bounce);
      ctx.lineTo(26, 0 - bounce);
      ctx.lineTo(18, 6 - bounce);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(12, 14 - bounce, 3, 4, 0, 0, Math.PI*2);
      ctx.ellipse(20, 14 - bounce, 3, 4, 0, 0, Math.PI*2);
      ctx.fill();
      
      // Pupils (Look at player direction if we had access, default left/right)
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(13, 14 - bounce, 1, 0, Math.PI*2);
      ctx.arc(21, 14 - bounce, 1, 0, Math.PI*2);
      ctx.fill();

      // Fangs
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(13, 20 - bounce); ctx.lineTo(14, 23 - bounce); ctx.lineTo(15, 20 - bounce);
      ctx.moveTo(17, 20 - bounce); ctx.lineTo(18, 23 - bounce); ctx.lineTo(19, 20 - bounce);
      ctx.fill();

      // Freeze Overlay (Ice encasing)
      if (e.freezeLevel && e.freezeLevel > 0) {
          const alpha = Math.min(0.9, e.freezeLevel / 100);
          
          // Ice Shape
          ctx.fillStyle = `rgba(200, 240, 255, ${alpha})`; 
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha + 0.2})`;
          ctx.lineWidth = 2;
          
          ctx.beginPath();
          // Draw rough hexagon/circle shape for ice block look
          const r = 16;
          ctx.moveTo(16 + r, 16 - bounce);
          for(let i=1; i<7; i++) {
              const angle = i * Math.PI / 3;
              ctx.lineTo(16 + Math.cos(angle)*r, 16 - bounce + Math.sin(angle)*r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Glint
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.beginPath();
          ctx.rect(10, 10 - bounce, 4, 4);
          ctx.fill();
      }
  }

  static drawSnowball(ctx: CanvasRenderingContext2D, e: Entity) {
      const radius = 16;
      ctx.translate(16, 16); // Center coordinate system
      
      if (e.isRolling) {
         const rotation = (Date.now() / 50) * (e.vel.x > 0 ? 1 : -1);
         ctx.rotate(rotation);
      }
      
      // Base Sphere
      const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.8, '#e0f2fe');
      grad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner Lines to show rotation
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, radius - 4, 0, Math.PI * 1.5);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(-8, -8);
      ctx.lineTo(8, 8);
      ctx.stroke();
  }
  
  static drawPlatform(ctx: CanvasRenderingContext2D, e: Entity) {
      // Tech Platform
      const w = e.size.x;
      const h = e.size.y;
      
      // Main block
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, w, h);
      
      // Top Neon Edge
      ctx.fillStyle = '#06b6d4'; // Cyan neon
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;
      ctx.fillRect(0, 0, w, 3);
      ctx.shadowBlur = 0;
      
      // Hazard markings
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for(let i=0; i < w; i+=30) {
          ctx.beginPath();
          ctx.moveTo(i, 3);
          ctx.lineTo(i+15, h);
          ctx.lineTo(i+5, h);
          ctx.lineTo(i-10, 3);
          ctx.fill();
      }
  }
  
  static drawProjectile(ctx: CanvasRenderingContext2D, e: Entity) {
      // Ice Shard
      ctx.fillStyle = '#a5f3fc';
      ctx.shadowColor = '#a5f3fc';
      ctx.shadowBlur = 5;
      
      ctx.beginPath();
      ctx.moveTo(16, 8); // Tip
      ctx.lineTo(4, 4);
      ctx.lineTo(4, 12);
      ctx.fill();
      
      ctx.shadowBlur = 0;
  }

  static drawPowerUp(ctx: CanvasRenderingContext2D, e: Entity) {
      const hover = Math.sin(Date.now() / 200) * 3;
      
      // Glow
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 15;
      
      // Bottle shape
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(8, 4 + hover);
      ctx.lineTo(16, 4 + hover);
      ctx.lineTo(16, 8 + hover);
      ctx.lineTo(20, 12 + hover); // Flair out
      ctx.lineTo(20, 20 + hover);
      ctx.lineTo(4, 20 + hover);
      ctx.lineTo(4, 12 + hover);
      ctx.lineTo(8, 8 + hover);
      ctx.closePath();
      ctx.fill();
      
      // Label
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '800 10px monospace';
      ctx.textAlign = 'center';
      
      let label = '?';
      if (e.powerUpType === PowerUpType.SPEED) label = 'S';
      if (e.powerUpType === PowerUpType.RAPID) label = 'R';
      if (e.powerUpType === PowerUpType.RANGE) label = 'L';
      
      ctx.fillText(label, 12, 17 + hover);
  }
}