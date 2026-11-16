// NOVA BLOOM — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Waves: 10 waves, a boss on 5 and 10. Killing the wave-10 boss wins the game. */
export const WAVES = { total: 10, bossWaves: [5, 10] };

export const PLAYER = {
  radius: 14,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.16,
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletRadius: 5,
  dashSpeed: 780,
  dashTime: 0.18,
  dashCooldown: 2.0,
  invulnerableAfterHit: 0.9,
  pickupRadius: 120,
  critChance: 0.05,
  critMult: 2,
};

export const ENEMY = {
  mote:     { hp: 14,  speed: 96,  radius: 13, damage: 8,  xp: 1, score: 50,  color: '#ff5d73' },
  darter:   { hp: 20,  speed: 72,  radius: 14, damage: 10, xp: 2, score: 80,  color: '#ffb02e' },
  splitter: { hp: 38,  speed: 56,  radius: 21, damage: 12, xp: 3, score: 120, color: '#b388ff' },
  spitter:  { hp: 24,  speed: 62,  radius: 15, damage: 10, xp: 3, score: 140, color: '#ff7ad9' },
  warden:   { hp: 950, speed: 42,  radius: 46, damage: 16, xp: 40, score: 2000, color: '#ff3d81' },
  sovereign:{ hp: 1700, speed: 48, radius: 54, damage: 20, xp: 80, score: 5000, color: '#ff2e63' },
};

/** XP needed to go from `level` to `level + 1`. */
export function xpNeeded(level) {
  return 8 + level * 6 + Math.floor(Math.pow(level - 1, 1.5) * 3);
}

/** How many enemies a wave throws, and which kinds it may use. */
export function wavePlan(wave) {
  const kinds = ['mote'];
  if (wave >= 2) kinds.push('darter');
  if (wave >= 3) kinds.push('splitter');
  if (wave >= 4) kinds.push('spitter');
  const count = 6 + wave * 3;
  const boss = WAVES.bossWaves.includes(wave) ? (wave === 10 ? 'sovereign' : 'warden') : null;
  return { kinds, count, boss };
}

export const PALETTE = {
  backdropTop: '#0b0620',
  backdropBottom: '#04020c',
  nebulaA: 'rgba(124, 58, 237, 0.20)',
  nebulaB: 'rgba(14, 165, 233, 0.16)',
  nebulaC: 'rgba(244, 63, 94, 0.12)',
  grid: 'rgba(148, 163, 255, 0.05)',
  player: '#5eead4',
  playerCore: '#f0fdfa',
  bullet: '#a5f3fc',
  shard: '#fde68a',
  heart: '#fb7185',
  nova: '#facc15',
  panel: 'rgba(10, 8, 28, 0.82)',
  panelEdge: 'rgba(148, 163, 255, 0.35)',
  text: '#f1f5ff',
  muted: '#94a3c8',
  gold: '#fbbf24',
  danger: '#fb7185',
};

export const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nova-bloom.best';
