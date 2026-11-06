// monsters spawn as Java's NaturalSpawner: never in or on water (drowned excepted, in oceans and rivers only), never in
// block light, packs of the biome's kinds, at most 70 for 17 x 17 chunks; land monsters out for a stroll keep out of water
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms)), out = {};
    PL.mode = 'creative'; PL.flying = true; PL.y = 90; W.time = 18000; W.rain = 0; PL.difficulty = 2;
    for (let i = 0; i < 200; i++) { UI.paused = false; W.time = 18000; gameTick(); if (i % 10 === 0) await wait(20); }
    for (const e of [...ENT]) if (e.kind === 'mob' && e.def.hostile) removeEnt(e);
    PL.mode = 'survival'; const bad = [], kinds = {}; let maxN = 0, cap = 0;
    const seen = new Set(), at = new Map(); const sm0 = spawnMob; window.spawnMob = function (t, x, y, z, o) { const e = sm0.apply(this, arguments); if (e) at.set(e, [getLight(Math.floor(x), Math.floor(y), Math.floor(z)) & 15, new Error().stack.split('\n').slice(2, 4).join('|').replace(/http[^ )]*\//g, '')]); return e; };
    for (let t = 0; t < 600; t++) { W.time = 18000; trySpawnHostile();
      for (const e of ENT) if (e.kind === 'mob' && e.def.hostile && !seen.has(e) && at.has(e)) { seen.add(e); kinds[e.type] = (kinds[e.type] || 0) + 1;
        const bx = Math.floor(e.x), by = Math.floor(e.y), bz = Math.floor(e.z), inW = FLUID[getBlock(bx, by, bz)] === 1, onW = FLUID[getBlock(bx, by - 1, bz)] === 1;
        if (e.type !== 'drowned' && (inW || onW)) bad.push(['water', e.type, bx, by, bz, BLOCKS[getBlock(bx, by, bz)].key, BLOCKS[getBlock(bx, by - 1, bz)].key, +e.y.toFixed(2), e.age]); if (e.type !== 'slime' && (getLight(bx, by, bz) & 15) > 0) bad.push(['lit', e.type, at.get(e)]);
        if (e.type === 'drowned') { const bb = biomeBase(bx, bz); if (!S.isOceanBio(bb) && bb !== S.BIO.RIVER) bad.push(['drowned-biome', bb]); } }
      let near = 0; for (let cx = (Math.floor(PL.x) >> 4) - 8; cx <= (Math.floor(PL.x) >> 4) + 8; cx++) for (let cz = (Math.floor(PL.z) >> 4) - 8; cz <= (Math.floor(PL.z) >> 4) + 8; cz++) if (chunkAt(cx, cz)) near++;
      cap = Math.floor(70 * near / 289); maxN = Math.max(maxN, countMobs(e => e.def.hostile && !e.persistent)); }
    out.spawn = { n: seen.size, bad: bad.slice(0, 5), nbad: bad.length, kinds, maxN, cap };
    // a zombie wandering by a pond stays dry
    PL.mode = 'creative'; for (const e of [...ENT]) if (e.kind === 'mob') removeEnt(e);
    const X = Math.floor(PL.x) + 30, Z = Math.floor(PL.z), Y = 200;
    for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) { setBlock(X + a, Y - 1, Z + c, BID.grass_block); setBlock(X + a, Y - 2, Z + c, BID.stone); }
    for (let a = -8; a <= 8; a++) for (let c = 1; c <= 8; c++) setBlock(X + a, Y - 1, Z + c, BID.water); // half of the floor is a pond
    for (let a = -9; a <= 9; a++) for (const c of [-9, 9]) for (let k = 0; k < 3; k++) { setBlock(X + a, Y + k, Z + c, BID.glass); setBlock(X + c, Y + k, Z + a, BID.glass); }
    W.time = 6000; const z = spawnMob('husk', X + .5, Y, Z - 4.5); z.persistent = true; let wet = 0;
    for (let i = 0; i < 1500; i++) { UI.paused = false; gameTick(); if (z.inWater) wet++; if (i % 50 === 0) await wait(10); }
    out.wander = wet;
    return out; });
  ok(r.spawn.n > 5, 'monsters spawn at night', r.spawn);
  ok(r.spawn.nbad === 0, 'none in or on water (drowned only in oceans and rivers) and none in block light', r.spawn);
  ok(r.spawn.maxN <= r.spawn.cap + 4, "the number stays at Java's cap (70 for 17 x 17 chunks)", r.spawn);
  ok(r.wander < 30, 'a monster strolling beside a pond stays out of it', r.wander);
};
