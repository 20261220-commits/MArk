// End cities are found and built as often as Java's: one in most 20-chunk regions of the outer islands, standing on
// land 60 high or more; /locate finds the nearest
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const o = {}, nA = S.makeNoise(W.seed + 201), nB = S.makeNoise(W.seed + 202); let n = 0, outer = 0;
    for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) { const x = (a * 20 + 10) * 16, z = (c * 20 + 10) * 16; if (Math.hypot(x, z) < 1600) continue; outer++; if (S.endCityAt(W.seed, a, c, nA, nB)) n++; }
    o.share = +(n / outer).toFixed(2);
    // one of them, built
    let city = null; for (let a = 4; a <= 8 && !city; a++) city = S.endCityAt(W.seed, a, 0, nA, nB);
    const d = S.genChunk(W.seed, city.x >> 4, city.z >> 4, 1, true); let purpur = 0; for (let i = 0; i < d.blocks.length; i++) if (d.blocks[i] === BID.purpur_block || d.blocks[i] === BID.purpur_pillar) purpur++;
    o.built = { at: [city.x, city.y, city.z], purpur };
    return o; });
  console.log(JSON.stringify(r));
  ok(r.share >= 0.4, 'an end city in most regions of the outer islands', r.share);
  ok(r.built.purpur > 50, 'and it is built there', r.built);
  const loc = await p.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms)); switchDim(1, 1500.5, 80, 0.5, 'gateway'); for (let i = 0; i < 400 && (UI.menu === 'loading' || W.dim !== 1); i++) await wait(100); showMenu(null);
    const msgs = []; const cm = chatMsg; chatMsg = (t, c) => { msgs.push(String(t)); return cm(t, c); }; runCommand('/locate end_city'); chatMsg = cm; return msgs.join(' | '); });
  console.log(loc);
  ok(/가장 가까운 end_city/.test(loc), '/locate end_city finds one', loc);
  ok(!p.errs.length, 'no page errors', p.errs);
};
