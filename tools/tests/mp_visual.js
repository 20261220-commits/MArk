// what other players see: poses, the fishing line, mobs' looks, projectiles, falling blocks, block sounds, lightning
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B, C, pos } = await lib.threePlayers(b, srv), [X, Y, Z] = pos, wait = ms => A.waitForTimeout(ms);
  const until = (P, f, arg, ms = 20000) => P.waitForFunction(f, arg, { timeout: ms, polling: 250 }).then(() => true, () => false);
  const peerOf = name => `[...MP.peers.values()].find(p => p.name === '${name}')`;
  // a fishing rod cast: the hook and line show on the others' screens
  await B.evaluate(() => { PL.yaw = Math.PI; PL.pitch = 0.3; INV.slots[INV.sel] = { id: IID.fishing_rod, n: 1, d: 0 }; useRod(); });
  ok(await until(A, new Function(`const p = ${peerOf('밥')}; return !!(p && p.fxm && p.fxm.bobber && p.fxm.bobber.userData.line);`)), 'another player\'s fishing hook and line are seen');
  await B.evaluate(() => { INV.slots[INV.sel] = null; });
  ok(await until(A, new Function(`const p = ${peerOf('밥')}; return !!(p && (!p.fxm || !p.fxm.bobber));`)), 'and go away when reeled in');
  // a drawn bow and a raised shield
  await B.evaluate(() => { INV.slots[INV.sel] = { id: IID.bow, n: 1, d: 0 }; USE.kind = 'bow'; R.hand.bow = 0.8; MP.testHold = setInterval(() => { USE.kind = 'bow'; R.hand.bow = 0.8; }, 20); });
  ok(await until(A, new Function(`const p = ${peerOf('밥')}; return !!(p && p.s && p.s.two === 'bow' && p.s.chg > 0.5);`)), 'a drawn bow is seen');
  await B.evaluate(() => { clearInterval(MP.testHold); USE.kind = null; R.hand.bow = 0; INV.slots[INV.sel] = null; });
  // mobs: a lit creeper, a sitting wolf, a sheared sheep, a damaged wither's health
  await A.evaluate(([X, Y, Z]) => { const c = spawnMob('creeper', X - 5.5, Y, Z + 5.5); c.persistent = true; window.__cr = c; const w = spawnMob('wolf', X - 3.5, Y, Z + 5.5); w.owner = 'player'; w.sitting = 1; window.__wf = w; const s = spawnMob('sheep', X - 1.5, Y, Z + 5.5); window.__sh = s; }, pos); await wait(1500);
  await A.evaluate(() => { __cr.fuse = 12; __cr.target = PL; MP.testHold = setInterval(() => { if (!__cr.dead) __cr.fuse = 12; }, 20); setSheared(__sh); });
  ok(await until(B, id => ENT.some(e => e.remote && e.rid === id && e.fuse > 0), await A.evaluate(() => __cr.mpid)), 'a creeper about to blow flashes on the guests\' screens');
  ok(await until(B, id => ENT.some(e => e.remote && e.rid === id && e.sitting), await A.evaluate(() => __wf.mpid)), 'a sitting wolf sits there too');
  ok(await until(B, id => ENT.some(e => e.remote && e.rid === id && e.sheared), await A.evaluate(() => __sh.mpid)), 'a sheep sheared later loses its wool there too');
  await A.evaluate(() => { clearInterval(MP.testHold); removeEnt(__cr); });
  // falling sand and a skeleton's arrow
  await A.evaluate(([X, Y, Z]) => { MP.local = true; setBlock(X + 4, Y + 3, Z + 4, BID.sand); MP.local = false; W.onFall(X + 4, Y + 3, Z + 4, BID.sand, 0); }, pos);
  ok(await until(B, () => ENT.some(e => e.kind === 'mpfx' && e.fk === 'falling' && !e.dead), null, 6000), 'a falling block is seen falling');
  await A.evaluate(([X, Y, Z]) => { const sk = spawnMob('skeleton', X + 6.5, Y, Z - 6.5); sk.persistent = true; window.__sk = sk; for (let i = 0; i < 4; i++) setTimeout(() => shootArrow(X + 6.5, Y + 1.5, Z - 6.5, -0.3, 0.25, 0, sk, 2), i * 300); }, pos);
  ok(await until(B, () => ENT.some(e => e.kind === 'mpfx' && e.fk === 'arrow' && !e.dead), null, 8000), 'a skeleton\'s arrow is seen flying');
  // a ghast fireball aimed at a guest hits the guest
  const h0 = await B.evaluate(([X, Y, Z]) => { PL.mode = 'survival'; PL.health = 20; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; return PL.health; }, pos); await wait(1500);
  await A.evaluate(([X, Y, Z]) => { PL.x = X + .5; PL.z = Z - 7.5; const g = spawnMob('ghast', X + .5, Y + 6, Z + 8.5); g.persistent = true; window.__gh = g; spawnFireball(X + .5, Y + 0.5, Z + 4.5, 0, 0, -1, g, false); }, pos);
  ok(await until(B, h0 => PL.health < h0, h0, 10000), 'a ghast\'s fireball hurts the guest it reaches');
  await A.evaluate(() => removeEnt(__gh));
  // breaking a block: the others hear it
  await C.evaluate(() => { window.__bfx = 0; const g = mpGotBfx; mpGotBfx = function (m) { if (m.k === 'break') __bfx++; return g.apply(this, arguments); }; });
  await B.evaluate(([X, Y, Z]) => { PL.mode = 'survival'; MP.local = true; try { breakBlock(X - 9, Y + 1, Z); } finally { MP.local = false; } }, pos);
  ok(await until(C, () => __bfx > 0, null, 8000), 'another player breaking a block is heard (and its pieces fly)');
  // digging cracks: B digs a stone block in the wall by hand
  await A.evaluate(([X, Y, Z]) => { MP.local = true; setBlock(X - 9, Y + 1, Z + 2, BID.stone); MP.local = false; }, pos); await wait(1500);
  await B.evaluate(([X, Y, Z]) => { PL.x = X - 6.5; PL.y = Y; PL.z = Z + 2.5; PL.yaw = Math.PI / 2; PL.pitch = 0; INV.slots[INV.sel] = null; MP.testHold = setInterval(() => { IN.attack = true; PL.yaw = Math.PI / 2; PL.pitch = 0; }, 20); }, pos);
  ok(await until(A, new Function(`const p = ${peerOf('밥')}; return !!(p && p.crack && p.crack.visible);`)), 'the cracks in a block someone digs are seen', await B.evaluate(() => [MINE.prog, TARGET && TARGET.type, TARGET && TARGET.x]));
  await B.evaluate(() => { clearInterval(MP.testHold); IN.attack = false; });
  // lightning: the runner's bolt is seen by everyone; a guest's bolt is struck by the runner
  await B.evaluate(() => { window.__bolt = 0; const f = mpBoltFx; mpBoltFx = function () { __bolt++; return f.apply(this, arguments); }; });
  await A.evaluate(() => { window.__strk = 0; const sl = strikeLightning; strikeLightning = function () { __strk++; return sl.apply(this, arguments); }; });
  await A.evaluate(([X, Y, Z]) => strikeLightning(X + 8, Y, Z + 8, false), pos);
  ok(await until(B, () => __bolt > 0, null, 5000), 'lightning is seen by the guests');
  await A.waitForTimeout(1500);
  await B.evaluate(([X, Y, Z]) => strikeLightning(X - 8, Y, Z - 8, false), pos);
  ok(await until(A, () => __strk > 1, null, 5000), 'a guest\'s lightning (channeling) is struck in the shared world');
  // a name tag: a guest names the runner's cow; everyone's copy has the name
  const cowId = await A.evaluate(([X, Y, Z]) => { const c = spawnMob('cow', X + 3.5, Y, Z + 6.5); c.persistent = true; window.__nc = c; return c.mpid || (c.mpid = mpNewId()); }, pos); await wait(1500);
  await B.evaluate(([X, Y, Z, id]) => { PL.x = X + 3.5; PL.y = Y; PL.z = Z + 4.5; const c = ENT.find(e => e.remote && e.rid === id && !e.dead); INV.slots[INV.sel] = { id: IID.name_tag, n: 1, name: '음메' }; TARGET = { type: 'ent', e: c, t: 1 }; USE.placeCd = 0; useItem(true); }, [...pos, cowId]);
  ok(await until(A, () => __nc.name === '음메'), 'a guest\'s name tag names the runner\'s mob');
  ok(await until(C, id => ENT.some(e => e.remote && e.rid === id && e.name === '음메'), cowId), 'and the name shows on the other screens');
  // a record in a jukebox is heard by the others
  await A.evaluate(([X, Y, Z]) => { MP.local = true; setBlock(X + 6, Y, Z - 4, BID.jukebox); MP.local = false; }, pos); await wait(1500);
  await C.evaluate(() => { window.__disc = 0; const pd = playDisc; playDisc = function () { __disc++; return pd.apply(this, arguments); }; });
  await B.evaluate(([X, Y, Z]) => { PL.x = X + 5.5; PL.z = Z - 2.5; INV.slots[INV.sel] = { id: IID.music_disc_cat, n: 1 }; TARGET = { type: 'block', x: X + 6, y: Y, z: Z - 4, nx: 0, ny: 1, nz: 0, id: BID.jukebox, m: 0, t: 2 }; USE.placeCd = 0; MP.local = true; try { useItem(true); } finally { MP.local = false; } }, pos);
  ok(await until(C, () => __disc > 0, null, 10000), 'a record someone puts in a jukebox plays for the others');
  await B.evaluate(([X, Y, Z]) => { INV.slots[INV.sel] = null; TARGET = { type: 'block', x: X + 6, y: Y, z: Z - 4, nx: 0, ny: 1, nz: 0, id: BID.jukebox, m: 0, t: 2 }; USE.placeCd = 0; MP.local = true; try { useItem(true); } finally { MP.local = false; } }, pos);
  ok(await until(C, ([x, y, z]) => !PLAYING.has(x + ',' + y + ',' + z), [X + 6, Y, Z - 4], 10000), 'and stops for them when taken out');
  // a door opened by someone is heard
  await C.evaluate(() => { window.__snd = []; const g = play; play = function (n) { if (MP.sndIn) __snd.push(n); return g.apply(this, arguments); }; });
  await A.evaluate(([X, Y, Z]) => { MP.local = true; setBlock(X + 2, Y, Z - 4, BID.oak_door, 0); setBlock(X + 2, Y + 1, Z - 4, BID.oak_door, 8); MP.local = false; }, pos); await wait(1500);
  await B.evaluate(([X, Y, Z]) => { PL.x = X + 2.5; PL.z = Z - 2.5; INV.slots[INV.sel] = null; TARGET = { type: 'block', x: X + 2, y: Y, z: Z - 4, nx: 0, ny: 0, nz: 1, id: BID.oak_door, m: 0, t: 2 }; USE.placeCd = 0; useItem(true); }, pos);
  ok(await until(C, () => __snd.length > 0, null, 8000), 'a door someone opens is heard nearby', await C.evaluate(() => __snd));
};
