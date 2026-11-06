// The multiplayer server on Cloudflare (Workers + a Durable Object), the same as tools/server.js does on Node:
//  - the Worker answers /skin and /profile itself, serves the game (dist/) and hands /mp (the WebSocket), /rooms,
//    /stats and /report to the one Durable Object, NemoServer, which keeps every server world and every open room
//  - the worlds are kept in the object's own SQLite storage (worlds, chunks), so nothing is lost on a restart;
//    the GitHub backup (GITHUB_TOKEN secret, GITHUB_BACKUP_REPO) still runs, and an empty object brings the worlds back from it
//  - a player's game sends its messages a tenth of a second at a time in one frame ({"t":"multi"}): the free plan
//    counts incoming WebSocket messages, not bytes
import mpc from '../js/mpcore.js';
const { mpWorldCore } = mpc;

// ---------------- the Worker ----------------
export default {
  async fetch(req, env) {
    const url = new URL(req.url), u = url.pathname;
    if (u === '/skin') return skinProxy(url);
    if (u === '/profile') return profileLookup(url);
    if (u === '/ping') return new Response('ok', { headers: { 'cache-control': 'no-store' } });
    if (u.startsWith('/mp') || u === '/rooms' || u === '/stats' || u === '/report') return env.NEMO.get(env.NEMO.idFromName('main')).fetch(req);
    if (u === '/js/config.js') return new Response('var NEMO_CONFIG = ' + JSON.stringify({ server: url.host }) + ';\n', { headers: { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache' } });
    if (env.ASSETS && (u === '/' || u === '/index.html')) { const r = await env.ASSETS.fetch(new Request(new URL('/nemo-1.18.html', url))); return new Response(r.body, { status: r.status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } }); }
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('not found', { status: 404 });
  },
};

// ---------------- skins (as tools/server.js) ----------------
const cors = { 'access-control-allow-origin': '*' };
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[|::|fc|fd)/i;
const IMG_SIG = [[[0x89, 0x50, 0x4e, 0x47], 'image/png'], [[0xff, 0xd8, 0xff], 'image/jpeg'], [[0x47, 0x49, 0x46], 'image/gif'], [[0x42, 0x4d], 'image/bmp']];
const latin = (b, a, z) => String.fromCharCode(...b.subarray(a, z));
const imgType = b => { for (const [sig, t] of IMG_SIG) if (sig.every((x, i) => b[i] === x)) return t; if (b.length > 12 && latin(b, 0, 4) === 'RIFF' && latin(b, 8, 12) === 'WEBP') return 'image/webp'; return null; };
const pngSize = b => { if (!(b.length > 24 && imgType(b) === 'image/png')) return null; const v = new DataView(b.buffer, b.byteOffset, b.byteLength); return [v.getUint32(16), v.getUint32(20)]; };
const okHost = u => /^https?:$/.test(u.protocol) && !(PRIVATE_HOST.test(u.hostname) || /\.(local|internal)$/i.test(u.hostname));
async function getLimited(url, max, accept) {
  const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (nemo skin import)', accept }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return { status: r.status }; if (+(r.headers.get('content-length') || 0) > max) return { status: 413 };
  const buf = new Uint8Array(await r.arrayBuffer()); return buf.length > max ? { status: 413 } : { buf, type: r.headers.get('content-type') || '', url: r.url || String(url) };
}
async function skinProxy(url) {
  const end = (code, msg) => new Response(msg, { status: code, headers: { 'content-type': 'text/plain; charset=utf-8', ...cors } });
  let target; try { target = new URL(url.searchParams.get('u') || ''); } catch (e) { return end(400, 'bad url'); }
  if (!okHost(target)) return end(400, 'not allowed');
  try {
    const r = await getLimited(target, 2000000, 'image/*,text/html;q=0.8,*/*;q=0.5'); if (!r.buf) return end(502, 'status ' + r.status);
    let found = imgType(r.buf) ? r : null;
    if (!found && /html/i.test(r.type)) {
      const html = new TextDecoder().decode(r.buf), seen = new Set(), cands = [];
      for (const m of html.matchAll(/(?:src|href|content|data-src|data-skin|data-url)\s*=\s*["']([^"'<>]+)["']/gi)) { let x; try { x = new URL(m[1].replace(/&amp;/g, '&'), r.url); } catch (e) { continue; } if (!okHost(x) || seen.has(x.href)) continue; seen.add(x.href);
        const k = x.href.toLowerCase(), score = (/\.png(\?|$)/.test(k) ? 2 : 0) + (/skin/.test(k) ? 2 : 0) + (/download/.test(k) ? 3 : 0) + (/texture/.test(k) ? 2 : 0) - (/(logo|icon|avatar|head|render|preview|banner|favicon|sprite)/.test(k) ? 3 : 0);
        if (score > 0 || /\.(png|jpe?g|webp|gif)(\?|$)/.test(k)) cands.push([score, x]); }
      cands.sort((a, b) => b[0] - a[0]);
      for (const [, x] of cands.slice(0, 10)) { const c = await getLimited(x, 500000, 'image/*').catch(() => ({})); if (!c.buf || !imgType(c.buf)) continue; const sz = pngSize(c.buf); if (!sz || (sz[0] === 64 && (sz[1] === 64 || sz[1] === 32))) { found = c; if (sz) break; } }
    }
    if (!found || found.buf.length > 500000) return end(415, 'no skin picture there');
    return new Response(found.buf, { headers: { 'content-type': imgType(found.buf), ...cors, 'cache-control': 'public, max-age=3600' } });
  } catch (e) { return end(502, 'fetch failed'); }
}
async function profileLookup(url) {
  const send = (code, o) => new Response(JSON.stringify(o), { status: code, headers: { 'content-type': 'application/json; charset=utf-8', ...cors, 'cache-control': code === 200 ? 'public, max-age=300' : 'no-store' } });
  const name = (url.searchParams.get('name') || '').trim(); if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) return send(400, { error: 'bad name' });
  const text = b => new TextDecoder().decode(b);
  try {
    let id = null;
    for (const x of ['https://api.mojang.com/users/profiles/minecraft/' + name, 'https://api.minecraftservices.com/minecraft/profile/lookup/name/' + name]) {
      const r = await getLimited(x, 100000, 'application/json').catch(() => ({})); if (r.buf && r.buf.length) { try { const j = JSON.parse(text(r.buf)); if (j.id) { id = j.id; break; } } catch (e) {} } }
    if (!id) return send(404, { error: 'no such player' });
    const r = await getLimited('https://sessionserver.mojang.com/session/minecraft/profile/' + id, 100000, 'application/json'); if (!r.buf) return send(502, { error: 'profile' });
    const prof = JSON.parse(text(r.buf)), tp = (prof.properties || []).find(p => p.name === 'textures');
    const tex = tp ? JSON.parse(text(b64dec(tp.value))).textures || {} : {}, fix = x => x ? String(x).replace(/^http:/, 'https:') : null;
    return send(200, { name: prof.name || name, id, skin: fix(tex.SKIN && tex.SKIN.url), slim: !!(tex.SKIN && tex.SKIN.metadata && tex.SKIN.metadata.model === 'slim'), cape: fix(tex.CAPE && tex.CAPE.url) });
  } catch (e) { return send(502, { error: 'lookup failed' }); }
}

// ---------------- bytes ----------------
function b64dec(s) { const bin = atob(String(s).replace(/\s+/g, '')), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function b64enc(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
const hex = buf => [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, '0')).join('');
const randHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
// the lines of a gzipped text, one at a time
async function* gzLines(gz) {
  const rd = new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip')).pipeThrough(new TextDecoderStream()).getReader(); let rest = '';
  for (;;) { const { value, done } = await rd.read(); if (done) break; rest += value; let i; while ((i = rest.indexOf('\n')) >= 0) { yield rest.slice(0, i); rest = rest.slice(i + 1); } }
  if (rest) yield rest;
}

// ---------------- the GitHub backup (as tools/backup.js, with fetch and web streams) ----------------
function githubBackup({ repo, token, branch = 'world-backup', api = 'https://api.github.com', file = 'world.json.gz' }) {
  const H = { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'user-agent': 'nemo-server', 'content-type': 'application/json' };
  const call = async (method, p, body, missing = [404]) => {
    const r = await fetch(api + '/repos/' + repo + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
    if (missing.includes(r.status) || (method === 'GET' && r.status === 409)) return null;
    if (!r.ok) { const e = new Error(`GitHub ${method} ${p}: ${r.status} ${(await r.text()).slice(0, 200)}`); e.status = r.status; throw e; }
    return r.json();
  };
  const setRef = async (name, sha) => { if (!await call('PATCH', '/git/refs/heads/' + name, { sha, force: true }, [404, 422])) await call('POST', '/git/refs', { ref: 'refs/heads/' + name, sha }); };
  const dayOf = t => Math.floor(t / 86400000), stamp = c => Date.parse(((c && c.message || '').match(/\d{4}-\d\d-\d\dT[\d:.]+Z/) || [])[0]);
  return {
    branch,
    async days() { // the daily restore points, newest first
      const days = [];
      for (let d = 0; d < 7; d++) { const ref = await call('GET', '/git/ref/heads/' + branch + '-day' + d).catch(() => null); if (!ref) continue; const c = await call('GET', '/git/commits/' + ref.object.sha).catch(() => null), t = stamp(c); days.push([branch + '-day' + d, isFinite(t) ? t : 0]); }
      return days.sort((a, b) => b[1] - a[1]).map(d => d[0]);
    },
    async loadGz(name) {
      const ref = await call('GET', '/git/ref/heads/' + name); if (!ref) return null;
      const c = await call('GET', '/git/commits/' + ref.object.sha), t = await call('GET', '/git/trees/' + c.tree.sha), f = t && t.tree.find(x => x.path === file);
      if (!f) return null;
      const r = await fetch(api + '/repos/' + repo + '/git/blobs/' + f.sha, { headers: { ...H, accept: 'application/vnd.github.raw' }, signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error('GitHub blob ' + r.status);
      return new Uint8Array(await r.arrayBuffer());
    },
    async save(gz, { suspect = false } = {}) {
      const content = b64enc(gz);
      const blob = await call('POST', '/git/blobs', { content, encoding: 'base64' });
      const tree = await call('POST', '/git/trees', { tree: [{ path: file, mode: '100644', type: 'blob', sha: blob.sha }] });
      const now = new Date(), commit = await call('POST', '/git/commits', { message: (suspect ? 'suspect world backup ' : 'world backup ') + now.toISOString(), tree: tree.sha, parents: [] });
      if (suspect) { await setRef(branch + '-suspect', commit.sha); return gz.length; }
      const head = await call('GET', '/git/ref/heads/' + branch); if (head && head.object.sha !== commit.sha) await setRef(branch + '-prev', head.object.sha);
      await setRef(branch, commit.sha);
      const day = dayOf(now.getTime()), name = branch + '-day' + (day % 7), ref = await call('GET', '/git/ref/heads/' + name), c = ref && await call('GET', '/git/commits/' + ref.object.sha), t = stamp(c);
      if (!(isFinite(t) && dayOf(t) === day)) await setRef(name, commit.sha);
      return gz.length;
    },
  };
}

// ---------------- the Durable Object: every server world and every room ----------------
const DROPPABLE = new Set(['pl', 'mobs', 'vehs', 'items', 'xps', 'time']);
const WORLD_ID = /^[\w\-가-힣]{1,40}$/, CHUNK_KEY = /^[ne]?-?\d+,-?\d+$|^o:/;
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SAVE_EVERY = 15000, MIRROR_EVERY = 300000, BACKUP_EVERY = 30 * 60000;
const J = o => JSON.stringify(o);

export class NemoServer {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql;
    this.worlds = new Map(); this.rooms = new Map(); this.nextId = 1;
    this.TRAFFIC = { since: Date.now(), total: 0, kinds: {} }; this.DROPS = []; this.STARTED = Date.now();
    this.BK = { blocked: false, lastError: null, restoredFrom: null, lastBackup: null };
    this.worldName = (env.WORLD || 'world').replace(/[^\w\-가-힣]/g, '_');
    this.requireLogin = /^(1|true|yes)$/i.test(env.REQUIRE_LOGIN || '');
    this.backup = env.GITHUB_TOKEN && env.GITHUB_BACKUP_REPO ? githubBackup({ repo: env.GITHUB_BACKUP_REPO, token: env.GITHUB_TOKEN, branch: env.GITHUB_BACKUP_BRANCH || 'world-backup', api: env.GITHUB_API_URL || undefined }) : null;
    this.sql.exec('CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY, state TEXT)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS chunks (wid TEXT, dk TEXT, data TEXT, PRIMARY KEY (wid, dk))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
    this.timers = false; this.isChanged = !!this.kv('changed');
    ctx.blockConcurrencyWhile(async () => {
      if (this.kv('restoring')) this.wipe(); // a restore cut short: done again from the start
      for (const r of this.sql.exec('SELECT id FROM worlds').toArray()) this.openWorld(r.id);
      if (![...this.worlds.values()].some(w => w.state.meta)) await this.restoreIfEmpty();
    });
  }
  kv(k, v) { if (v === undefined) { const r = this.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0]; return r ? JSON.parse(r.v) : null; } if (v === null) this.sql.exec('DELETE FROM kv WHERE k = ?', k); else this.sql.exec('INSERT OR REPLACE INTO kv VALUES (?, ?)', k, J(v)); }
  wipe() { this.sql.exec('DELETE FROM worlds'); this.sql.exec('DELETE FROM chunks'); this.kv('restoring', null); this.worlds.clear(); }
  log(t) { console.log(t); }
  // the clock of the worlds, and their saving, run while anyone is connected (the object sleeps when no one is)
  startTimers() {
    if (this.timers) return; this.timers = true;
    this.tickT = setInterval(() => { for (const w of this.worlds.values()) if (w.conns.size) w.core.tick(); }, 1000);
    this.saveT = setInterval(() => { this.saveAll(); this.deadCheck(); }, SAVE_EVERY);
  }
  stopTimersIfIdle() { if ([...this.worlds.values()].some(w => w.conns.size) || [...this.rooms.values()].some(r => r.host)) return; clearInterval(this.tickT); clearInterval(this.saveT); this.timers = false; }

  // ---------- worlds ----------
  openWorld(id) {
    let w = this.worlds.get(id); if (w) return w;
    const state = { meta: null, time: 1000, rain: 0, thunder: false, players: {}, weatherT: 12000 + Math.random() * 168000 };
    w = { id, state, keys: new Set(), keysLoaded: false, dirty: new Map(), stateDirty: false, conns: new Map(), mirrorStateAt: 0, restorer: null, mirPend: new Map() };
    const row = this.sql.exec('SELECT state FROM worlds WHERE id = ?', id).toArray()[0];
    if (row) { try { Object.assign(state, JSON.parse(row.state)); } catch (e) { state.meta = null; } }
    const store = { state, keys: w.keys,
      load: dk => { if (w.dirty.has(dk)) return w.dirty.get(dk); const r = this.sql.exec('SELECT data FROM chunks WHERE wid = ? AND dk = ?', id, dk).toArray()[0]; try { return r ? JSON.parse(r.data) : null; } catch (e) { return null; } },
      save: (dk, c) => w.dirty.set(dk, c), pending: dk => w.dirty.has(dk),
      drop: cid => { const c = w.conns.get(cid); if (c) setTimeout(() => c.close(), 200); },
      saveState: () => { w.stateDirty = true; this.changed(); }, log: t => this.log(`[${id}] ${t}`) };
    let lastO = null, lastS = '';
    w.core = mpWorldCore(store, (cid, o) => { const c = w.conns.get(cid); if (!c) return; if (o !== lastO) { if (lastO === null) queueMicrotask(() => { lastO = null; }); lastO = o; lastS = J(o); } c.send(lastS, DROPPABLE.has(o.t) && o.t + ':' + (o.id != null ? o.id : o.from != null ? o.from : '')); });
    this.worlds.set(id, w); return w;
  }
  ensureKeys(w) { if (w.keysLoaded) return; w.keysLoaded = true; for (const r of this.sql.exec('SELECT dk FROM chunks WHERE wid = ?', w.id).toArray()) w.keys.add(r.dk); }
  changed() { if (!this.isChanged) { this.isChanged = true; this.kv('changed', true); } }
  saveWorld(w, force) {
    const st = w.state; if (!st.meta) return;
    if (!st.wid) { st.wid = randHex(8); w.stateDirty = true; }
    const ver = st.cver || (st.cver = {}), out = [];
    if (w.dirty.size) this.changed();
    for (const [dk, c] of w.dirty) { const e = { rec: c.rec, edits: c.edits, tiles: c.tiles }; ver[dk] = (ver[dk] || 0) + 1; w.stateDirty = true; this.sql.exec('INSERT OR REPLACE INTO chunks VALUES (?, ?, ?)', w.id, dk, J(e)); w.keys.add(dk); out.push([dk, ver[dk], e]); }
    if (w.stateDirty) { this.sql.exec('INSERT OR REPLACE INTO worlds VALUES (?, ?)', w.id, J(st)); w.stateDirty = false; }
    w.dirty.clear();
    for (const o of out) w.mirPend.set(o[0], o);
    const since = Date.now() - (w.mirrorStateAt || 0);
    if (force || (w.mirPend.size && since > MIRROR_EVERY) || since > MIRROR_EVERY * 2) { this.mirrorOut(w, [...w.mirPend.values()]); w.mirPend.clear(); }
  }
  saveAll() {
    for (const w of this.worlds.values()) { if (w.conns.size) w.stateDirty = true; this.saveWorld(w); if (!w.conns.size) w.core.trim(0); }
    if (this.isChanged && this.backup && Date.now() - (this.kv('backupAt') || 0) > BACKUP_EVERY) this.ctx.storage.setAlarm(Date.now() + 1000);
  }
  dropIfEmpty(w) { if (w.state.meta || w.conns.size) return; this.worlds.delete(w.id); }
  newWorldId() { for (;;) { const id = 'w' + Date.now().toString(36) + randHex(2); if (!this.worlds.has(id) && !this.sql.exec('SELECT id FROM worlds WHERE id = ?', id).toArray().length) return id; } }
  // ---------- the players' copies ----------
  mirrorState(w) { const o = { ...w.state }; delete o.logins; return o; }
  joinedConns(w) { return [...w.conns].filter(([id]) => { const p = w.core.players.get(id); return p && p.joined; }).map(([, c]) => c); }
  mirrorOut(w, l) { const to = this.joinedConns(w); w.mirrorStateAt = Date.now(); if (!to.length || !w.state.meta) return; const s = J({ t: 'mirror', wid: w.state.wid, state: this.mirrorState(w), l }); for (const c of to) c.send(s); }
  mirrorFill(w, id, m) {
    const c = w.conns.get(id), st = w.state; if (!c || !st.meta) return; this.ensureKeys(w);
    const have = m.wid === st.wid && m.vers && typeof m.vers === 'object' ? m.vers : {}, ver = st.cver || {};
    const need = [...w.keys].filter(dk => !(dk in have) || have[dk] < (ver[dk] || 0));
    c.send(J({ t: 'mirror', wid: st.wid, state: this.mirrorState(w), reset: m.wid !== st.wid, l: [] }));
    const next = () => { if (!w.conns.has(id) || !need.length) return;
      const l = need.splice(0, 6).map(dk => { const e = w.core && w.dirty.get(dk); if (e) return [dk, ver[dk] || 0, e]; const r = this.sql.exec('SELECT data FROM chunks WHERE wid = ? AND dk = ?', w.id, dk).toArray()[0]; try { return r ? [dk, ver[dk] || 0, JSON.parse(r.data)] : null; } catch (er) { return null; } }).filter(Boolean);
      if (l.length) c.send(J({ t: 'mirror', wid: st.wid, l })); setTimeout(next, 250); };
    setTimeout(next, 3000);
  }
  restorePart(w, id, m) {
    const c = w.conns.get(id), st = w.state; if (!c) return;
    if (m.part === 'begin') {
      if (st.meta || w.restorer != null || !m.state || !m.state.meta || !m.state.meta.seed) { c.send(J({ t: 'error', msg: '이 세계는 서버에 이미 있습니다' })); return; }
      w.restorer = id; const s2 = { ...m.state }; delete s2.logins; Object.assign(st, s2, { logins: {} }); st.players = st.players || {}; st.cver = {}; w.keysLoaded = true;
      w.stateDirty = true; this.log(`[${w.id}] 플레이어의 사본에서 세계 "${st.meta.name}"를 되살리는 중`); return;
    }
    if (w.restorer !== id) return;
    if (m.part === 'chunk') { for (const [dk, v, e] of m.l || []) { if (typeof dk !== 'string' || !/^[ne]?-?\d+,-?\d+$/.test(dk) || !e) continue; this.sql.exec('INSERT OR REPLACE INTO chunks VALUES (?, ?, ?)', w.id, dk, J({ rec: e.rec || null, edits: e.edits || [], tiles: e.tiles || {} })); w.keys.add(dk); st.cver[dk] = +v || 1; } w.stateDirty = true; return; }
    if (m.part === 'end') { w.restorer = null; this.saveWorld(w); this.changed(); this.log(`[${w.id}] 세계를 되살렸습니다 (청크 ${w.keys.size}개)`); c.send(J({ t: 'restored' })); this.backupSoon(); }
  }

  // ---------- backup ----------
  worldCounts() { const o = {}; for (const r of this.sql.exec('SELECT wid, COUNT(*) AS n FROM chunks GROUP BY wid').toArray()) o[r.wid] = r.n; for (const w of this.worlds.values()) if (w.state.meta && !(w.id in o)) o[w.id] = 0; return o; }
  async snapshot() {
    for (const w of this.worlds.values()) this.saveWorld(w);
    const ws = this.sql.exec('SELECT id, state FROM worlds').toArray().filter(r => { try { return JSON.parse(r.state).meta; } catch (e) { return false; } });
    if (!ws.length) return null;
    const cs = new CompressionStream('gzip'), wr = cs.writable.getWriter(), enc = new TextEncoder(), outP = new Response(cs.readable).arrayBuffer();
    const put = s => wr.write(enc.encode(s));
    await put('NEMO3\n');
    for (const r of ws) {
      await put('W\t' + r.id + '\t' + r.state.replace(/\n/g, '') + '\n');
      for (const { dk } of this.sql.exec('SELECT dk FROM chunks WHERE wid = ?', r.id).toArray()) { const c = this.sql.exec('SELECT data FROM chunks WHERE wid = ? AND dk = ?', r.id, dk).toArray()[0]; if (c) await put('C\t' + r.id + '\t' + dk + '\t' + c.data.replace(/\n/g, '') + '\n'); }
    }
    await wr.close(); return new Uint8Array(await outP);
  }
  suspect(counts) { const m = this.kv('manifest'); if (!m) return null; for (const id in m) { const n0 = m[id], n = counts[id]; if (n == null) return '세계 ' + id + '이(가) 없어짐'; if (n0 >= 10 && n < n0 * 0.7) return '세계 ' + id + '의 청크가 ' + n0 + '개에서 ' + n + '개로 줄어듦'; } return null; }
  backupSoon() { if (this.backup) this.ctx.storage.setAlarm(Date.now() + 5000); }
  async backupNow(why) {
    if (!this.backup || this.BK.blocked) return;
    try {
      const snap = await this.snapshot(); if (!snap) return;
      const counts = this.worldCounts(), bad = this.suspect(counts);
      if (bad) { this.log('⚠ 이상한 백업이라 덮어쓰지 않고 따로 둡니다 (' + bad + ')'); this.BK.lastError = '의심 백업: ' + bad; await this.backup.save(snap, { suspect: true }); this.kv('backupAt', Date.now()); return; }
      const hash = hex(await crypto.subtle.digest('SHA-1', snap));
      if (hash !== this.kv('backupHash')) { await this.backup.save(snap); this.kv('backupHash', hash); this.BK.lastBackup = { at: new Date().toISOString(), why, kb: Math.round(snap.length / 1024) }; this.log(`세계 백업 완료 (${why}, ${Math.round(snap.length / 1024)} KB)`); }
      this.kv('manifest', counts); this.kv('backupAt', Date.now()); this.kv('changed', null); this.isChanged = false;
    } catch (e) { this.BK.lastBackup = { at: new Date().toISOString(), why, error: e.message }; this.log('세계 백업 실패: ' + e.message); throw e; }
  }
  // a restore point read through once to check it is whole, then written; a broken one gives way to the one before
  async checkGz(gz) { let w = 0, c = 0, first = true; for await (const line of gzLines(gz)) { if (first) { first = false; if (line !== 'NEMO3') return null; continue; } if (line.startsWith('W\t')) { try { if (JSON.parse(line.slice(line.indexOf('\t', 2) + 1)).meta) w++; } catch (e) { return null; } } else if (line.startsWith('C\t')) c++; } return w ? { worlds: w, chunks: c } : null; }
  async restoreFrom(gz) {
    this.kv('restoring', true); const ids = new Set(), counts = {};
    for await (const line of gzLines(gz)) {
      const a = line.indexOf('\t'), b = line.indexOf('\t', a + 1); if (a < 0 || b < 0) continue; const kind = line.slice(0, a), id = line.slice(a + 1, b); if (!WORLD_ID.test(id)) continue;
      if (kind === 'W') { this.sql.exec('INSERT OR REPLACE INTO worlds VALUES (?, ?)', id, line.slice(b + 1)); ids.add(id); counts[id] = 0; }
      else if (kind === 'C' && ids.has(id)) { const c = line.indexOf('\t', b + 1); if (c < 0) continue; const dk = line.slice(b + 1, c); if (!CHUNK_KEY.test(dk)) continue; this.sql.exec('INSERT OR REPLACE INTO chunks VALUES (?, ?, ?)', id, dk, line.slice(c + 1)); counts[id]++; }
    }
    this.kv('restoring', null); return ids.size ? { ids, counts } : null;
  }
  async restoreOnce() {
    const B = this.backup; let sawAny = false, days = null;
    for (let i = 0; ; i++) {
      let name = i === 0 ? B.branch : i === 1 ? B.branch + '-prev' : null;
      if (i >= 2) { if (!days) days = await B.days(); name = days[i - 2]; if (!name) break; }
      let gz; try { gz = await B.loadGz(name); } catch (e) { if (i === 0) throw e; continue; }
      if (!gz) continue; sawAny = true;
      let ok = null; try { ok = await this.checkGz(gz); } catch (e) { ok = null; }
      if (!ok) { this.log(`백업 ${name}이(가) 망가져 있어 그 전 것을 봅니다`); continue; }
      this.wipe(); const r = await this.restoreFrom(gz); if (!r) continue;
      for (const id of r.ids) this.openWorld(id);
      this.kv('manifest', r.counts); this.kv('backupHash', hex(await crypto.subtle.digest('SHA-1', gz))); this.BK.restoredFrom = name; this.log(`백업에서 세계를 되살렸습니다 (${name}, 세계 ${r.ids.size}개)`); return 'restored';
    }
    if (sawAny) throw new Error('읽을 수 있는 백업이 없습니다');
    return 'none';
  }
  async restoreIfEmpty() {
    // no backup set up: the server worlds stay locked (an empty server must never be backed up over the worlds once the
    // token is added; ALLOW_NO_BACKUP=1 opens them anyway)
    if (!this.backup) { if (!/^(1|true|yes)$/i.test(this.env.ALLOW_NO_BACKUP || '')) { this.BK.blocked = true; this.BK.lastError = 'GITHUB_TOKEN 비밀 값이 없습니다'; } return; }
    try { const r = await this.restoreOnce(); if (r === 'none') this.log('백업된 세계 없음 — 새 세계를 기다립니다'); this.BK.blocked = false; this.BK.lastError = null; }
    catch (e) { this.BK.blocked = true; this.BK.lastError = e.message; this.log('백업 불러오기 실패: ' + e.message); await this.ctx.storage.setAlarm(Date.now() + 60000); }
  }
  async alarm() {
    if (this.BK.blocked) { if (this.backup) await this.restoreIfEmpty(); return; }
    if (this.kv('changed')) { this.isChanged = true; await this.backupNow(this.anyConn() ? '30분마다' : '모두 나감'); }
  }
  anyConn() { return [...this.worlds.values()].some(w => w.conns.size); }

  // ---------- stats and lists ----------
  noteDrop(d) { this.DROPS.push(d); if (this.DROPS.length > 40) this.DROPS.shift(); }
  countOut(s) { const n = s.length; this.TRAFFIC.total += n; const m = /"t":"([a-z_]+)"/.exec(s.slice(0, 60)), k = m ? m[1] : '?'; this.TRAFFIC.kinds[k] = (this.TRAFFIC.kinds[k] || 0) + n; }
  stats() {
    const T = this.TRAFFIC;
    return { host: 'cloudflare', traffic: { sinceMin: Math.round((Date.now() - T.since) / 60000), MB: +(T.total / 1048576).toFixed(2), byKindKB: Object.fromEntries(Object.entries(T.kinds).sort((x, y) => y[1] - x[1]).slice(0, 15).map(([k, v]) => [k, Math.round(v / 1024)])) },
      uptimeMin: Math.round((Date.now() - this.STARTED) / 60000), lastBackup: this.BK.lastBackup, backup: { on: !!this.backup, locked: this.BK.blocked, lastError: this.BK.lastError, restoredFrom: this.BK.restoredFrom, lastAt: this.kv('backupAt'), changed: !!this.kv('changed') },
      worlds: [...this.worlds.values()].filter(w => w.state.meta).map(w => ({ id: w.state.meta.priv ? '(비공개)' : w.id, name: w.state.meta.priv ? '(비공개 서버)' : w.state.meta.name, players: [...w.core.players.values()].filter(q => q.joined).length, conns: w.conns.size, chunks: w.keysLoaded ? w.keys.size : null, cached: w.core.cacheSize(), unsaved: w.dirty.size })),
      rooms: [...this.rooms.values()].filter(r => r.host).length, recentDrops: this.DROPS.slice().reverse() };
  }
  roomList() {
    const info = w => ({ id: w.id, name: w.state.meta.name, mode: w.state.meta.mode, players: [...w.core.players.values()].filter(q => q.joined).length, last: w.state.last || 0 });
    const list = [...this.worlds.values()].filter(w => w.state.meta && !w.state.meta.priv).map(info).sort((a, b) => b.players - a.players || b.last - a.last);
    const def = this.worlds.get(this.worldName);
    return { world: def && def.state.meta && !def.state.meta.priv ? info(def) : list[0] || null, worlds: list,
      rooms: [...this.rooms].filter(([, r]) => r.host).map(([code, r]) => ({ code, host: r.hostName, world: r.worldName, mode: r.mode, players: r.guests.size + 1 })) };
  }
  newCode() { for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; if (!this.rooms.has(c)) return c; } }

  async fetch(req) {
    const url = new URL(req.url), u = url.pathname, jh = { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors };
    if (u === '/rooms') return new Response(J(this.roomList()), { headers: jh });
    if (u === '/stats') return new Response(JSON.stringify(this.stats(), null, 1), { headers: jh });
    if (u === '/report') { try { const o = JSON.parse((await req.text()).slice(0, 2000)); this.noteDrop({ at: new Date().toISOString(), side: 'game', name: String(o.name || '').slice(0, 16), why: String(o.why || '').slice(0, 200), world: String(o.world || '').slice(0, 40), secs: +o.secs || 0 }); } catch (e) {} return new Response(null, { status: 204, headers: cors }); }
    if (req.headers.get('upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
    const pair = new WebSocketPair(), ws = pair[1]; ws.accept(); this.connect(ws, url);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  deadCheck() { const now = Date.now(); for (const c of this.allConns) if (now - c.seen > 120000) c.kill('2분 동안 응답 없음'); }

  // ---------- one connection ----------
  connect(ws, url) {
    this.startTimers(); this.allConns = this.allConns || new Set();
    const S = this, id = this.nextId++; let role = null, wp = false, w = null, room = null, roomName = null, closed = false;
    const c = { seen: Date.now(), backlog: () => 0,
      send(s, drop) { if (closed) return; try { ws.send(s); S.countOut(s); } catch (e) {} },
      close() { if (closed) return; try { ws.close(1000, 'bye'); } catch (e) {} gone('서버가 닫음'); },
      kill(why) { if (closed) return; try { ws.close(1001, 'timeout'); } catch (e) {} gone(why); } };
    this.allConns.add(c);
    const handle = m => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'multi' && Array.isArray(m.l)) { for (const x of m.l) { try { handle(x); } catch (e) { S.log('메시지 처리 오류: ' + (e && e.stack || e)); } } return; }
      if (m.t === 'hb' && !wp && role !== 'guest') return;
      if (wp) {
        if (m.t === 'restore') { S.restorePart(w, id, m); return; }
        if (m.t === 'mirrorhave') { S.mirrorFill(w, id, m); return; }
        if (m.t === 'flush') { setTimeout(() => { w.stateDirty = true; S.saveWorld(w, true); c.send(J({ t: 'flushed' })); }, 150); return; }
        if (m.t === 'create' && w.state.meta == null) { w.keysLoaded = true; w.core.message(id, m); w.stateDirty = true; S.saveWorld(w); S.changed(); return; }
        if (m.t !== 'join') { w.core.message(id, m); return; }
        if (S.requireLogin && !(m.login && m.login.cred)) { c.send(J({ t: 'error', msg: '이 서버는 로그인이 필요합니다 (타이틀 → 로그인)' })); return; }
        w.core.message(id, m); w.state.last = Date.now(); w.stateDirty = true; return;
      }
      if (!role) {
        if (m.t !== 'hello') return;
        let code = String(m.room || url.searchParams.get('room') || '').trim().toUpperCase().slice(0, 12), wid = null;
        if (m.role === 'join' && !code) {
          if (m.newWorld) wid = S.newWorldId();
          else if (m.world != null) { wid = String(m.world); if (!WORLD_ID.test(wid)) { c.send(J({ t: 'error', msg: '잘못된 세계 이름입니다' })); c.close(); return; } }
          else { const def = S.worlds.get(S.worldName); if (!(def && def.state.meta)) { const open = [...S.rooms].filter(([, r]) => r.host); if (open.length === 1) code = open[0][0]; } }
        }
        if (m.role === 'join') { const r = code ? S.rooms.get(code) : null; m.role = r && r.host ? 'guest' : code ? 'none' : 'world'; }
        if (m.role === 'none') { c.send(J({ t: 'error', msg: `방 코드 ${code}로 열린 세계가 없습니다 (닫혔거나 코드가 틀렸어요)` })); c.close(); return; }
        if (m.role === 'world' && S.BK.blocked) { c.send(J({ t: 'error', msg: S.backup ? '서버가 세계 백업을 아직 불러오지 못해 잠시 잠가 두었습니다. 1~2분 뒤 다시 접속해 주세요' : '서버에 백업 설정(GITHUB_TOKEN)이 아직 없어 서버 세계를 잠가 두었습니다' })); c.close(); return; }
        if (m.role === 'world') { const ww = S.openWorld(wid || S.worldName), pk = ww.state.meta && ww.state.meta.priv && ww.state.meta.priv.key;
          if (pk && String(m.key || '') !== pk) { c.send(J({ t: 'error', msg: '비공개 서버입니다. 초대 코드가 맞지 않습니다' })); c.close(); S.dropIfEmpty(ww); return; }
          role = 'world'; wp = true; w = ww; S.ensureKeys(w); w.conns.set(id, c); roomName = w.id;
          c.send(J({ t: 'hello', id, world: w.state.meta ? { name: w.state.meta.name, seed: w.state.meta.seed } : null, kind: 'world', wid: w.id, multi: 1 })); return; }
        if (m.role === 'host') { roomName = code && !(S.rooms.get(code) || {}).host ? code : S.newCode();
          room = { host: c, guests: new Map(), hostName: String(m.name || '플레이어').slice(0, 16), worldName: String(m.world || '').slice(0, 40), mode: m.mode === 'creative' ? 'creative' : 'survival' }; S.rooms.set(roomName, room); role = 'host'; }
        else { roomName = code || 'main'; room = S.rooms.get(roomName); if (!room || !room.host) { c.send(J({ t: 'error', msg: '아직 세계를 연 호스트가 없습니다' })); c.close(); return; } room.guests.set(id, c); role = 'guest'; }
        c.send(J({ t: 'hello', id: role === 'host' ? 0 : id, kind: role, room: roomName, multi: 1 })); return;
      }
      const dr = DROPPABLE.has(m.t) && m.t + ':' + (m.id != null ? m.id : role === 'guest' ? id : '');
      if (role === 'guest') { if (room.host) room.host.send(J({ ...m, from: id }), dr); return; }
      const to = m.to; delete m.to; const s = J(m);
      if (to != null) { const g = room.guests.get(to); if (g) g.send(s, dr); } else for (const g of room.guests.values()) g.send(s, dr);
    };
    const gone = why => {
      if (closed) return; closed = true; S.allConns.delete(c);
      { const p = wp && w.core.players.get(id); if ((p && p.joined) || role) S.noteDrop({ at: new Date().toISOString(), side: 'server', world: wp ? w.id : roomName, name: p ? p.name : role, why }); }
      if (wp) { w.conns.delete(id); w.core.leave(id); if (w.restorer === id) { w.restorer = null; S.saveWorld(w); } if (!w.conns.size) { w.stateDirty = true; S.saveWorld(w); S.dropIfEmpty(w); if (!S.anyConn()) S.backupSoon(); } }
      else if (role === 'guest') { room.guests.delete(id); if (room.host) room.host.send(J({ t: 'leave', from: id })); }
      else if (role === 'host') { room.host = null; for (const g of room.guests.values()) { g.send(J({ t: 'hostgone' })); g.close(); } room.guests.clear(); S.rooms.delete(roomName); }
      S.stopTimersIfIdle();
    };
    ws.addEventListener('message', e => { c.seen = Date.now(); if (typeof e.data !== 'string') return; let m; try { m = JSON.parse(e.data); } catch (er) { return; } try { handle(m); } catch (er) { S.log('메시지 처리 오류: ' + (er && er.stack || er)); } });
    ws.addEventListener('close', () => { try { ws.close(); } catch (e) {} gone('플레이어 쪽에서 닫힘'); });
    ws.addEventListener('error', () => gone('네트워크 오류'));
  }
}
