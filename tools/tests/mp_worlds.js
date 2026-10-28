// a server keeps every world made on it, like single-player worlds: two players each make one, both stay listed after
// everyone has left, either can be joined again with what was built there, and an uploaded world is added beside them
module.exports = async ({ ok, srv, b, lib }) => {
  const enter = async P => { await P.waitForFunction(() => W.active && W.meta && W.meta.server && UI.menu !== 'loading', null, { timeout: 90000 }); await P.evaluate(() => { showMenu(null); UI.paused = false; }); await P.waitForTimeout(2500); };
  const make = async (P, name, seed) => {
    await P.evaluate(async u => { showMenu('mp_join'); await mpJoinWs(u, null, '+'); }, srv.ws);
    await P.evaluate(([n, s]) => { $('mpWName').value = n; $('mpSeed').value = s; $('mpMode').value = 'creative'; return mpAction('mp_createworld'); }, [name, seed]);
    await enter(P);
  };
  const rooms = () => fetch(srv.url + 'rooms').then(r => r.json()).catch(() => null);
  const A = await lib.page(b, srv, { w: 480, h: 300, name: '앨리스' }), B = await lib.page(b, srv, { w: 480, h: 300, name: '밥' });
  await make(A, '앨리스 섬', '11');
  const at = await A.evaluate(() => { const x = Math.floor(PL.x) + 2, z = Math.floor(PL.z), y = 150; setBlock(x, y, z, BID.emerald_block); return [x, y, z]; });
  await make(B, '밥 마을', '22');
  await A.waitForTimeout(4000);
  for (const P of [A, B]) await P.evaluate(() => { mpStop(); quitToTitle(); });
  await A.waitForTimeout(6000);
  const r1 = await rooms();
  const names = r1 && r1.worlds ? r1.worlds.map(w => w.name).sort() : [];
  ok(names.length === 2 && names[0] === '밥 마을' && names[1] === '앨리스 섬', 'both worlds stay on the server after everyone has left', r1);
  const listed = await B.evaluate(async u => { MPL.addr = u; await mpRefreshList(u); await new Promise(r => setTimeout(r, 1500)); return mpListHtml(); }, srv.ws);
  ok(/앨리스 섬/.test(listed) && /밥 마을/.test(listed) && /새 서버 세계 만들기/.test(listed), 'every player sees all of them, and can make another', listed.slice(0, 300));
  // B joins the world A made, though A is gone
  const aid = r1.worlds.find(w => w.name === '앨리스 섬').id;
  await B.evaluate(async ([u, id]) => { showMenu('mp_join'); await mpJoinWs(u, null, id); }, [srv.ws, aid]);
  await enter(B);
  const seen = await B.evaluate(([x, y, z]) => new Promise(res => { let n = 0; const t = setInterval(() => { if (getBlock(x, y, z) === BID.emerald_block || ++n > 40) { clearInterval(t); res({ name: W.meta.name, block: getBlock(x, y, z) === BID.emerald_block }); } }, 250); }), at);
  ok(seen.name === '앨리스 섬' && seen.block, 'anyone can go back into a world at any time, as it was left', seen);
  await B.evaluate(() => { mpStop(); quitToTitle(); }); await B.waitForTimeout(3000);
  // a single-player world uploaded: a third server world, joined right away
  await A.evaluate(() => createWorld({ name: '내 세계', seed: '33', mode: 'creative', diff: 2, cheats: true }));
  await A.waitForFunction(() => W.active && UI.menu !== 'loading', null, { timeout: 90000 }); await A.waitForTimeout(1500);
  await A.evaluate(u => { showMenu('mp_host'); const ad = $('mpAddr'); if (ad) ad.value = u; return mpAction('mp_upload'); }, srv.ws);
  await enter(A);
  const r2 = await rooms();
  ok(r2 && r2.worlds && r2.worlds.length === 3 && r2.worlds.some(w => w.name === '내 세계'), 'an uploaded world joins the list instead of being refused', r2 && r2.worlds);
  ok(await A.evaluate(() => W.meta.server && W.meta.name === '내 세계'), 'and its maker plays it on the server straight away');
  ok(!A.errs.length && !B.errs.length, 'no page errors', [...A.errs, ...B.errs]);
  await A.evaluate(() => mpStop());
};
