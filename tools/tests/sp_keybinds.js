// key bindings (Java's 조작 설정): Esc → 조작법 lists every action with its key; click one, press a new key, and the
// game follows it everywhere (the old key does nothing); a key used twice shows red; Esc while choosing leaves no key;
// reset one or all; kept for the next start
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const key = (code, type = 'keydown') => p.evaluate(([code, type]) => document.body.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true })), [code, type]);
  const r = {};
  await p.evaluate(() => { delete OPT.keys; pauseGame(); }); await p.waitForTimeout(200);
  r.pauseBtn = await p.evaluate(() => { const b = [...document.querySelectorAll('#menu button')].find(x => x.textContent === '조작법'); if (b) b.click(); return [!!b, UI.menu, document.querySelectorAll('.kbkey').length]; });
  await p.evaluate(() => document.querySelector('[data-act="kbset_forward"]').click()); r.waiting = await p.evaluate(() => [KB.wait, document.querySelector('[data-act="kbset_forward"]').textContent]);
  await key('ArrowUp'); r.bound = await p.evaluate(() => [OPT.keys && OPT.keys.forward, document.querySelector('[data-act="kbset_forward"]').textContent]);
  await p.evaluate(() => document.querySelector('[data-act="kbset_inventory"]').click()); await key('KeyI');
  await p.evaluate(() => document.querySelector('[data-act="kbset_jump"]').click()); await key('KeyI'); // the same key twice: red
  r.dup = await p.evaluate(() => document.querySelectorAll('.kbkey.dup').length);
  await p.evaluate(() => document.querySelector('[data-act="kbset_jump"]').click()); await key('Escape'); r.none = await p.evaluate(() => [OPT.keys.jump, document.querySelector('[data-act="kbset_jump"]').textContent]);
  await p.evaluate(() => { document.querySelector('[data-act="kbreset_jump"]').click(); resumeGame(); }); await p.waitForTimeout(200);
  // in the game: the new keys work, the old ones don't
  await key('ArrowUp'); r.fwdNew = await p.evaluate(() => IN.f); await key('ArrowUp', 'keyup');
  await key('KeyW'); r.fwdOld = await p.evaluate(() => IN.f); await key('KeyW', 'keyup');
  await key('KeyE'); r.invOld = await p.evaluate(() => UI.screen || null);
  await p.evaluate(() => { window.__seen = []; addEventListener('keydown', e => __seen.push(e.code + ':' + (UI.menu || '-') + ':' + (UI.screen || '-'))); }); await key('KeyI'); r.invNew = await p.evaluate(() => UI.screen || null); r.dbg = await p.evaluate(() => __seen); await p.evaluate(() => UI.closeScreen());
  r.saved = await p.evaluate(() => (JSON.parse(localStorage.getItem(OPT_KEY) || '{}').keys) || null);
  await p.evaluate(() => { pauseGame(); showMenu('controls'); document.querySelector('[data-act="kbresetall"]').click(); }); r.reset = await p.evaluate(() => OPT.keys || null);
  ok(r.pauseBtn[0] && r.pauseBtn[1] === 'controls' && r.pauseBtn[2] > 25, 'Esc → 조작법 lists every action with its key', r.pauseBtn);
  ok(/누르세요/.test(r.waiting[1]) && r.bound[0] === 'ArrowUp' && r.bound[1] === '↑', 'click a key, press a new one: bound', [r.waiting, r.bound]);
  ok(r.dup === 2 && r.none[0] === 'Unbound' && r.none[1] === '없음', 'a key used twice shows red; Esc while choosing leaves no key', [r.dup, r.none]);
  ok(r.fwdNew === 1 && r.fwdOld === 0 && r.invOld === null && r.invNew === 'inv', 'in the game the new keys work and the old ones do nothing', r);
  ok(r.saved && r.saved.forward === 'ArrowUp' && r.reset === null, 'kept for the next start; reset all', [r.saved, r.reset]);
  // pausing and closing windows are two keys: with pause on P, P pauses and Esc no longer does, but Esc still closes
  // the inventory and P doesn't; with close on C, C closes it, Esc doesn't, and Esc still pauses
  const pz = await p.evaluate(async () => { const key = (code, type = 'keydown') => document.body.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
    OPT.keys = { pause: 'KeyP' }; showMenu(null); UI.paused = false; const o = {};
    key('Escape'); o.escOld = UI.menu || null; key('KeyP'); o.pNew = UI.menu || null; resumeGame(); showMenu(null); UI.paused = false;
    UI.openScreen('inv'); key('KeyP'); o.pKeep = UI.screen || null; key('Escape'); o.escClose = UI.screen || null;
    OPT.keys = { close: 'KeyC' }; showMenu(null); UI.paused = false;
    UI.openScreen('inv'); key('Escape'); o.escKeep = UI.screen || null; key('KeyC'); o.cClose = UI.screen || null;
    key('Escape'); o.escPause = UI.menu || null; resumeGame(); showMenu(null); UI.paused = false;
    showMenu('controls'); document.querySelector('[data-act="kbset_pause"]').click(); key('Escape'); o.backToEsc = OPT.keys ? OPT.keys.pause || 'default' : 'default';
    OPT.keys = { close: 'KeyC' }; showMenu('controls'); document.querySelector('[data-act="kbset_close"]').click(); key('Escape'); o.closeBack = OPT.keys ? OPT.keys.close || 'default' : 'default';
    o.red = document.querySelectorAll('.kbkey.dup, .kbdup').length;
    OPT.keys = { pause: 'Unbound', close: 'Unbound' }; showMenu(null); UI.paused = false; key('Escape'); o.safe = UI.menu || null; resumeGame(); showMenu(null); UI.paused = false;
    UI.openScreen('inv'); key('Escape'); o.safeClose = UI.screen || null; delete OPT.keys; resumeGame(); return o; });
  ok(pz.escOld === null && pz.pNew === 'pause' && pz.pKeep === 'inv' && pz.escClose === null && pz.escKeep === 'inv' && pz.cClose === null && pz.escPause === 'pause'
    && pz.backToEsc === 'default' && pz.closeBack === 'default' && pz.red === 0 && pz.safe === 'pause' && pz.safeClose === null,
    'pausing and closing windows are separate keys; Esc while choosing either goes back to Esc; with no key Esc still does both', pz);
  ok(!p.errs.length, 'no page errors', p.errs);
};
