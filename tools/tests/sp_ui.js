// keyboard screens, focus loss, the title screen, window sizes
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p);
  const st = () => p.evaluate(() => [UI.menu || '-', UI.screen || '-', UI.chatOpen ? 'chat' : '-'].join('/'));
  await p.mouse.click(400, 300); await p.waitForTimeout(300);
  const seq = [['KeyE', '-/inv/-'], ['KeyE', '-/-/-'], ['KeyE', '-/inv/-'], ['Escape', '-/-/-'], ['Escape', 'pause/-/-'], ['Escape', '-/-/-'], ['KeyT', '-/-/chat'], ['Escape', '-/-/-'], ['KeyL', '-/adv/-'], ['KeyE', '-/adv/-'], ['KeyL', '-/-/-']];
  const got = []; for (const [k] of seq) { await p.keyboard.press(k); await p.waitForTimeout(250); got.push(await st()); }
  ok(got.every((g, i) => g === seq[i][1]), 'E, Esc, T and L open and close the right screens', got.map((g, i) => seq[i][0] + '→' + g));
  await p.keyboard.press('KeyT'); await p.waitForTimeout(200); await p.keyboard.type('hello e'); const typing = await st(); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
  ok(typing === '-/-/chat' && await st() === '-/-/-' && await p.evaluate(() => UI.msgs.some(m => /hello e/.test(m.t))), 'typing "e" in the chat stays in the chat and sends it', typing);
  await p.evaluate(() => { PL.inv = 0; hurtPlayer(100, 'generic'); }); await p.waitForTimeout(400);
  const dead = []; for (const k of ['KeyE', 'Escape', 'KeyT']) { await p.keyboard.press(k); await p.waitForTimeout(200); dead.push(await st()); }
  ok(dead.every(d => d === 'death/-/-'), 'keys do nothing on the death screen', dead);
  await p.evaluate(() => document.querySelector('[data-act="respawn"]').click()); await p.waitForTimeout(400);
  ok(await st() === '-/-/-' && !(await p.evaluate(() => PL.dead)), 'respawn returns to the game');
  await p.evaluate(() => { IN.f = 1; IN.jump = true; window.dispatchEvent(new Event('blur')); });
  ok(await p.evaluate(() => !IN.f && !IN.jump), 'losing focus lets go of held keys');
  // title screen: advancements of a saved world
  await p.evaluate(() => { advGrant('story/root'); quitToTitle(); }); await p.waitForTimeout(2500);
  await p.evaluate(() => document.querySelector('[data-act="advs"]').click()); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelector('[data-act^="advw_"]').click()); await p.waitForTimeout(600);
  ok(await p.evaluate(() => UI.menu === 'advview' && document.querySelectorAll('.adn.done').length >= 1), 'the title screen shows a saved world\'s advancements');
  // window sizes: every screen fits
  const out = [];
  for (const [w, h] of [[1024, 600], [1366, 768], [1920, 1080]]) {
    const q = await lib.page(b, srv, { w, h }); await lib.newWorld(q);
    for (const s of ['inv', 'craft', 'chest', 'furnace', 'enchant', 'anvil', 'brewing', 'creative', 'adv', 'stonecutter', 'loom']) {
      const o = await q.evaluate(s => { const X = Math.floor(PL.x), Y = Math.floor(PL.y) + 3, Z = Math.floor(PL.z);
        if (s === 'chest') { setBlock(X, Y, Z, BID.chest); setTile(X, Y, Z, { type: 'chest', items: new Array(27).fill(null) }); }
        if (s === 'furnace') { setBlock(X, Y, Z, BID.furnace); setTile(X, Y, Z, newFurnace()); }
        if (s === 'brewing') { setBlock(X, Y, Z, BID.brewing_stand); setTile(X, Y, Z, newBrewing()); }
        if (s === 'creative') PL.mode = 'creative'; UI.openScreen(s === 'creative' ? 'inv' : s, { x: X, y: Y, z: Z });
        const pn = document.querySelector('#screen .panel'), r = pn && pn.getBoundingClientRect(); UI.closeScreen(); PL.mode = 'survival';
        return !r ? s + ' no panel' : r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 ? s + ' outside' : null; }, s);
      if (o) out.push(w + 'x' + h + ' ' + o); }
    await q.close(); }
  ok(!out.length, 'every screen fits at 1024x600, 1366x768 and 1920x1080', out);
  ok(!p.errs.length, 'no page errors', p.errs);
};
