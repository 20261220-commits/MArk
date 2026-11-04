// a friend's open world keeps a guest's things between sessions: logged in, after the friend closes the world and opens
// it again, and also after the guest changed the account's ID in between (such a world keeps no passwords, so the old
// ID's record has to be found from the earlier name the game sends)
module.exports = async ({ ok, srv, b, lib }) => {
  const H = await lib.page(b, srv, { name: '친구' }); await lib.newWorld(H);
  const open = async () => { await H.evaluate(() => showMenu('mp_host')); await H.evaluate(() => mpAction('mp_hostws')); await H.waitForTimeout(1500); return H.evaluate(() => MP.roomCode); };
  const reopen = async () => { const id = await H.evaluate(() => W.id); await H.evaluate(async () => { mpStop(); await new Promise(r => setTimeout(r, 800)); quitToTitle(); }); await H.waitForTimeout(1500);
    await H.evaluate(id => startWorld(id), id); await H.waitForFunction(() => W.active && UI.menu !== 'loading', null, { timeout: 60000 }); await H.waitForTimeout(1500); await H.evaluate(() => { showMenu(null); UI.paused = false; }); return open(); };
  const G = await lib.page(b, srv, { name: '나' });
  await G.evaluate(() => { showMenu('account'); $('accName').value = '나계정'; $('accPass').value = 'pw1234'; accLogin(); });
  const join = async code => { await G.evaluate(() => mpAction('mp_join')); await G.waitForTimeout(1500); await G.evaluate(c => mpAction('mp_go:' + c), code); await G.waitForFunction(() => W.active && UI.menu !== 'loading', null, { timeout: 60000 }); await G.waitForTimeout(3000); };
  const leave = async () => { await G.evaluate(() => mpSendPdata()); await G.waitForTimeout(1500); await G.evaluate(() => { mpStop(); showMenu('title'); }); await G.waitForTimeout(1500); };
  await join(await open());
  await G.evaluate(() => { INV.slots[3] = { id: IID.diamond, n: 17 }; UI.hudDirty = true; }); await leave();
  await join(await reopen());
  const again = await G.evaluate(() => INV.count(IID.diamond)); await leave();
  ok(again === 17, 'logged in: the things are there when the friend opens the world again', again);
  // the account's ID changes in between
  await G.evaluate(() => { showMenu('account'); if ($('accNewId')) { $('accNewId').value = '새계정'; $('accCurPw').value = 'pw1234'; accChange(); } return ACC.user && ACC.user.name; });
  const nm = await G.evaluate(() => ACC.user.name);
  await join(await reopen());
  const after = await G.evaluate(() => INV.count(IID.diamond)); const keys = await H.evaluate(() => Object.keys(W.meta.mpPlayers || {}));
  ok(nm === '새계정' && after === 17, 'after an ID change, still there', { nm, after, keys });
  await G.evaluate(() => { mpSendPdata(); }); await G.waitForTimeout(1500); await G.evaluate(() => { mpStop(); showMenu('title'); }); await G.waitForTimeout(1000);
  // the case from before this fix: after the ID change the guest came in and started over, so the new ID has a record
  // too, and the old one is still there: the game offers the old one, and taking it brings the things back
  await H.evaluate(() => { const P = W.meta.mpPlayers, mine = P['a:새계정']; P['a:나계정'] = JSON.parse(JSON.stringify(mine)); mine.inv = mine.inv.map(() => null); });
  await G.evaluate(() => { showMenu('account'); $('accNewId').value = '새새계정'; $('accCurPw').value = 'pw1234'; accChange(); ACC.prev = [{ name: '나계정', cred: accProof('나계정', 'pw1234') }, ...ACC.prev]; accSave(); }); // (an earlier ID that still has its record here)
  await H.evaluate(() => { const P = W.meta.mpPlayers; P['a:새새계정'] = P['a:새계정']; delete P['a:새계정']; }); // (the new ID's own record, empty)
  const code = await reopen(); await G.evaluate(() => { window.__asked = null; window.confirm = q => { window.__asked = q; return true; }; });
  await join(code); await G.waitForFunction(() => window.__asked, null, { timeout: 15000 }).catch(() => {});
  await G.waitForFunction(() => W.active && UI.menu !== 'loading' && INV.count(IID.diamond) > 0, null, { timeout: 60000 }).catch(() => {});
  const took = await G.evaluate(() => ({ asked: !!window.__asked && /나계정/.test(window.__asked), d: INV.count(IID.diamond), on: MP.on })), keys2 = await H.evaluate(() => Object.keys(W.meta.mpPlayers || {}));
  ok(took.asked && took.d === 17 && took.on && !keys2.includes('a:나계정'), 'a record left under an earlier ID is offered, and taking it brings the things back', { took, keys2 });
  const prevCopy = await G.evaluate(() => { const h0 = MIR.host; MIR.host = 'srv|w1'; const all = JSON.parse(localStorage.getItem('nemo-pdata') || '{}'); all['srv|w1|a:나계정'] = { d: { mark: 42 }, at: 5 }; localStorage.setItem('nemo-pdata', JSON.stringify(all)); const r = pdLoad() || pdLoadPrev(); MIR.host = h0; return r && r.d && r.d.mark; });
  ok(prevCopy === 42, 'this device\'s own copy of a server world record, kept under an earlier ID, is found too', prevCopy);
  for (const P of [H, G]) ok(!P.errs.length, 'no page errors', P.errs);
};
