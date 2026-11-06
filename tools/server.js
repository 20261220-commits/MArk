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
// ---------- the watchman: this process only starts the real server and starts it again if it ever stops ----------
// The real server runs as a child with a cap on its memory (so it cleans up long before the free plan's 512 MB, whatever
// start command the host was given); if it crashes or runs out anyway it is back within a second, on the same disk (no
// wiped world), and why it stopped is kept for /stats. SUPERVISE=0 runs the server directly.
if (!process.env.NEMO_CHILD && !/^(0|no|false)$/i.test(process.env.SUPERVISE || '')) {
  const { spawn } = require('child_process'), starts = []; let child = null, stopping = false, tail = '', lastCrash = null;
  const start = () => {
    starts.push(Date.now()); while (starts.length > 10) starts.shift();
    child = spawn(process.execPath, ['--max-old-space-size=' + (+process.env.HEAP_MB || 300), '--expose-gc', __filename, ...process.argv.slice(2)],
      { stdio: ['ignore', 'inherit', 'pipe', 'ipc'], env: { ...process.env, NEMO_CHILD: '1', NEMO_RESTARTS: String(starts.length - 1), NEMO_LASTCRASH: lastCrash ? JSON.stringify(lastCrash) : '' } });
    child.stderr.on('data', d => { process.stderr.write(d); tail = (tail + d).slice(-3000); });
    child.on('exit', (code, sig) => {
      if (stopping) process.exit(code || 0);
      lastCrash = { at: new Date().toISOString(), code, sig, err: tail.slice(-1500) }; tail = '';
      console.log(`서버가 멈췄습니다 (${sig || '코드 ' + code}) — 다시 켭니다`);
      const fast = starts.length >= 5 && Date.now() - starts[starts.length - 5] < 60000; setTimeout(start, fast ? 10000 : 500); // (one that keeps falling over waits a little)
    });
  };
  for (const sg of ['SIGINT', 'SIGTERM']) process.on(sg, () => { stopping = true; if (child) child.kill(sg); else process.exit(0); setTimeout(() => process.exit(0), 28000); });
  start(); return;
}
if (process.env.NEMO_CHILD) process.on('disconnect', () => process.exit(0)); // the watchman is gone: so is this
// one bad message or a bug in some rarely used path must not take the whole server (and everyone in it) down
process.on('uncaughtException', e => console.log('오류 (서버는 계속 돕니다): ' + (e && e.stack || e)));
process.on('unhandledRejection', e => console.log('오류 (서버는 계속 돕니다): ' + (e && e.stack || e)));
const root = path.join(__dirname, '..'), args = process.argv.slice(2);
// a file is written beside itself and then put in place in one step: a server stopped halfway through (out of memory, a
// redeploy) leaves the old file whole, never half of a new one
const writeAtomic = (f, d) => { const t = f + '.tmp' + process.pid; fs.writeFileSync(t, d); fs.renameSync(t, f); };
// on a hosting service (Render and the like) the port comes from PORT; WORLD names the world and WORLDS_DIR is where worlds are
// kept (point it at a persistent disk there, or the world is lost whenever the service restarts)
const wi = args.indexOf('--world'), port = +(args.find((a, i) => /^\d+$/.test(a) && i !== wi + 1) || process.env.PORT || 8080), worldName = (wi >= 0 && args[wi + 1] ? args[wi + 1] : process.env.WORLD || 'world').replace(/[^\w\-가-힣]/g, '_');
const WORLDS = path.resolve(process.env.WORLDS_DIR || path.join(root, 'worlds'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.md': 'text/plain; charset=utf-8', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

// SERVER_URL (environment) reaches the game as js/config.js; REQUIRE_LOGIN=1 lets only players logged in with a
// nickname and password into the server world
const CFG = { server: process.env.SERVER_URL || '' }, REQUIRE_LOGIN = /^(1|true|yes)$/i.test(process.env.REQUIRE_LOGIN || '');
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  // what can be joined here: the saved server world and the players' own worlds that are open (the join screen lists them)
  if (u === '/skin') { skinProxy(req, res); return; }
  if (u === '/profile') { profileLookup(req, res); return; }
  if (u === '/report' && req.method === 'POST') { let b = ''; req.on('data', d => { b += d; if (b.length > 2000) req.destroy(); }); req.on('end', () => { try { const o = JSON.parse(b); noteDrop({ at: new Date().toISOString(), side: 'game', name: String(o.name || '').slice(0, 16), why: String(o.why || '').slice(0, 200), world: String(o.world || '').slice(0, 40), secs: +o.secs || 0 }); } catch (e) {} res.writeHead(204, { 'access-control-allow-origin': '*' }); res.end(); }); return; }
  if (u === '/stats') { res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(serverStats(), null, 1)); return; }
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
  // drop: a message the next one replaces (positions, mob lists, the clock). When a player's connection can't keep up,
  // these are skipped instead of piling up: a queue that only grows makes everything arrive later and later
  // (the newest of each kind - each player's position, the mob list - is kept and goes out the moment the connection
  // drains, so the latest state always arrives, only the stale ones in between are skipped)
  const latest = new Map();
  const flush = () => { if (closed || !latest.size) return; const l = [...latest.values()]; latest.clear(); for (const s of l) sock.write(frame(1, Buffer.from(s))); };
  sock.on('drain', flush);
  const c = { backlog: () => sock.writableLength, send(s, drop) { if (closed) return; if (drop && sock.writableLength > 256 * 1024) { latest.set(drop, s); return; } if (latest.size && !drop) flush(); sock.write(frame(1, Buffer.from(s))); }, close() { if (!closed) { closed = true; try { sock.end(frame(8, Buffer.alloc(0))); } catch (e) {} onClose('서버가 닫음'); } } };
  sock.on('data', d => {
    seen = Date.now(); buf = buf.length ? Buffer.concat([buf, d]) : d;
    for (;;) {
      if (buf.length < 2) return;
      const fin = buf[0] & 0x80, op = buf[0] & 15, masked = buf[1] & 0x80; let len = buf[1] & 127, p = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); p = 4; } else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); p = 10; }
      if (buf.length < p + (masked ? 4 : 0) + len) return;
      const mask = masked ? buf.subarray(p, p + 4) : null; p += masked ? 4 : 0;
      const data = Buffer.from(buf.subarray(p, p + len)); if (mask) for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(p + len);
      if (op === 8) { why = '플레이어가 나감'; closed = true; try { sock.end(frame(8, Buffer.alloc(0))); } catch (e) {} onClose(why); return; }
      if (op === 9) { sock.write(frame(10, data)); continue; }
      if (op === 1 || op === 2 || op === 0) { parts.push(data); if (fin) { const msg = Buffer.concat(parts).toString(); parts = []; try { onText(msg); } catch (e) { console.log('메시지 처리 오류: ' + (e && e.stack || e)); } } }
    }
  });
  // a ping now and then: hosting proxies close connections that stay quiet (the browser answers by itself). A connection
  // that hasn't said anything for 2 minutes - not even the pong - is dead (a phone that changed networks, a closed laptop):
  // closed here, so its player leaves at once instead of blocking its own way back in
  let seen = Date.now();
  const ping = setInterval(() => { if (closed) return; if (Date.now() - seen > 120000) { why = '2분 동안 응답 없음'; try { sock.destroy(); } catch (e) {} return; } try { sock.write(frame(9, Buffer.alloc(0))); } catch (e) {} }, 15000);
  let why = '플레이어 쪽에서 닫힘';
  sock.on('close', () => { clearInterval(ping); if (!closed) { closed = true; onClose(why); } }); sock.on('error', e => { why = '네트워크 오류 ' + (e && e.code || ''); });
  return c;
}

// ---------- server worlds (js/mpcore.js does the work; the files are here) ----------
// The server keeps any number of worlds, each in worlds/<id>/ (world.json and chunks/), as a single-player game keeps its
// worlds: every world made or uploaded here stays, is listed for everyone and can be joined at any time, with or without
// whoever made it. WORLD names the world an older game (one without the world list) joins.
const { mpWorldCore } = require(path.join(root, 'js', 'mpcore.js'));
const DROPPABLE = new Set(['pl', 'mobs', 'vehs', 'items', 'xps', 'time']);
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
  const store = { state, keys: w.keys, load: dk => { try { return JSON.parse(fs.readFileSync(w.fileOf(dk), 'utf8')); } catch (e) { return null; } }, save: (dk, c) => w.dirty.set(dk, c), pending: dk => w.dirty.has(dk), drop: cid => { const c = w.conns.get(cid); if (c) setTimeout(() => c.close(), 200); }, /* (after its 'kicked' has gone out) */ saveState: () => { w.stateDirty = true; w.changedSinceBackup = true; }, /* (players' things count too: the 10-minute backup used to wait for a changed block) */ log: t => console.log(`[${id}] ${t}`) };
  let lastO = null, lastS = ''; // one message to many players is turned into text once
  w.core = mpWorldCore(store, (cid, o) => { const c = w.conns.get(cid); if (!c) return; if (o !== lastO) { if (lastO === null) queueMicrotask(() => { lastO = null; }); lastO = o; lastS = JSON.stringify(o); } c.send(lastS, DROPPABLE.has(o.t) && o.t + ':' + (o.id != null ? o.id : o.from != null ? o.from : '')); }); // (only within one round of sending: an object changed and sent again later is written afresh)
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
  for (const [dk, c] of w.dirty) { const e = { rec: c.rec, edits: c.edits, tiles: c.tiles }; ver[dk] = (ver[dk] || 0) + 1; w.stateDirty = true; writeAtomic(w.fileOf(dk), JSON.stringify(e)); out.push([dk, ver[dk], e]); }
  if (w.stateDirty) { writeAtomic(path.join(w.dir, 'world.json'), JSON.stringify(st)); w.stateDirty = false; }
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
  const next = () => { if (!w.conns.has(id) || !need.length) return; if (c.backlog() > 64 * 1024) { setTimeout(next, 400); return; } /* a slow connection gets the copy as fast as it can take it, the game first */ const l = need.splice(0, 6).map(dk => { try { return [dk, ver[dk] || 0, JSON.parse(fs.readFileSync(w.fileOf(dk), 'utf8'))]; } catch (e) { return null; } }).filter(Boolean);
    if (l.length) c.send(JSON.stringify({ t: 'mirror', wid: st.wid, l })); setTimeout(next, 250); };
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
  if (m.part === 'chunk') { for (const [dk, v, e] of m.l || []) { if (typeof dk !== 'string' || !/^[ne]?-?\d+,-?\d+$/.test(dk) || !e) continue; writeAtomic(w.fileOf(dk), JSON.stringify({ rec: e.rec || null, edits: e.edits || [], tiles: e.tiles || {} })); w.keys.add(dk); st.cver[dk] = +v || 1; } w.stateDirty = true; return; }
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
  // one record per line (NEMO3): a world's state, then its chunks; the restore reads it a line at a time, so a big world
  // never has to fit in memory whole (the old one-object backups were parsed all at once on start - with a big world
  // that alone could pass the free plan's 512 MB and the server died on every start)
  saveAllWorlds(); const list = [...worlds.values()].filter(w => w.state.meta); if (!list.length) return null;
  // (a free host has a tenth of a processor: the work is done a few files at a time, with the game served in between -
  // a backup that held the server for tens of seconds made every player's game think the connection had died)
  const gz = zlib.createGzip({ level: 6 }), out = []; gz.on('data', d => out.push(d)); const done = new Promise((res, rej) => { gz.on('end', res); gz.on('error', rej); });
  let n = 0; const put = async s => { if (!gz.write(s)) await new Promise(r => gz.once('drain', r)); if (++n % 8 === 0) await new Promise(r => setTimeout(r, 5)); };
  const raw = f => { try { const t = fs.readFileSync(f, 'utf8'); return t.length > 1 && t[0] === '{' && t[t.length - 1] === '}' ? t : null; } catch (e) { return null; } }; // (a file cut short is left out)
  await put('NEMO3\n'); let any = false;
  for (const w of list) { const st = raw(path.join(w.dir, 'world.json')); if (!st) continue; any = true;
    await put('W\t' + w.id + '\t' + st.replace(/\n/g, '') + '\n');
    for (const dk of [...w.keys]) { const t = raw(w.fileOf(dk)); if (!t) continue; await put('C\t' + w.id + '\t' + dk + '\t' + t.replace(/\n/g, '') + '\n'); } }
  gz.end(); await done; return any ? Buffer.concat(out) : null;
}
let backingUp = null;
// a backup that would lose a world, or most of one, against the last good one is kept aside instead (…-suspect)
function backupSuspect(counts) { const m = BK.manifest; if (!m) return null; for (const id in m) { const n0 = m[id], n = counts[id]; if (n == null) return '세계 ' + id + '이(가) 없어짐'; if (n0 >= 10 && n < n0 * 0.7) return '세계 ' + id + '의 청크가 ' + n0 + '개에서 ' + n + '개로 줄어듦'; } return null; }
let lastBackupHash = null;
async function backupNow(why) {
  if (!BACKUP || backingUp) return backingUp;
  if (BK.blocked) { console.log('백업 건너뜀: 서버가 아직 백업을 불러오지 못했습니다'); return null; } // (an empty server must not be backed up over the worlds)
  backingUp = worldSnapshot().then(async snap => { if (!snap) return null; const counts = worldCounts(), bad = backupSuspect(counts);
      if (bad) { console.log('⚠ 이상한 백업이라 덮어쓰지 않고 따로 둡니다 (' + bad + ')'); BK.lastError = '의심 백업: ' + bad; await BACKUP.save(snap, { suspect: true }); return null; }
      const hash = require('crypto').createHash('sha1').update(Buffer.isBuffer(snap) ? snap : JSON.stringify(snap)).digest('hex');
      if (hash === lastBackupHash) { console.log('백업 건너뜀: 지난 백업과 같습니다'); for (const w of worlds.values()) w.changedSinceBackup = false; return null; }
      const n = await BACKUP.save(snap); lastBackupHash = hash; BK.manifest = counts; return n; }).then(n => { if (n == null) return; for (const w of worlds.values()) w.changedSinceBackup = false; lastBackup = { at: new Date().toISOString(), why, kb: Math.round(n / 1024) }; console.log(`세계 백업 완료 (${why}, ${(n / 1024).toFixed(0)} KB → ${process.env.GITHUB_BACKUP_REPO})`); }).catch(e => { lastBackup = { at: new Date().toISOString(), why, error: e.message }; console.log('세계 백업 실패: ' + e.message); }).finally(() => { backingUp = null; });
  return backingUp;
}
// the one-object backups ({"v":2,"worlds":{id:{"state":{..},"chunks":{dk:{..}}}}}) read a piece at a time: a small
// scanner keeps only the value it is copying (a world's state, or one chunk), never the whole world
async function scanOldBackup(input, put) {
  const key = []; let depth = 0, inStr = false, esc = false, str = null, last = null, cap = null, capAt = 0, capWhat = null;
  input.setEncoding('utf8');
  for await (const t of input) {
    let from = cap ? 0 : -1;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') { inStr = false; if (str != null) { last = str; str = null; } } else if (str != null) str += ch; continue; }
      if (ch === '"') { inStr = true; str = cap ? null : ''; continue; }
      if (ch === ':' && !cap && last != null) { key[depth] = last; last = null; continue; }
      if (ch === '{' || ch === '[') {
        if (!cap && ch === '{' && ((depth === 3 && key[3] === 'state') || (depth === 4 && key[3] === 'chunks'))) { cap = []; from = i; capAt = depth; capWhat = depth === 3 ? [key[2], null] : [key[2], key[4]]; }
        depth++; continue; }
      if (ch === '}' || ch === ']') { depth--;
        if (cap && depth === capAt) { cap.push(t.slice(from, i + 1)); put(capWhat[0], capWhat[1], cap.join('')); cap = null; from = -1; }
        continue; }
      if (ch === ',') last = null;
    }
    if (cap && from >= 0) cap.push(t.slice(from));
  }
}
// Restoring is careful: a restore point is read through once to check it is whole before anything is written; a broken
// or empty one gives way to the next (the one before, then the days of the last week). If GitHub can't be reached at
// all, the server tries again a few times, then opens with the server worlds locked (no one can join them, nothing is
// backed up) and keeps trying every minute: an empty server must never be backed up over the worlds.
const BK = { blocked: false, manifest: null, lastError: null, restoredFrom: null };
async function backupCheck(gz) { // { worlds, chunks } of a NEMO3 restore point, or null if it isn't whole
  let w = 0, c = 0; const rl = require('readline').createInterface({ input: require('stream').Readable.from([gz]).pipe(zlib.createGunzip()), crlfDelay: Infinity }); let first = true;
  for await (const line of rl) { if (first) { first = false; if (line !== 'NEMO3') return null; continue; } if (line.startsWith('W\t')) { const st = line.slice(line.indexOf('\t', 2) + 1); try { const o = JSON.parse(st); if (o && o.meta) w++; } catch (e) { return null; } } else if (line.startsWith('C\t')) c++; }
  return w ? { worlds: w, chunks: c } : null;
}
async function restoreFrom(gz) { // the files of a checked restore point (or an older one-object backup); the worlds' chunk counts
  const ids = new Set(), counts = {};
  const head = zlib.gunzipSync(gz.subarray(0, Math.min(gz.length, 4096)), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8', 0, 6);
  if (head === 'NEMO3\n') { // a line at a time, straight to the files
    const rl = require('readline').createInterface({ input: require('stream').Readable.from([gz]).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    for await (const line of rl) {
      const a = line.indexOf('\t'), b = line.indexOf('\t', a + 1); if (a < 0 || b < 0) continue; const kind = line.slice(0, a), id = line.slice(a + 1, b); if (!WORLD_ID.test(id)) continue;
      const dir = path.join(WORLDS, id), cdir = path.join(dir, 'chunks');
      if (kind === 'W') { fs.mkdirSync(cdir, { recursive: true }); writeAtomic(path.join(dir, 'world.json'), line.slice(b + 1)); ids.add(id); counts[id] = 0; }
      else if (kind === 'C' && ids.has(id)) { const c = line.indexOf('\t', b + 1); if (c < 0) continue; const dk = line.slice(b + 1, c); if (!/^[ne]?-?\d+,-?\d+$|^o:/.test(dk)) continue; writeAtomic(path.join(cdir, encodeURIComponent(dk) + '.json'), line.slice(c + 1)); counts[id]++; }
    }
  } else { // a backup made before (one object): read as a stream too, each world's state and each chunk on its own
    const put = (id, dk, text) => { if (!WORLD_ID.test(id)) return; const dir = path.join(WORLDS, id), cdir = path.join(dir, 'chunks');
      if (dk == null) { let st; try { st = JSON.parse(text); } catch (e) { return; } if (!st || !st.meta) return; fs.mkdirSync(cdir, { recursive: true }); writeAtomic(path.join(dir, 'world.json'), text); ids.add(id); counts[id] = 0; }
      else if (ids.has(id)) { writeAtomic(path.join(cdir, encodeURIComponent(dk) + '.json'), text); counts[id]++; } };
    await scanOldBackup(require('stream').Readable.from([gz]).pipe(zlib.createGunzip()), put);
    if (!ids.size) { const snap = JSON.parse(zlib.gunzipSync(gz).toString('utf8')); if (snap && snap.state && snap.state.meta) { put(snap.name || worldName, null, JSON.stringify(snap.state)); for (const [dk, c] of Object.entries(snap.chunks || {})) put(snap.name || worldName, dk, JSON.stringify(c)); } } // the very first (one-world) backups
  }
  return ids.size ? { ids, counts } : null;
}
// one try at bringing the worlds back: 'restored', 'none' (nothing was ever backed up) or throws (GitHub can't be reached)
async function restoreOnce() {
  const names = await BACKUP.candidates(); let sawAny = false;
  for (const name of names) {
    let gz; try { gz = await BACKUP.loadGz(name); } catch (e) { if (name === BACKUP.branch) throw e; continue; } // (the latest must be readable; an older one may be missing)
    if (!gz) continue; sawAny = true;
    let ok = null; try { const head = zlib.gunzipSync(gz.subarray(0, Math.min(gz.length, 4096)), { finishFlush: zlib.constants.Z_SYNC_FLUSH }).toString('utf8', 0, 6); ok = head === 'NEMO3\n' ? await backupCheck(gz) : { worlds: 1, chunks: 0 }; } catch (e) { ok = null; }
    if (!ok) { console.log(`백업 ${name}이(가) 망가져 있어 그 전 것을 봅니다`); continue; }
    const r = await restoreFrom(gz); if (!r) continue;
    for (const id of r.ids) { const w = worlds.get(id); if (w) loadWorld(w); else openWorld(id); }
    BK.manifest = r.counts; BK.restoredFrom = name; console.log(`백업에서 세계를 되살렸습니다 (${name}, 세계 ${r.ids.size}개)`); return 'restored';
  }
  if (sawAny) { const e = new Error('읽을 수 있는 백업이 없습니다'); e.broken = true; throw e; }
  return 'none';
}
async function restoreIfEmpty() { // a fresh disk (a restart on a free host): bring the worlds back from the backup
  if (!BACKUP || [...worlds.values()].some(w => w.state.meta)) { if (BACKUP) BK.manifest = worldCounts(); return; }
  const RS = +process.env.BACKUP_RETRY_SCALE || 1; // (tests make the waits short)
  for (const wait of [0, 5000, 15000, 30000]) {
    if (wait) await new Promise(r => setTimeout(r, wait * RS));
    try { const r = await restoreOnce(); if (r === 'none') console.log('백업된 세계 없음 — 새 세계를 기다립니다'); BK.blocked = false; BK.lastError = null; return; }
    catch (e) { BK.lastError = e.message; console.log('백업 불러오기 실패: ' + e.message); }
  }
  // still nothing: the server opens, its worlds locked until a restore goes through
  BK.blocked = true; console.log('백업을 불러오지 못해 서버 세계를 잠가 둡니다 (1분마다 다시 시도)');
  const retry = setInterval(async () => { try { await restoreOnce(); BK.blocked = false; BK.lastError = null; clearInterval(retry); console.log('백업을 불러와 서버 세계를 다시 엽니다'); } catch (e) { BK.lastError = e.message; } }, 60000 * RS);
}
const worldCounts = () => { const o = {}; for (const w of worlds.values()) if (w.state.meta) o[w.id] = w.keys.size; return o; };
// /stats: how the server is doing (memory, worlds, players), and why it last stopped if it did
const STARTED = Date.now(); let lastBackup = null; const DROPS = [];
const noteDrop = d => { DROPS.push(d); if (DROPS.length > 40) DROPS.shift(); }; // the last connections that ended, and why (as the server saw it, and as players' games reported it)
function serverStats() {
  const m = process.memoryUsage(), MB = x => Math.round(x / 1048576); let lc = null; try { lc = process.env.NEMO_LASTCRASH ? JSON.parse(process.env.NEMO_LASTCRASH) : null; } catch (e) {}
  return { pid: process.pid, uptimeMin: Math.round((Date.now() - STARTED) / 60000), memMB: { rss: MB(m.rss), heap: MB(m.heapUsed), heapTotal: MB(m.heapTotal), external: MB(m.external) }, restarts: +process.env.NEMO_RESTARTS || 0, lastCrash: lc, lastBackup, backup: { on: !!BACKUP, locked: BK.blocked, lastError: BK.lastError, restoredFrom: BK.restoredFrom },
    worlds: [...worlds.values()].filter(w => w.state.meta).map(w => ({ id: w.state.meta.priv ? '(비공개)' : w.id, name: w.state.meta.priv ? '(비공개 서버)' : w.state.meta.name, players: [...w.core.players.values()].filter(q => q.joined).length, conns: w.conns.size, chunksOnDisk: w.keys.size, cached: w.core.cacheSize ? w.core.cacheSize() : null, unsaved: w.dirty.size })),
    rooms: [...rooms.values()].filter(r => r.host).length, recentDrops: DROPS.slice().reverse() };
}
setInterval(() => { const m = process.memoryUsage(); console.log(`메모리 ${Math.round(m.rss / 1048576)} MB (힙 ${Math.round(m.heapUsed / 1048576)} MB), 접속 ${[...worlds.values()].reduce((a, w) => a + w.conns.size, 0)}명`); }, 5 * 60000).unref();
if (process.env.NEMO_LASTCRASH) console.log('지난번 서버가 멈춘 이유: ' + process.env.NEMO_LASTCRASH.slice(0, 600));
// memory: the free plan stops the server at 512 MB. Worlds nobody is in keep no chunks in memory, and when the server
// nears the limit every world lets go of the chunks it isn't changing (they are on disk) - long before it would be stopped
const MEM_SOFT = (+process.env.MEM_LIMIT_MB || 512) * 0.62 * 1048576;
setInterval(() => {
  for (const w of worlds.values()) if (!w.conns.size) w.core.trim && w.core.trim(0);
  const rss = process.memoryUsage().rss; if (rss < MEM_SOFT) return;
  for (const w of worlds.values()) { saveWorld(w); w.core.trim && w.core.trim(100); }
  if (global.gc) global.gc();
  console.log(`메모리 ${Math.round(rss / 1048576)} MB: 쓰지 않는 청크를 비웠습니다 → ${Math.round(process.memoryUsage().rss / 1048576)} MB`);
}, 10000).unref();
// every backup goes out as upload traffic (a 2 MB world, a third more in transit), and the free plan allows 5 GB a month:
// the worlds go up when they changed, at most every 30 minutes (and when everyone leaves, and before the server stops);
// a backup the same as the last one isn't sent at all
const BACKUP_EVERY = Math.max(5, +process.env.BACKUP_MINUTES || 30) * 60 * 1000;
if (BACKUP) setInterval(() => { if ([...worlds.values()].some(w => w.changedSinceBackup)) backupNow(Math.round(BACKUP_EVERY / 60000) + '분마다'); }, BACKUP_EVERY);
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
  const list = [...worlds.values()].filter(w => w.state.meta && !w.state.meta.priv).map(info) /* private worlds are never listed */.sort((a, b) => b.players - a.players || b.last - a.last);
  const def = worlds.get(worldName);
  return { world: def && def.state.meta && !def.state.meta.priv ? info(def) : list[0] || null, worlds: list, // world: what an older game shows
    rooms: [...rooms].filter(([, r]) => r.host).map(([code, r]) => ({ code, host: r.hostName, world: r.worldName, mode: r.mode, players: r.guests.size + 1 })) };
}
server.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://x'); if (!url.pathname.startsWith('/mp')) { sock.destroy(); return; }
  let roomName = null, room = null, w = null; // w: the server world this player is in
  const id = nextId++; let role = null, wp = false;
  const c = wsAccept(req, sock, text => {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (m.t === 'hb' && !wp && role !== 'guest') return; // a player's game saying it is still there (in a background tab too): the world (or the host's) marks it seen
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
      if (m.role === 'world' && BK.blocked) { c.send(JSON.stringify({ t: 'error', msg: '서버가 세계 백업을 아직 불러오지 못해 잠시 잠가 두었습니다. 1~2분 뒤 다시 접속해 주세요' })); c.close(); return; } // (nothing may be made or changed before the worlds are back)
      if (m.role === 'world') { const ww = openWorld(wid || worldName), pk = ww.state.meta && ww.state.meta.priv && ww.state.meta.priv.key;
        if (pk && String(m.key || '') !== pk) { c.send(JSON.stringify({ t: 'error', msg: '비공개 서버입니다. 초대 코드가 맞지 않습니다' })); c.close(); dropIfEmpty(ww); return; } // (a private world: only with its invite key)
        role = 'world'; wp = true; w = ww; w.conns.set(id, c); roomName = w.id;
        c.send(JSON.stringify({ t: 'hello', id, world: w.state.meta ? { name: w.state.meta.name, seed: w.state.meta.seed } : null, kind: 'world', wid: w.id })); return; }
      if (m.role === 'host') { roomName = code && !(rooms.get(code) || {}).host ? code : newCode();
        room = { host: c, guests: new Map(), hostName: String(m.name || '플레이어').slice(0, 16), worldName: String(m.world || '').slice(0, 40), mode: m.mode === 'creative' ? 'creative' : 'survival' }; rooms.set(roomName, room); role = 'host'; }
      else { roomName = code || 'main'; room = rooms.get(roomName); if (!room || !room.host) { c.send(JSON.stringify({ t: 'error', msg: '아직 세계를 연 호스트가 없습니다' })); c.close(); return; } room.guests.set(id, c); role = 'guest'; }
      c.send(JSON.stringify({ t: 'hello', id: role === 'host' ? 0 : id, kind: role, room: roomName })); console.log(`[${roomName}] ${role} ${id} 접속`); return;
    }
    const dr = DROPPABLE.has(m.t) && m.t + ':' + (m.id != null ? m.id : role === 'guest' ? id : '');
    if (role === 'guest') { if (room.host) room.host.send(JSON.stringify({ ...m, from: id }), dr); return; }
    const to = m.to; delete m.to; const s = JSON.stringify(m);
    if (to != null) { const g = room.guests.get(to); if (g) g.send(s, dr); } else for (const g of room.guests.values()) g.send(s, dr);
  }, why => {
    { const p = wp && w.core.players.get(id); if (p && p.joined || role) noteDrop({ at: new Date().toISOString(), side: 'server', world: wp ? w.id : roomName, name: p ? p.name : role, why }); }
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
