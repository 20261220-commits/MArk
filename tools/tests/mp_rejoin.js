// a server world's player follows the server clock, and comes back by itself when the server restarts
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
module.exports = async ({ ok, b, lib }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-rj-')), port = await new Promise(r => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
  const start = () => new Promise(res => { const p = spawn(process.execPath, [path.join(lib.root, 'tools', 'server.js')], { env: { ...process.env, PORT: String(port), WORLDS_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; p.stdout.on('data', d => { log += d; if (/멀티플레이 주소/.test(log)) res(p); }); });
  let sp = await start(); const srv = { url: `http://localhost:${port}/`, ws: `ws://localhost:${port}/mp` };
  try {
    const P = await lib.page(b, srv, { w: 480, h: 300 });
    await P.evaluate(async u => { showMenu('mp_join'); await mpJoinWs(u); }, srv.ws);
    await P.evaluate(() => { $('mpSeed').value = '555'; $('mpMode').value = 'survival'; return mpAction('mp_createworld'); });
    await P.waitForFunction(() => W.active && W.meta && W.meta.server && UI.menu !== 'loading', null, { timeout: 90000 }); await P.evaluate(() => { showMenu(null); UI.paused = false; });
    const clock = await P.evaluate(async () => { await new Promise(r => setTimeout(r, 3000)); const t0 = W.time, r0 = performance.now(); await new Promise(r => setTimeout(r, 15000)); await new Promise(r => requestAnimationFrame(r)); return { rate: +((W.time - t0) / ((performance.now() - r0) / 1000)).toFixed(1), base: !!MP.timeAt }; });
    ok(clock.base && clock.rate > 18 && clock.rate < 22, 'the day goes at the server\'s 20 ticks a second, however slowly the page draws', clock);
    sp.kill('SIGKILL'); await P.waitForTimeout(3000);
    const lost = await P.evaluate(() => ({ on: MP.on, menu: UI.menu, st: MP.status }));
    ok(!lost.on && lost.menu === 'mp_join' && /다시 연결/.test(lost.st), 'when the server goes away the game keeps knocking', lost);
    await P.waitForTimeout(4000); sp = await start();
    let back = false; try { await P.waitForFunction(() => MP.on && W.active && W.meta && W.meta.server && UI.menu !== 'loading' && UI.menu !== 'mp_join', null, { timeout: 60000 }); back = true; } catch (e) {}
    ok(back, 'and is back in the same world once the server is up again', await P.evaluate(() => [MP.on, UI.menu, MP.status]));
    ok(!P.errs.length, 'no page errors', P.errs);
  } finally { sp.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
};
