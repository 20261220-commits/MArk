// Tiny Web Audio synthesizer for game sounds (no audio files needed).
const AU = { ctx: null, vol: 0.6, noise: null, master: null };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
    AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.vol; AU.master.connect(AU.ctx.destination);
    const len = AU.ctx.sampleRate; const b = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; AU.noise = b;
  } catch (e) { AU.ctx = null; }
}
function setVolume(v) { AU.vol = v; if (AU.master) AU.master.gain.value = v; }
const MATS_SND = { stone: [1800, 1.2, 'bandpass'], wood: [700, 4, 'bandpass'], grass: [3000, 0.5, 'highpass'], gravel: [900, 0.7, 'lowpass'], sand: [2500, 0.4, 'lowpass'], glass: [4000, 8, 'bandpass'], wool: [500, 0.3, 'lowpass'], snow: [2000, 0.3, 'lowpass'], metal: [2600, 10, 'bandpass'] };
function soundMat(id) {
  const d = BLOCKS[id]; if (!d) return 'stone';
  if (d.key.includes('glass') || id === BID.ice) return 'glass';
  if (d.key.includes('wool')) return 'wool';
  if (d.key.includes('snow')) return 'snow';
  if (id === BID.sand) return 'sand';
  if (id === BID.gravel || id === BID.dirt || id === BID.farmland || id === BID.clay) return 'gravel';
  if (d.leaves || d.plant || id === BID.grass_block || id === BID.moss_block || id === BID.hay_block) return 'grass';
  if (d.tool === S.TOOL.AXE) return 'wood';
  if (d.key.includes('iron') || d.key.includes('gold_block') || d.key.includes('copper') || id === BID.lantern) return 'metal';
  return 'stone';
}
function noiseHit(t0, dur, freq, q, type, gain, rate = 1) {
  const c = AU.ctx, s = c.createBufferSource(); s.buffer = AU.noise; s.playbackRate.value = rate;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
}
function tone(t0, dur, f0, f1, type, gain) {
  const c = AU.ctx, o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(AU.master); o.start(t0); o.stop(t0 + dur + 0.02);
}
function play(name, opt = {}) {
  if (!AU.ctx || AU.vol <= 0) return;
  const t = AU.ctx.currentTime, v = opt.vol == null ? 1 : opt.vol;
  if (v < 0.02) return;
  const m = MATS_SND[opt.mat || 'stone'] || MATS_SND.stone;
  switch (name) {
    case 'dig': noiseHit(t, 0.08, m[0], m[1], m[2], 0.25 * v); break;
    case 'break': noiseHit(t, 0.22, m[0], m[1], m[2], 0.5 * v); noiseHit(t + 0.03, 0.15, m[0] * 0.7, m[1], m[2], 0.3 * v); break;
    case 'place': noiseHit(t, 0.12, m[0] * 0.8, m[1], m[2], 0.4 * v); break;
    case 'step': noiseHit(t, 0.07, m[0], m[1], m[2], 0.12 * v); break;
    case 'hurt': tone(t, 0.18, 260, 140, 'sawtooth', 0.25 * v); noiseHit(t, 0.1, 600, 1, 'lowpass', 0.2 * v); break;
    case 'hit': noiseHit(t, 0.1, 400, 1, 'lowpass', 0.4 * v); break;
    case 'pop': tone(t, 0.07, 900 + Math.random() * 500, 1600, 'sine', 0.18 * v); break;
    case 'xp': tone(t, 0.12, 1400 + Math.random() * 600, 2200, 'sine', 0.12 * v); break;
    case 'levelup': [0, .1, .2].forEach((d, i) => tone(t + d, 0.35, 520 * (1 + i * .25), 560 * (1 + i * .25), 'triangle', 0.18 * v)); break;
    case 'explode': noiseHit(t, 1.2, 300, 0.5, 'lowpass', 1.0 * v, 0.5); noiseHit(t, 0.4, 900, 0.5, 'lowpass', 0.6 * v); break;
    case 'fuse': noiseHit(t, 1.2, 5000, 1, 'highpass', 0.15 * v); break;
    case 'click': tone(t, 0.05, 1200, 900, 'square', 0.08 * v); break;
    case 'eat': for (let i = 0; i < 2; i++) noiseHit(t + i * 0.09, 0.07, 1500, 1, 'bandpass', 0.25 * v); break;
    case 'burp': tone(t, 0.25, 160, 90, 'sawtooth', 0.2 * v); break;
    case 'bow': noiseHit(t, 0.25, 1500, 1, 'bandpass', 0.35 * v, 1.5); break;
    case 'door': noiseHit(t, 0.1, 500, 3, 'bandpass', 0.5 * v); noiseHit(t + 0.06, 0.08, 700, 3, 'bandpass', 0.3 * v); break;
    case 'splash': noiseHit(t, 0.4, 1200, 0.5, 'lowpass', 0.4 * v); break;
    case 'fizz': noiseHit(t, 0.5, 4000, 0.5, 'highpass', 0.3 * v); break;
    case 'moo': { const c = AU.ctx, o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(110, t); o.frequency.linearRampToValueAtTime(95, t + 0.8); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25 * v, t + 0.1); g.gain.linearRampToValueAtTime(0.001, t + 0.9); o.connect(f); f.connect(g); g.connect(AU.master); o.start(t); o.stop(t + 1); break; }
    case 'oink': tone(t, 0.12, 300, 220, 'square', 0.12 * v); tone(t + 0.15, 0.1, 280, 200, 'square', 0.1 * v); break;
    case 'baa': { const c = AU.ctx, o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 280; const lfo = c.createOscillator(); lfo.frequency.value = 22; const lg = c.createGain(); lg.gain.value = 25; lfo.connect(lg); lg.connect(o.frequency); const g = c.createGain(); g.gain.setValueAtTime(0.15 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.connect(g); g.connect(AU.master); o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6); break; }
    case 'cluck': tone(t, 0.06, 900, 700, 'square', 0.08 * v); tone(t + 0.1, 0.05, 1000, 800, 'square', 0.06 * v); break;
    case 'groan': tone(t, 0.7, 120, 80, 'sawtooth', 0.15 * v); noiseHit(t, 0.6, 300, 2, 'bandpass', 0.1 * v); break;
    case 'rattle': for (let i = 0; i < 4; i++) noiseHit(t + i * 0.05, 0.03, 3000, 5, 'bandpass', 0.2 * v); break;
    case 'hiss': noiseHit(t, 1.0, 6000, 0.7, 'highpass', 0.2 * v); break;
    case 'spider': for (let i = 0; i < 3; i++) noiseHit(t + i * 0.08, 0.06, 2500, 2, 'bandpass', 0.15 * v); break;
    case 'bleat': tone(t, 0.4, 400, 300, 'sawtooth', 0.1 * v); break;
    case 'piston': noiseHit(t, 0.15, 700 * (opt.pitch || 1), 2, 'bandpass', 0.4 * v); tone(t, 0.1, 180, 120, 'square', 0.08 * v); break;
    case 'portal': { const c = AU.ctx, o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(opt.trigger ? 900 : 260, t + (opt.trigger ? 3 : 1.5)); const lfo = c.createOscillator(); lfo.frequency.value = 7; const lg = c.createGain(); lg.gain.value = 30; lfo.connect(lg); lg.connect(o.frequency); const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12 * v, t + 0.3); g.gain.exponentialRampToValueAtTime(0.001, t + (opt.trigger ? 3.2 : 1.6)); o.connect(g); g.connect(AU.master); o.start(t); lfo.start(t); o.stop(t + 3.3); lfo.stop(t + 3.3); break; }
    case 'ignite': noiseHit(t, 0.25, 2500, 1, 'bandpass', 0.35 * v); break;
    case 'fireball': noiseHit(t, 0.6, 500, 0.7, 'lowpass', 0.6 * v, 0.6); break;
    case 'ghast': tone(t, 0.9, 700 + Math.random() * 200, 300, 'sawtooth', 0.08 * v); tone(t, 0.9, 1400, 600, 'sine', 0.05 * v); break;
    case 'blaze': noiseHit(t, 0.5, 350, 1, 'lowpass', 0.25 * v, 0.8); tone(t, 0.4, 90, 70, 'sawtooth', 0.1 * v); break;
    case 'slime': noiseHit(t, 0.12, 400, 2, 'lowpass', 0.3 * v); break;
    case 'hmm': tone(t, 0.25, 210 + Math.random() * 40, 170, 'sawtooth', 0.1 * v); tone(t + 0.22, 0.2, 180, 230, 'sawtooth', 0.08 * v); break;
    case 'trade': tone(t, 0.2, 260, 330, 'triangle', 0.15 * v); tone(t + 0.18, 0.25, 330, 300, 'triangle', 0.12 * v); break;
    case 'golem': noiseHit(t, 0.3, 200, 1, 'lowpass', 0.5 * v); break;
    case 'enderman': tone(t, 0.6, 140, 70, 'sawtooth', 0.12 * v); noiseHit(t, 0.4, 900, 3, 'bandpass', 0.08 * v); break;
    case 'teleport': tone(t, 0.25, 300, 900, 'sine', 0.15 * v); break;
    case 'growl': noiseHit(t, 1.6, 150, 0.6, 'lowpass', 0.9 * v, 0.5); tone(t, 1.4, 70, 45, 'sawtooth', 0.25 * v); break;
    case 'anvil': tone(t, 0.3, 1800, 1700, 'triangle', 0.15 * v); noiseHit(t, 0.08, 3000, 3, 'bandpass', 0.3 * v); break;
    case 'boat': noiseHit(t, 0.2, 900, 1, 'lowpass', 0.15 * v); break;
    case 'thunder': noiseHit(t, 2.5, 120, 0.4, 'lowpass', 1.0 * v, 0.3); break;
  }
}
