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
  // another account's name can't be a nickname
  await B.evaluate(() => { mpSend({ t: 'nick', name: 'bobacc2' }); });
  const C = await lib.page(b, srv, { w: 480, h: 300, name: '철수' });
  await C.evaluate(() => { ACC.user = { name: 'carl', nick: 'bobacc' }; ACC.cred = accProof('carl', 'pw9999'); accSave(); });
  const cErr = await C.evaluate(async u => { await mpJoinWs(u); await new Promise(r => setTimeout(r, 2500)); return [MP.status, W.active]; }, srv.ws);
  ok(shown[0] === '빵돌이' && /계정/.test(shown[1] || ''), 'logged in, the account screen changes the nickname (the account stays)', shown);
  ok(seen1.includes('빵돌이') && seen2.includes('새이름') && !seen2.includes('빵돌이'), 'others see the nickname, and a new one at once mid-game', [seen1, seen2]);
  ok(back === 7 && seen3.includes('새이름'), 'back in under the new nickname: the account\'s things are still there', [back, seen3]);
  ok(/다른 계정의 이름/.test(cErr[0]) && !cErr[1], 'another account\'s name can\'t be taken as a nickname', cErr);
  ok(![A, B, C].some(P => P.errs.length), 'no page errors', [A.errs, B.errs, C.errs]);
};
