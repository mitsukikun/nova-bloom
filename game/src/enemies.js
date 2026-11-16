// Enemies: five kinds plus two bosses, each with its own movement and attack.
// A kind is a row of config.ENEMY; an enemy instance carries its live state.
import { FIELD, ENEMY } from './config.js';
import { range, chance, pick } from './random.js';
import { burst, ring } from './particles.js';

let nextId = 1;

export function spawnEnemy(world, kind, x, y, elite) {
  const def = ENEMY[kind];
  const hpMul = elite ? 2.3 : 1;
  const e = {
    id: nextId,
    kind,
    x, y,
    vx: 0, vy: 0,
    hp: def.hp * hpMul,
    maxHp: def.hp * hpMul,
    speed: def.speed * (elite ? 0.92 : 1) * (1 + (world.wave - 1) * 0.03),
    radius: def.radius * (elite ? 1.35 : 1),
    damage: def.damage,
    xp: def.xp * (elite ? 4 : 1),
    score: def.score * (elite ? 3 : 1),
    elite: !!elite,
    dead: false,
    flash: 0,
    touchTimer: 0,
    fireTimer: range(world.rng, 1.2, 2.4),
    lungeTimer: range(world.rng, 1.5, 3),
    lungeState: 0, // 0 roam, 1 telegraph, 2 lunging
    lungeX: 0, lungeY: 0,
    angle: 0,
    spin: range(world.rng, -1.2, 1.2),
    seed: world.rng(),
  };
  nextId += 1;
  world.enemies.push(e);
  return e;
}

/** Pick a spawn point just outside the field, away from the player. */
export function spawnPoint(world) {
  const p = world.player;
  for (let tries = 0; tries < 12; tries += 1) {
    const side = Math.floor(world.rng() * 4);
    let x;
    let y;
    if (side === 0) { x = range(world.rng, 0, FIELD.width); y = -30; }
    else if (side === 1) { x = FIELD.width + 30; y = range(world.rng, 0, FIELD.height); }
    else if (side === 2) { x = range(world.rng, 0, FIELD.width); y = FIELD.height + 30; }
    else { x = -30; y = range(world.rng, 0, FIELD.height); }
    if (Math.hypot(x - p.x, y - p.y) > 320) return { x, y };
  }
  return { x: FIELD.width / 2, y: -30 };
}

function steer(e, tx, ty, speed, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy) || 1;
  e.vx += ((dx / d) * speed - e.vx) * Math.min(1, 3.5 * dt);
  e.vy += ((dy / d) * speed - e.vy) * Math.min(1, 3.5 * dt);
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.angle = Math.atan2(e.vy, e.vx);
}

export function updateEnemy(e, world, dt) {
  const p = world.player;
  e.flash = Math.max(0, e.flash - dt);
  e.touchTimer = Math.max(0, e.touchTimer - dt);
  e.angle += e.spin * dt * 0.2;

  if (e.kind === 'mote') {
    steer(e, p.x, p.y, e.speed, dt);
  } else if (e.kind === 'darter') {
    e.lungeTimer -= dt;
    if (e.lungeState === 0) {
      steer(e, p.x, p.y, e.speed, dt);
      if (e.lungeTimer <= 0) {
        e.lungeState = 1;
        e.lungeTimer = 0.45;
        e.lungeX = p.x;
        e.lungeY = p.y;
      }
    } else if (e.lungeState === 1) {
      e.vx *= 0.9;
      e.vy *= 0.9;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.lungeTimer <= 0) {
        e.lungeState = 2;
        const dx = e.lungeX - e.x;
        const dy = e.lungeY - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.vx = (dx / d) * 400;
        e.vy = (dy / d) * 400;
        e.lungeTimer = 0.55;
      }
    } else {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (e.lungeTimer <= 0) {
        e.lungeState = 0;
        e.lungeTimer = range(world.rng, 1.6, 3.2);
      }
    }
  } else if (e.kind === 'splitter') {
    // Wobbles toward the player, slow but heavy.
    const wob = Math.sin(world.time * 2 + e.seed * 9) * 40;
    steer(e, p.x + wob, p.y, e.speed, dt);
  } else if (e.kind === 'spitter') {
    // Keeps a firing distance and lobs aimed orbs.
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const want = 290;
    const toward = d > want + 40 ? 1 : d < want - 60 ? -1 : 0;
    steer(e, e.x + (dx / d) * toward * 100, e.y + (dy / d) * toward * 100, e.speed, dt);
    e.fireTimer -= dt;
    if (e.fireTimer <= 0 && d < 560) {
      e.fireTimer = range(world.rng, 2.0, 2.6);
      const a = Math.atan2(dy, dx);
      world.spawnBullet(e.x, e.y, Math.cos(a) * 175, Math.sin(a) * 175, e.damage, 7, false, false);
    }
  } else {
    updateBoss(e, world, dt);
  }

  // Touch damage: a short per-enemy cooldown so one touch is one hit.
  if (!p.dead && e.touchTimer <= 0) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < e.radius + 14) {
      e.touchTimer = 0.9;
      world.damagePlayer(e.damage);
    }
  }
}

function updateBoss(e, world, dt) {
  const p = world.player;
  e.fireTimer -= dt;
  const d = Math.hypot(p.x - e.x, p.y - e.y) || 1;
  // Drift toward the player slowly, circling at mid range.
  const orbit = Math.sin(world.time * 0.7 + e.seed * 5) * 60;
  steer(e, p.x + orbit, p.y - orbit * 0.5, e.speed, dt);
  const enraged = e.hp < e.maxHp * 0.35;
  const interval = (e.kind === 'sovereign' ? 2.6 : 3.1) * (enraged ? 0.65 : 1);

  if (e.fireTimer <= 0 && !p.dead) {
    e.fireTimer = interval;
    const pattern = Math.floor(world.rng() * (e.kind === 'sovereign' ? 4 : 3));
    const a0 = Math.atan2(p.y - e.y, p.x - e.x);
    if (pattern === 0) {
      // Radial burst.
      const n = e.kind === 'sovereign' ? 16 : 12;
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 + world.time;
        world.spawnBullet(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150, e.damage, 7, false, 0);
      }
      ring(world.fx, e.x, e.y, '#ff3d81', e.radius + 60, 0.5);
    } else if (pattern === 1) {
      // Aimed fan of five.
      for (let i = -2; i <= 2; i += 1) {
        const a = a0 + i * 0.14;
        world.spawnBullet(e.x, e.y, Math.cos(a) * 230, Math.sin(a) * 230, e.damage, 7, false, 0);
      }
    } else if (pattern === 2) {
      // Summon motes.
      for (let i = 0; i < 4; i += 1) {
        const a = world.rng() * Math.PI * 2;
        spawnEnemy(world, 'mote', e.x + Math.cos(a) * (e.radius + 20), e.y + Math.sin(a) * (e.radius + 20), false);
      }
      burst(world.fx, e.x, e.y, '#ff3d81', 18, 200, 0.5, 4);
    } else {
      // Spiral stream.
      for (let i = 0; i < 10; i += 1) {
        const a = a0 + i * 0.35;
        world.spawnBullet(e.x, e.y, Math.cos(a) * 190, Math.sin(a) * 190, e.damage, 6, false, 0);
      }
    }
    if (enraged) {
      // Enraged bosses add a second radial burst.
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2 + 0.4;
        world.spawnBullet(e.x, e.y, Math.cos(a) * 165, Math.sin(a) * 165, e.damage, 7, false, 0);
      }
    }
  }
  // Bosses also slowly pull shards toward themselves? No — they push the player
  // away when very close, so the fight never becomes a hug.
  if (d < e.radius + 40 && !p.dead) {
    const push = (1 - d / (e.radius + 40)) * 260;
    p.x += ((p.x - e.x) / d) * push * dt;
    p.y += ((p.y - e.y) / d) * push * dt;
  }
}

/** Damage an enemy; returns true when it died. Handles splitters and drops. */
export function damageEnemy(e, amount, world, crit) {
  if (e.dead) return false;
  e.hp -= amount;
  e.flash = 0.12;
  if (e.hp > 0) return false;
  e.dead = true;
  const def = ENEMY[e.kind];
  world.onKill(e);
  burst(world.fx, e.x, e.y, def.color, e.kind === 'warden' || e.kind === 'sovereign' ? 46 : 16, 260, 0.6, 4);
  ring(world.fx, e.x, e.y, def.color, e.radius + 34, 0.4);
  if (e.kind === 'splitter') {
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + world.rng();
      spawnEnemy(world, 'mote', e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, false);
    }
  }
  if (e.elite || e.kind === 'warden' || e.kind === 'sovereign') {
    world.spawnPickup('heart', e.x, e.y);
  }
  if (chance(world.rng, e.kind === 'spitter' ? 0.12 : 0.05)) {
    world.spawnPickup('nova', e.x, e.y);
  }
  // XP shards: one per xp point, capped so the field never floods.
  const shards = Math.min(e.xp, 8);
  for (let i = 0; i < shards; i += 1) {
    const a = world.rng() * Math.PI * 2;
    const r = 12 + world.rng() * 26;
    world.spawnPickup('shard', e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, Math.ceil(e.xp / shards));
  }
  return true;
}
