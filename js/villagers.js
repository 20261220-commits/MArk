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
    // looking for work: a free job site within 48 blocks (villagelife.js); one that traded keeps its trade and looks for the same kind
    if (!e.baby && !e.job && (e.prof === 'none' || e.traded) && e.prof !== 'nitwit' && W.tickN % 100 === 0 && typeof vSeekJob === 'function') vSeekJob(e);
    if (e.job) VIL.claimed.set(e.job.join(','), e);
    // food lying close by is picked up
    for (const it of ENT) if (it.kind === 'item' && !it.dead && typeof villagerWants === 'function' && villagerWants(e, it)) continue; else if (it.kind === 'item' && !it.dead && VFOOD()[it.stack.id] && Math.hypot(it.x - e.x, it.z - e.z) < 1.5 && Math.abs(it.y - e.y) < 2) { e.vfood = (e.vfood || 0) + VFOOD()[it.stack.id] * it.stack.n; removeEnt(it); }
  }
  // breeding (villagelife.js): two willing adults and a bed nobody has claimed
  if (W.tickN % 200 === 0 && typeof villagerBreed === 'function') villagerBreed(vs);
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
