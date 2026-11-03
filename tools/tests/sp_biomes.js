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
    return o;
  });
  ok(r.md5 === '900150983cd24fb0d6963f7d28e17f72', 'MD5 as Java hashes noise names', r.md5);
  const P = r.points;
  ok(P.forest === 'forest' && P.ocean === 'ocean' && P.deep === 'deep_frozen_ocean' && P.mushroom === 'mushroom_fields' && P.river === 'river', 'the biome table: forest, oceans, mushroom fields, river', P);
  ok(P.frozenPeaks === 'frozen_peaks' && P.jaggedPeaks === 'jagged_peaks' && P.swamp === 'swamp' && P.desert === 'desert' && P.badlands === 'badlands', 'the biome table: peaks, swamp, desert, badlands', P);
  ok(P.beach === 'beach' && P.stonyShore === 'stone_shore' && P.windswept === 'gravelly_mountains' && P.savanna === 'shattered_savanna' && P.meadow === 'meadow', 'the biome table: beach, stony shore, windswept, meadow', P);
  ok(r.ocean > 25 && r.ocean < 45 && r.kinds >= 35, 'a third of the world is ocean, with most biomes found', [r.ocean, r.kinds]);
  ok(!p.errs.length, 'no page errors', p.errs);
};
