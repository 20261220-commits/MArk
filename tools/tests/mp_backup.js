// the server world outlives a wiped disk: backed up to a GitHub branch on shutdown and brought back on the next start
// (a small stand-in for GitHub's git API runs here; nothing is sent to GitHub)
const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), { spawn } = require('child_process');
module.exports = async ({ ok, lib }) => {
  // the fake API: blobs, trees, commits and one ref, as GitHub keeps them
  const obj = {}, refs = {}, sha = () => crypto.randomBytes(20).toString('hex'); let calls = 0;
  const api = http.createServer((req, res) => { let body = ''; req.on('data', d => body += d); req.on('end', () => { calls++;
    const b = body ? JSON.parse(body) : null, u = req.url.replace(/^\/repos\/o\/r/, ''), send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(o || {})); };
    if (req.headers.authorization !== 'Bearer tok') return send(401);
    let m;
    if (req.method === 'GET' && (m = u.match(/^\/git\/ref\/heads\/(.+)$/))) return refs[m[1]] ? send(200, { object: { sha: refs[m[1]] } }) : send(404);
    if (req.method === 'GET' && (m = u.match(/^\/git\/(commits|trees|blobs)\/(\w+)$/))) return obj[m[2]] ? send(200, obj[m[2]]) : send(404);
    if (req.method === 'POST' && u === '/git/blobs') { const s = sha(); obj[s] = { content: b.content, encoding: 'base64' }; return send(201, { sha: s }); }
    if (req.method === 'POST' && u === '/git/trees') { const s = sha(); obj[s] = { tree: b.tree }; return send(201, { sha: s }); }
    if (req.method === 'POST' && u === '/git/commits') { const s = sha(); obj[s] = { tree: { sha: b.tree } }; return send(201, { sha: s }); }
    if (req.method === 'PATCH' && (m = u.match(/^\/git\/refs\/heads\/(.+)$/))) { if (!refs[m[1]]) return send(422, { message: 'Reference does not exist' }); refs[m[1]] = b.sha; return send(200, {}); }
    if (req.method === 'POST' && u === '/git/refs') { refs[b.ref.replace('refs/heads/', '')] = b.sha; return send(201, {}); }
    send(404); }); });
  await new Promise(r => api.listen(0, r)); const apiUrl = 'http://localhost:' + api.address().port;
  const run = async (dir, port) => {
    const p = spawn(process.execPath, [path.join(lib.root, 'tools', 'server.js')], { env: { ...process.env, PORT: String(port), WORLDS_DIR: dir, GITHUB_BACKUP_REPO: 'o/r', GITHUB_TOKEN: 'tok', GITHUB_API_URL: apiUrl, KEEP_AWAKE: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
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
  await s2.stop(); api.close();
  for (const d of [d1, d2]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
};
