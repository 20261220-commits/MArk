// a player whose tab dies, garbage sent to the server, the join screen's list and room codes, opening your own world
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B, C } = await lib.threePlayers(b, srv);
  await A.evaluate(() => { const p = [...MP.peers.values()].find(q => q.name === '밥'); window.__bm = p && mpAvatar(p); });
  await B.context().close(); await A.waitForTimeout(6000);
  const left = await A.evaluate(() => [...MP.peers.values()].map(p => p.name));
  ok(left.length === 1 && left[0] === '철수', 'a player whose tab dies is gone from the others', left);
  ok(await A.evaluate(() => !!window.__bm && !__bm.parent), 'no ghost figure is left behind');
  await C.evaluate(async ws => { const s = new WebSocket(ws); await new Promise(r => s.onopen = r); const send = o => s.send(typeof o === 'string' ? o : JSON.stringify(o));
    send('not json'); send({ t: 'hello', role: 'join' }); await new Promise(r => setTimeout(r, 300));
    for (const o of [{ t: 'join', name: { x: 1 } }, { t: 'pl', x: 'a', dim: null }, { t: 'chunk', cx: 1e12, cz: -1e12, dim: 'x' }, { t: 'sets', l: 'notalist' }, { t: 'tile', dk: 5, tile: null }, { t: 'store', dk: '../../x', rec: { b: 1 } }, { t: 'mobsnap', l: 7 }, { t: 'pdata', d: 'x' }, { t: 'hit', e: 'x', dmg: 1e9 }, { t: 'adv', id: 'story/root' }, { t: 'setl', l: [{ x: 'a' }] }, { t: 'tslots', ch: 'x' }, { t: 'ride2', e: null }]) send(o);
    send('{"t":"chat","name":"x","text":"' + 'a'.repeat(100000) + '"}'); await new Promise(r => setTimeout(r, 1500)); s.close(); }, srv.ws);
  await A.waitForTimeout(2000);
  const st = await A.evaluate(async u => { try { const r = await fetch(u + 'rooms'); return r.status; } catch (e) { return 'down'; } }, srv.url);
  ok(st === 200, 'the server keeps running after garbage', st);
  ok(await A.evaluate(() => MP.on && !!MP.link && MP.peers.size === 1), 'the others stay connected');
  ok(await A.evaluate(() => !UI.msgs.some(m => m.t.length > 300)), 'an enormous chat line is cut down');
  const fs = require('fs'), path = require('path'); ok(!fs.existsSync(path.join(lib.root, 'x.json')), 'a stored chunk key can\'t climb out of the worlds folder');
  // the join screen: lists the server world and a player's open world, joins by its button, refuses a wrong code
  const H = await lib.page(b, srv, { name: '하나' }); await lib.newWorld(H);
  await H.evaluate(() => { showMenu('mp_host'); }); await H.evaluate(() => mpAction('mp_hostws')); await H.waitForTimeout(1500);
  const code = await H.evaluate(() => MP.roomCode); ok(/^[A-Z2-9]{4}$/.test(code || ''), 'opening a world on the server gives a room code', code);
  const G = await lib.page(b, srv, { name: '둘' }); await G.evaluate(() => mpAction('mp_join')); await G.waitForTimeout(2500);
  const list = await G.evaluate(() => [...document.querySelectorAll('#mpList .mpi b')].map(e => e.textContent));
  ok(list.some(t => /서버 세계/.test(t) || /🌍/.test(t)) && list.some(t => /하나님의 세계/.test(t)), 'the join screen lists the server world and the open world', list);
  await G.evaluate(c => document.querySelector(`[data-act="mp_go:${c}"]`).click(), code);
  await G.waitForFunction(() => W.active && UI.menu !== 'loading', null, { timeout: 60000 }).catch(() => {}); await G.waitForTimeout(3000);
  ok(await G.evaluate(c => MP.on && MP.roomCode === c && MP.peers.size === 1, code), 'its join button enters that world');
  const W2 = await lib.page(b, srv, { name: '셋' }); await W2.evaluate(() => mpAction('mp_join')); await W2.waitForTimeout(1000);
  await W2.fill('#mpRoom', 'zzzz'); await W2.click('[data-act="mp_code"]'); await W2.waitForTimeout(1500);
  ok(/방 코드 ZZZZ/.test(await W2.evaluate(() => MP.status)), 'a wrong room code is refused with a message');
  const errs = [...A.errs, ...C.errs, ...H.errs, ...G.errs]; ok(!errs.length, 'no page errors', errs);
};
