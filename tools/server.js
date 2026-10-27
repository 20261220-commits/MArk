// Serves the game and runs multiplayer on your network, with no dependencies:
//   node tools/server.js [port] [--world name]      then open http://<this computer's address>:<port> on every device
// Two kinds of multiplayer:
//  - a saved server world (worlds/<name>/ next to the game): it stays on this computer and anyone can join at any time,
//    whoever made it doesn't need to be there. The players who are on share the work: in each dimension the first one
//    there runs it (mobs, water, crops, redstone) and the others follow; when that player leaves, the next one takes
//    over. With nobody on, the world waits. Players join with "멀티플레이 → 서버에 접속" at ws://<address>:<port>/mp.
//  - one player's own world opened to others ("서버로 열기"), as before: guests' messages go to that host.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const root = path.join(__dirname, '..'), args = process.argv.slice(2);
const wi = args.indexOf('--world'), port = +(args.find((a, i) => /^\d+$/.test(a) && i !== wi + 1) || 8080), worldName = (wi >= 0 && args[wi + 1] ? args[wi + 1] : 'world').replace(/[^\w\-가-힣]/g, '_');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.md': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(root, path.normalize(u));
  if (!f.startsWith(root + path.sep) || f.startsWith(path.join(root, 'worlds') + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('not found'); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});

// ---------- a minimal WebSocket (RFC 6455): text frames, fragments, ping, close ----------
function frame(op, payload) {
  const n = payload.length, head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x80 | op, 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
  return Buffer.concat([head, payload]);
}
function wsAccept(req, sock, onText, onClose) {
  const key = req.headers['sec-websocket-key']; if (!key) { sock.destroy(); return null; }
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
      if (op === 1 || op === 2 || op === 0) { parts.push(data); if (fin) { const msg = Buffer.concat(parts).toString(); parts = []; onText(msg); } }
    }
  });
  sock.on('close', () => { if (!closed) { closed = true; onClose(); } }); sock.on('error', () => {});
  return c;
}

// ---------- the saved server world ----------
const WDIR = path.join(root, 'worlds', worldName), CDIR = path.join(WDIR, 'chunks');
const W = { meta: null, time: 1000, rain: 0, thunder: false, players: {}, weatherT: 12000 + Math.random() * 168000 };
const chunks = new Map(), dirty = new Set(); // dk -> { rec, edits: [[x, y, z, id, m, metaOnly]], tiles: { index: tile } }
const fileOf = dk => path.join(CDIR, encodeURIComponent(dk) + '.json');
function loadWorld() {
  try { const j = JSON.parse(fs.readFileSync(path.join(WDIR, 'world.json'), 'utf8')); Object.assign(W, j); } catch (e) { return; }
  try { for (const f of fs.readdirSync(CDIR)) if (f.endsWith('.json')) chunks.set(decodeURIComponent(f.slice(0, -5)), null); } catch (e) {} // loaded on first use
  console.log(`세계 "${worldName}" 불러옴 (시드 ${W.meta.seed}, 청크 ${chunks.size}개)`);
}
function chunk(dk) {
  let c = chunks.get(dk);
  if (c === null) { try { c = JSON.parse(fs.readFileSync(fileOf(dk), 'utf8')); } catch (e) { c = null; } }
  if (!c) c = { rec: null, edits: [], tiles: {} };
  chunks.set(dk, c); return c;
}
function saveWorld() {
  if (!W.meta) return;
  fs.mkdirSync(CDIR, { recursive: true });
  fs.writeFileSync(path.join(WDIR, 'world.json'), JSON.stringify({ meta: W.meta, time: W.time, rain: W.rain, thunder: W.thunder, players: W.players, weatherT: W.weatherT }));
  for (const dk of dirty) { const c = chunks.get(dk); if (c) fs.writeFileSync(fileOf(dk), JSON.stringify(c)); }
  dirty.clear();
}
loadWorld();
setInterval(saveWorld, 5000);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { saveWorld(); process.exit(0); });

// who runs each dimension: the first player there; the clock and weather are the server's
const players = new Map(); // id -> { c, id, name, skin, dim, s, at }
const auth = new Map(); // dim -> id
function sendTo(p, o) { p.c.send(JSON.stringify(o)); }
function others(p, o, sameDim) { const s = JSON.stringify(o); for (const q of players.values()) if (q !== p && (!sameDim || q.dim === p.dim)) q.c.send(s); }
function pickAuth(dim) {
  const cur = auth.get(dim), here = [...players.values()].filter(q => q.dim === dim);
  if (cur != null && here.some(q => q.id === cur)) return;
  if (here.length) auth.set(dim, here[0].id); else auth.delete(dim);
  const s = JSON.stringify({ t: 'auth', dim, id: auth.has(dim) ? auth.get(dim) : null });
  for (const q of players.values()) q.c.send(s);
}
function setDim(p, dim) { if (p.dim === dim) return; const old = p.dim; p.dim = dim; if (old != null) pickAuth(old); pickAuth(dim); sendTo(p, { t: 'auth', dim, id: auth.get(dim) }); }
const chunkKey = (dim, x, z) => ({ '-1': 'n', 1: 'e' }[dim] || '') + (x >> 4) + ',' + (z >> 4);
setInterval(() => { // 20 ticks a second while anyone plays
  if (!players.size || !W.meta) return;
  const g = W.meta.gamerules || {};
  if (g.doDaylightCycle !== false) W.time += 20;
  if (g.doWeatherCycle !== false && (W.weatherT -= 20) <= 0) { const on = W.rain < 0.5; W.rain = on ? 1 : 0; W.thunder = on && Math.random() < 0.3; W.weatherT = on ? 12000 + Math.random() * 12000 : 12000 + Math.random() * 168000; }
  // the night passes once everyone in the Overworld has been in bed for a few seconds
  const ow = [...players.values()].filter(q => q.dim === 0 && q.s && q.s.mode !== 'spectator');
  const asleep = ow.length && ow.every(q => q.s.sleep); W.sleepT = asleep ? (W.sleepT || 0) + 1 : 0;
  if (W.sleepT >= 5) { W.time = Math.ceil(W.time / 24000) * 24000; W.rain = 0; W.thunder = false; W.sleepT = 0; const s = JSON.stringify({ t: 'wake' }); for (const q of players.values()) q.c.send(s); }
  const s = JSON.stringify({ t: 'time', time: W.time, rain: W.rain, thunder: W.thunder }); for (const q of players.values()) q.c.send(s);
}, 1000);

function worldMessage(p, m) {
  const from = p.id; m.from = from;
  switch (m.t) {
    case 'create': // a new world, or the start of an upload of an existing one
      if (W.meta) { sendTo(p, { t: 'error', msg: '이 서버에는 이미 세계가 있습니다' }); return; }
      W.meta = { name: String(m.meta.name || worldName).slice(0, 40), seed: m.meta.seed, exp: m.meta.exp !== false, mode: m.meta.mode === 'creative' ? 'creative' : 'survival', diff: +m.meta.diff || 2, cheats: !!m.meta.cheats, spawn: m.meta.spawn || null, gamerules: m.meta.gamerules || {}, shared: m.meta.shared || {} };
      W.time = +m.meta.time || 1000; W.rain = 0; saveWorld(); console.log(`새 세계 "${W.meta.name}" (시드 ${W.meta.seed})`); sendTo(p, { t: 'created' }); return;
    case 'join': {
      if (!W.meta) { sendTo(p, { t: 'noworld' }); return; }
      p.name = String(m.name || '손님').slice(0, 16); p.skin = m.skin || null;
      for (const q of players.values()) if (q !== p && q.name === p.name) { sendTo(p, { t: 'error', msg: '같은 이름의 플레이어가 이미 있습니다' }); return; }
      p.joined = true;
      sendTo(p, { t: 'welcome', you: from, meta: W.meta, time: W.time, rain: W.rain, thunder: W.thunder, pdata: W.players[p.name] || null, stored: [...chunks.keys()],
        players: [...players.values()].filter(q => q !== p && q.joined).map(q => ({ id: q.id, name: q.name, skin: q.skin })), auth: Object.fromEntries(auth) });
      others(p, { t: 'peer', id: from, name: p.name, skin: p.skin }); console.log(`${p.name} 접속 (${players.size}명)`); return;
    }
    case 'dim': setDim(p, +m.dim || 0); return;
    case 'pl': p.s = m; if (m.dim !== p.dim) setDim(p, m.dim); others(p, m); return;
    case 'pdata': { const nm = p.name || (typeof m.name === 'string' ? m.name.slice(0, 16) : null); if (nm && m.d) W.players[nm] = m.d; return; }
    case 'meta': if (W.meta && m.shared) { W.meta.shared = { ...W.meta.shared, ...m.shared }; if (m.spawn) W.meta.spawn = m.spawn; if (m.gamerules) W.meta.gamerules = m.gamerules; } return;
    case 'timeset': W.time = +m.time || W.time; if (m.rain != null) { W.rain = m.rain; W.thunder = !!m.thunder; } return;
    case 'chunk': { const dk = ({ '-1': 'n', 1: 'e' }[m.dim] || '') + m.cx + ',' + m.cz, c = chunks.has(dk) ? chunk(dk) : null, out = { t: 'chunkdata', cx: m.cx, cz: m.cz, dim: m.dim, edits: c && c.edits.length ? c.edits : null, tiles: c && Object.keys(c.tiles).length ? c.tiles : null };
      if (c && c.rec && c.rec.b) Object.assign(out, { b: c.rec.b, m: c.rec.m, l: c.rec.l, bio: c.rec.bio, tl: c.rec.t || [], ch: c.rec.ch, it: c.rec.it, mobs: c.rec.mobs || null }); else { out.none = true; if (c && c.rec) out.mobs = c.rec.mobs || null; }
      sendTo(p, out); return; }
    case 'chunkmobs': { const l = []; for (const dk of m.dks || []) { const c = chunks.has(dk) ? chunk(dk) : null; if (c && c.rec && c.rec.mobs) l.push([dk, c.rec.mobs]); } sendTo(p, { t: 'chunkmobs', l }); return; }
    case 'store': { if (typeof m.dk !== 'string' || !m.rec) return; const c = chunk(m.dk); c.rec = m.rec; c.edits = []; c.tiles = {}; dirty.add(m.dk); others(p, { t: 'stored', dk: m.dk }); return; }
    case 'sets': { // the dimension's runner: every change, kept until that chunk is stored again
      if (auth.get(p.dim) !== from) return;
      for (const e of m.l || []) { const dk = chunkKey(m.dim, e[0], e[2]), c = chunk(dk); c.edits.push(e); if (c.edits.length > 20000) c.edits.splice(0, c.edits.length - 20000); dirty.add(dk); }
      others(p, m, true); return; }
    case 'tile': { if (typeof m.dk === 'string' && m.tile) { const c = chunk(m.dk), i = (m.y << 8) | ((m.z & 15) << 4) | (m.x & 15); c.tiles[i] = m.tile; dirty.add(m.dk); } others(p, m, true); return; }
    case 'chat': case 'sys': case 'hitfx': others(p, m); return;
  }
  // anything else: to one player, to the dimension's runner, to the dimension, or to everyone
  const to = m.to; delete m.to;
  if (typeof to === 'number') { const q = players.get(to); if (q) sendTo(q, m); }
  else if (to === 'auth') { const q = players.get(auth.get(m.dim != null ? m.dim : p.dim)); if (q && q !== p) sendTo(q, m); }
  else if (to === 'dim') others(p, m, true);
  else others(p, m);
}
function worldLeave(p) {
  players.delete(p.id); if (!p.joined) return;
  others(p, { t: 'gone', id: p.id }); console.log(`${p.name} 나감 (${players.size}명)`);
  if (p.dim != null) pickAuth(p.dim);
  if (!players.size) saveWorld();
}

// ---------- rooms of a player's own world: one host, any number of guests ----------
const rooms = new Map(); let nextId = 1;
server.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://x'); if (!url.pathname.startsWith('/mp')) { sock.destroy(); return; }
  const roomName = url.searchParams.get('room') || 'main', room = rooms.get(roomName) || { host: null, guests: new Map() }; rooms.set(roomName, room);
  const id = nextId++; let role = null, wp = null;
  const c = wsAccept(req, sock, text => {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (wp) { worldMessage(wp, m); return; }
    if (!role) { // the first message says who this is
      if (m.t !== 'hello') return;
      // "join": a player's open world if someone hosts one here, otherwise the saved server world
      if (m.role === 'join') m.role = room.host ? 'guest' : 'world';
      if (m.role === 'world') { role = 'world'; wp = { c, id, name: null, dim: null, joined: false }; players.set(id, wp); c.send(JSON.stringify({ t: 'hello', id, world: W.meta ? { name: W.meta.name, seed: W.meta.seed } : null, kind: 'world' })); return; }
      if (m.role === 'host') { if (room.host) { c.send(JSON.stringify({ t: 'error', msg: '이 서버에는 이미 호스트가 있습니다' })); c.close(); return; } room.host = c; role = 'host'; }
      else { if (!room.host) { c.send(JSON.stringify({ t: 'error', msg: '아직 세계를 연 호스트가 없습니다' })); c.close(); return; } room.guests.set(id, c); role = 'guest'; }
      c.send(JSON.stringify({ t: 'hello', id: role === 'host' ? 0 : id, kind: role })); console.log(`[${roomName}] ${role} ${id} 접속`); return;
    }
    if (role === 'guest') { if (room.host) room.host.send(JSON.stringify({ ...m, from: id })); return; }
    const to = m.to; delete m.to; const s = JSON.stringify(m);
    if (to != null) { const g = room.guests.get(to); if (g) g.send(s); } else for (const g of room.guests.values()) g.send(s);
  }, () => {
    if (wp) { worldLeave(wp); return; }
    if (role === 'guest') { room.guests.delete(id); if (room.host) room.host.send(JSON.stringify({ t: 'leave', from: id })); }
    else if (role === 'host') { room.host = null; for (const g of room.guests.values()) { g.send(JSON.stringify({ t: 'hostgone' })); g.close(); } room.guests.clear(); }
    if (role) console.log(`[${roomName}] ${role} ${id} 나감`);
  });
});
server.listen(port, () => {
  const addrs = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log(`네모 대륙 서버: http://localhost:${port}` + addrs.map(a => `  ·  http://${a}:${port}`).join(''));
  console.log(`멀티플레이 주소: ws://${addrs[0] || 'localhost'}:${port}/mp`);
  console.log(W.meta ? `서버 세계: ${W.meta.name} — 아무 때나 접속해 플레이할 수 있습니다` : `서버 세계 "${worldName}" 없음 — 처음 접속한 플레이어가 새로 만들거나 자기 세계를 올릴 수 있습니다`);
});
