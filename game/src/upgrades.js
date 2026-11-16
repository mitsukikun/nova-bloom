// Level-up upgrades: the draft of three the player picks from on every level.
// Each has a cap, a short name, a one-line effect, and an apply step that runs
// through the player's recompute. The pool is the game's build variety: fire
// rate, extra shots, damage, speed, dash, magnet, health, novas, ricochet,
// crits, a regrowing shield, and a once-per-wave screen clearer.
import { PLAYER } from './config.js';

export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Bloom', max: 5, color: '#a5f3fc',
    desc: '+16% fire rate', flavor: 'Petals open faster.' },
  { id: 'twin', name: 'Twin Petals', max: 3, color: '#a5f3fc',
    desc: '+1 projectile per shot', flavor: 'One bloom becomes two.' },
  { id: 'heavy', name: 'Heavy Pollen', max: 5, color: '#fca5a5',
    desc: '+25% bullet damage', flavor: 'Every grain hits harder.' },
  { id: 'swift', name: 'Swift Current', max: 4, color: '#86efac',
    desc: '+12% move speed', flavor: 'Ride the garden wind.' },
  { id: 'longdash', name: 'Long Dash', max: 3, color: '#5eead4',
    desc: 'Dash recharges 25% faster; at 2, +1 dash charge', flavor: 'Slip between moments.' },
  { id: 'magnet', name: 'Magnet Bloom', max: 4, color: '#fde68a',
    desc: '+45% pickup radius', flavor: 'Shards fly to you.' },
  { id: 'vital', name: 'Vital Sap', max: 5, color: '#fda4af',
    desc: '+25 max HP and heal 25 now', flavor: 'Drink deep, bloom again.' },
  { id: 'thorn', name: 'Thorn Nova', max: 3, color: '#d8b4fe',
    desc: 'Dashing releases a damaging nova', flavor: 'Leave thorns behind.' },
  { id: 'ricochet', name: 'Ricochet', max: 2, color: '#93c5fd',
    desc: 'Bullets bounce to a nearby enemy', flavor: 'One shot, two blooms.' },
  { id: 'crit', name: 'Crit Petals', max: 4, color: '#fbbf24',
    desc: '+12% critical chance (2x damage)', flavor: 'A petal finds the crack.' },
  { id: 'spore', name: 'Shield Spore', max: 3, color: '#67e8f9',
    desc: '+20 shield that slowly regrows', flavor: 'A soft shell of light.' },
  { id: 'bomb', name: 'Bomb Seed', max: 3, color: '#facc15',
    desc: 'Start each wave with a nova (Q to use)', flavor: 'One seed, one sunrise.' },
];

/** The upgrades the player may still take, with their current level. */
export function availableUpgrades(player) {
  return UPGRADES.filter((u) => (player.mods[u.id] || 0) < u.max);
}

/** Draw `n` distinct upgrades for the level-up draft. */
export function draftUpgrades(rng, player, n) {
  const pool = availableUpgrades(player);
  if (pool.length === 0) return [];
  const out = [];
  const copy = pool.slice();
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

/** Apply one upgrade to the player (called when the draft is picked). */
export function applyUpgrade(player, id) {
  player.mods[id] = (player.mods[id] || 0) + 1;
  if (id === 'vital') {
    player.maxHp += 25;
    player.hp = Math.min(player.maxHp, player.hp + 25);
  }
  if (id === 'bomb') {
    player.novaReady = Math.max(player.novaReady, 1);
  }
  return player.mods[id];
}

export function upgradeLevel(player, id) {
  return player.mods[id] || 0;
}

export function maxHpOf(player) {
  return PLAYER.maxHp + 25 * (player.mods.vital || 0);
}
