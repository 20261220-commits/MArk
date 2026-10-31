// Serves the game and runs multiplayer on your network, with no dependencies:
//   node tools/server.js [port] [--world name]      then open http://<this computer's address>:<port> on every device
// Two kinds of multiplayer:
//  - a saved server world (worlds/<name>/ next to the game): it stays on this computer and anyone can join at any time,
//    whoever made it doesn't need to be there. The players who are on share the work: in each dimension the first one
//    there runs it (mobs, water, crops, redstone) and the others follow; when that player leaves, the next one takes
//    over. With nobody on, the world waits. Players join with "멀티플레이 → 서버에 접속" at ws://<address>:<port>/mp.
//  - one player's own world opened to others ("서버로 열기"), as before: guests' messages go to that host.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const zlib = require('zlib');
// one bad message or a bug in some rarely used path must not take the whole server (and everyone in it) down
process.on('uncaughtException', e => console.log('오류 (서버는 계속 돕니다): ' + (e && e.stack || e)));
process.on('unhandledRejection', e => console.log('오류 (서버는 계속 돕니다): ' + (e && e.stack || e)));
const root = path.join(__dirname, '..'), args = process.argv.slice(2);
// on a hosting service (Render and the like) the port comes from PORT; WORLD names the world and WORLDS_DIR is where worlds are
// kept (point it at a persistent disk there, or the world is lost whenever the service restarts)
const wi = args.indexOf('--world'), port = +(args.find((a, i) => /^\d+$/.test(a) && i !== wi + 1) || process.env.PORT || 8080), worldName = (wi >= 0 && args[wi + 1] ? args[wi + 1] : process.env.WORLD || 'world').replace(/[^\w\-가-힣]/g, '_');
const WORLDS = path.resolve(process.env.WORLDS_DIR || path.join(root, 'worlds'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.md': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

// SERVER_URL (environment) reaches the game as js/config.js; REQUIRE_LOGIN=1 lets only players logged in with a
// nickname and password into the server world
const CFG = { server: process.env.SERVER_URL || '' }, REQUIRE_LOGIN = /^(1|true|yes)$/i.test(process.env.REQUIRE_LOGIN || '');
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  // what can be joined here: the saved server world and the players' own worlds that are open (the join screen lists them)
  if (u === '/skin') { skinProxy(req, res); return; }
  if (u === '/profile') { profileLookup(req, res); return; }
  if (u === '/ping') { res.writeHead(200, { 'content-type': 'text/plain', 'cache-control': 'no-store' }); res.end('ok'); return; }
  if (u === '/rooms') { res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(roomList())); return; }
  if (u === '/js/config.js' && CFG.server) { res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-cache' }); res.end('var NEMO_CONFIG = ' + JSON.stringify(CFG) + ';\n'); return; }
  const f = path.join(root, path.normalize(u));
  if (!f.startsWith(root + path.sep) || f.startsWith(WORLDS + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('not found'); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(d); /* no-cache: a new version shows on the next visit */ });
});

// ---------- skins from elsewhere, as Java Edition gets them ----------
// /profile?name=  a Minecraft account by its name, through Mojang's API (as the game does): the skin's address, whether
//                 it is drawn with slim arms, and the cape's address
// /skin?u=        a skin (or cape) picture from another site, for a page whose browser may not read it itself (most sites
//                 don't allow that): PNG, JPEG, GIF, WebP or BMP; a web page is searched for a 64x64 or 64x32 picture
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[|::|fc|fd)/i;
const IMG_SIG = [[[0x89, 0x50, 0x4e, 0x47], 'image/png'], [[0xff, 0xd8, 0xff], 'image/jpeg'], [[0x47, 0x49, 0x46], 'image/gif'], [[0x42, 0x4d], 'image/bmp']];
const imgType = b => { for (const [sig, t] of IMG_SIG) if (sig.every((x, i) => b[i] === x)) return t; if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp'; return null; };
const pngSize = b => b.length > 24 && imgType(b) === 'image/png' ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
const okHost = u => /^https?:$/.test(u.protocol) && !((PRIVATE_HOST.test(u.hostname) || /\.(local|internal)$/i.test(u.hostname)) && process.env.SKIN_PROXY_LOCAL !== '1'); // (the tests fetch from this machine)
async function getLimited(url, max, accept) {
  const ac = new AbortController(), to = setTimeout(() => ac.abort(), 8000);
  try { const r = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (nemo skin import)', accept } });
    if (!r.ok) return { status: r.status }; if (+(r.headers.get('content-length') || 0) > max) return { status: 413 };
    const buf = Buffer.from(await r.arrayBuffer()); return buf.length > max ? { status: 413 } : { buf, type: r.headers.get('content-type') || '', url: r.url || String(url) };
  } finally { clearTimeout(to); }
}
async function skinProxy(req, res) {
  const end = (code, msg) => { res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' }); res.end(msg); };
  let target; try { target = new URL(new URL(req.url, 'http://x').searchParams.get('u') || ''); } catch (e) { end(400, 'bad url'); return; }
  if (!okHost(target)) { end(400, 'not allowed'); return; }
  try {
    const r = await getLimited(target, 2000000, 'image/*,text/html;q=0.8,*/*;q=0.5'); if (!r.buf) { end(502, 'status ' + r.status); return; }
    let found = imgType(r.buf) ? r : null;
    if (!found && /html/i.test(r.type)) { // a skin site's page: its pictures, the likely skin ones first, until one is skin-sized
      const html = r.buf.toString('utf8'), seen = new Set(), cands = [];
      for (const m of html.matchAll(/(?:src|href|content|data-src|data-skin|data-url)\s*=\s*["']([^"'<>]+)["']/gi)) { let u; try { u = new URL(m[1].replace(/&amp;/g, '&'), r.url); } catch (e) { continue; } if (!okHost(u) || seen.has(u.href)) continue; seen.add(u.href);
        const k = u.href.toLowerCase(), score = (/\.png(\?|$)/.test(k) ? 2 : 0) + (/skin/.test(k) ? 2 : 0) + (/download/.test(k) ? 3 : 0) + (/texture/.test(k) ? 2 : 0) - (/(logo|icon|avatar|head|render|preview|banner|favicon|sprite)/.test(k) ? 3 : 0);
        if (score > 0 || /\.(png|jpe?g|webp|gif)(\?|$)/.test(k)) cands.push([score, u]); }
      cands.sort((x, y) => y[0] - x[0]);
      for (const [, u] of cands.slice(0, 10)) { const c = await getLimited(u, 500000, 'image/*').catch(() => ({})); if (!c.buf || !imgType(c.buf)) continue; const sz = pngSize(c.buf); if (!sz || (sz[0] === 64 && (sz[1] === 64 || sz[1] === 32))) { found = c; if (sz) break; } }
    }
    if (!found || found.buf.length > 500000) { end(415, 'no skin picture there'); return; }
    res.writeHead(200, { 'content-type': imgType(found.buf), 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=3600' }); res.end(found.buf);
  } catch (e) { end(502, 'fetch failed'); }
}
async function profileLookup(req, res) {
  const send = (code, o) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': code === 200 ? 'public, max-age=300' : 'no-store' }); res.end(JSON.stringify(o)); };
  const name = (new URL(req.url, 'http://x').searchParams.get('name') || '').trim(); if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) { send(400, { error: 'bad name' }); return; }
  try {
    let id = null; // name -> UUID (Mojang's old address first, then the newer one)
    for (const u of ['https://api.mojang.com/users/profiles/minecraft/' + name, 'https://api.minecraftservices.com/minecraft/profile/lookup/name/' + name]) {
      const r = await getLimited(u, 100000, 'application/json').catch(() => ({})); if (r.buf && r.buf.length) { try { const j = JSON.parse(r.buf.toString('utf8')); if (j.id) { id = j.id; break; } } catch (e) {} } }
    if (!id) { send(404, { error: 'no such player' }); return; }
    const r = await getLimited('https://sessionserver.mojang.com/session/minecraft/profile/' + id, 100000, 'application/json'); if (!r.buf) { send(502, { error: 'profile' }); return; }
    const prof = JSON.parse(r.buf.toString('utf8')), tp = (prof.properties || []).find(p => p.name === 'textures');
    const tex = tp ? JSON.parse(Buffer.from(tp.value, 'base64').toString('utf8')).textures || {} : {}, fix = u => u ? String(u).replace(/^http:/, 'https:') : null;
    send(200, { name: prof.name || name, id, skin: fix(tex.SKIN && tex.SKIN.url), slim: !!(tex.SKIN && tex.SKIN.metadata && tex.SKIN.metadata.model === 'slim'), cape: fix(tex.CAPE && tex.CAPE.url) });
  } catch (e) { send(502, { error: 'lookup failed' }); }
}

// ---------- a minimal WebSocket (RFC 6455): text frames, fragments, ping, close ----------
function frame(op, payload) {
  const n = payload.length, head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | op, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([head, payload]);
}
function wsAccept(req, sock, onText, onClose) {
  const key = req.headers['sec-websocket-key']; if (!key) { sock.destroy(); return null; }
  try { sock.setNoDelay(true); } catch (e) {} // small game messages go out at once, not batched
  const acc = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  let buf = Buffer.alloc(0), parts = [], closed = false;
  const c = { send(s) { if (!closed) sock.write(frame(1, Buffer.from(s))); }, close() { if (!closed) { closed = true; try { sock.end(frame(8, Buffer.alloc(0))); } catch (e) {} onClose(); } } };
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80; let len = buf[1] & 127, p = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); p = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); p = 10; }
      if (buf.length < p + (masked ? 4 : 0) + len) return;
      const mask = masked ? buf.subarray(p, p + 4) : null; p += masked ? 4 : 0;
      const data = Buffer.from(buf.subarray(p, p + len)); if (mask) for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(p + len);
      if (op === 8) { c.close(); return; }
      if (op === 9) { sock.write(frame(10, data)); continue; }
      if (op === 1 || op === 2 || op === 0) { parts.push(data); if (fin) { const msg = Buffer.concat(parts).toString(); parts = []; try { onText(msg); } catch (e) { console.log('메시지 처리 오류: ' + (e && e.stack || e)); } } }
    }
  });
  // a ping now and then: hosting proxies close connections that stay quiet (the browser answers by itself)
  const ping = setInterval(() => { if (!closed) try { sock.write(frame(9, Buffer.alloc(0))); } catch (e) {} }, 25000);
  sock.on('close', () => { clearInterval(ping); if (!closed) { closed = true; onClose(); } }); sock.on('error', () => {});
  return c;
}

// ---------- server worlds (js/mpcore.js does the work; the files are here) ----------
// The server keeps any number of worlds, each in worlds/<id>/ (world.json and chunks/), as a single-player game keeps its
// worlds: every world made or uploaded here stays, is listed for everyone and can be joined at any time, with or without
// whoever made it. WORLD names the world an older game (one without the world list) joins.
const { mpWorldCore } = require(path.join(root, 'js', 'mpcore.js'));
const WORLD_ID = /^[\w\-가-힣]{1,40}$/;
const worlds = new Map(); // id -> world
const newWorldId = () => { for (;;) { const id = 'w' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex'); if (!worlds.has(id) && !fs.existsSync(path.join(WORLDS, id))) return id; } };
function openWorld(id) {
  let w = worlds.get(id); if (w) return w;
  const dir = path.join(WORLDS, id), cdir = path.join(dir, 'chunks');
  const state = { meta: null, time: 1000, rain: 0, thunder: false, players: {}, weatherT: 12000 + Math.random() * 168000 };
  w = { id, dir, cdir, state, keys: new Set(), dirty: new Map(), stateDirty: false, conns: new Map(), changedSinceBackup: false, mirrorStateAt: 0, restorer: null };
  w.fileOf = dk => path.join(cdir, encodeURIComponent(dk) + '.json');
  loadWorld(w);
  const store = { state, keys: w.keys, load: dk => { try { return JSON.parse(fs.readFileSync(w.fileOf(dk), 'utf8')); } catch (e) { return null; } }, save: (dk, c) => w.dirty.set(dk, c), saveState: () => { w.stateDirty = true; }, log: t => console.log(`[${id}] ${t}`) };
  w.core = mpWorldCore(store, (cid, o) => { const c = w.conns.get(cid); if (c) c.send(JSON.stringify(o)); });
  worlds.set(id, w); return w;
}
function loadWorld(w) {
  try { Object.assign(w.state, JSON.parse(fs.readFileSync(path.join(w.dir, 'world.json'), 'utf8'))); w.keys.clear(); for (const f of fs.readdirSync(w.cdir)) if (f.endsWith('.json')) w.keys.add(decodeURIComponent(f.slice(0, -5))); console.log(`세계 "${w.state.meta.name}" 불러옴 (${w.id}, 시드 ${w.state.meta.seed}, 청크 ${w.keys.size}개)`); }
  catch (e) { w.state.meta = null; }
}
function saveWorld(w, force) {
  const st = w.state; if (!st.meta) return; fs.mkdirSync(w.cdir, { recursive: true }); if (w.dirty.size) w.changedSinceBackup = true;
  if (!st.wid) { st.wid = crypto.randomBytes(8).toString('hex'); w.stateDirty = true; } // tells the players' copies of one world from the next
  const ver = st.cver || (st.cver = {}), out = [];
  for (const [dk, c] of w.dirty) { const e = { rec: c.rec, edits: c.edits, tiles: c.tiles }; ver[dk] = (ver[dk] || 0) + 1; w.stateDirty = true; fs.writeFileSync(w.fileOf(dk), JSON.stringify(e)); out.push([dk, ver[dk], e]); }
  if (w.stateDirty) { fs.writeFileSync(path.join(w.dir, 'world.json'), JSON.stringify(st)); w.stateDirty = false; }
  w.dirty.clear();
  if (out.length || force || Date.now() - w.mirrorStateAt > 30000) mirrorOut(w, out);
}
const saveAllWorlds = () => { for (const w of worlds.values()) { w.stateDirty = true; saveWorld(w); } };
// a world slot opened for a new world that was never made (the player left the create screen) goes away again
function dropIfEmpty(w) { if (w.state.meta || w.conns.size) return; worlds.delete(w.id); try { fs.rmdirSync(w.cdir); fs.rmdirSync(w.dir); } catch (e) {} }
// ---------- the players' copies ----------
// Every browser in a server world keeps a copy of what was changed (chunks and world data) in its IndexedDB. A host
// that loses its files (Render's free plan wipes the disk on every restart and redeploy) gets each world back from the
// first player with a copy who opens it. Password hashes stay on the server: after such a restore, accounts are made
// again with the next login.
const mirrorState = w => { const o = { ...w.state }; delete o.logins; return o; };
const joinedConns = w => [...w.conns].filter(([id]) => { const p = w.core.players.get(id); return p && p.joined; }).map(([, c]) => c);
function mirrorOut(w, l) {
  const to = joinedConns(w); if (!to.length || !w.state.meta) return; w.mirrorStateAt = Date.now();
  const s = JSON.stringify({ t: 'mirror', wid: w.state.wid, state: mirrorState(w), l }); for (const c of to) c.send(s);
}
// a player who just came in says which versions it has; it gets the rest a few chunks at a time
function mirrorFill(w, id, m) {
  const c = w.conns.get(id), st = w.state; if (!c || !st.meta) return;
  const have = m.wid === st.wid && m.vers && typeof m.vers === 'object' ? m.vers : {}, ver = st.cver || {};
  const need = [...w.keys].filter(dk => !(dk in have) || have[dk] < (ver[dk] || 0));
  c.send(JSON.stringify({ t: 'mirror', wid: st.wid, state: mirrorState(w), reset: m.wid !== st.wid, l: [] }));
  const next = () => { if (!w.conns.has(id) || !need.length) return; const l = need.splice(0, 12).map(dk => { try { return [dk, ver[dk] || 0, JSON.parse(fs.readFileSync(w.fileOf(dk), 'utf8'))]; } catch (e) { return null; } }).filter(Boolean);
    if (l.length) c.send(JSON.stringify({ t: 'mirror', wid: st.wid, l })); setTimeout(next, 150); };
  setTimeout(next, 3000); // after the player's own world has loaded
}
// a world the server lost and a player with a copy: that copy becomes the server world again
function restorePart(w, id, m) {
  const c = w.conns.get(id), st = w.state; if (!c) return;
  if (m.part === 'begin') {
    if (st.meta || w.restorer != null || !m.state || !m.state.meta || !m.state.meta.seed) { c.send(JSON.stringify({ t: 'error', msg: '이 세계는 서버에 이미 있습니다' })); return; }
    w.restorer = id; const s2 = { ...m.state }; delete s2.logins; Object.assign(st, s2, { logins: {} }); st.players = st.players || {}; st.cver = {};
    fs.mkdirSync(w.cdir, { recursive: true }); w.stateDirty = true; console.log(`[${w.id}] 플레이어의 사본에서 세계 "${st.meta.name}"를 되살리는 중`); return;
  }
  if (w.restorer !== id) return;
  if (m.part === 'chunk') { for (const [dk, v, e] of m.l || []) { if (typeof dk !== 'string' || !/^[ne]?-?\d+,-?\d+$/.test(dk) || !e) continue; fs.writeFileSync(w.fileOf(dk), JSON.stringify({ rec: e.rec || null, edits: e.edits || [], tiles: e.tiles || {} })); w.keys.add(dk); st.cver[dk] = +v || 1; } w.stateDirty = true; return; }
  if (m.part === 'end') { w.restorer = null; saveWorld(w); console.log(`[${w.id}] 세계를 되살렸습니다 (청크 ${w.keys.size}개)`); c.send(JSON.stringify({ t: 'restored' })); backupNow('되살림'); }
}
// every world that was made before: open them all at the start, so they are listed even with nobody in them
try { for (const d of fs.readdirSync(WORLDS)) if (WORLD_ID.test(d) && fs.existsSync(path.join(WORLDS, d, 'world.json'))) openWorld(d); } catch (e) {}
setInterval(() => { for (const w of worlds.values()) w.core.tick(); }, 1000);
setInterval(saveAllWorlds, 5000);
// ---------- staying up: a backup that outlives a wiped disk, and a ping so a free host doesn't put the server to sleep ----------
const { githubBackup } = require(path.join(__dirname, 'backup.js'));
const BACKUP = process.env.GITHUB_BACKUP_REPO && process.env.GITHUB_TOKEN ? githubBackup({ repo: process.env.GITHUB_BACKUP_REPO, token: process.env.GITHUB_TOKEN, branch: process.env.GITHUB_BACKUP_BRANCH || 'world-backup', api: process.env.GITHUB_API_URL || undefined }) : null;
// everything on disk (every world's world.json and chunks) as one gzipped JSON, written a file at a time straight from the
// files' own text: parsing every chunk into objects first took more memory than a free host has once a world grew, and
// the server was killed in the middle of a backup
async function worldSnapshot() {
  saveAllWorlds(); const list = [...worlds.values()].filter(w => w.state.meta); if (!list.length) return null;
  const gz = zlib.createGzip({ level: 6 }), out = []; gz.on('data', d => out.push(d)); const done = new Promise((res, rej) => { gz.on('end', res); gz.on('error', rej); });
  const put = s => gz.write(s) ? null : new Promise(r => gz.once('drain', r));
  const raw = f => { try { const t = fs.readFileSync(f, 'utf8'); JSON.parse(t); return t; } catch (e) { return null; } }; // (a file cut short is left out)
  await put('{"v":2,"worlds":{'); let first = true;
  for (const w of list) { const st = raw(path.join(w.dir, 'world.json')); if (!st) continue;
    await put((first ? '' : ',') + JSON.stringify(w.id) + ':{"state":' + st + ',"chunks":{'); first = false; let fc = true;
    for (const dk of [...w.keys]) { const t = raw(w.fileOf(dk)); if (!t) continue; const p = put((fc ? '' : ',') + JSON.stringify(dk) + ':' + t); fc = false; if (p) await p; }
    await put('}}'); }
  gz.end('}}'); await done; return first ? null : Buffer.concat(out);
}
let backingUp = null;
async function backupNow(why) {
  if (!BACKUP || backingUp) return backingUp;
  backingUp = worldSnapshot().then(snap => snap && BACKUP.save(snap)).then(n => { if (n == null) return; for (const w of worlds.values()) w.changedSinceBackup = false; console.log(`세계 백업 완료 (${why}, ${(n / 1024).toFixed(0)} KB → ${process.env.GITHUB_BACKUP_REPO})`); }).catch(e => console.log('세계 백업 실패: ' + e.message)).finally(() => { backingUp = null; });
  return backingUp;
}
async function restoreIfEmpty() { // a fresh disk (a restart on a free host): bring the worlds back from the backup
  if (!BACKUP || [...worlds.values()].some(w => w.state.meta)) return;
  try { const snap = await BACKUP.load(); const all = snap && (snap.v === 2 ? snap.worlds : snap.state ? { [snap.name || worldName]: { state: snap.state, chunks: snap.chunks } } : null); // v1: the one-world backups before
    if (!all || !Object.keys(all).length) { console.log('백업된 세계 없음 — 새 세계를 기다립니다'); return; }
    for (const [id, x] of Object.entries(all)) { if (!WORLD_ID.test(id) || !x.state || !x.state.meta) continue; const dir = path.join(WORLDS, id), cdir = path.join(dir, 'chunks');
      fs.mkdirSync(cdir, { recursive: true }); fs.writeFileSync(path.join(dir, 'world.json'), JSON.stringify(x.state));
      for (const [dk, c] of Object.entries(x.chunks || {})) fs.writeFileSync(path.join(cdir, encodeURIComponent(dk) + '.json'), JSON.stringify(c));
      const w = worlds.get(id); if (w) loadWorld(w); else openWorld(id); }
    console.log('백업에서 세계를 되살렸습니다'); }
  catch (e) { console.log('백업 불러오기 실패: ' + e.message); }
}
if (BACKUP) { setInterval(() => { if ([...worlds.values()].some(w => w.changedSinceBackup)) backupNow('10분마다'); }, 10 * 60 * 1000); setInterval(() => backupNow('1시간마다'), 60 * 60 * 1000); }
// Render gives the service's own address; asking it for /ping every 10 minutes counts as a visit, so the free plan's
// 15-minute sleep never comes (KEEP_AWAKE=0 turns this off; KEEP_AWAKE_URL sets the address on other hosts)
const SELF_URL = process.env.KEEP_AWAKE_URL || process.env.RENDER_EXTERNAL_URL || '';
if (SELF_URL && !/^(0|false|no)$/i.test(process.env.KEEP_AWAKE || '')) setInterval(() => { fetch(SELF_URL.replace(/\/$/, '') + '/ping').catch(() => {}); }, 10 * 60 * 1000);
for (const sg of ['SIGINT', 'SIGTERM']) process.on(sg, () => { saveAllWorlds(); if (BACKUP && [...worlds.values()].some(w => w.state.meta)) { const t = setTimeout(() => process.exit(0), 25000); backupNow('서버 종료').finally(() => { clearTimeout(t); process.exit(0); }); } else process.exit(0); }); // a host gives some seconds before it stops the server

// ---------- rooms of a player's own world: one host, any number of guests, found by a short code ----------
const rooms = new Map(); let nextId = 1;
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
function newCode() { for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; if (!rooms.has(c)) return c; } }
function roomList() {
  const info = w => ({ id: w.id, name: w.state.meta.name, mode: w.state.meta.mode, players: [...w.core.players.values()].filter(q => q.joined).length, last: w.state.last || 0 });
  const list = [...worlds.values()].filter(w => w.state.meta).map(info).sort((a, b) => b.players - a.players || b.last - a.last);
  const def = worlds.get(worldName);
  return { world: def && def.state.meta ? info(def) : list[0] || null, worlds: list, // world: what an older game shows
    rooms: [...rooms].filter(([, r]) => r.host).map(([code, r]) => ({ code, host: r.hostName, world: r.worldName, mode: r.mode, players: r.guests.size + 1 })) };
}
server.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://x'); if (!url.pathname.startsWith('/mp')) { sock.destroy(); return; }
  let roomName = null, room = null, w = null; // w: the server world this player is in
  const id = nextId++; let role = null, wp = false;
  const c = wsAccept(req, sock, text => {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (wp) {
      if (m.t === 'restore') { restorePart(w, id, m); return; }
      if (m.t === 'mirrorhave') { mirrorFill(w, id, m); return; }
      // a player about to leave: save what it just sent and give it the final copy before it goes
      if (m.t === 'flush') { setTimeout(() => { w.stateDirty = true; saveWorld(w, true); c.send(JSON.stringify({ t: 'flushed' })); }, 150); return; }
      if (m.t === 'create' && w.state.meta == null) { w.core.message(id, m); w.stateDirty = true; saveWorld(w); return; }
      if (m.t !== 'join') { w.core.message(id, m); return; }
      // a server that wants everyone logged in (REQUIRE_LOGIN=1): no nickname-and-password, no entry. The password itself
      // is checked by the world (js/mpcore.js)
      if (REQUIRE_LOGIN && !(m.login && m.login.cred)) { c.send(JSON.stringify({ t: 'error', msg: '이 서버는 로그인이 필요합니다 (타이틀 → 로그인)' })); return; }
      w.core.message(id, m); w.state.last = Date.now(); w.stateDirty = true;
      return;
    }
    if (!role) { // the first message says who this is
      if (m.t !== 'hello') return;
      // "join" with a world id: that server world (a new id or newWorld: an empty slot for a new or restored world); with
      // a room code: that player's open world; with neither (an older game): the WORLD world, or the one open world
      let code = String(m.room || url.searchParams.get('room') || '').trim().toUpperCase().slice(0, 12), wid = null;
      if (m.role === 'join' && !code) {
        if (m.newWorld) wid = newWorldId();
        else if (m.world != null) { wid = String(m.world); if (!WORLD_ID.test(wid)) { c.send(JSON.stringify({ t: 'error', msg: '잘못된 세계 이름입니다' })); c.close(); return; } }
        else { const def = worlds.get(worldName); if (!(def && def.state.meta)) { const open = [...rooms].filter(([, r]) => r.host); if (open.length === 1) code = open[0][0]; } } // no world here and one open world: that one
      }
      if (m.role === 'join') { const r = code ? rooms.get(code) : null; m.role = r && r.host ? 'guest' : code ? 'none' : 'world'; }
      if (m.role === 'none') { c.send(JSON.stringify({ t: 'error', msg: `방 코드 ${code}로 열린 세계가 없습니다 (닫혔거나 코드가 틀렸어요)` })); c.close(); return; }
      if (m.role === 'world') { role = 'world'; wp = true; w = openWorld(wid || worldName); w.conns.set(id, c); roomName = w.id;
        c.send(JSON.stringify({ t: 'hello', id, world: w.state.meta ? { name: w.state.meta.name, seed: w.state.meta.seed } : null, kind: 'world', wid: w.id })); return; }
      if (m.role === 'host') { roomName = code && !(rooms.get(code) || {}).host ? code : newCode();
        room = { host: c, guests: new Map(), hostName: String(m.name || '플레이어').slice(0, 16), worldName: String(m.world || '').slice(0, 40), mode: m.mode === 'creative' ? 'creative' : 'survival' }; rooms.set(roomName, room); role = 'host'; }
      else { roomName = code || 'main'; room = rooms.get(roomName); if (!room || !room.host) { c.send(JSON.stringify({ t: 'error', msg: '아직 세계를 연 호스트가 없습니다' })); c.close(); return; } room.guests.set(id, c); role = 'guest'; }
      c.send(JSON.stringify({ t: 'hello', id: role === 'host' ? 0 : id, kind: role, room: roomName })); console.log(`[${roomName}] ${role} ${id} 접속`); return;
    }
    if (role === 'guest') { if (room.host) room.host.send(JSON.stringify({ ...m, from: id })); return; }
    const to = m.to; delete m.to; const s = JSON.stringify(m);
    if (to != null) { const g = room.guests.get(to); if (g) g.send(s); } else for (const g of room.guests.values()) g.send(s);
  }, () => {
    if (wp) { w.conns.delete(id); w.core.leave(id); if (w.restorer === id) { w.restorer = null; saveWorld(w); } if (!w.conns.size) { w.stateDirty = true; saveWorld(w); dropIfEmpty(w); backupNow('모두 나감'); } return; }
    if (role === 'guest') { room.guests.delete(id); if (room.host) room.host.send(JSON.stringify({ t: 'leave', from: id })); }
    else if (role === 'host') { room.host = null; for (const g of room.guests.values()) { g.send(JSON.stringify({ t: 'hostgone' })); g.close(); } room.guests.clear(); rooms.delete(roomName); }
    if (role) console.log(`[${roomName}] ${role} ${id} 나감`);
  });
});
restoreIfEmpty().then(() => server.listen(port, () => {
  const addrs = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log(`네모 대륙 서버: http://localhost:${port}` + addrs.map(a => `  ·  http://${a}:${port}`).join(''));
  console.log(`멀티플레이 주소: ws://${addrs[0] || 'localhost'}:${port}/mp`);
  const made = [...worlds.values()].filter(w => w.state.meta);
  console.log(made.length ? `서버 세계 ${made.length}개: ${made.map(w => w.state.meta.name).join(', ')} — 아무 때나 접속해 플레이할 수 있습니다` : '서버 세계 없음 — 플레이어가 새로 만들거나 자기 세계를 올릴 수 있습니다');
}));
