// a logged-in player changes the nickname others see: the account (its things on the world) stays the same; mid-game the
// others see the new name at once; another account's name can't be taken as a nickname
module.exports = async ({ ok, srv, b, lib }) => {
  const enter = async P => { await P.waitForFunction(() => W.active && W.meta && W.meta.server && UI.menu !== 'loading', null, { timeout: 90000 }); await P.evaluate(() => { showMenu(null); UI.paused = false; }); await P.waitForTimeout(2500); };
  const A = await lib.page(b, srv, { w: 480, h: 300, name: '앨리스' });
  await A.evaluate(async u => { showMenu('mp_join'); await mpJoinWs(u); }, srv.ws);
  await A.evaluate(() => { $('mpSeed').value = '555'; $('mpMode').value = 'survival'; return mpAction('mp_createworld'); }); await enter(A);
  const B = await lib.page(b, srv, { w: 480, h: 300, name: '밥' });
  await B.evaluate(() => { ACC.user = { name: 'bobacc' }; ACC.cred = accProof('bobacc', 'pw1234'); accSave(); showMenu('account'); $('accNick').value = '빵돌이'; accNick(); });
  const shown = await B.evaluate(() => [accName(), (document.querySelector('h2') || {}).textContent]);
  await B.evaluate(u => mpJoinWs(u), srv.ws); await enter(B);
  const seen1 = await A.evaluate(() => [...MP.peers.values()].map(p => p.name));
  await B.evaluate(() => { INV.slots[0] = { id: IID.diamond, n: 7 }; mpSendPdata(); showMenu('account'); $('accNick').value = '새이름'; accNick(); showMenu(null); });
  await A.waitForTimeout(2500);
  const seen2 = await A.evaluate(() => [...MP.peers.values()].map(p => p.name));
  // back in after leaving: the same account's things
  await B.evaluate(() => { mpStop(); quitToTitle(); }); await B.waitForTimeout(1500);
  await B.evaluate(u => mpJoinWs(u), srv.ws); await enter(B);
  const back = await B.evaluate(() => INV.count(IID.diamond));
  const seen3 = await A.evaluate(() => [...MP.peers.values()].map(p => p.name));
  // the title's 계정 button opens the account screen; a new id and password (the current one checked first)
  const title = await B.evaluate(() => { mpStop(); quitToTitle(); showMenu('title'); const b = [...document.querySelectorAll('button')].find(x => x.textContent === '계정'); if (b) b.click(); return [!!b, !!$('accNick'), !!$('accNewId')]; });
  const wrong = await B.evaluate(() => { $('accNewId').value = 'bobnew'; $('accNewPw').value = 'pw5678'; $('accCurPw').value = 'nope'; accChange(); return [ACC.user.name, $('accStatus').textContent]; });
  const changed = await B.evaluate(() => { showMenu('account'); $('accNewId').value = 'bobnew'; $('accNewPw').value = 'pw5678'; $('accCurPw').value = 'pw1234'; accChange(); return [ACC.user.name, accName(), ACC.cred === accProof('bobnew', 'pw5678')]; });
  await B.evaluate(u => mpJoinWs(u), srv.ws); await enter(B);
  const moved = await B.evaluate(() => [INV.count(IID.diamond), MP.on, !!W.active]);
  await B.evaluate(() => { mpStop(); quitToTitle(); ACC.prev = []; accSave(); }); await B.waitForTimeout(1000);
  await B.evaluate(u => mpJoinWs(u), srv.ws); await enter(B); // the world knows the new id and password now, without the old ones
  const again = await B.evaluate(() => INV.count(IID.diamond));
  // another account's name can't be a nickname
  await B.evaluate(() => { mpSend({ t: 'nick', name: 'bobacc2' }); });
  const C = await lib.page(b, srv, { w: 480, h: 300, name: '철수' });
  await C.evaluate(() => { ACC.user = { name: 'carl', nick: 'bobnew' }; ACC.cred = accProof('carl', 'pw9999'); accSave(); });
  const cErr = await C.evaluate(async u => { await mpJoinWs(u); await new Promise(r => setTimeout(r, 2500)); return [MP.status, W.active]; }, srv.ws);
  ok(shown[0] === '빵돌이' && /계정/.test(shown[1] || ''), 'logged in, the account screen changes the nickname (the account stays)', shown);
  ok(seen1.includes('빵돌이') && seen2.includes('새이름') && !seen2.includes('빵돌이'), 'others see the nickname, and a new one at once mid-game', [seen1, seen2]);
  ok(back === 7 && seen3.includes('새이름'), 'back in under the new nickname: the account\'s things are still there', [back, seen3]);
  ok(/다른 계정의 이름/.test(cErr[0]) && !cErr[1], 'another account\'s name can\'t be taken as a nickname', cErr);
  ok(title[0] && title[1] && title[2], 'logged in, the title\'s 계정 button opens the account screen (nickname, id and password)', title);
  ok(wrong[0] === 'bobacc' && /맞지 않/.test(wrong[1]), 'a wrong current password changes nothing', wrong);
  ok(changed[0] === 'bobnew' && changed[1] === '새이름' && changed[2], 'a new id and password; the nickname stays', changed);
  ok(moved[0] === 7 && moved[1] && moved[2] && again === 7, 'the world moves the account to the new id and password on the next join: its things go along', [moved, again]);
  ok(![A, B, C].some(P => P.errs.length), 'no page errors', [A.errs, B.errs, C.errs]);
};
