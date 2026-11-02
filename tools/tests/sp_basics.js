// basic rules checked against Java: large chests (two chests side by side), stacks that only merge when everything they
// carry matches, shift-click order out of a chest, furnace fuel and charcoal from every log, /fill modes and /summon at a
// place, Easy/Hard mob damage, and the 1.18 changes (copper ore drops, lush caves in every new world)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(async () => {
    const o = {}, X = Math.floor(PL.x) + 3, Y = 150, Z = Math.floor(PL.z);
    for (let a = -3; a <= 8; a++) for (let c = -3; c <= 8; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let k = 0; k < 6; k++) setBlock(X + a, Y + k, Z + c, 0); }
    const put = (x, z, bl, f) => { setBlock(x, Y, z, bl, f); setTile(x, Y, z, { type: 'chest', items: new Array(27).fill(null) }); chestJoin(x, Y, z); };
    // large chests
    put(X, Z, BID.chest, 0); put(X + 1, Z, BID.chest, 0); const pr = chestPair(X, Y, Z);
    interactBlock({ type: 'block', x: X, y: Y, z: Z, id: BID.chest, m: 0 }); o.big = { slots: GUI.slots.filter(s => s.group === 'cont').length, title: GUI.ctx.title, both: !!chestPair(X + 1, Y, Z) };
    const k0 = GUI.slots.findIndex(s => s.group === 'cont'); INV.cursor = { id: IID.diamond, n: 3 }; clickSlot(k0 + 30, 0, false); UI.closeScreen();
    o.secondHalf = !!(pr && getTile(...pr.right).items[3]);
    put(X + 2, Z, BID.chest, 0); o.third = chestPair(X + 2, Y, Z); // beside a large chest: stays single
    put(X + 4, Z + 3, BID.chest, 1); put(X + 5, Z + 3, BID.chest, 0); o.otherWay = chestPair(X + 5, Y, Z + 3);
    put(X, Z + 5, BID.chest, 0); put(X + 1, Z + 5, BID.trapped_chest, 0); o.mixed = chestPair(X, Y, Z + 5);
    // stacks
    o.same = [same({ id: IID.firework_rocket, n: 1, fw: 1 }, { id: IID.firework_rocket, n: 3, fw: 3 }), same({ id: IID.stone, n: 1 }, { id: IID.stone, n: 5, d: 0 }), same({ id: IID.compass, n: 1, lode: [1, 2, 3, 0] }, { id: IID.compass, n: 1 })];
    // shift-click out of a chest: the hotbar's right end first
    INV.slots.fill(null); put(X + 7, Z + 7, BID.chest, 0); getTile(X + 7, Y, Z + 7).items[0] = { id: IID.emerald, n: 5 };
    UI.openScreen('chest', { x: X + 7, y: Y, z: Z + 7 }); clickSlot(GUI.slots.findIndex(s => s.group === 'cont'), 0, true); o.shiftTo = INV.slots.findIndex(s => s && s.id === IID.emerald); UI.closeScreen();
    // fuel and charcoal
    o.fuel = [ITEMS[IID.oak_door].fuel, ITEMS[IID.spruce_trapdoor].fuel, ITEMS[IID.crossbow].fuel, ITEMS[IID.fishing_rod].fuel, ITEMS[IID.white_banner].fuel, ITEMS[IID.dried_kelp_block].fuel, ITEMS[IID.crimson_planks].fuel || 0];
    o.charcoal = ['stripped_oak_log', 'oak_wood', 'stripped_birch_wood'].filter(k => IID[k] != null).map(k => SMELT[IID[k]] && ITEMS[SMELT[IID[k]][0]].key);
    // commands
    runCommand(`fill ${X - 3} ${Y + 1} ${Z - 3} ${X - 1} ${Y + 3} ${Z - 1} stone hollow`); o.hollow = [getBlock(X - 2, Y + 2, Z - 2), getBlock(X - 3, Y + 2, Z - 2) === BID.stone];
    const n0 = ENT.filter(e => e.type === 'pig').length; runCommand(`summon pig ${X + 6} ${Y + 4} ${Z}`); const pigs = ENT.filter(e => e.type === 'pig'); o.summon = pigs.length === n0 + 1 && Math.abs(pigs[pigs.length - 1].x - (X + 6)) < 1;
    INV.off = { id: IID.shield, n: 1 }; runCommand('clear'); o.clearOff = INV.off;
    // difficulty
    const d0 = PL.difficulty; PL.difficulty = 1; o.easy = diffDmg(3); PL.difficulty = 3; o.hard = diffDmg(4); PL.difficulty = d0;
    // 1.18
    let mx = 0; for (let i = 0; i < 400; i++) mx = Math.max(mx, blockDrops(BID.copper_ore, 0, { id: IID.stone_pickaxe, n: 1 }).items[0][1]); o.copper = mx;
    o.emeraldStone = canHarvest(BID.deepslate_emerald_ore, { id: IID.stone_pickaxe, n: 1 });
    // landing on farmland from a few blocks up tramples it (and the crop on it) back to dirt
    { const fx = X + 4, fz = Z - 2; setBlock(fx, Y - 1, fz, BID.farmland, 7); setBlock(fx, Y, fz, BID.wheat, 3); PL.mode = 'survival'; PL.flying = false; PL.x = fx + .5; PL.z = fz + .5; PL.y = Y + 6; PL.vy = 0; PL.fallDist = 0; PL.health = 20;
      for (let i = 0; i < 80 && !(PL.onGround && PL.y < Y + 1); i++) { UI.paused = false; await new Promise(r => setTimeout(r, 50)); }
      o.trample = [getBlock(fx, Y - 1, fz) === 3, getBlock(fx, Y, fz), +(PL.y - Y).toFixed(3), PL.onGround, getBlock(fx, Y - 1, fz)]; PL.mode = 'creative'; }
    // durability: spam-clicking a mob wears the sword once per hit that lands, not once per click; a hoe tills coarse dirt
    // to dirt; mending mends the off-hand item too; a trident about to break isn't thrown
    { PL.mode = 'survival'; INV.sel = 0; INV.slots[0] = { id: IID.iron_sword, n: 1 }; const cow = spawnMob('cow', X + 1.5, Y, Z - 2.5); cow.ai = null; cow.hp = 100;
      for (let i = 0; i < 5; i++) { PL.attackT = 100; attackEntity(cow); } o.spam = INV.slots[0].d; removeEnt(cow);
      INV.slots[0] = { id: IID.iron_hoe, n: 1 }; setBlock(X + 6, Y - 1, Z - 2, BID.coarse_dirt); setBlock(X + 6, Y, Z - 2, 0); TARGET = { type: 'block', x: X + 6, y: Y - 1, z: Z - 2, id: BID.coarse_dirt, m: 0, nx: 0, ny: 1, nz: 0, t: 2 }; USE.placeCd = 0; useItem(true);
      o.coarse = [getBlock(X + 6, Y - 1, Z - 2) === 3, INV.slots[0].d];
      INV.slots[0] = null; INV.armor = [null, null, null, null]; INV.off = { id: IID.iron_sword, n: 1, d: 50, e: { mending: 1 } }; mendWithXP(5); o.mendOff = INV.off.d; INV.off = null;
      INV.slots[0] = { id: IID.trident, n: 1, d: 249 }; USE.t = 20; tridentRelease(INV.slots[0]); o.trident = !!INV.slots[0]; PL.mode = 'creative'; }
    o.lush = W.exp; o.mapStack = ITEMS[IID.filled_map].stack;
    // a hopper moves a shulker box with what is in it, and keeps rockets of different flights apart
    const H = [X + 6, Y + 1, Z + 6]; setBlock(H[0], H[1] + 1, H[2], BID.chest, 0); setTile(H[0], H[1] + 1, H[2], { type: 'chest', items: new Array(27).fill(null) });
    setBlock(...H, BID.hopper, 0); setTile(...H, { type: 'hopper', items: new Array(5).fill(null), cd: 0 }); setBlock(H[0], H[1] - 1, H[2], BID.chest, 0); setTile(H[0], H[1] - 1, H[2], { type: 'chest', items: new Array(27).fill(null) });
    const top = getTile(H[0], H[1] + 1, H[2]).items; top[0] = { id: IID.shulker_box, n: 1, items: [{ id: IID.diamond, n: 64 }, ...new Array(26).fill(null)] }; top[1] = { id: IID.firework_rocket, n: 2, fw: 1 }; top[2] = { id: IID.firework_rocket, n: 2, fw: 3 };
    for (let i = 0; i < 200; i++) tileTick();
    o.hopper = getTile(H[0], H[1] - 1, H[2]).items.filter(Boolean).map(s => ITEMS[s.id].key + s.n + (s.items ? '+' + s.items.filter(Boolean).length : '') + (s.fw ? 'f' + s.fw : ''));
    // a hopper against a furnace's side fills its fuel slot (and an item that can't go in doesn't block the rest); one
    // pointing into a large chest fills it as one; a comparator reads a large chest whole
    const F = [X - 2, Y + 1, Z + 6]; setBlock(...F, BID.furnace, 0); setTile(...F, newFurnace()); setBlock(F[0] - 1, F[1], F[2], BID.hopper, 5); setTile(F[0] - 1, F[1], F[2], { type: 'hopper', items: [{ id: IID.raw_iron, n: 2 }, { id: IID.coal, n: 3 }, null, null, null], cd: 0 });
    for (let i = 0; i < 100; i++) tileTick(); o.sideFuel = getTile(...F).items.map(s => s && ITEMS[s.id].key + s.n);
    o.comp = containerSignal(...pr.left) === containerSignal(...pr.right);
    return o;
  });
  ok(r.big.slots === 54 && r.big.title === '큰 상자' && r.big.both, 'two chests side by side open as one large chest', r.big);
  ok(r.secondHalf, 'the large chest\'s lower rows are the other chest', r.secondHalf);
  ok(r.third === null && r.otherWay === null && r.mixed === null, 'a third chest, one facing another way, or a trapped chest beside a chest stay single', [r.third, r.otherWay, r.mixed]);
  ok(!r.same[0] && r.same[1] && !r.same[2], 'stacks merge only when what they carry matches', r.same);
  ok(r.shiftTo === 8, 'shift-click out of a chest goes to the hotbar\'s right end', r.shiftTo);
  ok(JSON.stringify(r.fuel) === JSON.stringify([200, 300, 300, 300, 300, 4001, 0]), 'furnace fuel as in Java', r.fuel);
  ok(r.charcoal.length && r.charcoal.every(k => k === 'charcoal'), 'every log and wood block smelts into charcoal', r.charcoal);
  ok(r.hollow[0] === 0 && r.hollow[1] && r.summon && r.clearOff === null, '/fill hollow, /summon at a place, /clear empties the off hand', [r.hollow, r.summon, r.clearOff]);
  ok(r.easy === 2.5 && r.hard === 6, 'Easy: half the damage plus one; Hard: one and a half times', [r.easy, r.hard]);
  ok(r.copper === 5 && !r.emeraldStone, '1.18 copper ore drops up to 5; deepslate emerald ore needs an iron pickaxe', [r.copper, r.emeraldStone]);
  ok(r.lush === true && r.mapStack === 64, 'new worlds have lush caves; maps of the same number stack', [r.lush, r.mapStack]);
  ok(JSON.stringify(r.hopper) === JSON.stringify(['shulker_box1+1', 'firework_rocket2f1', 'firework_rocket2f3']), 'a hopper keeps what an item carries', r.hopper);
  ok(JSON.stringify(r.sideFuel) === JSON.stringify([null, 'coal3', null]) && r.comp, 'a hopper on a furnace\'s side fills the fuel slot; a comparator reads a large chest whole', [r.sideFuel, r.comp]);
  ok(r.trample[0] && r.trample[1] === 0, 'landing on farmland tramples it', r.trample);
  ok(r.spam === 1, 'clicking a mob five times at once wears the sword once (only hits that land)', r.spam);
  ok(r.coarse[0] && r.coarse[1] === 1 && r.mendOff === 40 && r.trident, 'a hoe tills coarse dirt; mending mends the off hand; a trident about to break stays in hand', [r.coarse, r.mendOff, r.trident]);
  ok(!p.errs.length, 'no page errors', p.errs);
};
