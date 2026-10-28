// three players: hitting each other, two grabbing the same chest stack, breaking a chest, riding, dropped items, mobs
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B, C, pos } = await lib.threePlayers(b, srv), [X, Y, Z] = pos;
  const place = () => Promise.all([[A, 0.5, -2.5], [B, 0.5, 0.5], [C, 2.5, 0.5]].map(([P, dx, dz]) => P.evaluate(([p, dx, dz]) => { PL.x = p[0] + dx; PL.y = p[1]; PL.z = p[2] + dz; PL.vx = PL.vy = PL.vz = 0; }, [pos, dx, dz])));
  const hit = async (P, n) => { await place(); await P.waitForTimeout(1200); return P.evaluate(n => { const p = [...MP.peers.values()].find(q => q.name === n); if (!p || !p.pos) return 'no peer'; const dx = p.pos[0] - PL.x, dz = p.pos[2] - PL.z, dy = p.pos[1] + 1.4 - (PL.y + PL.eyeH); PL.yaw = Math.atan2(-dx, -dz); PL.pitch = Math.atan2(dy, Math.hypot(dx, dz)); PL.attackT = 100; INV.slots[INV.sel] = { id: IID.iron_sword, n: 1 }; const t = raycast(4.5); if (!t || t.type !== 'ent' || t.e.kind !== 'peer') return 'no target'; attackEntity(t.e); return 'hit'; }, n); };
  const hp = P => P.evaluate(() => PL.health);
  ok(await hit(B, '앨리스') === 'hit', 'a guest can aim at the runner'); await A.waitForTimeout(1500); ok(await hp(A) < 20, 'guest → runner hit hurts', await hp(A));
  ok(await hit(A, '밥') === 'hit', 'the runner can aim at a guest'); await B.waitForTimeout(1500); const hb = await hp(B); ok(hb < 20, 'runner → guest hit hurts', hb);
  ok(await hit(C, '밥') === 'hit', 'a guest can aim at a guest'); await B.waitForTimeout(1500); ok(await hp(B) < hb, 'guest → guest hit hurts');
  const cp = [X + 1, Y, Z - 4];
  await A.evaluate(p => { MP.local = true; setBlock(p[0], p[1], p[2], BID.chest); MP.local = false; setTile(p[0], p[1], p[2], { type: 'chest', items: new Array(27).fill(null) }); getTile(p[0], p[1], p[2]).items[0] = { id: IID.diamond, n: 10 }; mpTileChanged(p[0], p[1], p[2]); }, cp);
  await A.waitForTimeout(2000);
  for (const P of [B, C]) await P.evaluate(p => UI.openScreen('chest', { x: p[0], y: p[1], z: p[2] }), cp);
  await Promise.all([B, C].map(P => P.evaluate(() => clickSlot(GUI.slots.findIndex(s => s.group === 'cont'), 0, false))));
  await A.waitForTimeout(2500);
  const dia = P => P.evaluate(p => (INV.cursor && INV.cursor.id === IID.diamond ? INV.cursor.n : 0) + INV.count(IID.diamond) + getTile(p[0], p[1], p[2]).items.reduce((a, s) => a + (s && s.id === IID.diamond ? s.n : 0), 0), cp);
  const total = (await dia(B)) + (await dia(C)) - (await A.evaluate(p => getTile(p[0], p[1], p[2]).items.reduce((a, s) => a + (s && s.id === IID.diamond ? s.n : 0), 0), cp));
  ok(total === 10, 'two guests grabbing the same chest stack end up with 10 diamonds between them, not 20', total);
  for (const P of [B, C]) await P.evaluate(() => { if (INV.cursor) { INV.giveOrDrop(INV.cursor); INV.cursor = null; } UI.closeScreen(); });
  await B.evaluate(p => { INV.slots[5] = { id: IID.gold_ingot, n: 7 }; UI.openScreen('chest', { x: p[0], y: p[1], z: p[2] }); const i = GUI.slots.findIndex(s => s.group === 'cont'), j = GUI.slots.findIndex(s => s.group === 'hot'); clickSlot(j + 5, 0, false); clickSlot(i + 4, 0, false); UI.closeScreen(); }, cp);
  await A.waitForTimeout(2000);
  ok(await A.evaluate(p => getTile(p[0], p[1], p[2]).items.some(s => s && s.id === IID.gold_ingot && s.n === 7), cp), 'a guest\'s chest change reaches the runner');
  await B.evaluate(p => { PL.mode = 'survival'; MP.local = true; try { breakBlock(p[0], p[1], p[2]); } finally { MP.local = false; } }, cp); await A.waitForTimeout(2500);
  const gold = await A.evaluate(() => ENT.filter(e => e.kind === 'item' && !e.dead && e.stack.id === IID.gold_ingot).reduce((a, e) => a + e.stack.n, 0) + INV.count(IID.gold_ingot));
  ok(gold === 7, 'a chest broken by a guest drops its contents once', gold);
  // a horse: one rider
  await A.evaluate(p => { const h = spawnMob('horse', p[0] + 3.5, p[1], p[2] + 3.5); h.persistent = true; horseTame(h); if (h.gear) { h.gear[0] = { id: IID.saddle, n: 1 }; horseGearChanged(h); } else h.saddle = true; window.__h = h; }, pos); await A.waitForTimeout(2500);
  const ride = P => P.evaluate(() => { const e = ENT.find(q => q.remote && q.type === 'horse' && !q.dead); if (!e) return 'no horse'; PL.x = e.x - 1.2; PL.z = e.z; INV.slots[INV.sel] = null; const dx = e.x - PL.x, dz = e.z - PL.z; PL.yaw = Math.atan2(-dx, -dz); PL.pitch = -0.4; TARGET = raycast(4.5); if (!TARGET || TARGET.type !== 'ent') return 'no target'; useItem(true); return !!PL.riding; });
  ok(await ride(B) === true, 'a guest mounts the runner\'s horse'); await A.waitForTimeout(1200);
  ok(await ride(C) === false, 'a second guest can\'t get on the same horse');
  ok(await A.evaluate(() => { const e = __h; PL.x = e.x - 1.2; PL.y = e.y; PL.z = e.z; const dx = e.x - PL.x, dz = e.z - PL.z; PL.yaw = Math.atan2(-dx, -dz); PL.pitch = -0.4; INV.slots[INV.sel] = null; TARGET = raycast(4.5); if (TARGET && TARGET.type === 'ent') useItem(true); return !PL.riding; }), 'nor can the runner');
  for (const P of [A, B, C]) await P.evaluate(() => { if (PL.riding) dismount(); });
  // a dropped item: one gets it
  await A.evaluate(p => dropItem(p[0] + 0.5, p[1] + 0.2, p[2] + 2.5, IID.emerald, 5, [0, 0, 0], 40), pos); await A.waitForTimeout(1500);
  for (const P of [B, C]) await P.evaluate(p => { PL.x = p[0] + 0.5; PL.y = p[1]; PL.z = p[2] + 2.5; }, pos); await A.waitForTimeout(4000);
  const em = await Promise.all([A, B, C].map(P => P.evaluate(() => INV.count(IID.emerald))));
  ok(em.reduce((a, v) => a + v, 0) === 5, 'a dropped stack goes to exactly one player', em);
  // a zombie goes for a guest; a guest kills it
  await C.evaluate(() => { PL.health = 20; PL.mode = 'survival'; }); await A.evaluate(p => { W.time = 18000; const z = spawnMob('zombie', p[0] + 0.5, p[1], p[2] + 6); z.persistent = true; window.__z = z; PL.mode = 'creative'; }, pos);
  await A.waitForTimeout(8000); const hc = await Promise.all([B, C].map(hp)); ok(hc.some(h => h < 20), 'the runner\'s zombie hurts a guest', hc);
  const zid = await A.evaluate(() => __z.mpid); // that zombie (dark caves spawn others at night)
  await B.evaluate(id => new Promise(r => { let i = 0; const f = () => { const q = ENT.find(z => z.remote && z.rid === id && !z.dead); if (q) hurtMob(q, 6, PL, 0, 0); if (++i < 6) setTimeout(f, 700); else r(); }; f(); }), zid);
  await A.waitForTimeout(2500); ok(await A.evaluate(() => !!(__z.dead || __z.deathT)), 'a guest can kill the runner\'s zombie');
  const errs = [...A.errs, ...B.errs, ...C.errs]; ok(!errs.length, 'no page errors', errs);
};
