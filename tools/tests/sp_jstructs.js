// the structures Java builds from code, grown from Java's own pieces: a stronghold (its piece kinds, one portal room with
// 12 frames and the silverfish spawner over the stairs, library and corridor chests), a nether fortress (bridges and
// castle, blaze spawners on the thrones), a mineshaft (a dirt room, corridors, crossings, stairs) and a jungle temple
// (two arrow traps, the main chest, the lever puzzle and its hidden chest)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(() => { const out = {}, seed = 12345;
    const count = (dim, box, ids) => { const n = {}, tiles = {}; for (let cx = box[0] >> 4; cx <= box[3] >> 4; cx++) for (let cz = box[2] >> 4; cz <= box[5] >> 4; cz++) { const d = S.genChunk(seed, cx, cz, dim);
      for (const t of d.tiles) { const k = t.t + (t.mob ? ':' + t.mob : '') + (t.cart ? ':cart' : ''); tiles[k] = (tiles[k] || 0) + 1; }
      for (let i = 0; i < d.blocks.length; i++) { const k = ids[d.blocks[i]]; if (k) n[k] = (n[k] || 0) + 1; } } return { n, tiles }; };
    const bounds = L => L.reduce((a, q) => [Math.min(a[0], q.box[0]), Math.min(a[1], q.box[1]), Math.min(a[2], q.box[2]), Math.max(a[3], q.box[3]), Math.max(a[4], q.box[4]), Math.max(a[5], q.box[5])], [1e9, 1e9, 1e9, -1e9, -1e9, -1e9]);
    const kinds = L => { const k = {}; for (const q of L) k[q.type] = (k[q.type] || 0) + 1; return k; };
    // stronghold
    const [sx, , sz] = S.strongholdsOf(seed)[0], SH = S.assembleStronghold(seed, sx - 6, sz - 6), pr = SH.find(q => q.type === 'PortalRoom');
    out.sh = { kinds: kinds(SH), y: [bounds(SH)[1], bounds(SH)[4]] };
    const c1 = count(0, pr.box, { [BID.end_portal_frame]: 'frame' }); out.sh.portal = [c1.n.frame || 0, c1.tiles['spawner:silverfish'] || 0];
    out.sh.inside = S.inStrongholdPieces(seed, (pr.box[0] + pr.box[3]) >> 1, pr.box[1] + 2, (pr.box[2] + pr.box[5]) >> 1);
    // fortress: the first one around with a throne
    let NF = null; for (let a = -6; a < 6 && !NF; a++) for (let c = -6; c < 6 && !NF; c++) { const f = S.fortressAt(seed, a, c); if (!f) continue; const L = S.assembleFortress(seed, f.x - 6, f.z - 6); if (L.some(q => q.type === 'MonsterThrone')) NF = L; }
    const th = NF.find(q => q.type === 'MonsterThrone'), c2 = count(-1, th.box, { [BID.nether_bricks]: 'nb' });
    out.nf = { kinds: kinds(NF), blaze: c2.tiles['spawner:blaze'] || 0, bricks: c2.n.nb || 0, y: bounds(NF)[1], inside: S.inFortressPieces(seed, (th.box[0] + th.box[3]) >> 1, th.box[1] + 3, (th.box[2] + th.box[5]) >> 1) };
    // mineshaft
    const MS = S.assembleMineshaft(seed, 3, 3, false), room = MS[0]; out.ms = { kinds: kinds(MS), top: bounds(MS)[4] };
    // jungle temple
    const G = S.makeGen(1); let o = null; for (let a = -12; a < 12 && !o; a++) for (let c = -12; c < 12 && !o; c++) o = S.templeAt(1, G, 'jungle', a, c);
    if (o) { const n = {}, tiles = {}; for (let cx = ((o.x - 8) >> 4) - 1; cx <= ((o.x - 8) >> 4) + 1; cx++) for (let cz = ((o.z - 8) >> 4) - 1; cz <= ((o.z - 8) >> 4) + 1; cz++) { const d = S.genChunk(1, cx, cz, 0);
        for (const t of d.tiles) tiles[t.t] = (tiles[t.t] || 0) + 1; for (let i = 0; i < d.blocks.length; i++) { const id = d.blocks[i]; if (id === BID.lever) n.lever = (n.lever || 0) + 1; if (id === BID.sticky_piston) n.piston = (n.piston || 0) + 1; if (id === BID.tripwire_hook_block) n.hook = (n.hook || 0) + 1; } }
      out.jt = { tiles, n }; }
    return out; });
  const k = r.sh.kinds;
  ok(k.Start === 1 && k.PortalRoom === 1 && (k.Library || 0) <= 2 && k.Straight > 0 && k.FiveCrossing > 0 && r.sh.y[1] <= 53, 'a stronghold is grown from Java\'s pieces (one portal room, at most two libraries), under sea level', r.sh);
  ok(r.sh.portal[0] === 12 && r.sh.portal[1] === 1 && r.sh.inside, 'its portal room has the 12 frames and the silverfish spawner', r.sh);
  ok(r.nf.kinds.BridgeCrossing >= 1 && r.nf.blaze >= 1 && r.nf.bricks > 50 && r.nf.y >= 48 && r.nf.inside, 'a nether fortress: bridges and castle from Java\'s pieces, a blaze spawner on its throne, between y 48 and 70', r.nf);
  ok(r.ms.kinds.Room === 1 && r.ms.kinds.Corridor > 0 && r.ms.top <= 53, 'a mineshaft: one dirt room, corridors, crossings and stairs, below sea level', r.ms);
  ok(r.jt && r.jt.tiles.dispenser === 2 && r.jt.tiles.chest === 2 && r.jt.n.lever === 3 && r.jt.n.piston === 3 && r.jt.n.hook === 4, 'a jungle temple: two arrow traps, the main chest, the lever puzzle and the hidden chest', r.jt);
};
