// guests' doors, beds, furnaces, TNT, arrows, sleeping, boats with two seats
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B, C, pos } = await lib.threePlayers(b, srv), [X, Y, Z] = pos, wait = ms => A.waitForTimeout(ms);
  const until = (P, f, arg, ms = 30000) => P.waitForFunction(f, arg, { timeout: ms, polling: 250 }).then(() => true, () => false); // slow machines: wait for it, up to a limit
  for (const P of [A, B, C]) await P.evaluate(() => { const f = UI.flash; window.__fl = []; UI.flash = t => { __fl.push(t); return f(t); }; });
  const blk = (P, x, y, z) => P.evaluate(([x, y, z]) => [getBlock(x, y, z), getMeta(x, y, z)], [x, y, z]);
  const use = (P, item, x, y, z, n = [0, 1, 0], place = true) => P.evaluate(([item, x, y, z, n, place]) => { PL.mode = 'survival'; INV.slots[INV.sel] = item ? { id: IID[item], n: 4 } : null; const tx = place ? x - n[0] : x, ty = place ? y - n[1] : y, tz = place ? z - n[2] : z;
    TARGET = { type: 'block', x: tx, y: ty, z: tz, id: getBlock(tx, ty, tz), m: getMeta(tx, ty, tz), nx: n[0], ny: n[1], nz: n[2], t: 2 }; USE.placeCd = 0; MP.local = true; try { useItem(true); } finally { MP.local = false; } return [getBlock(x, y, z), getMeta(x, y, z)]; }, [item, x, y, z, n, place]);
  await B.evaluate(([X, Y, Z]) => { PL.x = X + 4.5; PL.z = Z + 6.5; PL.y = Y; }, pos);
  await use(B, 'oak_door', X + 4, Y, Z + 4); await wait(1200);
  const d = [await blk(A, X + 4, Y, Z + 4), await blk(A, X + 4, Y + 1, Z + 4), await blk(C, X + 4, Y + 1, Z + 4)];
  ok(d[0][0] === d[1][0] && d[1][0] === d[2][0] && d[0][0] === (await A.evaluate(() => BID.oak_door)), 'a guest\'s door stands on every screen (both halves)', d);
  await use(B, null, X + 4, Y, Z + 4, [0, 0, 1], false);
  const open = P => until(P, ([x, y, z]) => !!(getMeta(x, y, z) & 4), [X + 4, Y, Z + 4], 10000);
  ok(await open(A) && await open(C), 'a guest opening it opens it for everyone', [await blk(A, X + 4, Y, Z + 4), await blk(C, X + 4, Y, Z + 4)]);
  await use(C, 'red_bed', X + 6, Y, Z + 4); await wait(1500);
  ok(await A.evaluate(([x, y, z]) => { let n = 0; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (getBlock(x + dx, y, z + dz) === BID.red_bed) n++; return n; }, [X + 6, Y, Z + 4]) === 2, 'a guest\'s bed keeps both halves');
  await use(B, 'furnace', X - 4, Y, Z + 4); await wait(1200);
  ok(await A.evaluate(([x, y, z]) => !!getTile(x, y, z), [X - 4, Y, Z + 4]), 'a guest\'s furnace exists on the runner\'s side');
  await B.evaluate(([x, y, z]) => { INV.slots[0] = { id: IID.raw_iron, n: 3 }; INV.slots[1] = { id: IID.coal, n: 1 }; UI.openScreen('furnace', { x, y, z }); const g = n => GUI.slots.findIndex(s => s.group === n), hot = g('hot'); clickSlot(hot, 0, false); clickSlot(g('fin'), 0, false); clickSlot(hot + 1, 0, false); clickSlot(g('ffuel'), 0, false); }, [X - 4, Y, Z + 4]);
  ok(await until(A, ([x, y, z]) => { const t = getTile(x, y, z); return !!(t && t.items[0] && t.items[0].id === IID.raw_iron && t.burn > 0); }, [X - 4, Y, Z + 4], 15000), 'what a guest puts in a furnace reaches the runner, and it lights');
  await A.evaluate(([x, y, z]) => { const t = getTile(x, y, z); if (t) t.cook = Math.max(t.cook || 0, 190); }, [X - 4, Y, Z + 4]); // (a slow test machine runs few ticks a second: skip most of the 10 seconds)
  ok(await until(B, ([x, y, z]) => { const t = getTile(x, y, z); return !!(t && t.items[2] && t.items[2].id === IID.iron_ingot); }, [X - 4, Y, Z + 4], 30000), 'the runner smelts what a guest put in and the guest sees the result');
  await B.evaluate(() => UI.closeScreen());
  await C.evaluate(([X, Y, Z]) => { PL.x = X - 6.5; PL.z = Z - 3.5; PL.y = Y; }, pos);
  await use(C, 'tnt', X - 6, Y, Z - 6); await wait(800); await use(C, 'flint_and_steel', X - 6, Y, Z - 6, [0, 1, 0], false);
  ok(await until(B, () => ENT.some(e => e.kind === 'tnt' && !e.dead), null, 8000), 'lit TNT flashes on the other guests\' screens');
  await C.evaluate(([X, Y, Z]) => { PL.x = X + 0.5; PL.z = Z + 6.5; }, pos); await until(A, ([x, y, z]) => getBlock(x, y - 1, z) === 0, [X - 6, Y, Z - 6], 15000); await wait(1500);
  const fl = await Promise.all([A, C].map(P => P.evaluate(([x, y, z]) => getBlock(x, y - 1, z), [X - 6, Y, Z - 6])));
  ok(fl[0] === 0 && fl[1] === 0, 'a guest\'s TNT blows up the floor for everyone', fl);
  await A.evaluate(([X, Y, Z]) => { for (let a = -8; a <= 8; a++) for (let c = -8; c <= 8; c++) { MP.local = true; setBlock(X + a, Y - 1, Z + c, BID.stone); MP.local = false; } const c = spawnMob('cow', X + 0.5, Y, Z + 6.5); c.persistent = true; window.__cow = c; }, pos); await C.evaluate(([X, Y, Z]) => { PL.x = X - 6.5; PL.z = Z + 6.5; }, pos); await wait(2000);
  await B.evaluate(([X, Y, Z]) => { PL.x = X + 0.5; PL.z = Z + 2.5; PL.y = Y; const c = ENT.filter(e => e.remote && e.type === 'cow' && !e.dead).sort((a, b) => Math.hypot(a.x - X, a.z - Z - 6.5) - Math.hypot(b.x - X, b.z - Z - 6.5))[0]; const dx = c.x - PL.x, dz = c.z - PL.z, d = Math.hypot(dx, dz); shootArrow(PL.x + dx / d * 0.5, Y + 0.8, PL.z + dz / d * 0.5, dx / d * 2.5, 0.05, dz / d * 2.5, PL, 2); }, pos);
  ok(await until(A, () => ENT.some(e => e.kind === 'arrow' && e.visual), null, 5000), 'a guest\'s arrow flies on the runner\'s screen');
  await wait(2200); ok(await A.evaluate(() => __cow.hp < __cow.def.hp), 'a guest\'s arrow hurts the runner\'s cow');
  await A.evaluate(([X, Y, Z]) => { PL.x = X + 0.5; PL.z = Z + 4.5; PL.y = Y; PL.health = 20; PL.mode = 'survival'; }, pos); await wait(1500);
  await B.evaluate(([X, Y, Z]) => { PL.x = X + 0.5; PL.z = Z + 1.5; shootArrow(PL.x, PL.y + 1.2, PL.z + 0.5, 0, 0, 2.5, PL, 2); }, pos); await wait(2000);
  ok(await A.evaluate(() => PL.health) < 20, 'a guest\'s arrow hurts another player');
  // sleeping
  await A.evaluate(() => { runCommand('time set 14000'); for (const e of [...ENT]) if (e.kind === 'mob' && e.def.hostile) removeEnt(e); }); await wait(2500);
  for (const [P, dx] of [[A, 2], [B, 4], [C, 6]]) { await P.evaluate(([X, Y, Z, dx]) => { PL.x = X + dx + .5; PL.z = Z - 3.5; PL.y = Y; PL.dead = false; PL.health = 20; }, [X, Y, Z, dx]); await use(P, 'red_bed', X + dx, Y, Z - 6); }
  await wait(1500);
  const sl = []; for (const [P, dx] of [[A, 2], [B, 4], [C, 6]]) sl.push(await P.evaluate(([x, y, z]) => { for (let dz = -1; dz <= 1; dz++) if (getBlock(x, y, z + dz) === BID.red_bed) { TARGET = { type: 'block', x, y, z: z + dz, id: getBlock(x, y, z + dz), m: getMeta(x, y, z + dz), nx: 0, ny: 1, nz: 0, t: 2 }; INV.slots[INV.sel] = null; MP.local = true; try { useItem(true); } finally { MP.local = false; } return PL.sleeping; } return 0; }, [X + dx, Y, Z - 6]));
  await until(A, () => W.time % 24000 < 2000, null, 25000); await wait(1500);
  const tm = await Promise.all([A, B, C].map(P => P.evaluate(() => W.time % 24000)));
  ok(sl.every(Boolean) && tm.every(t => t < 2000), 'when all three sleep the night passes for everyone', [sl, tm, await Promise.all([A, B, C].map(P => P.evaluate(() => [__fl.slice(-3), PL.dead, PL.health, ENT.filter(e => e.kind === 'mob' && !e.dead && e.def.hostile && Math.hypot(e.x - PL.x, e.z - PL.z) < 10).map(e => e.type).join()])))]);
  // a boat: two seats
  await A.evaluate(([X, Y, Z]) => { for (const P of [PL]) { P.dead = false; } placeBoat(X + 0.5, Y, Z + 3.5, 0, 'oak'); }, pos); await wait(2500);
  const board = P => P.evaluate(() => { const e = ENT.find(q => q.kind === 'boat' && !q.dead); if (!e) return 'no boat'; mount(e); return PL.riding === e ? (e.rider === PL ? 'driver' : e.rider2 === PL ? 'back' : '?') : 'no'; });
  const seat = P => P.evaluate(() => PL.riding ? (PL.riding.rider === PL ? 'driver' : PL.riding.rider2 === PL ? 'back' : '?') : 'off');
  const bstate = P => P.evaluate(() => ({ me: [+PL.x.toFixed(1), +PL.y.toFixed(1), +PL.z.toFixed(1), PL.dead, PL.riding ? PL.riding.kind : null], boats: ENT.filter(q => q.kind === 'boat' && !q.dead).map(e => [+e.x.toFixed(1), +e.y.toFixed(1), +e.z.toFixed(1), e.riderId, e.seat2Id, !!e.rider, !!e.rider2]) }));
  { const r = await board(B); ok(r === 'driver', 'the first one in a boat drives', [r, await bstate(B)]); } await wait(1500);
  { const r = await board(C); ok(r === 'back', 'the second sits in the back', [r, await bstate(C), await bstate(A)]); } await wait(1500);
  ok(await board(A) === 'no', 'a third can\'t get in');
  await B.evaluate(() => dismount()); await until(C, () => PL.riding && PL.riding.rider === PL, null, 8000); ok(await seat(C) === 'driver', 'when the driver gets off the back seat takes the front', [await seat(B), await seat(C), await C.evaluate(() => { const e = PL.riding; return e && [e.rider === PL ? 'me' : e.rider, e.mpRider, e.seat2Other]; }), await A.evaluate(() => { const e = ENT.find(q => q.kind === 'boat' && !q.dead); return [e.rider === PL, e.mpRider, e.mpRider2]; })]);
  for (const P of [A, B, C]) await P.evaluate(() => { if (PL.riding) dismount(); }); await wait(2000);
  await Promise.all([board(B), board(C)]); await wait(4000);
  const both = [await seat(B), await seat(C)].sort().join();
  ok(both === 'back,driver', 'two getting in at once: one drives, one sits in the back', both);
  const errs = [...A.errs, ...B.errs, ...C.errs]; ok(!errs.length, 'no page errors', errs);
};
