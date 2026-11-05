// a villager's day as Java's: to its job site at work time (a farmer harvesting and replanting ripe wheat there),
// to the bell for the meeting, into its own bed at night and up again in the morning; gossip from a hit lowers its
// opinion; three frightened villagers who slept summon an iron golem
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); PL.difficulty = 2;
    for (let a = -20; a <= 20; a++) for (let c = -20; c <= 20; c++) { setBlock(X + a, Y - 1, Z + c, BID.grass_block); for (let k = 0; k < 8; k++) setBlock(X + a, Y + k, Z + c, 0); }
    const run = async (n, f) => { for (let i = 0; i < n; i++) { UI.paused = false; PL.x = X + 18; PL.y = Y + 20; PL.z = Z + 18; PL.mode = 'creative'; W.time++; gameTick(); if (f && f(i)) return i; if (i % 8 === 0) await wait(1); } return -1; };
    for (const e of [...ENT]) if (e !== PL) removeEnt(e);
    // a bed (head toward +z), a bell, a composter with ripe wheat beside it
    let f = 0; for (let k = 0; k < 4; k++) if (DIRS[k][2] === 1 && DIRS[k][0] === 0) f = k;
    setBlock(X + 8, Y, Z + 8, BID.red_bed, f, { noUpdate: true }); setBlock(X + 8, Y, Z + 9, BID.red_bed, f | 4, { noUpdate: true });
    setBlock(X - 8, Y, Z, BID.bell, 0);
    setBlock(X, Y, Z - 8, BID.composter, 0);
    for (let a = 2; a <= 4; a++) { setBlock(X + a, Y - 1, Z - 8, BID.farmland, 7); setBlock(X + a, Y, Z - 8, BID.wheat, 7); }
    const v = spawnMob('villager', X + .5, Y, Z + .5, { prof: 'none' }); v.persistent = true;
    W.time = 3000; await run(500, () => v.job && Math.hypot(v.x - X - .5, v.z - Z + 7.5) < 2.5 && v.prof === 'farmer'); out.work = [v.prof, !!v.job, +Math.hypot(v.x - X - .5, v.z - Z + 7.5).toFixed(1)];
    await run(600); out.harvest = [0, 1, 2].map(i => getMeta(X + 2 + i, Y, Z - 8) & 7); out.food = v.vfood || 0; out.wheatItems = v.wheat || 0;
    for (let a = 5; a <= 6; a++) { setBlock(X + a, Y - 1, Z - 8, BID.farmland, 7); setBlock(X + a, Y, Z - 8, 0); } v.seeds = 4; v.crop = null;
    await run(400, () => getBlock(X + 5, Y, Z - 8) === BID.wheat || getBlock(X + 6, Y, Z - 8) === BID.wheat); out.sown = [getBlock(X + 5, Y, Z - 8) === BID.wheat, getBlock(X + 6, Y, Z - 8) === BID.wheat];
    W.time = 9200; await run(900, () => Math.hypot(v.x - X + 7.5, v.z - Z - .5) < 4.5); out.meet = +Math.hypot(v.x - X + 7.5, v.z - Z - .5).toFixed(1);
    W.time = 12500; await run(800, () => v.sleeping); out.sleep = [!!v.sleeping, v.bed && v.bed.join(',') === [X + 8, Y, Z + 9].join(',')];
    W.time = 24000 + 100; await run(40); out.awake = !v.sleeping;
    // breeding: two willing adults and a free bed (the child takes it)
    for (const bx of [X - 8, X - 10, X - 12]) { setBlock(bx, Y, Z + 8, BID.red_bed, f, { noUpdate: true }); setBlock(bx, Y, Z + 9, BID.red_bed, f | 4, { noUpdate: true }); } // (the parents take two)
    const pa = [0, 1].map(i => { const q = spawnMob('villager', X - 3 + i + .5, Y, Z + 5.5, { prof: 'nitwit' }); q.persistent = true; q.vfood = 12; return q; });
    W.time = 24000 + 500; await run(800, () => { pa[1].x = pa[0].x + 1; pa[1].z = pa[0].z; return ENT.some(q => q.type === 'villager' && q.baby > 0 && !q.dead); }); const kid = ENT.find(q => q.type === 'villager' && q.baby > 0 && !q.dead); out.breed = [!!kid, kid && kid.bed && kid.bed[2] === Z + 9 && [X - 8, X - 10, X - 12].includes(kid.bed[0])];
    // gossip
    hurtMob(v, 0.5, PL); out.rep = v.rep;
    // golem
    for (const e of [...ENT]) if (e.type === 'iron_golem') removeEnt(e);
    const vs = [0, 1, 2].map(i => { const q = spawnMob('villager', X + i + .5, Y, Z + 3.5, { prof: 'nitwit' }); q.persistent = true; q.sleptAt = W.time - 100; return q; });
    W.time = 25000; await run(300, () => { for (const q of vs) q.panic = 40; return ENT.some(e => e.type === 'iron_golem' && !e.dead); }); out.golem = ENT.some(e => e.type === 'iron_golem' && !e.dead);
    // the level badge: a texture of its own per level, put on when it levels up (a stand-in badge, as the jar's isn't here)
    const base = PACKPX.ent.villager; if (base) { const px = new Uint8Array(base.px.length); px[3] = 255; px[0] = 255; PACKPX.ent.vlvl_iron = { px, w: base.w, h: base.h }; }
    const lv = spawnMob('villager', X + 2.5, Y, Z + 2.5, { prof: 'librarian' }); lv.persistent = true; await run(2); const t1 = lv.mesh.userData.mat.map; lv.vlvl = 2; await run(3); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const t2 = lv.mesh.userData.mat.map;
    out.badge = [!!base, t1 !== t2, lv.texLvl, base ? t2.image.data[0] : null];
    PL.mode = 'survival'; return out; });
  ok(r.work[0] === 'farmer' && r.work[1] && r.work[2] < 2.6, 'at work time a villager takes the composter and goes to it', r);
  ok(r.harvest.every(a => a < 7) && r.food > 0, 'the farmer harvests ripe wheat and replants it', r);
  ok(r.sown.some(Boolean), 'the farmer sows empty farmland with its seeds', r);
  ok(r.breed[0] && r.breed[1], 'two willing villagers breed when a bed is free, and the child takes that bed', r);
  ok(r.meet < 5, 'at the meeting time it goes to the bell', r);
  ok(r.sleep[0] && r.sleep[1] && r.awake, 'at night it sleeps in the bed it claimed, and gets up in the morning', r);
  ok(r.rep === -25, 'hitting it gives it a minor_negative 25 opinion', r);
  ok(r.golem, 'three frightened villagers that slept summon an iron golem', r);
  ok(!r.badge[0] || (r.badge[1] && r.badge[2] === 2 && r.badge[3] === 255), 'a level-up puts on the next badge (stone, iron, gold, emerald, diamond)', r.badge);
};
