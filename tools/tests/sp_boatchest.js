// every boat places with something in the off hand; the paddles rest down in the water; chests are Java's model: a
// large chest is one long chest drawn from its left half, the lid opens while the chest is open and shuts after
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const run = async n => { for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); if (i % 3 === 0) await wait(5); } };
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) { setBlock(X + a, Y - 2, Z + c, BID.stone); setBlock(X + a, Y - 1, Z + c, a > 0 ? BID.water : BID.stone); for (let k = 0; k < 4; k++) setBlock(X + a, Y + k, Z + c, 0); }
    await wait(200); o.boats = {};
    for (const w of ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak']) {
      for (const e of [...ENT]) if (e.kind === 'boat') removeEnt(e);
      PL.yaw = -Math.PI / 2; PL.pitch = -0.6; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; INV.slots[INV.sel] = { id: IID[w + '_boat'], n: 1 }; INV.off = { id: IID.torch, n: 5 };
      UI.paused = false; gameTick(); USE.placeCd = 0; IN.use = true; onUsePress(); gameTick(); IN.use = false; if (typeof onUseRelease === 'function') onUseRelease();
      o.boats[w] = [ENT.filter(e => e.kind === 'boat' && e.wood === w).length, INV.off.n];
    }
    INV.off = null;
    // a resting paddle: its blade end lower than its handle
    const bt = ENT.find(e => e.kind === 'boat'); await run(3); bt.mesh.updateMatrixWorld(true);
    const pad = bt.mesh.userData.parts.lpaddle; if (pad) { const a = new THREE.Vector3(0, 0, 0).applyMatrix4(pad.matrixWorld), z = new THREE.Vector3(0, 0, 1).applyMatrix4(pad.matrixWorld), z2 = new THREE.Vector3(0, 0, -1).applyMatrix4(pad.matrixWorld); o.paddle = [+(a.y).toFixed(2), +(z.y - a.y).toFixed(2), +(z2.y - a.y).toFixed(2)]; }
    for (const e of [...ENT]) if (e.kind === 'boat') removeEnt(e);
    // chests
    for (let a = -4; a <= 4; a++) for (let c = -4; c <= 4; c++) setBlock(X + a, Y - 1, Z + c, BID.stone);
    const put = (id, x) => { PL.x = x + .5; PL.y = Y; PL.z = Z + 3.5; PL.yaw = 0; PL.pitch = -0.7; INV.slots[INV.sel] = { id, n: 1 }; const T = { type: 'block', x, y: Y - 1, z: Z, id: BID.stone, m: 0, nx: 0, ny: 1, nz: 0, t: 2, hy: 1 }; TARGET = T; USE.placeCd = 0; placeBlock(T, ITEMS[id]); };
    put(BID.chest, X - 3); put(BID.chest, X); put(BID.chest, X + 1);
    PL.x = X + .5; PL.z = Z + 3.5; await run(12);
    const models = [...CHESTS.m.values()].map(s => [s.x - X, s.v & 1]).sort((a, b) => a[0] - b[0]); o.models = models;
    const big = [...CHESTS.m.values()].find(s => s.v & 1);
    openChest(X + 1, Y, Z); await run(8); o.openT = big ? +big.t.toFixed(2) : null; o.lidRot = big ? +big.g.userData.hinge.rotation.x.toFixed(2) : null; o.screen = UI.screen;
    UI.closeScreen(); await run(8); o.shutT = big ? big.t : null;
    setBlock(X - 3, Y, Z, 0); await run(6); o.afterBreak = CHESTS.m.size;
    return o; });
  ok(Object.values(r.boats).every(([n, off]) => n === 1 && off === 5), 'every kind of boat places with a torch in the off hand (the torch stays)', r.boats);
  ok(r.paddle && r.paddle[1] < 0, 'a resting paddle points down toward the water', r.paddle);
  ok(JSON.stringify(r.models) === JSON.stringify([[-3, 0], [0, 1]]), 'a single chest and a large chest (one model, from its left half)', r.models);
  ok(r.screen === 'chest' && r.openT === 1 && r.lidRot < -1.4, 'the large chest\'s lid opens while it is open', r);
  ok(r.shutT === 0, 'and shuts when the screen closes', r);
  ok(r.afterBreak === 1, 'a broken chest\'s model goes', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};
