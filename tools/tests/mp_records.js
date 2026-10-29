// a server world keeps each player's things and place: after quitting to the title, after closing the tab outright,
// and for a player who never typed a name (the name made up for them is kept in this browser)
module.exports = async ({ ok, srv, b, lib }) => {
  const enter = async P => { await P.waitForFunction(() => W.active && W.meta && W.meta.server && UI.menu !== 'loading', null, { timeout: 90000 }); await P.evaluate(() => { showMenu(null); UI.paused = false; }); await P.waitForTimeout(2500); };
  const join = (P, url) => P.evaluate(async u => { MP.status = ''; showMenu('mp_join'); await mpJoinWs(u); }, url);
  const reopen = async ctx => { const P = await ctx.newPage(); P.errs = []; P.on('pageerror', e => P.errs.push(String(e).slice(0, 300))); await P.goto(srv.url); await P.waitForFunction(() => window.__game, null, { timeout: 60000 }); return P; };
  const A = await lib.page(b, srv, { w: 480, h: 300 }), ctx = A.context();
  const name0 = await A.evaluate(() => MP.name);
  await join(A, srv.ws); await A.evaluate(() => { $('mpSeed').value = '555'; $('mpMode').value = 'survival'; return mpAction('mp_createworld'); }); await enter(A);
  // quitting to the title straight after a change
  const at = await A.evaluate(() => { INV.slots[3] = { id: IID.diamond, n: 5 }; PL.x += 7; PL.z -= 4; PL.y = Math.floor(PL.y) + 20; PL.flying = true; PL.mode = 'creative'; return [Math.round(PL.x), Math.round(PL.z)]; });
  await A.waitForTimeout(400); await A.evaluate(() => quitToTitle()); await A.waitForTimeout(2500);
  const A2 = await reopen(ctx); const name1 = await A2.evaluate(() => MP.name);
  ok(name1 === name0, 'the made-up name stays with this browser', [name0, name1]);
  await join(A2, srv.ws); await enter(A2);
  const back = await A2.evaluate(() => ({ dia: INV.slots.some(s => s && s.id === IID.diamond && s.n === 5), x: Math.round(PL.x), z: Math.round(PL.z) }));
  ok(back.dia && Math.abs(back.x - at[0]) <= 1 && Math.abs(back.z - at[1]) <= 1, 'quitting to the title keeps the things and the place', [back, at]);
  // closing the tab without quitting
  const at2 = await A2.evaluate(() => { INV.slots[4] = { id: IID.emerald, n: 9 }; PL.x += 5; return [Math.round(PL.x), Math.round(PL.z)]; });
  await A2.waitForTimeout(400); await A2.close({ runBeforeUnload: true }); await A.close(); await new Promise(r => setTimeout(r, 2500));
  const A3 = await reopen(ctx); await join(A3, srv.ws); await enter(A3);
  const back2 = await A3.evaluate(() => ({ em: INV.slots.some(s => s && s.id === IID.emerald && s.n === 9), x: Math.round(PL.x), z: Math.round(PL.z) }));
  ok(back2.em && Math.abs(back2.x - at2[0]) <= 1, 'closing the tab keeps them too', [back2, at2]);
  ok(!A3.errs.length, 'no page errors', A3.errs);
};
