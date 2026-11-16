// NOVA BLOOM — entry point.
// Boots the canvas, wires input, runs the fixed-step loop, and stages the
// deterministic ?shot= scenes the screenshots are taken from. The world state
// is exposed on window.__novaBloom so headless tests can read it.
import { FIELD, STEP, BEST_KEY } from './config.js';
import { createWorld, stepWorld, SCREEN_LEVELUP } from './world.js';
import { render, levelupCardRects } from './render.js';
import { attachInput, readInput } from './input.js';
import { stageShot } from './shots.js';
import { musicTick, setMuted, unlockAudio } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function getParam(name) {
  const m = new URLSearchParams(window.location.search);
  return m.get(name);
}

function fitCanvas() {
  const scale = Math.min(
    window.innerWidth / FIELD.width,
    window.innerHeight / FIELD.height,
  );
  canvas.style.width = `${Math.floor(FIELD.width * scale)}px`;
  canvas.style.height = `${Math.floor(FIELD.height * scale)}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const seed = parseInt(getParam('seed') || '1', 10) || 1;
const shot = getParam('shot');

let world;
if (shot) {
  // Screenshot mode: stage the scene deterministically, render one frame.
  world = stageShot(shot, seed);
  render(ctx, world);
} else {
  world = createWorld(seed);
  try {
    const saved = window.localStorage.getItem(BEST_KEY);
    if (saved) world.best = parseInt(saved, 10) || 0;
  } catch (_e) {
    // Storage may be unavailable in some sandboxes; the game does not need it.
  }
  const input = attachInput(canvas);
  // Audio unlocks on the first real gesture (browsers require one).
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Clicking a level-up card picks it; clicks elsewhere are just firing.
  canvas.addEventListener('mousedown', (event) => {
    if (world.screen !== SCREEN_LEVELUP) return;
    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (FIELD.width / rect.width);
    const y = (event.clientY - rect.top) * (FIELD.height / rect.height);
    levelupCardRects().forEach((r, i) => {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        world.pickUpgrade(i);
      }
    });
  });

  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      const before = world.screen;
      stepWorld(world, readInput(), STEP);
      acc -= STEP;
      guard += 1;
      if (world.screen !== before && (world.screen === 'over' || world.screen === 'victory')) {
        if (world.score > world.best) {
          world.best = world.score;
          try { window.localStorage.setItem(BEST_KEY, String(world.best)); } catch (_e) { /* no storage */ }
        }
      }
    }
    setMuted(world.muted);
    musicTick(dt, world.muted, world.screen === 'playing');
    render(ctx, world);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

window.__novaBloom = {
  world,
  version: '1.0.0',
  shot: shot || null,
};
