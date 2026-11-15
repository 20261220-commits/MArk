// A saved End chunk out on the outer islands from before they were Java's (one a player changed, so its blocks were
// stored) takes the new ground when it loads again; what the player changed stays
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const o = {}, seed = W.seed;
    let cx = 100, cz = 0, best = null; // a chunk whose ground the change moves a lot
    for (let k = 0; k < 40 && !best; k++, cx++) { S.setLegacy({ endisl: 1 }); const a = S.genChunk(seed, cx, cz, 1, true); S.setLegacy({}); const n = S.genChunk(seed, cx, cz, 1, true); let diff = 0; for (let i = 0; i < a.blocks.length; i++) if (a.blocks[i] !== n.blocks[i]) diff++; if (diff > 500) best = { cx, a, n, diff }; }
    o.diff = best.diff;
    const B = best.a.blocks.slice(), M = best.a.meta.slice(), gi = ((120 + 64) << 8) | (5 << 4) | 5; B[gi] = BID.glass; // the player's glass up in the air
    const res = S.fixSaved({ seed, cx: best.cx, cz, dim: 1, exp: true, blocks: B, meta: M });
    let same = 0, other = 0; for (let i = 0; i < res.blocks.length; i++) { if (i === gi) continue; if (res.blocks[i] === best.n.blocks[i]) same++; else other++; }
    o.after = { changed: res.changed, other, glass: res.blocks[gi] === BID.glass };
    return o; });
  console.log(JSON.stringify(r));
  ok(r.diff > 500 && r.after.changed > 400 && r.after.other === 0, 'the old ground becomes the new ground', r);
  ok(r.after.glass, 'what the player put there stays', r.after);
  ok(!p.errs.length, 'no page errors', p.errs);
};
