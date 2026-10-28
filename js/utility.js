// Campfires, bells and jukeboxes (Java Edition).

// ---------- campfire: cooks up to four raw foods (30 s each), smokes, hurts what stands on it ----------
const isCampfire = b => b === BID.campfire || b === BID.soul_campfire;
const newCampfire = () => ({ type: 'campfire', items: [null, null, null, null], t: [0, 0, 0, 0] });
const campfireFood = id => SMELT[id] && ITEMS[id].food && ITEMS[SMELT[id][0]].food;
const cfMeshes = new Map(); // "x,y,z" -> { ver, meshes }
function campfireTick(c, i, t) {
  const x = c.cx * 16 + (i & 15), y = (i >> 8) + MINY, z = c.cz * 16 + ((i >> 4) & 15), b = c.blocks[i], m = c.meta[i], lit = !!(m & 4);
  for (let k = 0; k < 4; k++) {
    const st = t.items[k]; if (!st) continue;
    if (!lit) continue;
    if (++t.t[k] >= 600) { t.items[k] = null; t.t[k] = 0; t.ver = (t.ver || 0) + 1; dropItem(x + .5, y + 1, z + .5, SMELT[st.id][0], 1, [0, 0.15, 0]); c.modified = c.edited = true; }
  }
  // smoke drifts up (higher over a hay bale: a signal fire)
  if (lit && Math.hypot(PL.x - x, PL.z - z) < 40 && W.tickN % 3 === 0) {
    const sig = getBlock(x, y - 1, z) === BID.hay_block;
    R.simpleParticle(x + .3 + Math.random() * .4, y + .8, z + .3 + Math.random() * .4, [0.62, 0.62, 0.62], { kind: 'big_smoke', size: 0.2, vx: (Math.random() - .5) * 0.1, vy: 0.6, vz: (Math.random() - .5) * 0.1, grav: -0.05, life: sig ? 8 : 3 });
  }
  // items lying on it
  const k0 = x + ',' + y + ',' + z, cur = cfMeshes.get(k0), ver = t.ver || 0;
  if (!cur || cur.ver !== ver) {
    if (cur) for (const me of cur.meshes) scene.remove(me);
    const meshes = [];
    t.items.forEach((st, k) => { if (!st) return; const me = R.itemMesh(st.id); me.scale.setScalar(0.35); me.rotation.x = -Math.PI / 2; me.rotation.z = k * Math.PI / 2; me.position.set(x + .5 + [0.2, -0.2, -0.2, 0.2][k], y + 0.45, z + .5 + [0.2, 0.2, -0.2, -0.2][k]); scene.add(me); meshes.push(me); });
    cfMeshes.set(k0, { ver, meshes });
  }
  for (const me of cfMeshes.get(k0).meshes) R.setMeshLight(me, 1);
}
function campfireCleanup() { for (const [k, v] of cfMeshes) { const [x, y, z] = k.split(',').map(Number); if (!isCampfire(getBlock(x, y, z))) { for (const me of v.meshes) scene.remove(me); cfMeshes.delete(k); } } }
function campfireUse(x, y, z, m, h) {
  const b = getBlock(x, y, z), lit = m & 4, d = h && ITEMS[h.id];
  if (d && d.tool && d.tool.type === S.TOOL.SHOVEL && lit) { setMeta(x, y, z, m & ~4); play('fizz'); damageItem(INV.slots, INV.sel, 1); return true; }
  if (h && (h.id === IID.flint_and_steel || h.id === IID.fire_charge) && !lit) { setMeta(x, y, z, m | 4); play('ignite'); if (h.id === IID.fire_charge) consume(); else damageItem(INV.slots, INV.sel, 1); return true; }
  if (h && campfireFood(h.id)) {
    let t = getTile(x, y, z); if (!t) { t = newCampfire(); setTile(x, y, z, t); }
    const k = t.items.findIndex(s => !s); if (k < 0) return false;
    t.items[k] = { id: h.id, n: 1 }; t.t[k] = 0; t.ver = (t.ver || 0) + 1; consume(); play('place', { mat: 'wood' }); return true;
  }
  return false;
}
// standing on a lit campfire burns (1, soul campfire 2)
function campfireStand() {
  for (const yy of [Math.floor(PL.y - 0.05), Math.floor(PL.y + 0.2)]) { const b = getBlock(Math.floor(PL.x), yy, Math.floor(PL.z)); if (isCampfire(b) && (getMeta(Math.floor(PL.x), yy, Math.floor(PL.z)) & 4)) { hurtPlayer(b === BID.soul_campfire ? 2 : 1, 'fire'); return; } }
}

// ---------- bell ----------
function ringBell(x, y, z) {
  if (AU.ctx) { const t = AU.ctx.currentTime; tone(t, 2.4, 880, 870, 'sine', 0.35); tone(t, 1.6, 1760, 1750, 'sine', 0.12); tone(t, 1.2, 2637, 2630, 'triangle', 0.05); }
  for (const e of ENT) {
    if (e.kind !== 'mob' || e.dead || Math.hypot(e.x - x, e.z - z) > 48) continue;
    if (e.type === 'villager') e.panic = 120; // villagers scatter
    if (e.def.raider) addEffect(e, 'glowing', 60, 0); // raiders are revealed (raids)
  }
  vibrate(x + .5, y + .5, z + .5);
}
function bellPower(x, y, z, m) { // rings on a rising redstone edge
  const p = typeof powerAt === 'function' && powerAt(x, y, z) > 0;
  if (p && !(m & 16)) { setMeta(x, y, z, m | 16); ringBell(x, y, z); } else if (!p && (m & 16)) setMeta(x, y, z, m & ~16);
}
function bellAttach(t, fd) { // meta for a bell placed on face t
  if (t.ny === -1) return 1;
  if (t.ny === 1) return (fd & 3) << 2;
  const f = [[0, -1], [1, 0], [0, 1], [-1, 0]].findIndex(([dx, dz]) => dx === -t.nx && dz === -t.nz);
  return 2 | (((f + 2) & 3) << 2);
}
function bellSupported(x, y, z, m) {
  const a = m & 3, f = (m >> 2) & 3;
  if (a === 0) return SOLID[getBlock(x, y - 1, z)]; if (a === 1) return SOLID[getBlock(x, y + 1, z)];
  const d = DIRS[(f + 2) & 3]; return SOLID[getBlock(x + d[0], y, z + d[2])];
}

// ---------- jukebox and music discs ----------
// every disc gets its own synthesised tune: [bpm, scale, root Hz, lead wave, style]
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10], PENTA = [0, 2, 4, 7, 9];
const SONGS = { '13': [50, MINOR, 110, 'sine', 'eerie'], cat: [110, MAJOR, 330, 'triangle', 'pop'], blocks: [120, DORIAN, 220, 'square', 'funk'], chirp: [112, PENTA, 392, 'triangle', 'pop'],
  far: [72, MAJOR, 262, 'sine', 'pad'], mall: [100, DORIAN, 294, 'triangle', 'jazz'], mellohi: [60, MINOR, 196, 'sine', 'pad'], stal: [104, DORIAN, 262, 'square', 'jazz'],
  strad: [126, MAJOR, 349, 'square', 'pop'], ward: [96, MINOR, 247, 'triangle', 'pop'], '11': [40, MINOR, 98, 'sawtooth', 'broken'], wait: [90, MAJOR, 294, 'sine', 'pop'], pigstep: [120, MINOR, 165, 'sawtooth', 'funk'] };
const PLAYING = new Map(); // "x,y,z" -> { gain, end }
const freqOf = (root, scale, step) => root * Math.pow(2, (scale[((step % scale.length) + scale.length) % scale.length] + 12 * Math.floor(step / scale.length)) / 12);
function playDisc(key, x, y, z) {
  stopDisc(x, y, z); if (!AU.ctx) return;
  const [bpm, scale, root, wave, style] = SONGS[key] || SONGS.cat, c = AU.ctx, t0 = c.currentTime + 0.1, beat = 60 / bpm, r = trng(key.length * 97 + key.charCodeAt(0));
  const out = c.createGain(); out.gain.value = 0; out.connect(AU.master);
  const note = (t, dur, f, type, vol) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.04, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); };
  const hit = (t, dur, f, vol) => { const s = c.createBufferSource(); s.buffer = AU.noise; const fl = c.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(fl); fl.connect(g); g.connect(out); s.start(t, r() * 0.5); s.stop(t + dur + 0.02); };
  const bars = style === 'pad' || style === 'eerie' ? 16 : 28, len = bars * 4 * beat;
  let step = 7, chord = 0;
  for (let bar = 0; bar < bars; bar++) {
    const tb = t0 + bar * 4 * beat; if (bar % 2 === 0) chord = [0, 3, 4, 5, 0, 5, 3, 4][(bar / 2 + r.int(2)) % 8];
    if (style === 'eerie' || style === 'broken') { // sparse drones, distant pings and odd noises
      note(tb, 4 * beat, freqOf(root / 2, scale, chord), 'sine', 0.08);
      if (r() < 0.6) note(tb + r() * 3 * beat, 1.5, freqOf(root * 4, scale, r.int(7)), 'sine', 0.03);
      if (r() < 0.5) hit(tb + r() * 4 * beat, 0.6, 300 + r() * 1200, style === 'broken' ? 0.12 : 0.04);
      continue;
    }
    note(tb, 4 * beat * (style === 'pad' ? 1.1 : 0.9), freqOf(root / 2, scale, chord), style === 'funk' ? 'sawtooth' : 'triangle', style === 'pad' ? 0.06 : 0.07); // bass
    if (style === 'pad') { for (const s of [0, 2, 4]) note(tb, 4 * beat, freqOf(root, scale, chord + s), 'sine', 0.025); }
    const per = style === 'pad' ? 2 : style === 'jazz' ? 3 : 4;
    for (let k = 0; k < 4 * per / 2; k++) { // melody: a random walk around the chord
      if (r() < (style === 'pad' ? 0.45 : 0.25)) continue;
      step += r.int(5) - 2; step = Math.max(2, Math.min(13, step));
      const swing = style === 'jazz' && k % 2 ? beat / 3 * 0.5 : 0;
      note(tb + k * beat * 2 / per + swing, beat * 2 / per * (r() < 0.3 ? 2 : 0.9), freqOf(root, scale, step + (r() < 0.2 ? chord : 0)), wave, style === 'pad' ? 0.05 : 0.045);
    }
    if (style === 'funk' || style === 'pop') for (let k = 0; k < 4; k++) { hit(tb + k * beat, 0.08, k % 2 ? 2200 : 120, k % 2 ? 0.05 : 0.12); if (style === 'funk') hit(tb + (k + 0.5) * beat, 0.04, 6000, 0.03); }
  }
  PLAYING.set(x + ',' + y + ',' + z, { gain: out, end: t0 + len + 1 });
  jukeboxVolume();
}
function stopDisc(x, y, z) { const k = x + ',' + y + ',' + z, p = PLAYING.get(k); if (!p) return; try { p.gain.gain.setTargetAtTime(0, AU.ctx.currentTime, 0.05); setTimeout(() => p.gain.disconnect(), 300); } catch (e) {} PLAYING.delete(k); }
// fade with distance (64 blocks), stop when the jukebox is gone or the song is over
function jukeboxVolume() {
  for (const [k, p] of PLAYING) {
    const [x, y, z] = k.split(',').map(Number);
    if (getBlock(x, y, z) !== BID.jukebox || AU.ctx.currentTime > p.end) { stopDisc(x, y, z); const t = getTile(x, y, z); if (t) t.playing = false; continue; }
    const d = Math.hypot(PL.x - x - .5, PL.y - y - .5, PL.z - z - .5);
    p.gain.gain.setTargetAtTime(Math.max(0, 1 - d / 64) * 0.9, AU.ctx.currentTime, 0.2);
  }
}
function jukeboxUse(x, y, z, h) {
  let t = getTile(x, y, z); if (!t) { t = { type: 'jukebox', items: [null] }; setTile(x, y, z, t); }
  if (t.items[0]) { dropItem(x + .5, y + 1.2, z + .5, t.items[0].id, 1, [0, 0.2, 0]); t.items[0] = null; t.playing = false; stopDisc(x, y, z); rsNotify(x, y, z); return true; }
  if (!h || !ITEMS[h.id].disc) return false;
  t.items[0] = { id: h.id, n: 1 }; t.playing = true; consume(); playDisc(ITEMS[h.id].key.replace('music_disc_', ''), x, y, z);
  UI.flash('재생 중: ' + ITEMS[h.id].lore[0]); rsNotify(x, y, z);
  if (W.dim === 0 && typeof advGrant === 'function' && S.BIOMES[biomeAt(x, z)][8] === 'meadow') advGrant('adventure/play_jukebox_in_meadows'); // sound of music
  return true;
}
