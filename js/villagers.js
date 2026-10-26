// Villager life as in Java: an unemployed villager claims a free job site block nearby and takes its profession (a
// nitwit never does); it loses the job if the block is broken before it ever traded. Villagers pick up bread,
// carrots, potatoes and beetroots, and two villagers with enough food breed when the village has a free bed.
const JOB_SITES = () => VIL.sites || (VIL.sites = new Map([[BID.composter, 'farmer'], [BID.lectern, 'librarian'], [BID.blast_furnace, 'armorer'], [BID.smithing_table, 'toolsmith'],
  [BID.grindstone, 'weaponsmith'], [BID.smoker, 'butcher'], [BID.brewing_stand, 'cleric'], [BID.fletching_table, 'fletcher'], [BID.loom, 'shepherd'], [BID.stonecutter, 'mason'],
  [BID.cauldron, 'leatherworker'], [BID.cartography_table, 'cartographer'], [BID.barrel, 'fisherman']]));
const VIL = { sites: null, claimed: new Map() }; // "x,y,z" -> villager
const VFOOD = () => VIL.food || (VIL.food = { [IID.bread]: 4, [IID.carrot]: 1, [IID.potato]: 1, [IID.beetroot]: 1 });
function villagerRetexture(e) { const t = villagerTexture(e.vtype, e.prof); if (t && e.mesh) { e.mesh.userData.mat.map = t; if (e.matOwn) for (const m of e.mesh.userData.own) if (m.skinning) m.map = t; } }
function villagerLifeTick() {
  if (W.tickN % 20) return;
  const vs = ENT.filter(e => e.type === 'villager' && !e.dead);
  zombieSiege(vs);
  for (const [k, v] of VIL.claimed) if (v.dead || !ENT.includes(v)) VIL.claimed.delete(k);
  for (const e of vs) {
    // a lost job site
    if (e.job) { const [x, y, z] = e.job; if (isLoaded(x, z) && JOB_SITES().get(getBlock(x, y, z)) !== e.prof) { VIL.claimed.delete(e.job.join(',')); e.job = null; if (!e.traded) { e.prof = 'none'; e.trades = null; villagerRetexture(e); } } }
    // looking for work
    if (!e.baby && e.prof === 'none' && W.tickN % 100 === 0) {
      let best = null, bd = 17;
      for (let dx = -16; dx <= 16; dx++) for (let dy = -4; dy <= 4; dy++) for (let dz = -16; dz <= 16; dz++) {
        const x = Math.floor(e.x) + dx, y = Math.floor(e.y) + dy, z = Math.floor(e.z) + dz, p = JOB_SITES().get(getBlock(x, y, z));
        if (!p || VIL.claimed.has(x + ',' + y + ',' + z)) continue; const d = Math.hypot(dx, dy, dz); if (d < bd) { bd = d; best = [x, y, z, p]; }
      }
      if (best) { const [x, y, z, p] = best; e.job = [x, y, z]; e.prof = p; e.trades = null; VIL.claimed.set(x + ',' + y + ',' + z, e); villagerRetexture(e); for (let i = 0; i < 6; i++) R.simpleParticle(e.x, e.y + 2, e.z, [0.4, 0.9, 0.3], { kind: 'happy', size: 0.1, vy: 1, grav: 0 }); }
    }
    if (e.job) VIL.claimed.set(e.job.join(','), e);
    // food lying close by is picked up
    for (const it of ENT) if (it.kind === 'item' && !it.dead && VFOOD()[it.stack.id] && Math.hypot(it.x - e.x, it.z - e.z) < 1.5 && Math.abs(it.y - e.y) < 2) { e.vfood = (e.vfood || 0) + VFOOD()[it.stack.id] * it.stack.n; removeEnt(it); }
  }
  // breeding: food for both, and a bed nobody sleeps in
  if (W.tickN % 200) return;
  const beds = [...trackBlocks(BID.red_bed)].filter(k => { const [x, y, z] = k.split(',').map(Number); return getMeta(x, y, z) & 4; }).length;
  const adults = vs.filter(e => !e.baby && (e.vfood || 0) >= 12 && !(e.breedCd > W.tickN));
  if (vs.length >= beds) return;
  for (let i = 0; i < adults.length; i++) for (let j = i + 1; j < adults.length; j++) {
    const a = adults[i], b = adults[j]; if (Math.hypot(a.x - b.x, a.z - b.z) > 8 || a.breedCd > W.tickN || b.breedCd > W.tickN) continue;
    a.vfood -= 12; b.vfood -= 12; a.breedCd = b.breedCd = W.tickN + 6000;
    const kid = spawnMob('villager', (a.x + b.x) / 2, a.y, (a.z + b.z) / 2, { baby: true, vtype: a.vtype, prof: 'none' }); kid.persistent = true;
    for (let k = 0; k < 7; k++) R.simpleParticle(kid.x, kid.y + 1, kid.z, [1, 0.3, 0.4], { kind: 'heart', size: 0.12, vy: 1, grav: 0 });
    return;
  }
}
{ const save = MOBDEF.villager.save, init = MOBDEF.villager.init;
  MOBDEF.villager.save = e => ({ ...(save ? save(e) : {}), job: e.job || null, traded: !!e.traded, vfood: e.vfood || 0 });
  MOBDEF.villager.init = (e, o) => { if (init) init(e, o); if (o.job) e.job = o.job; if (o.traded) e.traded = true; if (o.vfood) e.vfood = o.vfood; if (o.baby && !o.prof) e.prof = 'none'; }; }
PROF_NAME.none = '실업자';

// zombie sieges (Java's VillageSiege): around midnight, 10% of nights, if the player is in a village with enough
// villagers, about twenty zombies appear together at its edge and walk in
function zombieSiege(vs) {
  if (W.dim !== 0 || PL.difficulty === 0 || PL.dead || !gr('doMobSpawning')) return;
  const day = Math.floor(W.time / 24000), t = ((W.time % 24000) + 24000) % 24000;
  if (t < 18000 || t > 18400 || W.meta.siegeDay === day) return;
  W.meta.siegeDay = day;
  const near = vs.filter(v => Math.hypot(v.x - PL.x, v.z - PL.z) < 48); if (near.length < 5 || Math.random() >= 0.1) return;
  const cx = near.reduce((a, v) => a + v.x, 0) / near.length, cz = near.reduce((a, v) => a + v.z, 0) / near.length;
  for (let tries = 0; tries < 10; tries++) {
    const a = Math.random() * Math.PI * 2, x = Math.floor(cx + Math.cos(a) * 32), z = Math.floor(cz + Math.sin(a) * 32), y = topY(x, z) + 1;
    if (!isLoaded(x, z) || (getLight(x, y, z) & 15) > 7) continue;
    for (let i = 0; i < 20; i++) { const zx = x + (Math.random() - .5) * 6, zz = z + (Math.random() - .5) * 6, e = spawnMob(Math.random() < 0.1 ? 'zombie_villager' : 'zombie', zx, topY(Math.floor(zx), Math.floor(zz)) + 1, zz); if (e) e.goal = [cx, cz]; }
    return;
  }
}
