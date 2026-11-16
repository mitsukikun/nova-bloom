// Particles, floating score text, shockwave rings and screen shake.
// Everything here is cosmetic: it never changes the simulation's outcome, and it
// draws from the world's seeded RNG so a screenshot replays identically.
export function createFx(rng) {
  return {
    rng,
    parts: [],
    texts: [],
    rings: [],
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    freeze: 0,
  };
}

export function burst(fx, x, y, color, count, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = fx.rng() * Math.PI * 2;
    const v = speed * (0.35 + fx.rng() * 0.65);
    fx.parts.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + fx.rng() * 0.4),
      maxLife: life,
      size: size * (0.6 + fx.rng() * 0.8),
      color,
      drag: 3.2,
    });
  }
  if (fx.parts.length > 420) fx.parts.splice(0, fx.parts.length - 420);
}

export function ring(fx, x, y, color, maxR, life) {
  fx.rings.push({ x, y, r: 6, maxR, life, maxLife: life, color });
}

export function floatText(fx, x, y, text, color, size) {
  fx.texts.push({ x, y, text, color, size: size || 15, life: 0.9, maxLife: 0.9 });
  if (fx.texts.length > 40) fx.texts.shift();
}

export function addShake(fx, amount) {
  fx.shake = Math.min(16, fx.shake + amount);
}

export function hitStop(fx, seconds) {
  fx.freeze = Math.max(fx.freeze, seconds);
}

export function updateFx(fx, dt) {
  if (fx.freeze > 0) fx.freeze -= dt;
  for (let i = fx.parts.length - 1; i >= 0; i -= 1) {
    const p = fx.parts[i];
    p.life -= dt;
    if (p.life <= 0) { fx.parts.splice(i, 1); continue; }
    const d = Math.max(0, 1 - p.drag * dt);
    p.vx *= d;
    p.vy *= d;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  for (let i = fx.texts.length - 1; i >= 0; i -= 1) {
    const t = fx.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) fx.texts.splice(i, 1);
  }
  for (let i = fx.rings.length - 1; i >= 0; i -= 1) {
    const r = fx.rings[i];
    r.life -= dt;
    r.r = r.maxR * (1 - r.life / r.maxLife);
    if (r.life <= 0) fx.rings.splice(i, 1);
  }
  if (fx.shake > 0) {
    fx.shake = Math.max(0, fx.shake - 42 * dt);
    fx.shakeX = (fx.rng() * 2 - 1) * fx.shake;
    fx.shakeY = (fx.rng() * 2 - 1) * fx.shake;
  } else {
    fx.shakeX = 0;
    fx.shakeY = 0;
  }
}
