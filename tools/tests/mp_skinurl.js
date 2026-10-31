// skins from elsewhere: a PNG address whose site allows other pages (fetched directly), one that doesn't (fetched
// through the game server's /skin), a page address turned into its picture, and a pasted picture
const http = require('http'), zlib = require('zlib'), { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path'), net = require('net');
const crc32 = b => { let c, crc = 0xffffffff; for (let n = 0; n < b.length; n++) { c = (crc ^ b[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; };
function png(r, g, bl) { // a 64x64 RGBA picture of one colour
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(64, 0); ih.writeUInt32BE(64, 4); ih[8] = 8; ih[9] = 6;
  const raw = Buffer.alloc(64 * (1 + 64 * 4)); for (let y = 0; y < 64; y++) { raw[y * 257] = 0; for (let x = 0; x < 64; x++) raw.set([r, g, bl, 255], y * 257 + 1 + x * 4); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const free = () => new Promise(r => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });
module.exports = async ({ ok, b, lib }) => {
  const site = http.createServer((req, res) => { const open = req.url.startsWith('/open'); res.writeHead(200, { 'content-type': 'image/png', ...(open ? { 'access-control-allow-origin': '*' } : {}) }); res.end(req.url.includes('red') ? png(220, 30, 30) : png(30, 200, 60)); });
  const sp = await free(); await new Promise(r => site.listen(sp, r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nemo-sk-')), port = await free();
  const game = await new Promise(res => { const p = spawn(process.execPath, [path.join(lib.root, 'tools', 'server.js')], { env: { ...process.env, PORT: String(port), WORLDS_DIR: dir, SKIN_PROXY_LOCAL: '1' } }); let log = ''; p.stdout.on('data', d => { log += d; if (/멀티플레이 주소/.test(log)) res(p); }); });
  try {
    const srv = { url: `http://localhost:${port}/`, ws: `ws://localhost:${port}/mp` }, P = await lib.page(b, srv);
    const col = () => P.evaluate(() => { const e = PACKPX.ent.custom_skin; return e ? [e.px[(20 * 64 + 20) * 4], e.px[(20 * 64 + 20) * 4 + 1]] : null; });
    await P.evaluate(u => skinFromAny(u + 'open/red.png'), `http://127.0.0.1:${sp}/`); await P.waitForTimeout(2500);
    const direct = await col(); ok(direct && direct[0] > 200 && direct[1] < 60, 'a PNG address that allows other pages is fetched directly', direct);
    await P.evaluate(u => skinFromAny(u + 'closed/green.png'), `http://127.0.0.1:${sp}/`); await P.waitForTimeout(3000);
    const proxied = await col(); ok(proxied && proxied[1] > 150 && proxied[0] < 60, 'one that doesn\'t is fetched through the game server', proxied);
    const names = await P.evaluate(() => skinLib().map(e => e.name)); ok(names[0] === 'green' && names[1] === 'red', 'they are kept under their file names', names);
    const pages = await P.evaluate(() => { const r = []; for (const [re, to] of SKIN_PAGES) for (const t of ['https://namemc.com/skin/0123456789abcdef', 'https://ko.namemc.com/profile/Notch.1', 'https://www.minecraftskins.com/skin/12345/cool-skin/']) { const m = t.match(re); if (m) r.push(to(m)); } return r; });
    ok(pages.includes('https://s.namemc.com/i/0123456789abcdef.png') && pages.includes('https://mc-heads.net/skin/Notch') && pages.includes('https://www.minecraftskins.com/skin/download/12345'), 'skin pages become their picture addresses', pages);
    const bad = await P.evaluate(async () => { const r = await fetch('/skin?u=' + encodeURIComponent('http://example.invalid/x.png')); return r.status; });
    ok(bad >= 400, 'the server answers an address it cannot fetch with an error', bad);
    ok(!P.errs.length, 'no page errors', P.errs);
  } finally { game.kill(); site.close(); try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {} }
};
