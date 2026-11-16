// Projectiles: the player's bloom shots and the enemies' orbs, one pool.
// A bullet knows its side, its damage and whether it can crit; the world moves
// them, tests them against their targets, and removes them at the field's edge.
import { FIELD } from './config.js';
import { burst } from './particles.js';

export function createBullets() {
  return [];
}

export function spawnBullet(bullets, x, y, vx, vy, damage, radius, friendly, crit) {
  bullets.push({
    x, y, vx, vy, damage, radius, friendly,
    crit: !!crit,
    life: 2.2,
    dead: false,
    trail: 0,
  });
  if (bullets.length > 320) bullets.splice(0, bullets.length - 320);
}

export function updateBullets(bullets, world, dt) {
  const p = world.player;
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.trail += dt;
    if (b.life <= 0 || b.x < -24 || b.x > FIELD.width + 24 || b.y < -24 || b.y > FIELD.height + 24) {
      bullets.splice(i, 1);
      continue;
    }
    if (b.friendly) {
      // Find the closest enemy this bullet overlaps.
      let hit = null;
      let hitD = Infinity;
      for (const e of world.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < e.radius + b.radius && d < hitD) { hit = e; hitD = d; }
      }
      if (hit) {
        const dmg = b.damage * (b.crit ? 2 : 1);
        world.hitEnemy(hit, dmg, b.crit);
        burst(world.fx, b.x, b.y, '#a5f3fc', 5, 140, 0.3, 3);
        if (p.ricochet > 0) {
          // Bounce to the nearest other enemy.
          let next = null;
          let nd = 260;
          for (const e of world.enemies) {
            if (e.dead || e === hit) continue;
            const d = Math.hypot(e.x - b.x, e.y - b.y);
            if (d < nd) { nd = d; next = e; }
          }
          if (next) {
            const a = Math.atan2(next.y - b.y, next.x - b.x);
            const sp = Math.hypot(b.vx, b.vy);
            b.vx = Math.cos(a) * sp;
            b.vy = Math.sin(a) * sp;
            b.x = hit.x;
            b.y = hit.y;
            b.life = Math.max(b.life, 0.5);
            continue;
          }
        }
        bullets.splice(i, 1);
      }
    } else if (!p.dead && !p.invulnerable && p.dashTimer <= 0) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 14 + b.radius) {
        world.damagePlayer(b.damage);
        burst(world.fx, b.x, b.y, '#ff7ad9', 8, 160, 0.35, 3);
        bullets.splice(i, 1);
      }
    }
  }
}
