// Synthesised sound: every effect is an oscillator or a burst of filtered noise
// through the Web Audio API, so the game ships no audio files at all.
// The context is created on the first real gesture; before that every call is a
// silent no-op, which also keeps headless screenshot runs quiet.
let ctx = null;
let master = null;
let muted = false;
let musicTimer = 0;
let musicStep = 0;

const BASSLINE = [55, 0, 55, 65.41, 0, 55, 49, 58.27, 55, 0, 55, 65.41, 73.42, 0, 65.41, 49];

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function setMuted(m) {
  muted = !!m;
  if (master) master.gain.value = muted ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(dur, vol, filterFreq, slideTo) {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, t);
  if (slideTo) filter.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t);
}

export const sfx = {
  shoot() { tone(720, 0.07, 'square', 0.05, 320); },
  enemyHit() { tone(220, 0.05, 'triangle', 0.08, 140); },
  enemyDie() { noise(0.22, 0.16, 2400, 220); tone(180, 0.18, 'sawtooth', 0.07, 60); },
  hurt() { tone(130, 0.25, 'sawtooth', 0.16, 55); noise(0.18, 0.12, 900, 150); },
  pickup() { tone(880, 0.09, 'sine', 0.09, 1320); },
  heart() { tone(523, 0.12, 'sine', 0.1, 784); tone(784, 0.16, 'sine', 0.08, 1046); },
  levelup() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.1), i * 70)); },
  dash() { noise(0.16, 0.1, 3200, 500); },
  nova() { noise(0.5, 0.22, 3000, 90); tone(90, 0.45, 'sine', 0.2, 40); },
  boss() { tone(55, 0.7, 'sawtooth', 0.18, 48); tone(82, 0.7, 'square', 0.07, 70); },
  waveClear() { [659, 784, 988].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.09), i * 90)); },
  click() { tone(660, 0.05, 'sine', 0.07, 520); },
  gameOver() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.11), i * 160)); },
  victory() { [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'triangle', 0.1), i * 110)); },
};

/** A quiet two-bar bass pulse while playing; called every frame with dt. */
export function musicTick(dt, isMuted, playing) {
  if (!ctx || !master || isMuted || !playing) return;
  musicTimer += dt;
  const stepDur = 0.22;
  while (musicTimer >= stepDur) {
    musicTimer -= stepDur;
    const freq = BASSLINE[musicStep % BASSLINE.length];
    musicStep += 1;
    if (freq > 0) tone(freq, 0.2, 'triangle', 0.045);
    if (musicStep % 16 === 8) tone(110, 0.12, 'sine', 0.03, 220);
  }
}
