// animals: a hit wild wolf and its pack turn on the player (and an angry one won't take a bone); bones show smoke or
// hearts; a goat ramming stone loses a horn (dropped as an item, hidden on the model); the horn can be blown, with a
// cooldown; land animals that fall in a pond climb back out
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    const run = async n => { for (let i = 0; i < n; i++) { UI.paused = false; gameTick(); if (i % 4 === 0) await wait(5); } };
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    for (let a = -20; a <= 20; a++) for (let c = -20; c <= 20; c++) { setBlock(X + a, Y - 1, Z + c, BID.grass_block); for (let k = 0; k < 5; k++) setBlock(X + a, Y + k, Z + c, 0); }
    PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.vx = PL.vy = PL.vz = 0; await wait(300);
    for (const e of [...ENT]) if (e.kind === 'mob') removeEnt(e);
    // the pack
    const w1 = spawnMob('wolf', X + 3, Y, Z), w2 = spawnMob('wolf', X + 5, Y, Z + 2), w3 = spawnMob('wolf', X + 30, Y, Z);
    PL.yaw = -Math.PI / 2; hurtMob(w1, 1, PL, 1, 0);
    o.pack = { hit: w1.target === PL, near: w2.target === PL, far: w3.target === PL };
    await run(20); o.stillAngry = w1.target === PL;
    INV.slots[INV.sel] = { id: IID.bone, n: 64 };
    o.angryBone = mobInteract(w1, INV.slots[INV.sel], ITEMS[IID.bone]) === true;
    o.angryBoneLeft = INV.slots[INV.sel].n;
    // bones on a calm wolf: smoke until it's tame
    const w4 = spawnMob('wolf', X - 3, Y, Z); let used = 0;
    for (let i = 0; i < 60 && w4.owner !== 'player'; i++) { INV.slots[INV.sel] = { id: IID.bone, n: 64 }; mobInteract(w4, INV.slots[INV.sel], ITEMS[IID.bone]); used++; }
    o.tamed = w4.owner === 'player'; o.used = used;
    removeEnt(w1); removeEnt(w2); removeEnt(w3); removeEnt(w4);
    // a goat rams a stone wall
    for (let c = -3; c <= 3; c++) for (let k = 0; k < 3; k++) setBlock(X + 6, Y + k, Z + c, BID.stone);
    const g = spawnMob('goat', X + 4.5, Y, Z + .5); PL.x = X + 9.5; PL.z = Z + .5; // the player stands behind the wall
    const items0 = ENT.filter(e => e.kind === 'item' && e.stack && e.stack.id === IID.goat_horn).length;
    for (let tries = 0; tries < 3 && !(g.lostHorns > 0); tries++) { g.ram = 40; g.hitH = false; await run(40); }
    o.goat = { lost: g.lostHorns || 0, drops: ENT.filter(e => e.kind === 'item' && e.stack && e.stack.id === IID.goat_horn).length - items0 };
    mobHeldTick(); const P = g.mesh.userData.parts; o.goat.hornHidden = P.horn2 ? !P.horn2.visible : 'no part'; o.goat.saved = MOBDEF.goat.save(g).lostHorns;
    removeEnt(g);
    // blowing the horn
    PL.x = X + .5; PL.z = Z + .5; PL.pitch = 1.2; INV.slots[INV.sel] = { id: IID.goat_horn, n: 1 }; TARGET = null;
    o.hornName = itemName(IID.goat_horn); useItem(true); const t1 = PL.hornT; useItem(true); o.horn = { blown: t1 > performance.now() + 6000, cooldownKept: PL.hornT === t1 };
    // animals in a pond
    for (let a = -3; a <= 3; a++) for (let c = -3; c <= 3; c++) { setBlock(X + a, Y - 1, Z + c, BID.water); setBlock(X + a, Y - 2, Z + c, BID.dirt); }
    PL.x = X + 15.5; PL.z = Z + 15.5;
    const herd = ['cow', 'sheep', 'pig', 'chicken', 'goat'].map(t => spawnMob(t, X + .5, Y - 1, Z + .5)); herd.forEach(e => e.persistent = true);
    await run(600);
    o.pond = herd.map(e => [e.type, Math.max(Math.abs(e.x - X - .5), Math.abs(e.z - Z - .5)) > 3.6 ? 'out' : 'in']);
    return o; });
  ok(r.pack.hit && r.pack.near && !r.pack.far, 'a hit wolf and its pack (not a far one) target the player', r.pack);
  ok(r.stillAngry, 'the pack stays angry for a while', r);
  ok(!r.angryBone && r.angryBoneLeft === 64, 'an angry wolf will not take a bone', r);
  ok(r.tamed && r.used > 0, 'bones tame a calm wolf', r);
  ok(r.goat.lost === 1 && r.goat.drops === 1 && r.goat.hornHidden === true && r.goat.saved === 1, 'a goat ramming stone loses one horn (dropped, hidden, saved)', r.goat);
  ok(r.hornName === '염소 뿔' && r.horn.blown && r.horn.cooldownKept, 'the goat horn can be blown, then waits', r);
  ok(r.pond.filter(([, w]) => w === 'out').length >= 4, 'animals climb out of a pond', r.pond);
  ok(!p.errs.length, 'no page errors', p.errs);
};
