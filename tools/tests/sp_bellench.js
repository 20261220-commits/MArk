// a village bell rung by hand sends the villagers who hear it home (to their beds) for a while; the enchanting table
// offers each kind of armour its own enchantments (a helmet, chestplate, leggings and boots in turn aren't all alike)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const out = {};
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z); for (let a = -14; a <= 14; a++) for (let c = -14; c <= 14; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 5; k++) setBlock(X + a, Y + k, Z + c, 0); }
    for (const e of [...ENT]) if (e !== PL) removeEnt(e); W.time = 6000; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.inv = 1e9; UI.paused = false; PL.mode = 'creative';
    const run = async n => { for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); if (i % 5 === 0) await new Promise(r => setTimeout(r, 1)); } };
    setBlock(X, Y, Z - 3, BID.stone); setBlock(X, Y + 1, Z - 3, BID.bell, 0);
    setBlock(X + 10, Y, Z + 9, BID.red_bed, 0, { noUpdate: true }); setBlock(X + 10 + DIRS[0][0], Y, Z + 9 + DIRS[0][2], BID.red_bed, 4); // (the foot, then the head beside it: meta 4)
    const v = spawnMob('villager', X - 6.5, Y, Z - 6.5); v.persistent = true; await run(110); out.bed = v.bed ? [v.bed[0] - X, v.bed[2] - Z] : null;
    v.x = X - 6.5; v.z = Z - 6.5; v.goal = null; const d0 = v.bed ? Math.hypot(v.bed[0] + .5 - v.x, v.bed[2] + .5 - v.z) : -1;
    ringBell(X, Y + 1, Z - 3); out.heard = v.heardBell > W.tickN; out.d0 = +d0.toFixed(1); let dmin = 99, hid = false;
    for (let i = 0; i < 400 && v.heardBell > W.tickN; i++) { await run(1); hid = hid || !!v.hiding; dmin = Math.min(dmin, Math.hypot(v.bed[0] + .5 - v.x, v.bed[2] + .5 - v.z)); } out.d1 = +dmin.toFixed(1); out.hiding = hid;
    await run(5); out.over = !(v.heardBell > W.tickN) && !v.hiding;
    // armour on the table
    setBlock(X + 3, Y, Z, BID.enchanting_table); PL.level = 50; let differ = 0, n = 0; const sets = [];
    for (let s = 0; s < 12; s++) { const offers = ['diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots'].map(k => { UI.openScreen('enchant', { x: X + 3, y: Y, z: Z }); GUI.ctx.items[0] = { id: IID[k], n: 1 }; GUI.ctx.items[1] = { id: IID.lapis_lazuli, n: 3 }; PL.enchSeed = 5000 + s * 17; const l = enchantOptions().list.map(o => JSON.stringify(o.e)); GUI.ctx.items = [null, null]; UI.closeScreen(); return l.join('|'); });
      n++; if (new Set(offers).size >= 3) differ++; if (s < 2) sets.push(offers); }
    out.differ = differ; out.n = n; out.sets = sets;
    return out; });
  ok(r.bed && r.heard && r.d1 < 2.5 && r.d0 > 10 && r.hiding && r.over, 'a villager who hears the bell goes home to its bed and stays till it is over', r);
  ok(r.differ >= r.n - 2, 'the four pieces of armour get their own offers on the enchanting table', [r.differ, r.n, r.sets]);
};
