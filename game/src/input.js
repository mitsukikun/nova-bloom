// Keyboard + mouse input, reduced to one plain object per step:
// { mx, my, aimX, aimY, firing, dash, pause, restart, mute, anyKey }.
// The world never reads the DOM itself, so the screenshot autopilot can drive the
// same shape with a scripted hand instead of a real one.
import { FIELD } from './config.js';

const keys = new Set();
let mouseX = FIELD.width / 2;
let mouseY = FIELD.height / 2 - 120;
let mouseDown = false;
let mouseSeen = false;
let dashQueued = false;
let pauseQueued = false;
let restartQueued = false;
let muteQueued = false;
let anyKeyQueued = false;
let novaQueued = false;
let digitQueued = 0;

function canvasPos(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = FIELD.width / rect.width;
  const scaleY = FIELD.height / rect.height;
  return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY };
}

export function attachInput(canvas) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (!event.repeat) {
      anyKeyQueued = true;
      if (event.key === 'Shift' || event.key === ' ') dashQueued = true;
      if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') pauseQueued = true;
      if (event.key === 'r' || event.key === 'R') restartQueued = true;
      if (event.key === 'm' || event.key === 'M') muteQueued = true;
      if (event.key === 'q' || event.key === 'Q') novaQueued = true;
      if (event.key === '1') digitQueued = 1;
      if (event.key === '2') digitQueued = 2;
      if (event.key === '3') digitQueued = 3;
    }
    keys.add(event.key.toLowerCase());
  });
  window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
  canvas.addEventListener('mousemove', (event) => {
    const p = canvasPos(event, canvas);
    mouseX = p.x;
    mouseY = p.y;
    mouseSeen = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) mouseDown = true;
    if (event.button === 2) dashQueued = true;
    const p = canvasPos(event, canvas);
    mouseX = p.x;
    mouseY = p.y;
    mouseSeen = true;
    anyKeyQueued = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
}

/** Read the current input and clear the one-shot queues. */
export function readInput() {
  let mx = 0;
  let my = 0;
  if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
  if (keys.has('d') || keys.has('arrowright')) mx += 1;
  if (keys.has('w') || keys.has('arrowup')) my -= 1;
  if (keys.has('s') || keys.has('arrowdown')) my += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len;
    my /= len;
  }
  const out = {
    mx,
    my,
    aimX: mouseX,
    aimY: mouseY,
    aimSeen: mouseSeen,
    firing: mouseDown || keys.has(' '),
    dash: dashQueued,
    pause: pauseQueued,
    restart: restartQueued,
    mute: muteQueued,
    novaKey: novaQueued,
    anyKey: anyKeyQueued,
    digit: digitQueued,
  };
  dashQueued = false;
  pauseQueued = false;
  restartQueued = false;
  muteQueued = false;
  novaQueued = false;
  anyKeyQueued = false;
  digitQueued = 0;
  return out;
}
