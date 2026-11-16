// The player: the seed-ship Bloom. Movement, dash with i-frames, the bloom gun,
// and every stat an upgrade can change. All numbers start from config.PLAYER and
// are then shaped by the upgrade levels in `p.mods`.
import { FIELD, PLAYER, STEP } from './config.js';
import { range } from './random.js';
import { burst, addShake } from './particles.js';

export function createPlayer() {
  return {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    shield: 0,
    shieldMax: 0,
    shieldTimer: 0,
    level: 1,
    xp: 0,
    fireTimer: 0,
    dashTimer: 0,
    dashCooldown: 0,
    dashCharges: 1,
    dashUsed: 0,
    invulnerable: 0,
    hurtFlash: 0,
    dead: false,
    trail: [],
    novaReady: 0,
    // Upgrade-modified stats; mods are counts per upgrade id.
    mods: {},
    fireInterval: PLAYER.fireInterval,
    projectiles: 1,
    damage: PLAYER.bulletDamage,
    bulletSpeed: PLAYER.bulletSpeed,
    speed: PLAYER.speed,
    pickupRadius: PLAYER.pickupRadius,
    critChance: PLAYER.critChance,
    ricochet: 0,
    thornNova: 0,
  };
}

export function modCount(p, id) {
  return p.mods[id] || 0;
}

/** Recompute derived stats from the upgrade counts. */
export function recompute(p) {
  p.fireInterval = PLAYER.fireInterval * Math.pow(0.84, modCount(p, 'rapid'));
  p.projectiles = 1 + modCount(p, 'twin');
  p.damage = PLAYER.bulletDamage * Math.pow(1.25, modCount(p, 'heavy'));
  p.speed = PLAYER.speed * Math.pow(1.12, modCount(p, 'swift'));
  p.pickupRadius = PLAYER.pickupRadius * Math.pow(1.45, modCount(p, 'magnet'));
  p.critChance = PLAYER.critChance + 0.12 * modCount(p, 'crit');
  p.ricochet = modCount(p, 'ricochet');
  p.thornNova = modCount(p, 'thorn');
  p.dashCharges = 1 + (modCount(p, 'longdash') >= 2 ? 1 : 0);
  p.shieldMax = 20 * modCount(p, 'spore');
  if (p.shield > p.shieldMax) p.shield = p.shieldMax;
}

function aimAngle(p, input, enemies) {
  if (input.aimSeen) return Math.atan2(input.aimY - p.y, input.aimX - p.x);
  // No mouse yet: aim at the nearest living enemy, else keep facing.
  let best = null;
  let bestD = Infinity;
  for (const e of enemies) {
    if (e.dead) continue;
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  if (best) return Math.atan2(best.y - p.y, best.x - p.x);
  return p.angle;
}

export function updatePlayer(p, input, world, dt) {
  if (p.dead) return;
  p.invulnerable = Math.max(0, p.invulnerable - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.fireTimer -= dt;
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  if (p.dashUsed > 0 && p.dashCooldown <= 0) {
    p.dashUsed = 0;
  }
  // Shield slowly regrows.
  if (p.shieldMax > 0 && p.shield < p.shieldMax) {
    p.shieldTimer += dt;
    if (p.shieldTimer >= 1) {
      p.shieldTimer = 0;
      p.shield = Math.min(p.shieldMax, p.shield + 2);
    }
  }

  p.angle = aimAngle(p, input, world.enemies);

  // Dash: a short burst in the movement direction (or facing) with i-frames.
  if (input.dash && p.dashTimer <= 0 && p.dashUsed < p.dashCharges) {
    const dx = input.mx !== 0 || input.my !== 0 ? input.mx : Math.cos(p.angle);
    const dy = input.mx !== 0 || input.my !== 0 ? input.my : Math.sin(p.angle);
    p.vx = dx * PLAYER.dashSpeed;
    p.vy = dy * PLAYER.dashSpeed;
    p.dashTimer = PLAYER.dashTime;
    p.dashUsed += 1;
    p.dashCooldown = PLAYER.dashCooldown * Math.pow(0.75, modCount(p, 'longdash'));
    p.invulnerable = Math.max(p.invulnerable, 0.24);
    world.fxDash = true;
    burst(world.fx, p.x, p.y, '#5eead4', 10, 180, 0.35, 3);
    if (p.thornNova > 0) world.queueNova(p.x, p.y, 26 * p.thornNova, 150);
  }

  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
  } else {
    const targetVx = input.mx * p.speed;
    const targetVy = input.my * p.speed;
    const k = 1 - Math.exp(-14 * dt);
    p.vx += (targetVx - p.vx) * k;
    p.vy += (targetVy - p.vy) * k;
  }
  p.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, p.x + p.vx * dt));
  p.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, p.y + p.vy * dt));

  // Motion trail for the dash / fast flight.
  p.trail.unshift({ x: p.x, y: p.y, life: 0.22 });
  if (p.trail.length > 14) p.trail.pop();
  for (const t of p.trail) t.life -= dt;

  // Fire the bloom gun while held.
  if (input.firing && p.fireTimer <= 0) {
    p.fireTimer = p.fireInterval;
    const spread = 0.09;
    const n = p.projectiles;
    for (let i = 0; i < n; i += 1) {
      const off = (i - (n - 1) / 2) * spread;
      const a = p.angle + off + range(world.rng, -0.02, 0.02);
      world.spawnBullet(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20,
        Math.cos(a) * p.bulletSpeed, Math.sin(a) * p.bulletSpeed,
        p.damage, PLAYER.bulletRadius, true, world.rng() < p.critChance);
    }
    world.fxShoot = true;
  }
}

/** Damage the player, honouring shield and i-frames. Returns true when it hurt. */
export function hurtPlayer(p, amount, world) {
  if (p.dead || p.invulnerable > 0 || p.dashTimer > 0) return false;
  let left = amount;
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, left);
    p.shield -= absorbed;
    left -= absorbed;
  }
  if (left > 0) {
    p.hp -= left;
    p.hurtFlash = 0.25;
    p.invulnerable = PLAYER.invulnerableAfterHit;
    addShake(world.fx, 7);
    burst(world.fx, p.x, p.y, '#fb7185', 14, 220, 0.5, 4);
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
    }
  }
  return true;
}
