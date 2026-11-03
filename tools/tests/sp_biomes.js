// Java 1.18's biome layout (world generator 4): the noise building blocks (MD5, Xoroshiro), the OverworldBiomeBuilder
// table answering known climate points, and the share of ocean and land over a wide area of a new world
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv);
  const r = await p.evaluate(() => {
    const o = {};
    o.md5 = S.jMd5 ? S.jMd5('abc').map(x => x.toString(16).padStart(2, '0')).join('') : null;
    const k = (T, H, C, E, W) => S.jBiomeKey({ T, H, C, E, W });
    o.points = {
      forest: k(0, 0, 0.2, 0.2, 0.1), ocean: k(0, 0, -0.3, 0, 0.1), deep: k(-0.6, 0, -0.6, 0, 0.1), mushroom: k(0, 0, -1.1, 0, 0), frozenPeaks: k(-0.6, 0, 0.5, -0.9, 0.65),
      jaggedPeaks: k(-0.6, 0, 0.5, -0.9, -0.65), river: k(0, 0, 0, 0, 0), swamp: k(0, 0, 0.2, 0.7, 0.3), desert: k(0.7, 0, 0.2, 0.2, 0.1), badlands: k(0.7, 0, 0.5, -0.3, -0.5),
      beach: k(0, 0, -0.15, 0.2, -0.1), stonyShore: k(0, 0, -0.15, -0.5, 0.3), windswept: k(-0.3, -0.5, 0.5, 0.5, 0.3), savanna: k(0.4, -0.5, 0.0, 0.5, 0.3), meadow: k(-0.3, -0.5, 0.5, -0.3, 0.3),
    };
    S.setGenVersion(4); const G = S.makeGen(12345); let ocean = 0, n = 0; const seen = new Set();
    for (let x = -40000; x < 40000; x += 800) for (let z = -40000; z < 40000; z += 800) { const key = S.BIOMES[G.column(x, z)[2]][8]; seen.add(key); n++; if (/ocean/.test(key)) ocean++; }
    o.ocean = +(ocean / n * 100).toFixed(1); o.kinds = seen.size;
    // generator 5: the ground from Java's TerrainShaper - plains near 66, ocean floors near 48, deep ones near 35, peaks high
    S.setGenVersion(5); const G5 = S.makeGen(12345), byB = {};
    for (let x = -30000; x < 30000; x += 400) for (let z = -30000; z < 30000; z += 400) { const r = G5.column(x, z), k = S.BIOMES[r[2]][8]; (byB[k] = byB[k] || []).push(r[0]); }
    const med = k => { const v = (byB[k] || []).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : null; }, mx = k => Math.max(...(byB[k] || [0]));
    o.h5 = { plains: med('plains'), ocean: med('ocean'), deep: med('deep_ocean'), meadow: med('meadow'), peaks: Math.max(mx('jagged_peaks'), mx('frozen_peaks'), mx('stony_peaks')) };
    return o;
  });
  ok(r.md5 === '900150983cd24fb0d6963f7d28e17f72', 'MD5 as Java hashes noise names', r.md5);
  const P = r.points;
  ok(P.forest === 'forest' && P.ocean === 'ocean' && P.deep === 'deep_frozen_ocean' && P.mushroom === 'mushroom_fields' && P.river === 'river', 'the biome table: forest, oceans, mushroom fields, river', P);
  ok(P.frozenPeaks === 'frozen_peaks' && P.jaggedPeaks === 'jagged_peaks' && P.swamp === 'swamp' && P.desert === 'desert' && P.badlands === 'badlands', 'the biome table: peaks, swamp, desert, badlands', P);
  ok(P.beach === 'beach' && P.stonyShore === 'stone_shore' && P.windswept === 'gravelly_mountains' && P.savanna === 'shattered_savanna' && P.meadow === 'meadow', 'the biome table: beach, stony shore, windswept, meadow', P);
  ok(r.ocean > 25 && r.ocean < 45 && r.kinds >= 35, 'a third of the world is ocean, with most biomes found', [r.ocean, r.kinds]);
  const h = r.h5; ok(h.plains >= 63 && h.plains <= 72 && h.ocean >= 42 && h.ocean <= 55 && h.deep >= 28 && h.deep <= 42 && h.meadow > 90 && h.peaks > 190, 'generator 5 heights as Java shapes them: plains, oceans, deep oceans, meadows, peaks', h);
  ok(!p.errs.length, 'no page errors', p.errs);
};
