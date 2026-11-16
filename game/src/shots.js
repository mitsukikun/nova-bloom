// Deterministic staged scenes for screenshots: ?shot=start|play|end&seed=N.
// Each scene is produced by actually stepping the world with a scripted
// autopilot — no hand-drawn mockups, so the screenshots are the game's own
// code rendering itself. The same seed always stages the same scene.
import { FIELD, STEP } from './config.js';
import { createWorld, stepWorld, SCREEN_PLAY } from './world.js';
import { spawnEnemy } from './enemies.js';

const BLANK = {
  mx: 0, my: 0, aimX: FIELD.width / 2, aimY: FIELD.height / 2,
  firing: false, dash: false, pause: false, restart: false,
  mute: false, novaKey: false, anyKey: false, digit: 0,
};

/** An autopilot that flies, aims at the nearest threat, and fires. */
export function autopilotInput(world) {
  const p = world.player;
  let nearest = null;
  let nearestD = Infinity;
  for (const e of world.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < nearestD) { nearestD = d; nearest = e; }
  }
  const input = { ...BLANK };
  if (!nearest) {
    input.mx = 0; input.my = 0;
    input.aimX = p.x + Math.cos(p.angle) * 100;
    input.aimY = p.y + Math.sin(p.angle) * 100;
    return input;
  }
  // Keep a comfortable firing distance: close in when far, back off when near.
  const dx = nearest.x - p.x;
  const dy = nearest.y - p.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const want = 260;
  const toward = dist > want + 60 ? 1 : dist < want - 60 ? -1 : 0;
  // A little sideways drift so the ship does not just sit on the line.
  const perp = Math.sin(world.time * 0.7) * 0.5;
  const ux = dx / dist;
  const uy = dy / dist;
  let mx = ux * toward + -uy * perp;
  let my = uy * toward + ux * perp;
  // When the nearest threat is far away, drift back toward the middle of the
  // garden instead of chasing it to the edge — the fight stays in frame.
  if (dist > 380) {
    const cx = FIELD.width / 2 - p.x;
    const cy = FIELD.height / 2 - p.y;
    const cd = Math.hypot(cx, cy) || 1;
    mx = mx * 0.5 + (cx / cd) * 0.5;
    my = my * 0.5 + (cy / cd) * 0.5;
  }
  // When nothing is dangerously close, sweep up the nearest shard instead.
  if (dist > 240) {
    let shard = null;
    let shardD = 500;
    for (const u of world.pickups) {
      if (u.kind !== 'shard') continue;
      const sd = Math.hypot(u.x - p.x, u.y - p.y);
      if (sd < shardD) { shardD = sd; shard = u; }
    }
    if (shard) {
      mx = (shard.x - p.x) / Math.max(1, shardD);
      my = (shard.y - p.y) / Math.max(1, shardD);
    }
  }
  input.mx = mx;
  input.my = my;
  input.aimX = nearest.x;
  input.aimY = nearest.y;
  input.firing = true;
  if (nearestD < 110 && p.dashCooldown <= 0) input.dash = true;
  if (world.enemies.length > 10 && p.novaReady > 0) input.novaKey = true;
  return input;
}

/** Step the world for `seconds` of game time with the autopilot flying. */
export function simulate(world, seconds, inputFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, (inputFn || autopilotInput)(world), STEP);
    if (world.screen !== SCREEN_PLAY && world.screen !== 'levelup') break;
  }
  return world;
}

/**
 * Build a staged scene and return the world, ready to render once.
 * - start: the title screen, after a few seconds of drifting motes.
 * - play: mid-wave-2 combat, level 2, a draft-free fight with shards flying.
 * - end: the real game-over screen, reached by playing with 5 HP and no dodging.
 */
export function stageShot(name, seed) {
  const world = createWorld(seed || 1);
  if (name === 'start') {
    // Title only: step the drift directly — simulate() stops on non-play
    // screens, and the title is exactly such a screen.
    for (let i = 0; i < Math.round(3 / STEP); i += 1) stepWorld(world, { ...BLANK }, STEP);
    return world;
  }
  if (name === 'play') {
    world.startGame(seed || 1);
    // Play until the frame is busy and centred: wave 2 or later, several
    // enemies on screen, the ship near the middle with threats around it —
    // and (thanks to shard-sweeping) a level or two earned.
    for (let t = 0; t < 60; t += 1) {
      simulate(world, 1);
      if (world.screen === 'levelup') world.pickUpgrade(0);
      if (world.screen === 'over' || world.screen === 'victory') {
        // The autopilot died mid-stage: restart from a fresh seed and keep going.
        world.startGame((seed || 1) + t + 1);
        continue;
      }
      if (world.screen !== SCREEN_PLAY) continue;
      const p = world.player;
      const alive = world.enemies.filter((e) => !e.dead);
      const nearPlayer = alive.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) < 450).length;
      const centred = Math.hypot(p.x - FIELD.width / 2, p.y - FIELD.height / 2) < 350;
      if (world.wave >= 2 && alive.length >= 6 && nearPlayer >= 2 && centred) break;
    }
    // Never hand back a draft or a game-over as the "play" frame.
    if (world.screen === 'levelup') {
      world.pickUpgrade(0);
      simulate(world, 1);
    }
    if (world.screen === 'over' || world.screen === 'victory') {
      world.startGame((seed || 1) + 99);
      simulate(world, 5);
    }
    return world;
  }
  if (name === 'end') {
    world.startGame(seed || 1);
    // Earn a real score first, then stand still at 5 HP while the ring closes in.
    simulate(world, 8);
    if (world.screen === 'levelup') world.pickUpgrade(0);
    world.player.hp = 5;
    world.player.maxHp = 5;
    // A ring of motes closes in while the ship stands still.
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      spawnEnemy(world, 'mote', world.player.x + Math.cos(a) * 90, world.player.y + Math.sin(a) * 90, false);
    }
    simulate(world, 30, () => ({ ...BLANK }));
    return world;
  }
  return world;
}
