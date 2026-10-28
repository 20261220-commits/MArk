// armour, hunger, redstone, fluids, portals, light
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const r = await p.evaluate(async () => { const out = {}, wait = ms => new Promise(r => setTimeout(r, ms)); PL.mode = 'survival';
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    for (let a = -6; a <= 6; a++) for (let c = -6; c <= 6; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let y = 0; y < 5; y++) setBlock(X + a, Y + y, Z + c, 0); }
    PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.vy = 0;
    INV.armor = ['diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots'].map(k => ({ id: IID[k], n: 1 }));
    PL.health = 20; PL.inv = 0; hurtPlayer(10, 'mob'); out.diamond10 = +(20 - PL.health).toFixed(2); INV.armor.fill(null);
    PL.health = 10; PL.food = 17; PL.sat = 0; PL.exh = 0; for (let i = 0; i < 40; i++) { UI.paused = false; await wait(50); } out.regen17 = PL.health - 10;
    PL.health = 10; PL.food = 20; PL.sat = 5; for (let i = 0; i < 40; i++) { UI.paused = false; await wait(50); } out.regen20 = PL.health - 10;
    PL.health = 20; PL.inv = 0; PL.y = Y + 10; PL.vy = 0; PL.fallDist = 0; PL.onGround = false; PL.food = 0; PL.sat = 0; let hp0 = 20; for (let i = 0; i < 80 && !PL.onGround; i++) { UI.paused = false; await wait(50); } await wait(100); out.fall10 = 20 - PL.health;
    PL.food = 20; PL.health = 20;
    const use = (item, t) => { INV.slots[INV.sel] = item ? { id: IID[item], n: 4 } : null; TARGET = { type: 'block', ...t, id: getBlock(t.x, t.y, t.z), m: getMeta(t.x, t.y, t.z), t: 2 }; USE.placeCd = 0; useItem(true); };
    setBlock(X + 3, Y, Z, BID.redstone_lamp); const lamp0 = getBlock(X + 3, Y, Z); use('lever', { x: X + 4, y: Y - 1, z: Z, nx: 0, ny: 1, nz: 0 }); use(null, { x: X + 4, y: Y, z: Z, nx: 0, ny: 1, nz: 0 }); await wait(500);
    out.lamp = { changed: getBlock(X + 3, Y, Z) !== lamp0 || getMeta(X + 3, Y, Z) !== 0, emits: S.emitOf(getBlock(X + 3, Y, Z), getMeta(X + 3, Y, Z)) };
    setBlock(X - 3, Y, Z, BID.lava); setBlock(X - 3, Y, Z + 1, BID.water); for (let i = 0; i < 60; i++) { UI.paused = false; await wait(50); } out.obsidian = getBlock(X - 3, Y, Z) === BID.obsidian;
    const px = X, pz = Z - 4; for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) if (i === 0 || i === 3 || j === 0 || j === 4) setBlock(px + i, Y + j - 1, pz, BID.obsidian);
    INV.slots[INV.sel] = { id: IID.flint_and_steel, n: 1 }; TARGET = { type: 'block', x: px + 1, y: Y - 1, z: pz, id: BID.obsidian, m: 0, nx: 0, ny: 1, nz: 0, t: 2 }; USE.placeCd = 0; useItem(true);
    out.portal = getBlock(px + 1, Y, pz) === BID.nether_portal && getBlock(px + 2, Y + 2, pz) === BID.nether_portal; const ox = PL.x;
    PL.x = px + 1.5; PL.z = pz + .5; PL.y = Y; for (let i = 0; i < 200 && W.dim === 0; i++) { UI.paused = false; await wait(50); } await wait(5000); showMenu(null); UI.paused = false; await wait(500);
    out.nether = { dim: W.dim, inPortal: getBlock(Math.floor(PL.x), Math.floor(PL.y), Math.floor(PL.z)) === BID.nether_portal, stuck: !!OPQ[getBlock(Math.floor(PL.x), Math.floor(PL.y + 1.5), Math.floor(PL.z))], xScaled: Math.abs(PL.x - (px + 1.5) / 8) < 24 };
    // light: random torches, glowstone and blocks keep block light consistent
    switchDim(0, X + .5, Y + 2, Z + .5); await wait(6000); showMenu(null); UI.paused = false;
    let seed = 7; const rn = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const ids = [0, 0, BID.stone, BID.glowstone, BID.sea_lantern, BID.torch, BID.redstone_torch, BID.soul_torch, BID.glass];
    for (let it = 0; it < 2000; it++) { const x = X - 5 + rn(11), z = Z - 5 + rn(11), y = Y + rn(3), id = ids[rn(ids.length)]; if ((id === BID.torch || id === BID.redstone_torch || id === BID.soul_torch) && !getBlock(x, y - 1, z)) continue; setBlock(x, y, z, id, 0); }
    let badL = 0; for (let x = X - 5; x <= X + 5; x++) for (let z = Z - 5; z <= Z + 5; z++) for (let y = Y; y < Y + 4; y++) { const id = getBlock(x, y, z), op = LOP[id], l = getLight(x, y, z) & 15; let want = S.emitOf(id, getMeta(x, y, z));
      if (op < 15) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) want = Math.max(want, (getLight(x + dx, y + dy, z + dz) & 15) - Math.max(1, op)); if (l !== want) badL++; }
    out.lightBad = badL;
    return out; });
  ok(r.diamond10 === 3, 'full diamond armour takes a 10 hit down to 3', r.diamond10);
  ok(r.regen17 === 0 && r.regen20 > 1, 'no natural regeneration under 18 food, regeneration at 20', [r.regen17, r.regen20]);
  ok(r.fall10 === 7, 'a 10 block fall deals 7', r.fall10);
  ok(r.lamp.changed && r.lamp.emits > 0, 'a lever lights a redstone lamp', r.lamp);
  ok(r.obsidian, 'water on a lava source makes obsidian');
  ok(r.portal, 'flint and steel lights an obsidian frame');
  ok(r.nether.dim === -1 && r.nether.inPortal && !r.nether.stuck && r.nether.xScaled, 'the portal leads into a portal in the Nether at 1/8 the distance', r.nether);
  ok(r.lightBad === 0, '2000 random light-source edits leave block light consistent', r.lightBad);
  ok(!p.errs.length, 'no page errors', p.errs);
};
