// Pickups: XP shards the fallen drop, hearts that heal, and nova seeds that
// clear the field. Shards drift toward the player inside the pickup radius.
import { FIELD } from './config.js';
import { range } from './random.js';

export function createPickups() {
  return [];
}

export function spawnPickup(pickups, rng, kind, x, y, value) {
  pickups.push({
    kind,
    x: Math.min(FIELD.width - 14, Math.max(14, x)),
    y: Math.min(FIELD.height - 14, Math.max(14, y)),
    value: value || 1,
    vx: range(rng, -30, 30),
    vy: range(rng, -30, 30),
    life: 14,
    bob: rng() * Math.PI * 2,
    dead: false,
  });
  if (pickups.length > 260) pickups.splice(0, pickups.length - 260);
}

export function updatePickups(pickups, world, dt) {
  const p = world.player;
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const u = pickups[i];
    u.life -= dt;
    u.bob += dt * 3;
    if (u.life <= 0) { pickups.splice(i, 1); continue; }
    const dx = p.x - u.x;
    const dy = p.y - u.y;
    const d = Math.hypot(dx, dy) || 1;
    if (!p.dead && d < p.pickupRadius * 2.2) {
      const pull = d < p.pickupRadius ? 520 : 170;
      u.vx += (dx / d) * pull * dt * 4;
      u.vy += (dy / d) * pull * dt * 4;
    }
    u.vx *= Math.max(0, 1 - 2.4 * dt);
    u.vy *= Math.max(0, 1 - 2.4 * dt);
    u.x = Math.min(FIELD.width - 10, Math.max(10, u.x + u.vx * dt));
    u.y = Math.min(FIELD.height - 10, Math.max(10, u.y + u.vy * dt));
    if (!p.dead && d < 24) {
      if (u.kind === 'shard') world.gainXp(u.value);
      else if (u.kind === 'heart') world.healPlayer(22);
      else if (u.kind === 'nova') world.queueNova(p.x, p.y, 70, 9999);
      pickups.splice(i, 1);
    }
  }
}
