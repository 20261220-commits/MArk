// Temples and what they need: tripwire traps (hooks and string), flower pots, zombie villagers (and curing them with
// a splash of weakness and a golden apple), witches around swamp huts.

// ---------- tripwires ----------
const isHook = b => b === BID.tripwire_hook_block;
// from a hook, follow the string to the hook facing back; returns the cells of string and the far hook, or null
function tripLine(x, y, z) {
  const m = getMeta(x, y, z), f = m & 3, [dx, , dz] = DIRS[f], cells = [];
  for (let k = 1; k <= 41; k++) {
    const nx = x + dx * k, nz = z + dz * k, b = getBlock(nx, y, nz);
    if (b === BID.tripwire) { cells.push([nx, y, nz]); continue; }
    if (isHook(b) && (getMeta(nx, y, nz) & 3) === ((f + 2) & 3) && cells.length) return { cells, far: [nx, y, nz] };
    return null;
  }
  return null;
}
// hooks are 'attached' (drawn lower) while a complete line joins them
function tripRefresh(x, y, z) {
  const b = getBlock(x, y, z);
  const hooks = [];
  if (isHook(b)) hooks.push([x, y, z]);
  else for (const [dx, , dz] of DIRS) for (let k = 1; k <= 41; k++) { const nb = getBlock(x + dx * k, y, z + dz * k); if (isHook(nb)) { hooks.push([x + dx * k, y, z + dz * k]); break; } if (nb !== BID.tripwire) break; }
  for (const [hx, hy, hz] of hooks) {
    const line = tripLine(hx, hy, hz), m = getMeta(hx, hy, hz), att = line ? 4 : 0;
    if ((m & 4) !== att) setMeta(hx, hy, hz, (m & ~4) | att);
    if (line) { const [fx, fy, fz] = line.far, fm = getMeta(fx, fy, fz); if (!(fm & 4)) setMeta(fx, fy, fz, fm | 4); }
  }
}
// something stands in the string: both hooks give a redstone signal for at least 10 ticks
const tripOccupied = (x, y, z) => { const ins = (e, w) => e.x + w > x && e.x - w < x + 1 && e.z + w > z && e.z - w < z + 1 && e.y >= y - 0.01 && e.y < y + 0.5; return (!PL.dead && !spectator() && ins(PL, PL.w)) || ENT.some(e => !e.dead && (e.kind === 'mob' || e.kind === 'item' || e.kind === 'arrow' || e.kind === 'minecart') && ins(e, e.w || 0.2)); };
function tripTrigger(x, y, z) {
  const m = getMeta(x, y, z), ew = m & 1, dirs = ew ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
  for (const [dx, dz] of dirs) for (let k = 1; k <= 41; k++) {
    const nx = x + dx * k, nz = z + dz * k, b = getBlock(nx, y, nz);
    if (b === BID.tripwire) continue;
    if (isHook(b)) { const hm = getMeta(nx, y, nz); if ((hm & 4) && !(hm & 8)) { setMeta(nx, y, nz, hm | 8); play('click'); const [ax, , az] = DIRS[hm & 3]; rsNotify(nx, y, nz); rsNotify(nx - ax, y, nz - az); } rsLater(nx, y, nz, 10); }
    break;
  }
}
function tripTick() {
  if (W.tickN % 2) return;
  const chk = (e, w) => { const x = Math.floor(e.x), y = Math.floor(e.y + 0.01), z = Math.floor(e.z); if (getBlock(x, y, z) === BID.tripwire) tripTrigger(x, y, z); };
  if (!PL.dead && !spectator()) chk(PL);
  for (const e of ENT) if (!e.dead && (e.kind === 'mob' || e.kind === 'item' || e.kind === 'minecart')) chk(e);
}
// rsDelayed for a powered hook: turns off once the string is clear
function hookDelayed(x, y, z, m) {
  const line = tripLine(x, y, z);
  if (line && line.cells.some(c => tripOccupied(...c))) { rsLater(x, y, z, 10); return; }
  setMeta(x, y, z, m & ~8); play('click', { pitch: 0.8 }); const [ax, , az] = DIRS[m & 3]; rsNotify(x, y, z); rsNotify(x - ax, y, z - az);
}
// placing: hooks go on the side of a solid block, string lies on the floor along the line it joins
function tripPlace(t, d, x, y, z, fd) {
  if (d.place === BID.tripwire_hook_block) { const f = DIRS.findIndex(v => v[0] === t.nx && v[2] === t.nz); if (t.ny !== 0 || f < 0 || !OPQ[getBlock(x - t.nx, y, z - t.nz)]) return false; return f; }
  if (d.place === BID.tripwire) {
    const ew = [[1, 0], [-1, 0]].some(([dx, dz]) => { const b = getBlock(x + dx, y, z + dz); return b === BID.tripwire ? (getMeta(x + dx, y, z + dz) & 1) : isHook(b); });
    const ns = [[0, 1], [0, -1]].some(([dx, dz]) => { const b = getBlock(x + dx, y, z + dz); return b === BID.tripwire ? !(getMeta(x + dx, y, z + dz) & 1) : isHook(b); });
    return ew ? 1 : ns ? 0 : (fd & 1);
  }
  return null;
}

// ---------- flower pots ----------
function potUse(t, h) {
  const { x, y, z, m } = t;
  if (m) { if (h) return false; INV.giveOrDrop({ id: IID[S.POT_PLANTS[m][0]], n: 1 }); setMeta(x, y, z, 0); swing(); return true; }
  if (!h) return false;
  const k = S.POT_PLANTS.findIndex(p => p && IID[p[0]] === h.id); if (k < 1) return false;
  setMeta(x, y, z, k); consume(); play('place', { mat: 'grass' }); swing(); return true;
}

// ---------- zombie villagers ----------
// the villager model with the skin turned zombie green
function zombieVillagerTexture() {
  if (entTex.zombie_villager) return entTex.zombie_villager;
  const base = villagerTexture('plains', 'nitwit'); if (!base) return null;
  const px = new Uint8Array(base.image.data);
  for (let i = 0; i < px.length; i += 4) { const r = px[i], g = px[i + 1], b = px[i + 2]; if (r > g && g > b && r - b > 40 && r > 120) { px[i] = r * 0.45; px[i + 1] = Math.min(255, g * 0.95 + 20); px[i + 2] = b * 0.55; } }
  const t = new THREE.DataTexture(px, base.image.width, base.image.height, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return entTex.zombie_villager = t;
}
MCMODELS.zombie_villager = { ...MCMODELS.villager, tex: 'zombie_villager' };
// curing: a zombie villager under weakness that is given a golden apple shakes for 3-5 minutes, then is a villager again
function zombieVillagerUse(e, h) {
  if (e.type !== 'zombie_villager' || !h || h.id !== IID.golden_apple || !(e.eff && e.eff.weakness) || e.curing) return false;
  e.curing = 3600 + Math.floor(Math.random() * 2400); e.persistent = true; consume(); play('fizz'); swing(); return true;
}
function zombieVillagerTick(e) {
  if (!e.curing) return;
  if (e.age % 4 === 0) R.simpleParticle(e.x + (Math.random() - .5) * 0.6, e.y + 1 + Math.random(), e.z + (Math.random() - .5) * 0.6, [0.9, 0.3, 0.3], { size: 0.08, vy: 0.4, grav: 0 });
  if (--e.curing > 0) return;
  removeEnt(e); const v = spawnMob('villager', e.x, e.y, e.z, { prof: e.prof || ['farmer', 'librarian', 'cleric', 'armorer'][Math.floor(Math.random() * 4)] }); v.persistent = true;
  addEffect(v, 'nausea', 200, 0); play('levelup', { vol: 0.5 }); UI.advance && UI.advance('cure');
}
// a villager killed by a zombie comes back as a zombie villager (normal 50%, hard always)
function zombifyVillager(v, killer) {
  if (!killer || !(killer.type === 'zombie' || killer.type === 'husk' || killer.type === 'drowned' || killer.type === 'zombie_villager')) return;
  if (PL.difficulty < 2 || (PL.difficulty === 2 && Math.random() < 0.5)) return;
  const z = spawnMob('zombie_villager', v.x, v.y, v.z); z.prof = v.prof; z.persistent = true;
}

// ---------- swamp huts keep spawning witches ----------
function hutSpawn() {
  if (W.dim !== 0 || PL.difficulty === 0 || W.tickN % 400 !== 200) return;
  const G = W.genCache || (W.genCache = S.makeGen(W.seed)), rx = Math.floor((PL.x >> 4) / 24), rz = Math.floor((PL.z >> 4) / 24);
  for (let i = rx - 1; i <= rx + 1; i++) for (let j = rz - 1; j <= rz + 1; j++) {
    const o = S.templeAt(W.seed, G, 'hut', i, j); if (!o || Math.hypot(o.x - PL.x, o.z - PL.z) > 64 || Math.hypot(o.x - PL.x, o.z - PL.z) < 16) continue;
    if (countMobs(e => e.type === 'witch' && Math.hypot(e.x - o.x, e.z - o.z) < 12) >= 2) continue;
    if (isLoaded(o.x, o.z) && getBlock(o.x, Math.max(S.SEA, o.h) + 4, o.z + 1) === 0) spawnMob('witch', o.x + .5, Math.max(S.SEA, o.h) + 4, o.z + 1.5).persistent = true;
  }
}
function templeTick() { tripTick(); hutSpawn(); }

Object.assign(MOBDEF, {
  zombie_villager: { ...MOBDEF.zombie, drops: [['rotten_flesh', 0, 2]], parts: HUMAN(4), init: (e, o) => { if (o.prof) e.prof = o.prof; if (o.curing) e.curing = o.curing; }, interact: (e, h) => zombieVillagerUse(e, h), save: e => ({ prof: e.prof, curing: e.curing || 0 }) },
});
// breaking string or a hook detaches the hooks of that line
{ const prev = W.onBlockChanged; W.onBlockChanged = (x, y, z, old, id) => { if (prev) prev(x, y, z, old, id); if (old !== id && (old === BID.tripwire || isHook(old))) tripRefresh(x, y, z); }; }
