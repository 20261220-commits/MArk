// glass panes, cactus, beds, armour wear, the build limit
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms)), run = async n => { for (let i = 0; i < n; i++) { UI.paused = false; await wait(50); } };
    PL.mode = 'survival'; W.meta.gamerules = { ...(W.meta.gamerules || {}), doMobSpawning: false };
    const X = Math.floor(PL.x), Y = 150, Z = Math.floor(PL.z);
    for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) { setBlock(X + a, Y - 1, Z + c, BID.stone); for (let y = 0; y < 6; y++) setBlock(X + a, Y + y, Z + c, 0); }
    PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.vx = PL.vy = PL.vz = 0;
    for (const e of ENT) if (e.kind === 'mob' || e.kind === 'item') removeEnt(e);
    const items = () => ENT.filter(e => e.kind === 'item' && !e.dead).map(e => ITEMS[e.stack.id].key);
    // glass panes break into nothing
    for (const k of ['glass_pane', 'glass', 'stained_glass_pane']) { setBlock(X + 3, Y, Z + 3, BID[k]); INV.slots[INV.sel] = null; breakBlock(X + 3, Y, Z + 3); }
    await run(4); o.glassDrops = items();
    // a cactus: an item on it is destroyed, a mob beside it is hurt
    setBlock(X - 4, Y - 2, Z, BID.stone); setBlock(X - 4, Y - 1, Z, BID.red_sand); setBlock(X - 4, Y, Z, BID.cactus); setBlock(X - 4, Y + 1, Z, BID.cactus);
    const st = dropItem(X - 3.5, Y + 2.6, Z + .5, IID.stick, 1, [0, 0, 0], 0); for (let i = 0; i < 120 && !st.dead; i++) await run(1); o.onCactus = items();
    const cow = spawnMob('cow', X - 2.5, Y, Z + .5); cow.persistent = true; cow.ai = null; const hp0 = cow.hp; cow.x = X - 3 + cow.w + 0.02; await run(25); o.cowHurt = hp0 - cow.hp; removeEnt(cow);
    // a bed: placed on glass (no floor needed), slept in at the head, left by sneaking to a spot beside it
    setBlock(X + 1, Y, Z - 3, BID.glass); setBlock(X + 2, Y, Z - 3, BID.glass);
    INV.slots[INV.sel] = { id: IID.red_bed, n: 1 }; PL.yaw = -Math.PI / 2; // facing east
    TARGET = { type: 'block', x: X + 1, y: Y, z: Z - 3, id: BID.glass, m: 0, nx: 0, ny: 1, nz: 0, t: 2 }; USE.placeCd = 0; useItem(true);
    o.bed = [getBlock(X + 1, Y + 1, Z - 3), getBlock(X + 2, Y + 1, Z - 3)].map(b => b === BID.red_bed);
    const foot = [X + 1, Y + 1, Z - 3], parts = bedParts(...foot);
    W.time = 18000; PL.x = X + .5; PL.y = Y; PL.z = Z - 2.5; trySleep(...foot); o.sleep = { on: !!PL.sleeping, at: [Math.floor(PL.x), +PL.y.toFixed(3), Math.floor(PL.z)], head: parts.head, spawn: PL.spawn, bed: PL.spawnBed };
    IN.sneak = true; await run(3); IN.sneak = false; o.woke = { on: !!PL.sleeping, at: [+PL.x.toFixed(1), +PL.y.toFixed(1), +PL.z.toFixed(1)], inBed: getBlock(Math.floor(PL.x), Math.floor(PL.y), Math.floor(PL.z)) === BID.red_bed };
    W.time = 18000; PL.x = X - 6; PL.z = Z + 6; trySleep(...foot); o.far = !!PL.sleeping;
    // falling on a bed bounces and halves the damage
    PL.x = parts.head[0] + .5; PL.z = parts.head[2] + .5; PL.y = Y + 12; PL.vy = 0; PL.fallDist = 0; PL.health = 20; PL.inv = 0; let up = false; for (let i = 0; i < 60; i++) { UI.paused = false; await wait(50); if (PL.vy > 0.1) { up = true; break; } } o.bounce = { up, hp: PL.health };
    // dying: back at the bed; with the bed gone, at the world spawn
    PL.inv = 0; hurtPlayer(100, 'kill'); respawn(); o.resp1 = [Math.floor(PL.x), Math.floor(PL.y), Math.floor(PL.z)];
    setBlock(...parts.head, 0); setBlock(...parts.foot, 0); PL.inv = 0; hurtPlayer(100, 'kill'); respawn(); o.resp2 = { spawn: PL.spawn, at: [Math.floor(PL.x), Math.floor(PL.z)], ws: [W.worldSpawn[0], W.worldSpawn[2]] };
    // armour wears from a hit, an elytra doesn't
    PL.x = X + .5; PL.y = Y; PL.z = Z + .5; INV.armor = [{ id: IID.iron_helmet, n: 1 }, { id: IID.elytra, n: 1 }, null, null]; PL.inv = 0; PL.health = 20; hurtPlayer(8, 'mob'); o.wear = INV.armor.map(s => s && (s.d || 0));
    // a furnace lights up where it stands (tile rows count from y -64)
    setBlock(X + 4, Y, Z - 5, BID.furnace); setTile(X + 4, Y, Z - 5, { ...newFurnace(), items: [{ id: IID.raw_iron, n: 2 }, { id: IID.coal, n: 1 }, null] }); await run(40);
    o.furnace = { here: BLOCKS[getBlock(X + 4, Y, Z - 5)].key, above: getBlock(X + 4, Y + 64, Z - 5) };
    // the build limit
    const fl = []; const f0 = UI.flash; UI.flash = t => { fl.push(t); }; INV.slots[INV.sel] = { id: IID.stone, n: 4 }; PL.y = 318; TARGET = { type: 'block', x: X, y: 319, z: Z, id: BID.stone, m: 0, nx: 0, ny: 1, nz: 0, t: 2 }; setBlock(X, 319, Z, BID.stone); USE.placeCd = 0; useItem(true); UI.flash = f0; o.limit = fl; setBlock(X, 319, Z, 0);
    return o; });
  ok(r.glassDrops.length === 0, 'glass, panes and stained panes drop nothing without silk touch', r.glassDrops);
  ok(!r.onCactus.includes('stick'), 'an item dropped on a cactus is destroyed', r.onCactus);
  ok(r.cowHurt > 0, 'a mob touching a cactus is hurt', r.cowHurt);
  ok(r.bed.every(Boolean), 'a bed goes down on glass (no floor needed)', r.bed);
  ok(r.sleep.on && r.sleep.at[0] === r.sleep.head[0] && r.sleep.at[2] === r.sleep.head[2] && Math.abs(r.sleep.at[1] - (r.sleep.head[1] + 0.5625)) < 0.01 && r.sleep.bed, 'sleeping: on the head half, the spawn set by the bed', r.sleep);
  ok(!r.woke.on && !r.woke.inBed, 'sneaking gets you out of bed, beside it', r.woke);
  ok(!r.far, 'a bed too far away can\'t be slept in');
  ok(r.bounce.up && r.bounce.hp > 20 - 9, 'a bed bounces and halves a fall', r.bounce);
  ok(Math.abs(r.resp1[0] - r.sleep.head[0]) <= 2 && Math.abs(r.resp1[2] - r.sleep.head[2]) <= 2, 'death: back beside the bed', [r.resp1, r.sleep.head]);
  ok(!r.resp2.spawn && Math.abs(r.resp2.at[0] - r.resp2.ws[0]) < 20, 'with the bed gone: the world spawn', r.resp2);
  ok(r.wear[0] === 2 && r.wear[1] === 0, 'a hit wears armour, not an elytra', r.wear);
  ok(r.furnace.here === 'lit_furnace' && !r.furnace.above, 'a burning furnace lights up in place (not 64 blocks up)', r.furnace);
  ok(r.limit.some(t => /320/.test(t)), 'building at the top says the limit', r.limit);
  ok(!p.errs.length, 'no page errors', p.errs);
};
