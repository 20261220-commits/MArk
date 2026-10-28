// offline play: after one visit the game opens with no network at all, and the world saved before is still there
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative', '2468');
  const ready = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; for (let i = 0; i < 60; i++) { const c = await caches.open('nemo-offline-v1'), n = (await c.keys()).length; if (n > 40) return n; await new Promise(r => setTimeout(r, 500)); } return 0; });
  ok(ready > 40, 'the game\'s files are kept for offline use', ready);
  const saved = await p.evaluate(async () => { const x = Math.floor(PL.x), z = Math.floor(PL.z); setBlock(x, 200, z, BID.gold_block); INV.slots[0] = { id: IID.emerald, n: 5 }; saveAll(true); await new Promise(r => setTimeout(r, 800)); quitToTitle(); await new Promise(r => setTimeout(r, 800)); return { id: W.id || null, at: [x, 200, z] }; });
  await p.context().setOffline(true);
  await p.reload(); await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  ok(true, 'the game starts again without a network');
  const worlds = await p.evaluate(async () => (await listWorlds()).map(w => ({ id: w.id, name: w.name })));
  ok(worlds.length >= 1, 'the saved world is still listed', worlds);
  await p.evaluate(id => startWorld(id), worlds[0].id);
  await p.waitForFunction(() => W.active && UI.menu !== 'loading', null, { timeout: 90000 });
  const back = await p.evaluate(([x, y, z]) => new Promise(res => { let n = 0; const t = setInterval(() => { if (getBlock(x, y, z) === BID.gold_block || ++n > 40) { clearInterval(t); res({ block: getBlock(x, y, z) === BID.gold_block, em: INV.count(IID.emerald) }); } }, 250); }), saved.at);
  ok(back.block && back.em === 5, 'and it carries on where it was left', back);
  ok(!p.errs.length, 'no page errors', p.errs);
  await p.context().setOffline(false);
};
