// 1.18 generation under the ground: diamonds get commoner the deeper (most near the bottom, few above y 0); lush caves
// and dripstone caves decorate every cave in their regions, down in the deepslate too
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const out = {}, seed = W.seed, MIN = -64;
    S.setGenVersion(W.gen || 7);
    const band = [0, 0, 0, 0, 0]; // -64..-49, -48..-33, -32..-17, -16..-1, 0..16
    for (let cx = 40; cx < 52; cx++) for (let cz = 40; cz < 52; cz++) { const d = S.genChunk(seed, cx, cz, 0, true);
      for (let i = 0; i < (81 << 8); i++) { const id = d.blocks[i]; if (id === BID.diamond_ore || id === BID.deepslate_diamond_ore) { const y = (i >> 8) + MIN; band[y < -48 ? 0 : y < -32 ? 1 : y < -16 ? 2 : y < 0 ? 3 : 4]++; } } }
    out.band = band;
    const find = f => { for (let r = 0; r < 400; r++) for (const [a, c] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r]]) if (f(seed, a * 16 + 8, c * 16 + 8)) return [a, c]; return null; };
    const tally = (cx, cz, ids) => { const d = S.genChunk(seed, cx, cz, 0, true), n = { deep: 0, up: 0 }; for (let i = 0; i < (120 << 8); i++) if (ids.includes(d.blocks[i])) n[(i >> 8) + MIN < 0 ? 'deep' : 'up']++; return n; };
    const whole = f => (s, x, z) => [0, 16, 32, 47].every(a => [0, 16, 32, 47].every(c => f(s, x - 8 + a, z - 8 + c))); // (the 3 x 3 chunks from there all inside)
    const L = find(whole(S.isLushCaves)), D = find(whole((s, x, z) => S.isDripstoneCaves(s, x, z) && !S.isLushCaves(s, x, z)));
    out.L = L; out.D = D;
    if (L) { let m = { deep: 0, up: 0 }, v = { deep: 0, up: 0 }; for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) { const t = tally(L[0] + a, L[1] + c, [87]), t2 = tally(L[0] + a, L[1] + c, [1044, 1045, 1039, 1040, 1046, 1048]); m.deep += t.deep; m.up += t.up; v.deep += t2.deep; v.up += t2.up; } out.moss = m; out.plants = v; }
    if (D) { let m = { deep: 0, up: 0 }, v = { deep: 0, up: 0 }; for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) { const t = tally(D[0] + a, D[1] + c, [85]), t2 = tally(D[0] + a, D[1] + c, [86]); m.deep += t.deep; m.up += t.up; v.deep += t2.deep; v.up += t2.up; } out.drip = m; out.pointed = v; }
    return out; });
  console.log(JSON.stringify(r));
  const bd = r.band;
  ok(bd[0] > bd[1] && bd[1] > bd[2] && bd[2] > bd[3] && bd[3] > bd[4] && bd[0] > 100, 'diamonds: the deeper the more, most near the bottom', bd);
  ok(r.L && r.moss.deep + r.moss.up > 200 && r.plants.deep + r.plants.up > 20 && r.moss.deep > 0, 'lush caves: moss and plants through the caves, the deep ones too', [r.L, r.moss, r.plants]);
  ok(r.D && r.drip.deep + r.drip.up > 200 && r.pointed.deep + r.pointed.up > 40 && r.drip.deep > 0, 'dripstone caves: dripstone and its spikes through the caves, the deep ones too', [r.D, r.drip, r.pointed]);
};
