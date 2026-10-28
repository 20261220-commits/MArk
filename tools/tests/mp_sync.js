// what a guest makes or changes reaches everyone: decorations, mobs from eggs and golems, splash potions
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B, C, pos } = await lib.threePlayers(b, srv), [X, Y, Z] = pos, wait = ms => A.waitForTimeout(ms);
  const until = (P, f, arg, ms = 20000) => P.waitForFunction(f, arg, { timeout: ms, polling: 250 }).then(() => true, () => false);
  const all = (f, arg, ms) => Promise.all([A, B, C].map(P => until(P, f, arg, ms))).then(r => r.every(Boolean));
  const use = (P, item, t, extra) => P.evaluate(([item, t, extra]) => { PL.mode = 'survival'; INV.slots[INV.sel] = item ? { id: IID[item], n: 4, ...(extra || {}) } : null; TARGET = { type: 'block', ...t, id: getBlock(t.x, t.y, t.z), m: getMeta(t.x, t.y, t.z), t: 2 }; USE.placeCd = 0; MP.local = true; try { useItem(true); } finally { MP.local = false; } }, [item, t, extra]);
  await B.evaluate(([X, Y, Z]) => { PL.x = X + .5; PL.z = Z + 4.5; PL.y = Y; PL.yaw = 0; }, pos);
  await A.evaluate(([X, Y, Z]) => { for (let a = -3; a <= 3; a++) for (let y = 0; y < 3; y++) { MP.local = true; setBlock(X + a, Y + y, Z + 7, BID.stone); MP.local = false; } }, pos); await wait(1500);
  // item frame: hung, filled, turned, emptied, taken down
  await use(B, 'item_frame', { x: X, y: Y + 1, z: Z + 7, nx: 0, ny: 0, nz: -1 });
  ok(await all(() => ENT.filter(e => e.kind === 'frame' && !e.dead).length === 1), 'a guest\'s item frame appears for everyone');
  await B.evaluate(() => { const e = ENT.find(q => q.kind === 'frame' && !q.dead); PL.mode = 'survival'; INV.slots[INV.sel] = { id: IID.diamond, n: 2 }; frameUse(e, PL.held()); frameUse(e, PL.held()); });
  ok(await all(() => { const e = ENT.find(q => q.kind === 'frame' && !q.dead); return !!(e && e.item && e.item.id === IID.diamond && e.rot === 1); }), 'its item and turn reach everyone');
  await B.evaluate(() => { const e = ENT.find(q => q.kind === 'frame' && !q.dead); e.onHit(e); });
  ok(await all(() => { const e = ENT.find(q => q.kind === 'frame' && !q.dead); return !!(e && !e.item); }), 'knocking the item out reaches everyone');
  await B.evaluate(() => { const e = ENT.find(q => q.kind === 'frame' && !q.dead); e.onHit(e); });
  ok(await all(() => !ENT.some(q => q.kind === 'frame' && !q.dead)), 'taking the frame down reaches everyone');
  // painting and armor stand
  await use(B, 'painting', { x: X - 2, y: Y + 1, z: Z + 7, nx: 0, ny: 0, nz: -1 });
  ok(await all(() => ENT.filter(e => e.kind === 'painting' && !e.dead).length === 1), 'a guest\'s painting appears for everyone');
  const motifs = await Promise.all([A, B, C].map(P => P.evaluate(() => (ENT.find(e => e.kind === 'painting' && !e.dead) || {}).motif)));
  ok(motifs[0] && motifs.every(m => m === motifs[0]), 'everyone sees the same picture', motifs);
  await use(B, 'armor_stand', { x: X + 2, y: Y - 1, z: Z + 5, nx: 0, ny: 1, nz: 0 });
  ok(await all(() => ENT.filter(e => e.kind === 'armor_stand' && !e.dead).length === 1), 'a guest\'s armor stand appears for everyone');
  await B.evaluate(() => { const e = ENT.find(q => q.kind === 'armor_stand' && !q.dead); INV.slots[INV.sel] = { id: IID.iron_helmet, n: 1 }; standUse(e, PL.held(), e.y + 1.8); });
  ok(await all(() => { const e = ENT.find(q => q.kind === 'armor_stand' && !q.dead); return !!(e && e.armor[0] && e.armor[0].id === IID.iron_helmet); }), 'armor put on a stand reaches everyone');
  // mobs a guest makes are the runner's real mobs
  await use(B, 'pig_spawn_egg', { x: X - 3, y: Y - 1, z: Z + 3, nx: 0, ny: 1, nz: 0 });
  ok(await until(A, ([X, Z]) => ENT.some(e => e.type === 'pig' && !e.dead && !e.remote && Math.hypot(e.x - X + 3, e.z - Z - 3) < 3), [X, Z]), 'a guest\'s spawn egg makes a mob on the runner');
  ok(await until(C, ([X, Z]) => ENT.some(e => e.type === 'pig' && !e.dead && e.remote && Math.hypot(e.x - X + 3, e.z - Z - 3) < 3), [X, Z]), 'and the other guest sees it');
  await A.evaluate(([X, Y, Z]) => { MP.local = true; setBlock(X + 5, Y, Z, BID.iron_block); setBlock(X + 5, Y + 1, Z, BID.iron_block); setBlock(X + 4, Y + 1, Z, BID.iron_block); setBlock(X + 6, Y + 1, Z, BID.iron_block); MP.local = false; }, pos); await wait(1500);
  await use(B, 'carved_pumpkin', { x: X + 5, y: Y + 1, z: Z, nx: 0, ny: 1, nz: 0 });
  ok(await until(A, ([X, Z]) => ENT.some(e => e.type === 'iron_golem' && !e.dead && !e.remote && e.playerMade && Math.hypot(e.x - X - 5, e.z - Z) < 4), [X, Z]), 'a guest\'s iron golem is built on the runner (and stays friendly)');
  // a splash potion thrown by a guest
  await C.evaluate(([X, Y, Z]) => { PL.x = X + 3.5; PL.z = Z - 5.5; PL.health = 20; PL.mode = 'survival'; PL.eff = {}; }, pos);
  await A.evaluate(([X, Y, Z]) => { const c = spawnMob('cow', X + 2.5, Y, Z - 5.5); c.persistent = true; window.__cow = c; }, pos); await wait(1500);
  await B.evaluate(([X, Y, Z]) => { splashPotion(POTION.poison.items.splash, X + 3, Y + 0.5, Z - 5.5, null); }, pos);
  ok(await until(C, () => !!(PL.eff && PL.eff.poison)), 'a guest\'s splash potion poisons another player');
  ok(await until(A, () => !!(__cow.eff && __cow.eff.poison)), 'and the runner\'s mobs in reach');
  // a lingering cloud
  await B.evaluate(([X, Y, Z]) => { spawnCloud(X - 6, Y + 0.05, Z - 6, 'swiftness', { r: 3, dur: 400 }); }, pos);
  ok(await all(([X, Z]) => ENT.some(e => e.kind === 'cloud' && !e.dead && Math.hypot(e.x - X + 6, e.z - Z + 6) < 1), [X, Z]), 'a lingering cloud shows up for everyone');
  // a rocket and a snowball in flight
  await B.evaluate(([X, Y, Z]) => launchRocket(X + .5, Y + 1, Z + .5, { fw: { flight: 3 } }, false), pos);
  ok(await until(C, () => ROCKETS.some(r => r.remote)), 'a guest\'s firework rocket flies on the other screens');
  await B.evaluate(() => { PL.pitch = 0.3; INV.slots[INV.sel] = { id: IID.snowball, n: 4 }; TARGET = null; MP.local = true; try { useItem(true); } finally { MP.local = false; } });
  ok(await until(C, () => ENT.some(e => e.visThrown && !e.dead), null, 5000), 'a guest\'s snowball is seen in flight');
  // a lead: a guest leads the runner's cow, then ties it to a fence beside it
  const cw = await A.evaluate(() => { __cow.eff = {}; __cow.vx = __cow.vz = 0; return [__cow.x, __cow.y, __cow.z, __cow.mpid]; });
  await B.evaluate(([x, y, z]) => { PL.x = x + 1.5; PL.y = y; PL.z = z; PL.flying = true; }, cw);
  await until(A, ([x, y, z]) => [...MP.peers.values()].some(p => p.s && Math.hypot(p.s.x - x - 1.5, p.s.z - z) < 1), cw); await wait(500); // the runner knows where the guest stands
  await B.evaluate(id => { const c = ENT.find(e => e.remote && e.rid === id && !e.dead); INV.slots[INV.sel] = { id: IID.lead, n: 1 }; TARGET = { type: 'ent', e: c, t: 1 }; USE.placeCd = 0; useItem(true); }, cw[3]);
  ok(await until(A, () => !!(__cow.leash && __cow.leash.p != null)), 'a guest puts a lead on the runner\'s mob');
  ok(await until(C, id => ENT.some(e => e.remote && e.rid === id && e.leash && e.leashLine), cw[3]), 'the other guest sees the lead');
  await B.evaluate(([x, y, z]) => { PL.x = x + 8.5; }, cw);
  ok(await until(A, ([x]) => __cow.x > x + 1, cw), 'the mob follows the guest holding it');
  const fx = Math.floor(cw[0]) + 6, fy = Math.floor(cw[1]), fz = Math.floor(cw[2]) + 2;
  await A.evaluate(([x, y, z]) => { MP.local = true; setBlock(x, y, z, BID.oak_fence); MP.local = false; }, [fx, fy, fz]); await wait(1500);
  await B.evaluate(([x, y, z]) => { INV.slots[INV.sel] = { id: IID.lead, n: 1 }; TARGET = { type: 'block', x, y, z, nx: 1, ny: 0, nz: 0, id: BID.oak_fence, m: 0, t: 2 }; USE.placeCd = 0; useItem(true); }, [fx, fy, fz]);
  ok(await until(A, () => Array.isArray(__cow.leash)), 'and the guest ties it to a fence', await A.evaluate(() => [JSON.stringify(__cow.leash), __cow.x, __cow.y, __cow.z, JSON.stringify([...MP.peers.values()].map(p => p.s && [p.id, p.s.x, p.s.y, p.s.z]))]));
};
