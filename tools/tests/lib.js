// Test harness: starts the game server on a free port with a throw-away worlds folder, opens headless Chromium pages
// (Playwright), and offers small helpers. Playwright is not a dependency of the game; the runner says how to get it.
const path = require('path'), fs = require('fs'), os = require('os'), net = require('net'), { spawn } = require('child_process');
const root = path.join(__dirname, '..', '..');
function playwright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright', path.join(process.execPath, '..', '..', 'lib', 'node_modules', 'playwright')]) { try { return require(p); } catch (e) {} }
  return null;
}
const freePort = () => new Promise(res => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
async function startServer() {
  const port = await freePort(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-test-'));
  const proc = spawn(process.execPath, [path.join(root, 'tools', 'server.js')], { env: { ...process.env, PORT: String(port), WORLDS_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; proc.stdout.on('data', d => { log += d; }); proc.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 100 && !/멀티플레이 주소/.test(log); i++) await new Promise(r => setTimeout(r, 100));
  return { port, url: 'http://localhost:' + port + '/', ws: 'ws://localhost:' + port + '/mp', log: () => log, stop: () => { proc.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} } };
}
async function browser() { const pw = playwright(); return pw.chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); }
// a page with the game loaded; errs collects page errors
async function page(b, srv, { w = 960, h = 600, name } = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }), p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(String(e.stack || e).slice(0, 300)));
  await p.goto(srv.url); await p.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await p.evaluate(([n, ws]) => { if (n) { MP.name = n; localStorage.setItem('nemo-mp-name', n); } localStorage.setItem('nemo-mp-addr', ws); }, [name, srv.ws]);
  return p;
}
async function newWorld(p, mode = 'survival', seed = '12345') {
  await p.evaluate(([m, s]) => createWorld({ name: 't', seed: s, mode: m, diff: 2, cheats: true }), [mode, seed]);
  await p.waitForFunction(() => W.active && UI.menu !== 'loading', null, { timeout: 90000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { showMenu(null); UI.paused = false; });
}
// three players in a fresh server world: A runs it, B and C are guests, standing on a walled stone pad high up
async function threePlayers(b, srv) {
  const enter = async P => { await P.waitForFunction(() => W.active && W.meta && W.meta.server && UI.menu !== 'loading', null, { timeout: 90000 }); await P.evaluate(() => { showMenu(null); UI.paused = false; }); await P.waitForTimeout(2500); };
  const A = await page(b, srv, { w: 480, h: 300, name: '앨리스' });
  await A.evaluate(async u => { showMenu('mp_join'); await mpJoinWs(u); }, srv.ws);
  await A.evaluate(() => { $('mpSeed').value = '555'; $('mpMode').value = 'survival'; $('mpCheats').checked = true; return mpAction('mp_createworld'); });
  await enter(A);
  const B = await page(b, srv, { w: 480, h: 300, name: '밥' }); await B.evaluate(u => mpJoinWs(u), srv.ws); await enter(B);
  const C = await page(b, srv, { w: 480, h: 300, name: '철수' }); await C.evaluate(u => mpJoinWs(u), srv.ws); await enter(C);
  const pos = await A.evaluate(() => { const x = Math.floor(PL.x), y = 120, z = Math.floor(PL.z); PL.mode = 'creative';
    for (let a = -9; a <= 9; a++) for (let c = -9; c <= 9; c++) { MP.local = true; setBlock(x + a, y - 1, z + c, BID.stone); const wall = Math.abs(a) === 9 || Math.abs(c) === 9; for (let k = 0; k < 4; k++) setBlock(x + a, y + k, z + c, wall ? BID.glass : 0); MP.local = false; }
    PL.x = x + .5; PL.y = y; PL.z = z - 2.5; PL.mode = 'survival'; PL.vx = PL.vy = PL.vz = 0; PL.health = 20; return [x, y, z]; });
  await A.waitForTimeout(2000);
  for (const [P, dx, dz] of [[B, 0.5, 0.5], [C, 2.5, 0.5]]) await P.evaluate(([p, dx, dz]) => { PL.x = p[0] + dx; PL.y = p[1]; PL.z = p[2] + dz; PL.vx = PL.vy = PL.vz = 0; PL.mode = 'survival'; PL.health = 20; PL.flying = false; PL.fallDist = 0; }, [pos, dx, dz]);
  await A.waitForTimeout(2500);
  return { A, B, C, pos };
}
module.exports = { root, playwright, startServer, browser, page, newWorld, threePlayers };
