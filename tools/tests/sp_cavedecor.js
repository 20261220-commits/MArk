// Lush and dripstone caves decorated as Java's features do: most of a lush cave's floor moss with plants on it, its
// ceiling mossy with long cave vines (some with glow berries), clay pools; a dripstone cave's spikes meeting tip to tip
// into columns and growing in thickness from tip to base
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const o = {}, I = (x, y, z) => ((y + 64) << 8) | (z << 4) | x;
    const plant = q => q === 1043 || q === 29 || q === 1110 || q === 1039 || q === 1040 || q === 1045 || q === 1046 || q === 1047 || q === 1048;
    let floors = 0, moss = 0, onMoss = 0, vines = 0, berries = 0, longVine = 0, clay = 0, roots = 0;
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) { const B = S.genChunk(W.seed, -74 + a, -74 + c, 0, true).blocks, M = S.genChunk(W.seed, -74 + a, -74 + c, 0, true).meta;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { let run = 0; for (let y = -55; y < 60; y++) { const b = B[I(x, y, z)], below = B[I(x, y - 1, z)];
        if ((b === 0 || plant(b) || b === 1044) && below && below !== 27 && !plant(below) && below !== 1044) { floors++; if (below === 87) { moss++; if (plant(b)) onMoss++; } }
        if (b === 1044) { vines++; if (M[I(x, y, z)] & 1) berries++; run++; longVine = Math.max(longVine, run); } else run = 0;
        if (b === 53) clay++; if (b === 1049 || b === 1050) roots++; } } }
    o.lush = { floors, moss, pct: Math.round(moss / floors * 100), onMoss, vines, berries, longVine, clay, roots };
    let merge = 0, thick = 0;
    for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) { const d = S.genChunk(W.seed, 20 + a, 0 + c, 0, true), B = d.blocks, M = d.meta;
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) for (let y = -60; y < 60; y++) { const i = I(x, y, z); if (B[i] !== 86) continue; const up = M[i] & 1;
        if (!up && B[I(x, y - 1, z)] === 86 && (M[I(x, y - 1, z)] & 1)) merge++; // a hanging one over a standing one: tip to tip
        if (!up && B[I(x, y + 1, z)] === 86 && B[I(x, y + 2, z)] === 86) thick++; } }
    o.drip = { merge, thick, tiles: ['tip', 'tip_merge', 'frustum', 'middle', 'base'].every(t => S.T['pointed_dripstone_down_' + t] != null && S.T['pointed_dripstone_up_' + t] != null) };
    return o; });
  console.log(JSON.stringify(r));
  ok(r.lush.pct >= 45 && r.lush.onMoss > r.lush.moss * 0.5, 'a lush cave\'s floor: mostly moss, with plants on it', r.lush);
  ok(r.lush.vines > 300 && r.lush.berries > r.lush.vines * 0.1 && r.lush.longVine >= 8 && r.lush.clay > 30, 'long cave vines (glow berries one in five), clay pools', r.lush);
  ok(r.drip.merge > 5 && r.drip.thick > 20 && r.drip.tiles, 'dripstone spikes meeting tip to tip, long ones with their ten shapes', r.drip);
  ok(!p.errs.length, 'no page errors', p.errs);
};
