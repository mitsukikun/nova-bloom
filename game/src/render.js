// All drawing: the garden backdrop, every entity, the HUD, and every screen
// (title, level-up draft, pause, game over, victory). The renderer only reads
// the world; it never changes it. Level-up cards share their geometry with
// main.js through levelupCardRects, so a click lands on the card it looks at.
import { FIELD, PALETTE, FONT, xpNeeded } from './config.js';
import { makeRng, range } from './random.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_LEVELUP, SCREEN_PAUSED, SCREEN_OVER, SCREEN_VICTORY } from './world.js';
import { ENEMY } from './config.js';

const CARD_W = 300;
const CARD_H = 210;
const CARD_GAP = 24;
const CARD_Y = 250;

export function levelupCardRects() {
  const total = 3 * CARD_W + 2 * CARD_GAP;
  const x0 = (FIELD.width - total) / 2;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (CARD_W + CARD_GAP), y: CARD_Y, w: CARD_W, h: CARD_H }));
}

// A fixed starfield, seeded once, so every frame and every screenshot agree.
const stars = (() => {
  const rng = makeRng(20261116);
  const out = [];
  for (let i = 0; i < 110; i += 1) {
    out.push({
      x: range(rng, 0, FIELD.width),
      y: range(rng, 0, FIELD.height),
      r: range(rng, 0.6, 2.1),
      layer: rng() < 0.5 ? 1 : 2,
      phase: range(rng, 0, Math.PI * 2),
      speed: range(rng, 0.4, 1.4),
    });
  }
  return out;
})();

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, str, x, y, size, color, align, weight) {
  ctx.fillStyle = color;
  ctx.font = `${weight || 600} ${size}px ${FONT}`;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

function drawBackground(ctx, world) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  g.addColorStop(0, PALETTE.backdropTop);
  g.addColorStop(1, PALETTE.backdropBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  // Drifting nebula blobs.
  const blobs = [
    { x: 260 + Math.sin(world.time * 0.05) * 30, y: 170, r: 300, c: PALETTE.nebulaA },
    { x: 1020 + Math.cos(world.time * 0.04) * 40, y: 520, r: 340, c: PALETTE.nebulaB },
    { x: 700, y: 90 + Math.sin(world.time * 0.06) * 20, r: 240, c: PALETTE.nebulaC },
  ];
  for (const b of blobs) {
    const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    rg.addColorStop(0, b.c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }

  // Parallax starfield with a slow twinkle.
  for (const s of stars) {
    const tw = 0.55 + 0.45 * Math.sin(world.time * s.speed + s.phase);
    const px = (s.x - world.player.x * 0.02 * s.layer + FIELD.width) % FIELD.width;
    const py = (s.y - world.player.y * 0.02 * s.layer + FIELD.height) % FIELD.height;
    ctx.globalAlpha = tw * (s.layer === 1 ? 0.5 : 0.9);
    ctx.fillStyle = '#dbeafe';
    ctx.beginPath();
    ctx.arc(px, py, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Faint dot grid, for depth.
  ctx.fillStyle = PALETTE.grid;
  for (let x = 40; x < FIELD.width; x += 80) {
    for (let y = 40; y < FIELD.height; y += 80) {
      ctx.fillRect(x, y, 2, 2);
    }
  }
}

function drawPickup(ctx, u, time) {
  const bob = Math.sin(u.bob) * 3;
  ctx.save();
  ctx.translate(u.x, u.y + bob);
  if (u.kind === 'shard') {
    ctx.rotate(time * 2 + u.bob);
    ctx.fillStyle = PALETTE.shard;
    ctx.shadowColor = PALETTE.shard;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -8); ctx.lineTo(6, 0); ctx.lineTo(0, 8); ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
  } else if (u.kind === 'heart') {
    ctx.fillStyle = PALETTE.heart;
    ctx.shadowColor = PALETTE.heart;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-4, -2, 5, 0, Math.PI * 2);
    ctx.arc(4, -2, 5, 0, Math.PI * 2);
    ctx.moveTo(-8, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(8, 0);
    ctx.closePath();
    ctx.fill();
  } else {
    // Nova seed: a pulsing gold star.
    const r = 9 + Math.sin(time * 5) * 2;
    ctx.fillStyle = PALETTE.nova;
    ctx.shadowColor = PALETTE.nova;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const rr = i % 2 === 0 ? r : r * 0.45;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  const def = ENEMY[e.kind];
  ctx.save();
  ctx.translate(e.x, e.y);
  const flashing = e.flash > 0;
  ctx.fillStyle = flashing ? '#ffffff' : def.color;
  ctx.strokeStyle = flashing ? '#ffffff' : def.color;
  ctx.shadowColor = def.color;
  ctx.shadowBlur = e.elite ? 22 : 12;
  const r = e.radius;
  if (e.kind === 'mote') {
    ctx.beginPath();
    for (let i = 0; i < 16; i += 1) {
      const a = (i / 16) * Math.PI * 2 + time * 0.8;
      const rr = i % 2 === 0 ? r : r * 0.55;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'darter') {
    ctx.rotate(e.angle);
    if (e.lungeState === 1) {
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(time * 30);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(r + 46, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.moveTo(r + 6, 0); ctx.lineTo(-r * 0.7, r * 0.7); ctx.lineTo(-r * 0.3, 0); ctx.lineTo(-r * 0.7, -r * 0.7);
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'splitter') {
    ctx.rotate(time * 0.6 + e.seed);
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.rotate(-time * 1.2);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
    }
    ctx.closePath();
    ctx.fill();
  } else if (e.kind === 'spitter') {
    ctx.rotate(Math.PI / 4 + Math.sin(time + e.seed * 6) * 0.2);
    ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
    ctx.rotate(-(Math.PI / 4 + Math.sin(time + e.seed * 6) * 0.2));
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28 + Math.sin(time * 6) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Bosses: a ring of rotating blades around a burning eye.
    ctx.rotate(time * 0.5);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(r * 0.9, -7); ctx.lineTo(r + 16, 0); ctx.lineTo(r * 0.9, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.rotate(-time * 0.5);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a0512';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Elite ring and HP bar for anything hurt or big.
  if (e.elite) {
    ctx.save();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (e.hp < e.maxHp && e.kind !== 'mote') {
    const w = e.radius * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 4);
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}

function drawPlayer(ctx, p, time) {
  // Motion trail.
  for (let i = p.trail.length - 1; i >= 0; i -= 1) {
    const t = p.trail[i];
    if (t.life <= 0) continue;
    ctx.globalAlpha = (t.life / 0.22) * 0.25;
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (p.invulnerable > 0 && Math.floor(time * 18) % 2 === 0 && p.dashTimer <= 0) {
    ctx.globalAlpha = 0.45;
  }
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shield ring.
  if (p.shield > 0) {
    ctx.strokeStyle = 'rgba(103, 232, 249, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 24 + Math.sin(time * 3) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Three petals turning slowly around the hull.
  ctx.rotate(time * 0.9);
  ctx.fillStyle = PALETTE.player;
  ctx.shadowColor = PALETTE.player;
  ctx.shadowBlur = 16;
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(20, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.rotate(-time * 0.9);
  // Hull: a seed-ship pointing at the aim.
  ctx.rotate(p.angle);
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-10, 10); ctx.lineTo(-5, 0); ctx.lineTo(-10, -10);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(-p.angle);
  // Core.
  ctx.fillStyle = PALETTE.playerCore;
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
  // Hurt flash.
  if (p.hurtFlash > 0) {
    ctx.fillStyle = `rgba(251, 113, 133, ${p.hurtFlash * 0.9})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBullets(ctx, bullets) {
  for (const b of bullets) {
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.friendly) {
      ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.fillStyle = PALETTE.bullet;
      ctx.shadowColor = PALETTE.bullet;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(3, 0, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pulse = 1 + Math.sin(b.trail * 9) * 0.15;
      ctx.fillStyle = '#ff7ad9';
      ctx.shadowColor = '#ff7ad9';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, b.radius * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, b.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawFx(ctx, fx) {
  for (const p of fx.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const r of fx.rings) {
    ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(r.x, r.y, Math.max(1, r.r), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const t of fx.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    text(ctx, t.text, t.x, t.y, t.size, t.color, 'center', 700);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  const p = world.player;
  const pad = 18;
  // HP bar.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, pad, pad, 240, 20, 10);
  ctx.fill();
  const hpFrac = Math.max(0, p.hp / p.maxHp);
  const hg = ctx.createLinearGradient(pad, 0, pad + 240, 0);
  hg.addColorStop(0, '#34d399');
  hg.addColorStop(1, '#5eead4');
  ctx.fillStyle = hpFrac < 0.3 ? '#fb7185' : hg;
  roundRect(ctx, pad + 2, pad + 2, 236 * hpFrac, 16, 8);
  ctx.fill();
  text(ctx, `${Math.ceil(p.hp)} / ${p.maxHp}`, pad + 120, pad + 10, 12, '#ffffff', 'center', 700);
  if (p.shieldMax > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, pad, pad + 26, 240, 8, 4);
    ctx.fill();
    ctx.fillStyle = '#67e8f9';
    roundRect(ctx, pad + 1, pad + 27, 238 * Math.max(0, p.shield / p.shieldMax), 6, 3);
    ctx.fill();
  }
  // Level + XP bar along the bottom.
  const xpFrac = Math.min(1, p.xp / xpNeeded(p.level));
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, FIELD.height - 14, FIELD.width, 14);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, FIELD.height - 14, FIELD.width * xpFrac, 14);
  text(ctx, `LV ${p.level}`, 14, FIELD.height - 26, 13, PALETTE.gold, 'left', 700);
  // Wave, top centre.
  text(ctx, `WAVE ${Math.max(1, world.wave)} / 10`, FIELD.width / 2, 26, 20, PALETTE.text, 'center', 800);
  if (world.boss && !world.boss.dead) {
    const b = world.boss;
    const w = 420;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(ctx, FIELD.width / 2 - w / 2, 40, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#ff3d81';
    roundRect(ctx, FIELD.width / 2 - w / 2 + 1, 41, (w - 2) * Math.max(0, b.hp / b.maxHp), 10, 5);
    ctx.fill();
    text(ctx, b.kind === 'sovereign' ? 'THE HOLLOW SOVEREIGN' : 'THE HOLLOW WARDEN', FIELD.width / 2, 66, 13, '#ff8fb3', 'center', 700);
  }
  // Score, top right.
  text(ctx, `${world.score.toLocaleString('en-US')}`, FIELD.width - pad, 26, 24, PALETTE.text, 'right', 800);
  text(ctx, `BEST ${Math.max(world.best, world.score).toLocaleString('en-US')}`, FIELD.width - pad, 48, 12, PALETTE.muted, 'right', 600);
  if (world.combo > 1) {
    text(ctx, `COMBO x${world.combo}`, FIELD.width - pad, 74, 16, '#fbbf24', 'right', 800);
  }
  // Dash pips + nova, bottom left above the XP bar and its level label.
  const dashReady = p.dashUsed < p.dashCharges;
  text(ctx, `DASH ${dashReady ? 'READY' : '···'}`, pad, FIELD.height - 48, 13, dashReady ? PALETTE.player : PALETTE.muted, 'left', 700);
  if (p.novaReady > 0) {
    text(ctx, `NOVA [Q] x${p.novaReady}`, pad + 130, FIELD.height - 48, 13, PALETTE.nova, 'left', 700);
  }
  if (world.muted) text(ctx, 'MUTED [M]', FIELD.width - pad, FIELD.height - 48, 12, PALETTE.muted, 'right', 600);
  // Wave banner.
  if (world.bannerTimer > 0 && world.bannerText) {
    const a = Math.min(1, world.bannerTimer / 0.6);
    ctx.globalAlpha = a;
    text(ctx, world.bannerText, FIELD.width / 2, 150, 44, PALETTE.text, 'center', 800);
    ctx.globalAlpha = 1;
  }
}

function drawPanel(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(2, 2, 12, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const w = 560;
  const h = 130 + lines.length * 30;
  const x = (FIELD.width - w) / 2;
  const y = (FIELD.height - h) / 2;
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, x, y, w, h, 16);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 16);
  ctx.stroke();
  text(ctx, title, FIELD.width / 2, y + 44, 34, accent || PALETTE.text, 'center', 800);
  lines.forEach((line, i) => {
    text(ctx, line, FIELD.width / 2, y + 92 + i * 30, 16, i === lines.length - 1 ? PALETTE.muted : PALETTE.text, 'center', i === lines.length - 1 ? 600 : 600);
  });
}

function drawTitle(ctx, world) {
  // The wandering motes behind the menu are already in the world; draw them dim.
  for (const e of world.enemies) drawEnemy(ctx, e, world.time);
  ctx.fillStyle = 'rgba(2, 2, 12, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, 'NOVA BLOOM', FIELD.width / 2, 190, 84, '#f0fdfa', 'center', 800);
  text(ctx, 'The last seed-ship defends the garden against the Hollow.', FIELD.width / 2, 250, 20, PALETTE.muted, 'center', 600);
  text(ctx, 'Survive 10 waves. Slay the Hollow Sovereign. Bloom again.', FIELD.width / 2, 280, 17, PALETTE.gold, 'center', 700);
  const cx = FIELD.width / 2;
  const lines = [
    'WASD / Arrows — fly      Mouse — aim      Hold Click / Space — fire',
    'Shift / Right-click — dash (brief invulnerability)',
    'Q — nova bomb (when stocked)      P — pause      M — mute      R — restart',
    'Collect shards to level up and draft new blooms. Chain kills for combo score.',
  ];
  lines.forEach((line, i) => text(ctx, line, cx, 350 + i * 30, 16, PALETTE.text, 'center', 600));
  if (Math.floor(world.time * 1.6) % 2 === 0) {
    text(ctx, 'CLICK OR PRESS ANY KEY TO PLAY', cx, 520, 22, PALETTE.player, 'center', 800);
  }
  if (world.best > 0) {
    text(ctx, `BEST SCORE  ${world.best.toLocaleString('en-US')}`, cx, 566, 16, PALETTE.muted, 'center', 700);
  }
}

function drawLevelup(ctx, world) {
  drawHud(ctx, world);
  ctx.fillStyle = 'rgba(2, 2, 12, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  text(ctx, `LEVEL ${world.player.level} — CHOOSE A BLOOM`, FIELD.width / 2, 190, 34, PALETTE.text, 'center', 800);
  const rects = levelupCardRects();
  world.draft.forEach((up, i) => {
    const r = rects[i];
    const lvl = world.player.mods[up.id] || 0;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.fill();
    ctx.strokeStyle = up.color;
    ctx.lineWidth = 2;
    roundRect(ctx, r.x, r.y, r.w, r.h, 14);
    ctx.stroke();
    text(ctx, `[${i + 1}]`, r.x + r.w / 2, r.y + 28, 14, PALETTE.muted, 'center', 700);
    text(ctx, up.name, r.x + r.w / 2, r.y + 62, 21, up.color, 'center', 800);
    text(ctx, up.desc, r.x + r.w / 2, r.y + 100, 15, PALETTE.text, 'center', 600);
    text(ctx, up.flavor, r.x + r.w / 2, r.y + 128, 13, PALETTE.muted, 'center', 600);
    const pips = '●'.repeat(lvl) + '○'.repeat(Math.max(0, up.max - lvl));
    text(ctx, pips, r.x + r.w / 2, r.y + 168, 15, up.color, 'center', 600);
  });
  text(ctx, 'Click a card or press 1 / 2 / 3', FIELD.width / 2, CARD_Y + CARD_H + 44, 16, PALETTE.muted, 'center', 600);
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Draw the whole frame for the world's current screen. */
export function render(ctx, world) {
  ctx.save();
  ctx.translate(world.fx.shakeX, world.fx.shakeY);
  drawBackground(ctx, world);
  if (world.screen === SCREEN_TITLE) {
    drawTitle(ctx, world);
    ctx.restore();
    return;
  }
  for (const u of world.pickups) drawPickup(ctx, u, world.time);
  for (const e of world.enemies) drawEnemy(ctx, e, world.time);
  drawBullets(ctx, world.bullets);
  if (!world.player.dead) drawPlayer(ctx, world.player, world.time);
  drawFx(ctx, world.fx);
  // Vignette.
  const vg = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.restore();

  if (world.screen === SCREEN_PLAY || world.screen === SCREEN_PAUSED) {
    drawHud(ctx, world);
    if (world.screen === SCREEN_PAUSED) {
      drawPanel(ctx, 'PAUSED', ['The garden waits.', 'Press P or any key to keep flying.'], PALETTE.player);
    }
  } else if (world.screen === SCREEN_LEVELUP) {
    drawLevelup(ctx, world);
  } else if (world.screen === SCREEN_OVER) {
    drawHud(ctx, world);
    drawPanel(ctx, 'BLOOM FALLEN', [
      world.overReason,
      `Score ${world.score.toLocaleString('en-US')}   •   Wave ${world.wave}   •   ${world.kills} kills   •   ${fmtTime(world.stats.timePlayed)}   •   Best combo x${world.bestCombo}`,
      'Press R or click to bloom again.',
    ], '#fb7185');
  } else if (world.screen === SCREEN_VICTORY) {
    drawHud(ctx, world);
    drawPanel(ctx, 'THE GARDEN BLOOMS AGAIN', [
      'The Hollow Sovereign is shattered. Nova Bloom endures.',
      `Score ${world.score.toLocaleString('en-US')}   •   ${world.kills} kills   •   ${fmtTime(world.stats.timePlayed)}   •   Best combo x${world.bestCombo}`,
      'Press R or click to play again.',
    ], PALETTE.gold);
  }
}
