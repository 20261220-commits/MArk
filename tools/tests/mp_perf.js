// what made guests lag and drop: a guest's tick count stood still (every "each N ticks" job, its saved self sent to the
// server among them, ran on every tick), a runner in a background tab froze the others, and a dropped connection left
// the world instead of coming straight back
module.exports = async ({ ok, srv, b, lib }) => {
  const { A, B, C } = await lib.threePlayers(b, srv), wait = ms => A.waitForTimeout(ms);
  const count = P => P.evaluate(() => { window.__pd = 0; window.__t0 = W.tickN; const o = WebSocket.prototype.send; if (!window.__wrapped) { window.__wrapped = 1; WebSocket.prototype.send = function (s) { if (s.indexOf('"t":"pdata"') >= 0) __pd++; return o.call(this, s); }; } });
  await count(B); await wait(10000);
  const g = await B.evaluate(() => ({ pd: __pd, ticks: W.tickN - __t0 }));
  ok(g.pd <= 4 && g.ticks > 20, 'a guest\'s game ticks count on and its saved self goes to the server every 5 s, not every tick', g);
  // the runner's game goes to a background tab: another player there takes over, and keeps it when the first comes back
  const roles = () => Promise.all([A, B, C].map(P => P.evaluate(() => MP.role)));
  const r0 = await roles(); const run = [A, B, C][r0.indexOf('host')];
  await run.evaluate(() => mpSend({ t: 'away', on: 1 })); await wait(3000);
  const r1 = await roles();
  ok(r0.filter(r => r === 'host').length === 1 && r1.filter(r => r === 'host').length === 1 && r1.indexOf('host') !== r0.indexOf('host'), 'a runner whose game is in a background tab hands the dimension to a player who is playing', [r0, r1]);
  await run.evaluate(() => mpSend({ t: 'away', on: 0 })); await wait(2000);
  ok((await roles()).indexOf('host') === r1.indexOf('host'), 'coming back does not take it back (no switching to and fro)');
  // a guest's connection drops: it comes back into the same world by itself
  const gst = [A, B, C][(await roles()).indexOf('guest')];
  const at = await gst.evaluate(() => [PL.x, PL.z]);
  await gst.evaluate(() => MP.link.close()); await gst.waitForFunction(() => !MP.on || UI.menu === 'mp_join', null, { timeout: 10000 }).catch(() => {});
  let back = false; try { await gst.waitForFunction(() => MP.on && W.active && W.meta && W.meta.server && UI.menu !== 'loading' && UI.menu !== 'mp_join', null, { timeout: 30000 }); back = true; } catch (e) {}
  const at2 = await gst.evaluate(() => [PL.x, PL.z, MP.status, UI.menu]);
  ok(back && Math.hypot(at[0] - at2[0], at[1] - at2[1]) < 3, 'a guest whose connection drops is back in the world at once, where it was', [back, at, at2]);
  // the connection dies without the server noticing (the socket stays open, nothing comes through): the game gives up on
  // it by itself after 20 s of silence, and its new connection takes over the old one instead of "already playing"
  const g2 = [A, B, C][(await roles()).lastIndexOf('guest')];
  await g2.evaluate(() => { const l = MP.link; window.__oldLink = l; l.ws.onmessage = null; l.ws.send = () => {}; l.ws.close = () => {}; l.ws.onclose = null; }); // nothing in or out, and the socket stays open
  await g2.waitForFunction(() => !MP.on || UI.menu === 'mp_join', null, { timeout: 15000 }).catch(() => {});
  let back2 = false; try { await g2.waitForFunction(() => MP.on && W.active && W.meta && W.meta.server && UI.menu !== 'loading' && UI.menu !== 'mp_join' && MP.link !== window.__oldLink, null, { timeout: 40000 }); back2 = true; } catch (e) {}
  const names = await A.evaluate(() => [...MP.peers.values()].map(p => p.name));
  ok(back2 && new Set(names).size === names.length, 'a connection that died unnoticed: back in by itself, the old one replaced (not "already playing", no double)', [back2, names, await g2.evaluate(() => MP.status)]);
  ok(![A, B, C].some(P => P.errs.length), 'no page errors', [A.errs, B.errs, C.errs]);
};
