// a logged-in player's record kept on their device too: when the server has lost it (or has an older one), joining brings
// it back; when another device played later, the server's newer record wins
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
module.exports = async ({ ok, b, lib }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-pd-')), port = await new Promise(r => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
  const start = () => new Promise(res => { const p = spawn(process.execPath, [path.join(lib.root, 'tools', 'server.js')], { env: { ...process.env, PORT: String(port), WORLDS_DIR: dir }, stdio: ['ignore', 'pipe', 'pipe'] }); let log = ''; p.stdout.on('data', d => { log += d; if (/멀티플레이 주소/.test(log)) res(p); }); });
  const stop = p => new Promise(r => { p.on('exit', r); p.kill('SIGTERM'); });
  let sp = await start(); const srv = { url: `http://localhost:${port}/`, ws: `ws://localhost:${port}/mp` };
  const enter = async P => { await P.waitForFunction(() => W.active && W.meta && W.meta.server && UI.menu !== 'loading', null, { timeout: 90000 }); await P.evaluate(() => { showMenu(null); UI.paused = false; }); await P.waitForTimeout(2500); };
  const login = P => P.evaluate(() => { showMenu('account'); $('accName').value = '하늘'; $('accPass').value = 'secret9'; accLogin(); });
  const join = (P, first) => P.evaluate(async ([u, first]) => { showMenu('mp_join'); const r = await mpJoinWs(u); if (first) { $('mpSeed').value = '777'; $('mpMode').value = 'survival'; await mpAction('mp_createworld'); } return r; }, [srv.ws, first]);
  const count = (P, key) => P.evaluate(k => INV.slots.reduce((n, s) => n + (s && s.id === IID[k] ? s.n : 0), 0), key);
  try {
    const A = await lib.page(b, srv, { w: 480, h: 300 }); await login(A); await join(A, true); await enter(A);
    await A.evaluate(() => { INV.slots[2] = { id: IID.diamond, n: 12 }; mpSendPdata(); }); await A.waitForTimeout(1500);
    const kept = await A.evaluate(() => { const l = pdLoad(); return l && { at: l.at, dirty: l.dirty, dia: (l.d.inv || []).some(s => s && s.n === 12) }; });
    ok(kept && kept.at > 0 && !kept.dirty && kept.dia, 'the device keeps a copy of the record with the server\'s stamp', kept);
    await A.evaluate(() => { mpStop(); quitToTitle(); }); await A.waitForTimeout(2000);
    // the server loses the record (an old backup, a world rebuilt from someone else's copy)
    await stop(sp); const wdir = fs.readdirSync(dir).map(d => path.join(dir, d)).find(d => fs.existsSync(path.join(d, 'world.json')));
    const st = JSON.parse(fs.readFileSync(path.join(wdir, 'world.json'), 'utf8')); const had = Object.keys(st.players || {}); st.players = {}; fs.writeFileSync(path.join(wdir, 'world.json'), JSON.stringify(st));
    sp = await start();
    await join(A, false); await enter(A);
    ok(await count(A, 'diamond') === 12, 'joining again brings the record back from the device', { had });
    await A.waitForTimeout(6000); await A.evaluate(() => { mpStop(); quitToTitle(); }); await A.waitForTimeout(6500);
    const st2 = JSON.parse(fs.readFileSync(path.join(wdir, 'world.json'), 'utf8'));
    ok(Object.values(st2.players || {}).some(r => (r.inv || []).some(s => s && s.n === 12)), 'and the server has it again', Object.keys(st2.players || {}));
    // another device plays later: its newer record (on the server) wins over this device's older copy
    const B = await lib.page(b, srv, { w: 480, h: 300 }); await login(B); await join(B, false); await enter(B);
    await B.evaluate(() => { INV.slots.fill(null); INV.slots[5] = { id: IID.emerald, n: 3 }; mpSendPdata(); }); await B.waitForTimeout(1500); await B.evaluate(() => { mpStop(); quitToTitle(); }); await B.waitForTimeout(2000);
    await join(A, false); await enter(A);
    ok(await count(A, 'emerald') === 3 && await count(A, 'diamond') === 0, 'a newer record from another device wins', [await count(A, 'emerald'), await count(A, 'diamond')]);
    for (const P of [A, B]) ok(!P.errs.length, 'no page errors', P.errs);
  } finally { sp.kill(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
};
