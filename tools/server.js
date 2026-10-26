// Serves the game and relays multiplayer messages on your network, with no dependencies:
//   node tools/server.js [port]        then open http://<this computer's address>:<port> on every device
// One player opens their world to multiplayer ("서버로 열기", address ws://<address>:<port>/mp), the others
// join with the same address. Guests' messages go to the host; the host's go to one guest or all of them.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const root = path.join(__dirname, '..'), port = +process.argv[2] || 8080;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.md': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]); if (u === '/') u = '/index.html';
  const f = path.join(root, path.normalize(u));
  if (!f.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
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

// ---------- rooms: one host, any number of guests ----------
const rooms = new Map(); let nextId = 1;
server.on('upgrade', (req, sock) => {
  const url = new URL(req.url, 'http://x'); if (!url.pathname.startsWith('/mp')) { sock.destroy(); return; }
  const roomName = url.searchParams.get('room') || 'main', room = rooms.get(roomName) || { host: null, guests: new Map() }; rooms.set(roomName, room);
  const id = nextId++; let role = null;
  const c = wsAccept(req, sock, text => {
    let m; try { m = JSON.parse(text); } catch (e) { return; }
    if (!role) { // the first message says who this is
      if (m.t !== 'hello') return;
      if (m.role === 'host') { if (room.host) { c.send(JSON.stringify({ t: 'error', msg: '이 서버에는 이미 호스트가 있습니다' })); c.close(); return; } room.host = c; role = 'host'; }
      else { if (!room.host) { c.send(JSON.stringify({ t: 'error', msg: '아직 세계를 연 호스트가 없습니다' })); c.close(); return; } room.guests.set(id, c); role = 'guest'; }
      c.send(JSON.stringify({ t: 'hello', id: role === 'host' ? 0 : id })); console.log(`[${roomName}] ${role} ${id} 접속`); return;
    }
    if (role === 'guest') { if (room.host) room.host.send(JSON.stringify({ ...m, from: id })); return; }
    const to = m.to; delete m.to; const s = JSON.stringify(m);
    if (to != null) { const g = room.guests.get(to); if (g) g.send(s); } else for (const g of room.guests.values()) g.send(s);
  }, () => {
    if (role === 'guest') { room.guests.delete(id); if (room.host) room.host.send(JSON.stringify({ t: 'leave', from: id })); }
    else if (role === 'host') { room.host = null; for (const g of room.guests.values()) { g.send(JSON.stringify({ t: 'hostgone' })); g.close(); } room.guests.clear(); }
    if (role) console.log(`[${roomName}] ${role} ${id} 나감`);
  });
});
server.listen(port, () => {
  const addrs = Object.values(os.networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  console.log(`네모 대륙 서버: http://localhost:${port}` + addrs.map(a => `  ·  http://${a}:${port}`).join(''));
  console.log(`멀티플레이 주소: ws://${addrs[0] || 'localhost'}:${port}/mp`);
});
