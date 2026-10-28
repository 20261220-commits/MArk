// the server world outlives a wiped disk without any backup settings: the players' browsers keep a copy, and the first
// one to connect to the empty server puts the world back
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
module.exports = async ({ ok, b, lib }) => {
  const port = 20000 + Math.floor(Math.random() * 1000), url = 'http://localhost:' + port + '/', ws = 'ws://localhost:' + port + '/mp';
  const run = async dir => {
    const p = spawn(process.execPath, [path.join(lib.root, 'tools', 'server.js')], { env: { ...process.env, PORT: String(port), WORLDS_DIR: dir, KEEP_AWAKE: '0', GITHUB_BACKUP_REPO: '', GITHUB_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
    for (let i = 0; i < 100 && !/멀티플레이 주소/.test(log); i++) await new Promise(r => setTimeout(r, 100));
    return { log: () => log, stop: () => new Promise(r => { p.on('exit', r); p.kill('SIGTERM'); }) };
  };
  const d1 = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-rs1-')), d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-rs2-'));
  const s1 = await run(d1);
  const A = await lib.page(b, { url, ws }, { w: 480, h: 300, name: '앨리스' });
  const enter = async () => { await A.waitForFunction(() => W.active && W.meta && W.meta.server && UI.menu !== 'loading', null, { timeout: 90000 }); await A.evaluate(() => { showMenu(null); UI.paused = false; }); await A.waitForTimeout(2500); };
  await A.evaluate(async u => { showMenu('mp_join'); await mpJoinWs(u); }, ws);
  await A.evaluate(() => { $('mpWName').value = '사본 세계'; $('mpSeed').value = '321'; $('mpMode').value = 'creative'; return mpAction('mp_createworld'); });
  await enter();
  // a block placed by the player who runs the Overworld, then everyone leaves
  const at = await A.evaluate(() => { const x = Math.floor(PL.x) + 2, z = Math.floor(PL.z), y = 150; setBlock(x, y, z, BID.diamond_block); INV.slots[0] = { id: IID.diamond, n: 9 }; return [x, y, z]; });
  await A.waitForTimeout(6000);
  await A.evaluate(() => { mpStop(); quitToTitle(); });
  await A.waitForTimeout(6000);
  const copy = await A.evaluate(async () => { const r = await mirGet('S|' + MIR.host); return r ? { name: r.state && r.state.meta && r.state.meta.name, n: Object.keys(r.vers).length } : null; });
  ok(copy && copy.name === '사본 세계' && copy.n > 0, 'the browser keeps a copy of the server world', copy);
  // the host restarts on a wiped disk: the server is empty
  await s1.stop();
  const s2 = await run(d2);
  const rooms = await fetch(url + 'rooms').then(r => r.json()).catch(() => null);
  ok(rooms && !rooms.world, 'the restarted server has no world of its own', rooms);
  await A.goto(url); await A.waitForFunction(() => window.__game, null, { timeout: 60000 });
  await A.evaluate(() => new Promise(r => setTimeout(r, 300)));
  const listed = await A.evaluate(async u => { MPL.addr = u; MPL.data = { world: null, rooms: [] }; return mpListHtml(); }, ws);
  ok(/되살리기/.test(listed), 'the join list offers to bring the world back', listed.slice(0, 200));
  await A.evaluate(async u => { showMenu('mp_join'); await mpJoinWs(u); }, ws);
  await enter();
  ok(/세계를 되살렸습니다/.test(s2.log()), 'joining the empty server restores the world from the copy', s2.log().slice(-400));
  const back = await A.evaluate(([x, y, z]) => new Promise(res => { let n = 0; const t = setInterval(() => { const c = chunkAt(x >> 4, z >> 4); if ((c && getBlock(x, y, z) === BID.diamond_block) || ++n > 40) { clearInterval(t); res({ name: W.meta.name, block: !!c && getBlock(x, y, z) === BID.diamond_block, diamonds: INV.count(IID.diamond) }); } }, 250); }), at);
  ok(back.name === '사본 세계', 'it is the same world', back);
  ok(back.block, 'with the block placed before the restart', back);
  ok(back.diamonds === 9, 'and the player\'s inventory', back);
  const rooms2 = await fetch(url + 'rooms').then(r => r.json()).catch(() => null);
  ok(rooms2 && rooms2.world && rooms2.world.name === '사본 세계', 'the server lists the restored world again', rooms2);
  ok(!A.errs.length, 'no page errors', A.errs);
  await A.evaluate(() => { mpStop(); }); await A.waitForTimeout(1000);
  await s2.stop();
  for (const d of [d1, d2]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
};
