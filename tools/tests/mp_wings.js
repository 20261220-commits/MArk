// another player is drawn with elytra wings only while they wear one (the wings' layer was made visible every frame,
// so everyone seemed to wear wings - a cape looked like a pair of wings), invisible or not
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B, pos } = await lib.threePlayers(b, srv), wait = ms => A.waitForTimeout(ms);
  const wings = () => B.evaluate(() => { const p = [...MP.peers.values()].find(q => q.name === '앨리스'); const m = p && p.m; return m ? { wings: !!(m.userData.mat2 && m.userData.mat2.visible), body: m.userData.mat.visible } : null; });
  await wait(2500); const w0 = await wings();
  await A.evaluate(() => { INV.armor[1] = { id: IID.elytra, n: 1 }; UI.hudDirty = true; }); await wait(2500); const w1 = await wings();
  await A.evaluate(() => { INV.armor[1] = null; addEffect(PL, 'invisibility', 600, 0); }); await wait(2500); const w2 = await wings();
  ok(w0 && w0.wings === false && w0.body === true, 'no elytra: no wings on the other player', w0);
  ok(w1 && w1.wings === true, 'an elytra worn: wings', w1);
  ok(w2 && w2.wings === false && w2.body === false, 'invisible without an elytra: nothing', w2);
  for (const P of [A, B]) ok(!P.errs.length, 'no page errors', P.errs);
};
