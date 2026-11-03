// villages and outposts: a saved desert village that got iron ore under its houses (an old bug) gets sand back (only the
// ore above the natural ground, inside the village); outposts follow Java 1.18 - none where a village starts within
// 10 chunks either way, and they stand in the new mountain biomes too (worlds of generator 7 on)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => {
    const o = { gen: W.gen };
    // the old bug, faked: a desert village core over a chunk, iron ore above the ground and some below it
    const G = W.genCache || (W.genCache = S.makeGen(W.seed)), cx = 40, cz = 40, x0 = cx * 16, z0 = cz * 16;
    const hv = S.villageAt, hs = S.hasStructs; S.hasStructs = () => true; S.villageAt = (seed, g, i, j) => i === Math.floor(x0 / (S.VREG * 16)) && j === Math.floor(z0 / (S.VREG * 16)) ? { jig: [1], core: [x0 + 14, z0 + 14, x0 + 24, z0 + 24] } : null;
    const blocks = new Uint16Array(S.CVOL), meta = new Uint8Array(S.CVOL), biome = new Uint8Array(256).fill(S.BIO.DESERT);
    const c = { cx, cz, blocks, meta, biome }, h = G.column(x0 + 14, z0 + 14)[0], at = (x, y, z) => ((y - MINY) << 8) | (z << 4) | x;
    for (let y = h + 1; y <= h + 4; y++) blocks[at(14, y, 14)] = BID.iron_ore; blocks[at(14, h - 3, 14)] = BID.iron_ore; blocks[at(0, h + 2, 0)] = BID.iron_ore; // (0,0) is outside the village and its 12-block edge
    o.changed = fixVillageIron(c);
    o.above = [1, 2, 3, 4].map(k => blocks[at(14, h + k, 14)] === BID.sand); o.below = blocks[at(14, h - 3, 14)] === BID.iron_ore; o.outside = blocks[at(0, h + 2, 0)] === BID.iron_ore;
    S.villageAt = hv; S.hasStructs = hs;
    // outposts against villages, Java's square of 10 chunks
    const vil = []; for (let i = -12; i <= 12; i++) for (let j = -12; j <= 12; j++) { const v = S.villageAt(W.seed, G, i, j); if (v) vil.push(v); }
    let ops = 0, close = 0, mount = 0;
    for (let i = -16; i <= 16; i++) for (let j = -16; j <= 16; j++) { const op = S.outpostAt(W.seed, G, i, j); if (!op) continue; ops++;
      if (vil.some(v => Math.abs((v.x >> 4) - (op.x >> 4)) <= 10 && Math.abs((v.z >> 4) - (op.z >> 4)) <= 10)) close++;
      if (/meadow|grove|slopes|peaks/.test(S.BIOMES[G.column(op.x, op.z)[2]][8])) mount++; }
    Object.assign(o, { villages: vil.length, ops, close, mount });
    return o;
  });
  ok(r.changed && r.above.every(Boolean) && r.below && r.outside, 'a saved desert village: the iron ore above the ground under it turns back to sand, ore underground and outside it stays', r);
  ok(r.gen >= 7 && r.ops > 20 && r.close === 0, 'outposts: none where a village starts within 10 chunks (Java\'s square)', r);
  ok(r.mount > 0, 'outposts stand in the 1.18 mountain biomes too (meadow, grove, slopes, peaks)', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};
