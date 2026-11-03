// a big server world (4000 changed chunks, ~100 MB on disk) is backed up and brought back on an empty disk without
// the server's memory coming near the free plan's 512 MB (the old backups were unpacked and parsed whole on start)
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
  const rss = pid => { try { return +/VmRSS:\s+(\d+)/.exec(fs.readFileSync(`/proc/${pid}/status`, 'utf8'))[1] / 1024; } catch (e) { return 0; } };
  const run = async (dir, port) => {
    const p = spawn(process.execPath, ['--max-old-space-size=360', '--expose-gc', path.join(lib.root, 'tools', 'server.js')], { env: { ...process.env, PORT: String(port), WORLDS_DIR: dir, GITHUB_BACKUP_REPO: 'o/r', GITHUB_TOKEN: 'tok', GITHUB_API_URL: apiUrl, KEEP_AWAKE: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '', peak = 0; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d); const iv = setInterval(() => { peak = Math.max(peak, rss(p.pid)); }, 50);
    for (let i = 0; i < 1200 && !/멀티플레이 주소/.test(log); i++) await new Promise(r => setTimeout(r, 100));
    return { p, log: () => log, peak: () => peak, stop: () => new Promise(r => { p.on('exit', () => { clearInterval(iv); r(); }); p.kill('SIGTERM'); }) };
  };
  const d1 = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-mem1-')), d2 = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-mem2-')), W1 = path.join(d1, 'big');
  try {
    fs.mkdirSync(path.join(W1, 'chunks'), { recursive: true });
    fs.writeFileSync(path.join(W1, 'world.json'), JSON.stringify({ meta: { name: '큰 세계', seed: 9, mode: 'survival' }, time: 1, rain: 0, thunder: false, players: {} }));
    const R = crypto.randomBytes(18000).toString('base64'); // incompressible like a real chunk's blocks would partly be
    for (let i = 0; i < 4000; i++) fs.writeFileSync(path.join(W1, 'chunks', encodeURIComponent((i % 80) + ',' + Math.floor(i / 80)) + '.json'), JSON.stringify({ rec: { v: 3, b: R.slice(i % 500) + i, m: 'AA', l: 'AA', bio: [1, 2, 3], mobs: [] }, edits: [[i, 2, 3, 4, 0]], tiles: {} }));
    const s1 = await run(d1, 20000 + Math.floor(Math.random() * 1000)); await s1.stop();
    ok(/세계 백업 완료/.test(s1.log()), 'a big world is backed up on shutdown', s1.log().slice(-200));
    const s2 = await run(d2, 21000 + Math.floor(Math.random() * 1000)); await new Promise(r => setTimeout(r, 500));
    const n = fs.existsSync(path.join(d2, 'big', 'chunks')) ? fs.readdirSync(path.join(d2, 'big', 'chunks')).length : 0;
    ok(/백업에서 세계를 되살렸습니다/.test(s2.log()) && n === 4000, 'and restored whole on an empty disk', [n, s2.log().slice(0, 300)]);
    console.log('  memory peak MB (backup, restore):', Math.round(s1.peak()), Math.round(s2.peak()));
    ok(s1.peak() < 330 && s2.peak() < 250, 'the server stays far under 512 MB while backing up and restoring (MB)', [Math.round(s1.peak()), Math.round(s2.peak())]);
    await s2.stop();
  } finally { api.close(); for (const d of [d1, d2]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
};
