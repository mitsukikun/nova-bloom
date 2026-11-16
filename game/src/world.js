// The world: one object holding the whole game state, and the step that moves
// it forward. The state machine lives here too: title → playing → levelup →
// paused → over / victory. Everything the renderer draws comes from this state,
// and the screenshot autopilot drives it through the same step the player does.
import { FIELD, STEP, WAVES, PLAYER, ENEMY, xpNeeded, wavePlan } from './config.js';
import { makeRng, range, chance } from './random.js';
import { createFx, burst, ring, floatText, addShake, hitStop, updateFx } from './particles.js';
import { createPlayer, updatePlayer, hurtPlayer, recompute } from './player.js';
import { spawnEnemy, spawnPoint, updateEnemy, damageEnemy } from './enemies.js';
import { createBullets, spawnBullet, updateBullets } from './projectiles.js';
import { createPickups, spawnPickup, updatePickups } from './pickups.js';
import { draftUpgrades, applyUpgrade } from './upgrades.js';
import { sfx } from './audio.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

export function createWorld(seed) {
  const rng = makeRng(seed || 1);
  const world = {
    rng,
    seed: seed || 1,
    time: 0,
    screen: SCREEN_TITLE,
    player: createPlayer(),
    enemies: [],
    bullets: createBullets(),
    pickups: createPickups(),
    fx: createFx(rng),
    wave: 0,
    waveState: 'idle', // idle | spawning | fighting | banner | done
    spawnQueue: [],
    spawnTimer: 0,
    bannerTimer: 0,
    bannerText: '',
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    levelupsPending: 0,
    draft: [],
    boss: null,
    novaQueue: [],
    fxShoot: false,
    fxDash: false,
    stats: { shots: 0, hits: 0, damageDealt: 0, wavesCleared: 0, timePlayed: 0 },
    overReason: '',
    overTimer: 0,
    muted: false,
    best: 0,
  };
  world.spawnBullet = (x, y, vx, vy, damage, radius, friendly, crit) => {
    spawnBullet(world.bullets, x, y, vx, vy, damage, radius, friendly, crit);
    if (friendly) world.stats.shots += 1;
  };
  world.spawnPickup = (kind, x, y, value) => spawnPickup(world.pickups, world.rng, kind, x, y, value);
  world.queueNova = (x, y, damage, radius) => world.novaQueue.push({ x, y, damage, radius });
  world.damagePlayer = (amount) => {
    if (hurtPlayer(world.player, amount, world)) sfx.hurt();
  };
  world.healPlayer = (amount) => {
    const p = world.player;
    if (p.dead) return;
    p.hp = Math.min(p.maxHp, p.hp + amount);
    sfx.heart();
    burst(world.fx, p.x, p.y, '#fb7185', 8, 120, 0.5, 3);
  };
  world.gainXp = (amount) => {
    const p = world.player;
    p.xp += amount;
    while (p.xp >= xpNeeded(p.level)) {
      p.xp -= xpNeeded(p.level);
      p.level += 1;
      world.levelupsPending += 1;
    }
    if (world.levelupsPending > 0 && world.screen === SCREEN_PLAY) {
      world.openLevelup();
    }
  };
  world.hitEnemy = (e, dmg, crit) => {
    world.stats.hits += 1;
    world.stats.damageDealt += dmg;
    const died = damageEnemy(e, dmg, world, crit);
    if (died) sfx.enemyDie();
    else sfx.enemyHit();
    if (crit) floatText(world.fx, e.x, e.y - e.radius - 6, `${Math.round(dmg)}!`, '#fbbf24', 17);
  };
  world.onKill = (e) => {
    world.kills += 1;
    world.combo += 1;
    world.comboTimer = 2.5;
    world.bestCombo = Math.max(world.bestCombo, world.combo);
    const mult = 1 + Math.min(world.combo, 20) * 0.05;
    const gained = Math.round(e.score * mult);
    world.score += gained;
    floatText(world.fx, e.x, e.y - e.radius - 4, `+${gained}`, '#e0f2fe', 14);
    if (e.kind === 'warden' || e.kind === 'sovereign') {
      hitStop(world.fx, 0.12);
      addShake(world.fx, 12);
    }
  };
  world.openLevelup = () => {
    world.screen = SCREEN_LEVELUP;
    world.draft = draftUpgrades(world.rng, world.player, 3);
    world.levelupsPending -= 1;
    sfx.levelup();
  };
  world.pickUpgrade = (index) => {
    const up = world.draft[index];
    if (!up) return;
    applyUpgrade(world.player, up.id);
    recompute(world.player);
    sfx.click();
    burst(world.fx, world.player.x, world.player.y, up.color, 18, 200, 0.5, 3);
    if (world.levelupsPending > 0) {
      world.openLevelup();
    } else {
      world.draft = [];
      world.screen = SCREEN_PLAY;
    }
  };
  world.startWave = (n) => {
    world.wave = n;
    world.waveState = 'spawning';
    const plan = wavePlan(n);
    world.spawnQueue = [];
    for (let i = 0; i < plan.count; i += 1) {
      const kind = plan.kinds[Math.floor(world.rng() * plan.kinds.length)];
      const elite = chance(world.rng, 0.07 + n * 0.008);
      world.spawnQueue.push({ kind, elite });
    }
    if (plan.boss) world.spawnQueue.push({ kind: plan.boss, elite: false, boss: true });
    world.spawnTimer = 0.4;
    world.bannerText = n === 10 ? 'FINAL WAVE — THE HOLLOW SOVEREIGN' : `WAVE ${n}`;
    world.bannerTimer = 2.2;
    if (plan.boss) sfx.boss();
    const p = world.player;
    if ((p.mods.bomb || 0) > 0) p.novaReady = Math.max(p.novaReady, 1);
  };
  world.startGame = (seed) => {
    // Reset every run's state in place (the helpers above close over this object,
    // so a fresh object would leave them pointing at the old one).
    const keepBest = world.best;
    const keepSeed = world.seed;
    world.rng = makeRng(seed !== undefined ? seed : (keepSeed + Math.floor(Math.random() * 1e9)));
    world.time = 0;
    world.screen = SCREEN_PLAY;
    world.player = createPlayer();
    world.enemies = [];
    world.bullets = createBullets();
    world.pickups = createPickups();
    world.fx = createFx(world.rng);
    world.wave = 0;
    world.waveState = 'idle';
    world.spawnQueue = [];
    world.spawnTimer = 0;
    world.bannerTimer = 0;
    world.bannerText = '';
    world.score = 0;
    world.kills = 0;
    world.combo = 0;
    world.comboTimer = 0;
    world.bestCombo = 0;
    world.levelupsPending = 0;
    world.draft = [];
    world.boss = null;
    world.novaQueue = [];
    world.fxShoot = false;
    world.fxDash = false;
    world.stats = { shots: 0, hits: 0, damageDealt: 0, wavesCleared: 0, timePlayed: 0 };
    world.overReason = '';
    world.overTimer = 0;
    world.best = keepBest;
    world.startWave(1);
  };
  return world;
}

/** One fixed step of the simulation, driven by `input`. Pure except for sound. */
export function stepWorld(world, input, dt) {
  world.time += dt;
  updateFx(world.fx, dt);

  if (world.screen === SCREEN_TITLE) {
    // The title drifts: a few motes wander inside the field behind the menu.
    if (world.enemies.length < 5 && chance(world.rng, 0.02)) {
      spawnEnemy(world, 'mote', range(world.rng, 60, FIELD.width - 60), range(world.rng, 40, FIELD.height * 0.6), false);
    }
    for (const e of world.enemies) {
      e.x += Math.sin(world.time + e.seed * 7) * 20 * dt;
      e.y += 14 * dt;
      if (e.y > FIELD.height + 40) { e.y = -30; e.x = range(world.rng, 0, FIELD.width); }
    }
    if (input.anyKey) world.startGame();
    return;
  }

  if (world.screen === SCREEN_LEVELUP) {
    if (input.digit >= 1 && input.digit <= world.draft.length) {
      world.pickUpgrade(input.digit - 1);
    }
    return;
  }

  if (world.screen === SCREEN_PAUSED) {
    if (input.pause || input.anyKey) world.screen = SCREEN_PLAY;
    return;
  }

  if (world.screen === SCREEN_OVER || world.screen === SCREEN_VICTORY) {
    // Let the last particles settle, then wait for restart — but not the very
    // click that killed the player: a short delay guards against it.
    world.overTimer += dt;
    if (world.overTimer > 0.9 && (input.restart || input.anyKey)) world.startGame();
    return;
  }

  // --- playing ---
  world.stats.timePlayed += dt;
  if (input.pause) { world.screen = SCREEN_PAUSED; return; }
  if (input.mute) { world.muted = !world.muted; }

  // Bomb Seed: Q (or the key the player bound) fires a stored nova.
  if (input.novaKey && world.player.novaReady > 0) {
    world.player.novaReady -= 1;
    world.queueNova(world.player.x, world.player.y, 90, 9999);
  }

  if (world.fx.freeze > 0) return; // hit-stop: the world holds its breath.

  updatePlayer(world.player, input, world, dt);
  if (world.fxShoot) { sfx.shoot(); world.fxShoot = false; }
  if (world.fxDash) { sfx.dash(); world.fxDash = false; }

  // Wave director.
  if (world.waveState === 'spawning') {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0 && world.spawnQueue.length > 0) {
      const next = world.spawnQueue.shift();
      const pt = spawnPoint(world);
      const e = spawnEnemy(world, next.kind, pt.x, pt.y, next.elite);
      if (next.boss) world.boss = e;
      world.spawnTimer = world.spawnQueue.length > 0 ? 0.55 : 0;
      if (world.spawnQueue.length === 0) world.waveState = 'fighting';
    }
  } else if (world.waveState === 'fighting') {
    const alive = world.enemies.some((e) => !e.dead);
    if (!alive) {
      world.waveState = 'banner';
      world.bannerTimer = 2.4;
      world.bannerText = world.wave >= WAVES.total ? '' : `WAVE ${world.wave} CLEAR`;
      world.stats.wavesCleared += 1;
      sfx.waveClear();
      if (world.wave >= WAVES.total) {
        // The sovereign is dead: victory.
        world.screen = SCREEN_VICTORY;
        world.overTimer = 0;
        sfx.victory();
        return;
      }
    }
  } else if (world.waveState === 'banner') {
    world.bannerTimer -= dt;
    if (world.bannerTimer <= 0) world.startWave(world.wave + 1);
  }
  if (world.bannerTimer > 0) world.bannerTimer -= dt;

  // Novas clear the field.
  for (const nova of world.novaQueue) {
    ring(world.fx, nova.x, nova.y, '#facc15', 320, 0.6);
    burst(world.fx, nova.x, nova.y, '#fde68a', 30, 380, 0.6, 4);
    addShake(world.fx, 9);
    sfx.nova();
    for (const e of world.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - nova.x, e.y - nova.y);
      if (d < nova.radius || nova.radius > 9000) {
        damageEnemy(e, nova.damage, world, false);
      }
    }
    for (const b of world.bullets) {
      if (!b.friendly) b.dead = true;
    }
    world.bullets = world.bullets.filter((b) => !b.dead);
  }
  world.novaQueue.length = 0;

  for (const e of world.enemies) {
    if (!e.dead) updateEnemy(e, world, dt);
  }
  world.enemies = world.enemies.filter((e) => !e.dead);
  if (world.boss && world.boss.dead) world.boss = null;

  updateBullets(world.bullets, world, dt);
  updatePickups(world.pickups, world, dt);

  // Combo decay.
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  if (world.player.dead) {
    world.screen = SCREEN_OVER;
    world.overTimer = 0;
    world.overReason = `The Hollow took Bloom on wave ${world.wave}.`;
    addShake(world.fx, 14);
    burst(world.fx, world.player.x, world.player.y, '#5eead4', 40, 320, 0.9, 5);
    ring(world.fx, world.player.x, world.player.y, '#5eead4', 220, 0.8);
    sfx.gameOver();
  }
}
