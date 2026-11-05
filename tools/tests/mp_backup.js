// the server world outlives a wiped disk: backed up to a GitHub branch on shutdown and brought back on the next start
// (a small stand-in for GitHub's git API runs here; nothing is sent to GitHub)
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), { spawn } = require('child_process');
module.exports = async ({ ok, lib }) => {
  // the fake API: blobs, trees, commits and one ref, as GitHub keeps them
  const obj = {}, refs = {}, sha = () => crypto.randomBytes(20).toString('hex'); let calls = 0, empty = true, down = false; // (starts as a repository just made, with no commit)
  const api = http.createServer((req, res) => { let body = ''; req.on('data', d => body += d); req.on('end', () => { calls++;
    const b = body ? JSON.parse(body) : null, u = req.url.replace(/^\/repos\/o\/r/, ''), send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o || {})); };
    if (req.headers.authorization !== 'Bearer tok') return send(401);
    if (down) return send(503, { message: 'GitHub is down' }); // (GitHub can't be reached)
    let m;
    // a repository just made has no commit: git objects are refused (409), the contents API makes its first commit
    if (empty && req.method === 'PUT' && u.startsWith('/contents/')) { empty = false; const s = sha(); refs.main = s; obj[s] = { tree: { sha: sha() } }; return send(201, { commit: { sha: s } }); }
    if (empty && u.startsWith('/git/')) return send(409, { message: 'Git Repository is empty.' });
    if (req.method === 'GET' && (m = u.match(/^\/git\/ref\/heads\/(.+)$/))) return refs[m[1]] ? send(200, { object: { sha: refs[m[1]] } }) : send(404);
    if (req.method === 'GET' && (m = u.match(/^\/git\/(commits|trees|blobs)\/(\w+)$/))) return obj[m[2]] ? send(200, obj[m[2]]) : send(404);
    if (req.method === 'POST' && u === '/git/blobs') { const s = sha(); obj[s] = { content: b.content, encoding: 'base64' }; return send(201, { sha: s }); }
    if (req.method === 'POST' && u === '/git/trees') { const s = sha(); obj[s] = { tree: b.tree }; return send(201, { sha: s }); }
    if (req.method === 'POST' && u === '/git/commits') { const s = sha(); obj[s] = { tree: { sha: b.tree }, message: b.message }; return send(201, { sha: s }); }
    if (req.method === 'PATCH' && (m = u.match(/^\/git\/refs\/heads\/(.+)$/))) { if (!refs[m[1]]) return send(422, { message: 'Reference does not exist' }); refs[m[1]] = b.sha; return send(200, {}); }
    if (req.method === 'POST' && u === '/git/refs') { refs[b.ref.replace('refs/heads/', '')] = b.sha; return send(201, {}); }
    send(404); }); });
  await new Promise(r => api.listen(0, r)); const apiUrl = 'http://localhost:' + api.address().port;
  const run = async (dir, port) => {
    const p = spawn(process.execPath, [path.join(lib.root, 'tools', 'server.js')], { env: { ...process.env, PORT: String(port), WORLDS_DIR: dir, GITHUB_BACKUP_REPO: 'o/r', GITHUB_TOKEN: 'tok', GITHUB_API_URL: apiUrl, KEEP_AWAKE: '0', BACKUP_RETRY_SCALE: '0.05' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = ''; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
    for (let i = 0; i < 100 && !/멀티플레이 주소/.test(log); i++) await new Promise(r => setTimeout(r, 100));
    return { p, log: () => log, stop: () => new Promise(r => { p.on('exit', r); p.kill('SIGTERM'); }) };
  };
  // a world on the first disk
  const d1 = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-bk1-')), d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-bk2-')), W1 = path.join(d1, 'world');
  fs.mkdirSync(path.join(W1, 'chunks'), { recursive: true });
  fs.writeFileSync(path.join(W1, 'world.json'), JSON.stringify({ meta: { name: '백업 세계', seed: 777, mode: 'survival' }, time: 5000, rain: 0, thunder: false, players: { 철수: { x: 1 } } }));
  fs.writeFileSync(path.join(W1, 'chunks', encodeURIComponent('o:0,0') + '.json'), JSON.stringify({ rec: { v: 2, mobs: [] }, edits: [[1, 2, 3, 4, 0]], tiles: {} }));
  const s1 = await run(d1, 18000 + Math.floor(Math.random() * 1000));
  ok(/불러옴/.test(s1.log()), 'the first server loads its world', s1.log().slice(0, 300));
  await s1.stop();
  ok(/세계 백업 완료/.test(s1.log()), 'stopping the server backs the world up', s1.log().slice(-300));
  ok(!!refs['world-backup'], 'the backup is a branch in the repository');
  // a wiped disk: the next start brings it back
  const port2 = 19000 + Math.floor(Math.random() * 1000), s2 = await run(d2, port2);
  ok(/백업에서 세계를 되살렸습니다/.test(s2.log()), 'a server on an empty disk restores the world from the backup', s2.log().slice(0, 400));
  const rooms = await fetch(`http://localhost:${port2}/rooms`).then(r => r.json()).catch(() => null);
  ok(rooms && rooms.world && rooms.world.name === '백업 세계', 'the restored world is open to join', rooms);
  const ch = path.join(d2, 'world', 'chunks', encodeURIComponent('o:0,0') + '.json');
  ok(fs.existsSync(ch) && JSON.parse(fs.readFileSync(ch, 'utf8')).edits[0][3] === 4, 'its chunks come back too');
  const st = JSON.parse(fs.readFileSync(path.join(d2, 'world', 'world.json'), 'utf8'));
  ok(st.players && st.players['철수'], 'and the players\' saved things');
  const ping = await fetch(`http://localhost:${port2}/ping`).then(r => r.text()).catch(() => '');
  ok(ping === 'ok', 'the server answers /ping (what keeps a free host awake)');
  await s2.stop();
  ok(!!refs['world-backup-prev'] && Object.keys(refs).some(k => /^world-backup-day\d$/.test(k)), 'the backup before and one of the day are kept as restore points', Object.keys(refs));
  // a broken latest backup: the one before it is used
  const goodPrev = refs['world-backup-prev']; { const s = sha(); obj[s] = { content: Buffer.from('not a gzip').toString('base64'), encoding: 'base64' }; const t = sha(); obj[t] = { tree: [{ path: 'world.json.gz', mode: '100644', type: 'blob', sha: s }] }; const c = sha(); obj[c] = { tree: { sha: t }, message: 'world backup ' + new Date().toISOString() }; refs['world-backup'] = c; }
  const d3 = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-bk3-')), port3 = 19000 + Math.floor(Math.random() * 1000), s3 = await run(d3, port3);
  const r3 = await fetch(`http://localhost:${port3}/rooms`).then(r => r.json()).catch(() => null);
  ok(/그 전 것을 봅니다/.test(s3.log()) && r3 && r3.world && r3.world.name === '백업 세계', 'a broken latest backup gives way to the one before it', s3.log().slice(0, 500));
  await s3.stop(); refs['world-backup'] = goodPrev;
  // GitHub down while starting: the server opens with the server world locked, backs nothing up, and opens it once GitHub is back
  down = true; const before = refs['world-backup'];
  const d4 = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-bk4-')), port4 = 19000 + Math.floor(Math.random() * 1000), s4 = await run(d4, port4);
  for (let i = 0; i < 100 && !/잠가 둡니다/.test(s4.log()); i++) await new Promise(r => setTimeout(r, 200));
  const st4 = await fetch(`http://localhost:${port4}/stats`).then(r => r.json()).catch(() => null);
  const refused = await new Promise(res => { const ws = new WebSocket('ws://localhost:' + port4 + '/mp'); ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', role: 'join', world: 'world' })); ws.onmessage = e => { res(String(e.data)); ws.close(); }; ws.onerror = () => res('err'); setTimeout(() => res('timeout'), 8000); }).catch(e => 'noWs ' + e.message);
  ok(st4 && st4.backup && st4.backup.locked, 'with GitHub down at the start the server world is locked', st4 && st4.backup);
  ok(/잠시 잠가/.test(refused) || /noWs/.test(refused), 'and nobody can join it then (nothing made to be backed up over the worlds)', refused);
  down = false; for (let i = 0; i < 100 && !/다시 엽니다/.test(s4.log()); i++) await new Promise(r => setTimeout(r, 200));
  const r4 = await fetch(`http://localhost:${port4}/rooms`).then(r => r.json()).catch(() => null);
  ok(r4 && r4.world && r4.world.name === '백업 세계' && refs['world-backup'] === before, 'once GitHub is back the world comes back, the good backup untouched meanwhile', [r4 && r4.world, refs['world-backup'] === before]);
  await s4.stop(); api.close();
  for (const d of [d3, d4]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
  for (const d of [d1, d2]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
};
