// private servers: a single-player world made into a private server world (never listed, joined only with the invite
// code), kept in step with the single-player world both ways: what happened on the server comes into the world's
// copy here, and what was played offline goes up the next time
module.exports = async ({ ok, srv, b, lib }) => {
  const enter = async P => { await P.waitForFunction(() => W.active && W.meta && W.meta.server && UI.menu !== 'loading', null, { timeout: 120000 }); await P.evaluate(() => { showMenu(null); UI.paused = false; }); await P.waitForTimeout(2500); };
  const stub = P => P.evaluate(() => { window.confirm = () => true; window.alert = m => { window.__alert = m; }; window.prompt = (m, v) => { window.__code = v; return v; }; });
  const A = await lib.page(b, srv, { w: 480, h: 300, name: '앨리스' }); await stub(A);
  await lib.newWorld(A, 'creative');
  const at = await A.evaluate(async () => { const x = Math.floor(PL.x) + 2, y = 150, z = Math.floor(PL.z); setBlock(x, y, z, BID.gold_block); saveAll(true); await new Promise(r => setTimeout(r, 800)); const id = W.id; quitToTitle(); return { x, y, z, id }; });
  await A.evaluate(id => { privCreate(id); }, at.id); await enter(A);
  const code = await A.evaluate(() => window.__code);
  const s1 = await A.evaluate(() => ({ server: !!(W.meta && W.meta.server) }));
  ok(s1.server && /^w[a-z0-9]+\.[A-Z0-9]{10}$/.test(code || ''), 'a single-player world becomes a private server world, with an invite code', [s1, code]);
  const rooms = await fetch(srv.url + 'rooms').then(r => r.json());
  ok(!rooms.worlds.some(w => w.id === code.split('.')[0]), 'the private world is not listed on the server', rooms.worlds);
  // a friend: without the code, turned away; with it, in
  const B = await lib.page(b, srv, { w: 480, h: 300, name: '밥' }); await stub(B);
  const refused = await B.evaluate(async ([ws, wid]) => { try { showMenu('mp_join'); await mpJoinWs(ws, null, wid); return null; } catch (e) { mpStop && MP.on && mpStop(); return e.message; } }, [srv.ws, code.split('.')[0]]);
  ok(/초대 코드/.test(refused || ''), 'without the invite code the world turns you away', refused);
  await B.evaluate(c => { showMenu('worlds'); privJoinCode(c); }, code); await enter(B);
  const seen = await B.evaluate(([x, y, z]) => new Promise(res => { let n = 0; const t = setInterval(() => { if (getBlock(x, y, z) === BID.gold_block || ++n > 60) { clearInterval(t); res(getBlock(x, y, z) === BID.gold_block); } }, 500); }), [at.x, at.y, at.z]);
  ok(seen, 'with the code a friend gets in and sees the world as it was in single player', seen);
  // the friend builds; the owner leaves: the single-player world takes it in
  await B.evaluate(([x, y, z]) => { MP.local = true; try { setBlock(x + 1, y, z, BID.diamond_block); } finally { MP.local = false; } }, [at.x, at.y, at.z]); /* (as a player's own placing is sent) */ await B.waitForTimeout(4000);
  const reached = await A.evaluate(([x, y, z]) => new Promise(res => { let n = 0; const t = setInterval(() => { if (getBlock(x + 1, y, z) === BID.diamond_block || ++n > 80) { clearInterval(t); res(getBlock(x + 1, y, z) === BID.diamond_block); } }, 500); }), [at.x, at.y, at.z]); await A.waitForTimeout(3000);
  await A.evaluate(() => { mpStop(); quitToTitle(); }); await A.waitForTimeout(1000); await A.evaluate(() => PRIV.pulling); // (the server's copy written into the single-player world)
  const back = await A.evaluate(async ([x, y, z, id]) => { const m = (await listWorlds()).find(w => w.id === id); if (!m || !m.priv) return { priv: false };
    await startWorld(id, m); for (let i = 0; i < 120 && !(chunkAt(x >> 4, z >> 4) && chunkAt((x + 2) >> 4, z >> 4)); i++) await new Promise(r => setTimeout(r, 250)); await new Promise(r => setTimeout(r, 1500));
    for (let i = 0; i < 20 && getBlock(x + 1, y, z) !== BID.diamond_block; i++) await new Promise(r => setTimeout(r, 250));
    return { priv: true, gold: getBlock(x, y, z) === BID.gold_block, dia: getBlock(x + 1, y, z) === BID.diamond_block }; }, [at.x, at.y, at.z, at.id]);
  ok(back.priv && back.gold && back.dia, "the single-player world (still in the list, linked) has what the friend built on the server", { ...back, reached });
  // offline in single player: a block, then the server again
  await A.evaluate(async ([x, y, z]) => { setBlock(x + 2, y, z, BID.emerald_block); saveAll(true); await new Promise(r => setTimeout(r, 2500)); quitToTitle(); }, [at.x, at.y, at.z]);
  const dirty = await A.evaluate(async id => ((await listWorlds()).find(w => w.id === id).privDirty || []).length, at.id);
  await A.evaluate(async id => { const m = (await listWorlds()).find(w => w.id === id); privPlay(m); }, at.id); await enter(A);
  const up = await B.evaluate(([x, y, z]) => new Promise(res => { let n = 0; const t = setInterval(() => { if (getBlock(x + 2, y, z) === BID.emerald_block || ++n > 60) { clearInterval(t); res(getBlock(x + 2, y, z) === BID.emerald_block); } }, 500); }), [at.x, at.y, at.z]);
  const upA = await A.evaluate(([x, y, z]) => getBlock(x + 2, y, z) === BID.emerald_block, [at.x, at.y, at.z]);
  ok(dirty > 0 && (upA || up), 'what was built offline in single player goes up to the server the next time', { dirty, upA, up });
  ok(!A.errs.length && !B.errs.length, 'no page errors', [A.errs.slice(0, 2), B.errs.slice(0, 2)]);
  await A.evaluate(() => { mpStop(); }); await B.evaluate(() => { mpStop(); });
};
