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
// on a hosting service (Render and the like) the port comes from PORT; WORLD names the world and WORLDS_DIR is where worlds are
// kept (point it at a persistent disk there, or the world is lost whenever the service restarts)
const wi = args.indexOf('--world'), port = +(args.find((a, i) => /^\d+$/.test(a) && i !== wi + 1) || process.env.PORT || 8080), worldName = (wi >= 0 && args[wi + 1] ? args[wi + 1] : process.env.WORLD || 'world').replace(/[^\w\-가-힣]/g, '_');
const WORLDS = path.resolve(process.env.WORLDS_DIR || path.join(root, 'worlds'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.md': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

// SERVER_URL and GOOGLE_CLIENT_ID (environment) reach the game as js/config.js; REQUIRE_LOGIN=1 lets only players
// signed in with Google into the server world
const CFG = { server: process.env.SERVER_URL || '', googleClientId: process.env.GOOGLE_CLIENT_ID || '' }, REQUIRE_LOGIN = /^(1|true|yes)$/i.test(process.env.REQUIRE_LOGIN || '');
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  // what can be joined here: the saved server world and the players' own worlds that are open (the join screen lists them)
  if (u === '/rooms') { res.writeHead(200, { 'content-type': TYPES['.json'], 'cache-control': 'no-store', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(roomList())); return; }
  if (u === '/js/config.js' && (CFG.server || CFG.googleClientId)) { res.writeHead(200, { 'content-type': TYPES['.js'], 'cache-control': 'no-cache' }); res.end('var NEMO_CONFIG = ' + JSON.stringify(CFG) + ';\n'); return; }
  const f = path.join(root, path.normalize(u));
  if (!f.startsWith(root + path.sep) || f.startsWith(WORLDS + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end('not found'); return; } res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache' }); res.end(d); /* no-cache: a new version shows on the next visit */ });
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
  // a ping now and then: hosting proxies close connections that stay quiet (the browser answers by itself)
  const ping = setInterval(() => { if (!closed) try { sock.write(frame(9, Buffer.alloc(0))); } catch (e) {} }, 25000);
  sock.on('close', () => { clearInterval(ping); if (!closed) { closed = true; onClose(); } }); sock.on('error', () => {});
  return c;
}

// ---------- the saved server world (js/mpcore.js does the work; the files are here) ----------
const { mpWorldCore } = require(path.join(root, 'js', 'mpcore.js'));
const WDIR = path.join(WORLDS, worldName), CDIR = path.join(WDIR, 'chunks');
const state = { meta: null, time: 1000, rain: 0, thunder: false, players: {}, weatherT: 12000 + Math.random() * 168000 };
const keys = new Set(), dirty = new Map(); let stateDirty = false;
const fileOf = dk => path.join(CDIR, encodeURIComponent(dk) + '.json');
try { Object.assign(state, JSON.parse(fs.readFileSync(path.join(WDIR, 'world.json'), 'utf8'))); for (const f of fs.readdirSync(CDIR)) if (f.endsWith('.json')) keys.add(decodeURIComponent(f.slice(0, -5))); console.log(`세계 "${worldName}" 불러옴 (시드 ${state.meta.seed}, 청크 ${keys.size}개)`); } catch (e) { state.meta = null; }
function saveWorld() {
  if (!state.meta) return; fs.mkdirSync(CDIR, { recursive: true });
  if (stateDirty) { fs.writeFileSync(path.join(WDIR, 'world.json'), JSON.stringify(state)); stateDirty = false; }
  for (const [dk, c] of dirty) fs.writeFileSync(fileOf(dk), JSON.stringify({ rec: c.rec, edits: c.edits, tiles: c.tiles }));
  dirty.clear();
}
const store = { state, keys, load: dk => { try { return JSON.parse(fs.readFileSync(fileOf(dk), 'utf8')); } catch (e) { return null; } }, save: (dk, c) => dirty.set(dk, c), saveState: () => { stateDirty = true; }, log: t => console.log(t) };
const conns = new Map(); // id -> socket of a player in the server world
const core = mpWorldCore(store, (id, o) => { const c = conns.get(id); if (c) c.send(JSON.stringify(o)); });
setInterval(() => { core.tick(); }, 1000);
setInterval(() => { stateDirty = true; saveWorld(); }, 5000);
for (const sg of ['SIGINT', 'SIGTERM']) process.on(sg, () => { stateDirty = true; saveWorld(); process.exit(0); });

// a Google sign-in sent with "join": checked with Google, so the player's things are kept by account
async function verifyGoogle(tok) {
  if (!tok || !CFG.googleClientId || typeof fetch !== 'function') return null;
  try { const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(tok)); if (!r.ok) return null; const c = await r.json();
    if (c.aud !== CFG.googleClientId || +c.exp * 1000 < Date.now() || !c.sub) return null; return { sub: c.sub, name: c.name || c.given_name || String(c.email || '').split('@')[0], email: c.email || '' }; }
  catch (e) { return null; }
}
// ---------- rooms of a player's own world: one host, any number of guests, found by a short code ----------
const rooms = new Map(); let nextId = 1;
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I
function newCode() { for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; if (!rooms.has(c)) return c; } }
function roomList() {
  const n = [...core.players.values()].filter(q => q.joined).length;
  return { world: state.meta ? { name: state.meta.name, mode: state.meta.mode, players: n } : null,
    rooms: [...rooms].filter(([, r]) => r.host).map(([code, r]) => ({ code, host: r.hostName, world: r.worldName, mode: r.mode, players: r.guests.size + 1 })) };
}
server.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://x'); if (!url.pathname.startsWith('/mp')) { sock.destroy(); return; }
  let roomName = null, room = null;
  const id = nextId++; let role = null, wp = false;
  const c = wsAccept(req, sock, text => {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (wp) {
      if (c.waiting) { c.waiting.push(m); return; }
      if (m.t !== 'join') { core.message(id, m); return; }
      // the sign-in is checked before anything else from this player is taken
      c.waiting = []; const tok = m.google; delete m.google;
      verifyGoogle(tok).then(acc => {
        if (acc) { m.account = acc.sub; m.name = acc.name.replace(/\s+/g, '').slice(0, 16) || m.name; }
        const q = c.waiting; c.waiting = null;
        if (REQUIRE_LOGIN && !acc) { c.send(JSON.stringify({ t: 'error', msg: '이 서버는 Google 로그인이 필요합니다 (타이틀 → Google 로그인)' })); return; }
        core.message(id, m); for (const x of q) core.message(id, x);
      });
      return;
    }
    if (!role) { // the first message says who this is
      if (m.t !== 'hello') return;
      // "join" with a room code: that player's open world; without one, the saved server world (or the one open world
      // of an older game that hosted without a code)
      let code = String(m.room || url.searchParams.get('room') || '').trim().toUpperCase().slice(0, 12);
      if (m.role === 'join' && !code && !state.meta) { const open = [...rooms].filter(([, r]) => r.host); if (open.length === 1) code = open[0][0]; } // no server world and one open world: that one
      if (m.role === 'join') { const r = rooms.get(code || 'main'); m.role = r && r.host ? 'guest' : code ? 'none' : 'world'; }
      if (m.role === 'none') { c.send(JSON.stringify({ t: 'error', msg: `방 코드 ${code}로 열린 세계가 없습니다 (닫혔거나 코드가 틀렸어요)` })); c.close(); return; }
      if (m.role === 'world') { role = 'world'; wp = true; conns.set(id, c); c.send(JSON.stringify({ t: 'hello', id, world: state.meta ? { name: state.meta.name, seed: state.meta.seed } : null, kind: 'world' })); return; }
      if (m.role === 'host') { roomName = code && !(rooms.get(code) || {}).host ? code : newCode();
        room = { host: c, guests: new Map(), hostName: String(m.name || '플레이어').slice(0, 16), worldName: String(m.world || '').slice(0, 40), mode: m.mode === 'creative' ? 'creative' : 'survival' }; rooms.set(roomName, room); role = 'host'; }
      else { roomName = code || 'main'; room = rooms.get(roomName); if (!room || !room.host) { c.send(JSON.stringify({ t: 'error', msg: '아직 세계를 연 호스트가 없습니다' })); c.close(); return; } room.guests.set(id, c); role = 'guest'; }
      c.send(JSON.stringify({ t: 'hello', id: role === 'host' ? 0 : id, kind: role, room: roomName })); console.log(`[${roomName}] ${role} ${id} 접속`); return;
    }
    if (role === 'guest') { if (room.host) room.host.send(JSON.stringify({ ...m, from: id })); return; }
    const to = m.to; delete m.to; const s = JSON.stringify(m);
    if (to != null) { const g = room.guests.get(to); if (g) g.send(s); } else for (const g of room.guests.values()) g.send(s);
  }, () => {
    if (wp) { conns.delete(id); core.leave(id); if (!conns.size) { stateDirty = true; saveWorld(); } return; }
    if (role === 'guest') { room.guests.delete(id); if (room.host) room.host.send(JSON.stringify({ t: 'leave', from: id })); }
    else if (role === 'host') { room.host = null; for (const g of room.guests.values()) { g.send(JSON.stringify({ t: 'hostgone' })); g.close(); } room.guests.clear(); rooms.delete(roomName); }
    if (role) console.log(`[${roomName}] ${role} ${id} 나감`);
  });
});
server.listen(port, () => {
  const addrs = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log(`네모 대륙 서버: http://localhost:${port}` + addrs.map(a => `  ·  http://${a}:${port}`).join(''));
  console.log(`멀티플레이 주소: ws://${addrs[0] || 'localhost'}:${port}/mp`);
  console.log(state.meta ? `서버 세계: ${state.meta.name} — 아무 때나 접속해 플레이할 수 있습니다` : `서버 세계 "${worldName}" 없음 — 처음 접속한 플레이어가 새로 만들거나 자기 세계를 올릴 수 있습니다`);
});
