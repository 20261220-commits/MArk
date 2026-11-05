// ---------- private servers ----------
// A single-player world can be made into a private server world: it is uploaded to the multiplayer server with an
// invite key, the server never lists it and lets in only those who give the key (the invite code is "world.key").
// The single-player world stays in the world list, linked to the server ("🔒 비공개 서버"): playing it joins the
// server when it can be reached, and plays this device's copy when it can't. The two are kept in step:
//  - leaving the server, everything the server sent (this browser's copy of it, multiplayer.js) is written into the
//    single-player world: chunks, the changes still to be put in place, your inventory and position, the time;
//  - chunks changed while playing offline are remembered and uploaded the next time the server is reached (your
//    copy of a chunk then replaces the server's), and so are your inventory and position.
// A private server someone invited you to shows in the list too, and gets its own single-player copy after the first visit.
const PRIV_KEYS = 'nemo-privkeys', PRIV_INV = 'nemo-privinvites', PRIV_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const privRead = k => { try { return JSON.parse(localStorage.getItem(k) || (k === PRIV_INV ? '[]' : '{}')); } catch (e) { return k === PRIV_INV ? [] : {}; } };
const privWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
function privKeyOf(wid) { return privRead(PRIV_KEYS)[wid] || undefined; }
function privKeySet(wid, key) { const k = privRead(PRIV_KEYS); k[wid] = key; privWrite(PRIV_KEYS, k); }
const privNewKey = () => { let s = ''; const r = crypto.getRandomValues(new Uint8Array(10)); for (const b of r) s += PRIV_CH[b % PRIV_CH.length]; return s; };
const privCode = p => p.wid + '.' + p.key;
function privParse(s) {
  s = String(s || '').trim(); let url = null; const bar = s.lastIndexOf('|'); if (bar > 0) { url = s.slice(0, bar).trim(); s = s.slice(bar + 1).trim(); }
  const m = /^(w[a-z0-9]{6,})\.([A-Z0-9]{6,32})$/i.exec(s); return m ? { url, wid: m[1].toLowerCase(), key: m[2].toUpperCase() } : null;
}
const PRIV = { sp: null };
// ---------- chunks between the server's form and this browser's ----------
function privToServerRec(rec) { return rec.b ? { v: 3, it: rec.it, ch: rec.ch || 128, my: rec.my, b: mpB64(rec.b), m: mpB64(rec.m), l: mpB64(rec.l), bio: Array.from(rec.bio), t: rec.t || [], mobs: rec.mobs || null } : { v: 2, it: rec.it, mobs: rec.mobs || null }; }
function privFromServerRec(r) { return r.b ? { v: 3, it: r.it, ch: r.ch || 128, my: r.my, b: mpUnB64(r.b, Uint16Array), m: mpUnB64(r.m, Uint8Array), l: mpUnB64(r.l, Uint8Array), bio: r.bio, t: r.t || [], mobs: r.mobs || null } : { v: 2, it: r.it, mobs: r.mobs || null }; }
const privHost = p => mirHost(p.url) + '|' + p.wid;
const privPdKey = p => privHost(p) + '|' + (ACC.user ? 'a:' + ACC.user.name.toLowerCase() : 'n:' + String(MP.name || '').toLowerCase());
// ---------- the server's copy into the single-player world ----------
async function privPull(p, spId) {
  const host = privHost(p), rec = await mirGet('S|' + host); if (!rec || !rec.state || !rec.state.meta) return null;
  const all = await listWorlds(); let meta = (all || []).find(w => w.id === spId) || (all || []).find(w => w.priv && w.priv.wid === p.wid);
  const sm = rec.state.meta;
  if (!meta) meta = { id: 'priv-' + p.wid, name: sm.name, seed: sm.seed, gen: sm.gen || 1, mode: sm.mode, diff: sm.diff, cheats: sm.cheats, exp: sm.exp, created: Date.now(), last: Date.now(), spawn: sm.spawn };
  meta.priv = { url: p.url, wid: p.wid, key: p.key, name: sm.name }; const dirty = new Set(meta.privDirty || []);
  for (const dk of Object.keys(rec.vers)) {
    if (dirty.has(dk)) continue; const e = await mirGet('C|' + host + '|' + dk); if (!e) continue;
    if (e.rec) await dbReq('chunks', 'readwrite', st => st.put(privFromServerRec(e.rec), meta.id + ':' + dk));
    const logK = 'mplog:' + meta.id + ':' + dk;
    if ((e.edits && e.edits.length) || (e.tiles && Object.keys(e.tiles).length)) await dbReq('chunks', 'readwrite', st => st.put({ edits: e.edits || [], tiles: e.tiles || {} }, logK));
    else await dbReq('chunks', 'readwrite', st => st.delete(logK));
  }
  // you, as the server last kept you (this device's own record of it)
  try { const r = JSON.parse(localStorage.getItem('nemo-pdata') || '{}')[privPdKey(p)]; const d = r && r.d;
    if (d && d.s) { meta.player = { s: d.s, inv: d.inv, armor: d.armor, sel: d.sel, it: d.it, ender: d.ender, off: d.off, pend: d.pend || null }; meta.dim = d.dim || 0; if (d.adv) meta.adv = d.adv; if (d.adv2) meta.adv2 = d.adv2; if (d.stats) meta.stats = d.stats; if (d.s.mode) meta.mode = d.s.mode; } } catch (e) {}
  if (rec.state.time != null) meta.time = rec.state.time; if (sm.spawn) meta.spawn = sm.spawn; if (sm.gamerules) meta.gamerules = sm.gamerules;
  meta.privSyncAt = rec.at || Date.now(); meta.last = Date.now(); await putWorld(meta);
  privWrite(PRIV_INV, privRead(PRIV_INV).filter(q => q.wid !== p.wid)); // it has a copy of its own now
  return meta;
}
// ---------- what was played offline, up to the server ----------
async function privPush(meta) {
  const p = meta.priv, dirty = meta.privDirty || []; if (!dirty.length && !meta.privPlayerDirty) return;
  const link = await mpWebSocket(p.url, 'join', { world: p.wid, key: p.key });
  try {
    if (!link.hello.world) return; // the server lost the world: joining puts this device's copy back (multiplayer.js)
    for (const dk of dirty) { const rec = await dbReq('chunks', 'readonly', st => st.get(meta.id + ':' + dk)); if (!rec || (rec.b && rec.v < 3)) continue; link.send({ t: 'store', dk, rec: privToServerRec(rec) }); }
    await new Promise(r => setTimeout(r, 500));
  } finally { link.close(); }
  // your inventory and position from the offline play: this device's record wins when you join (multiplayer.js)
  if (meta.player) try { const all = JSON.parse(localStorage.getItem('nemo-pdata') || '{}'), k = privPdKey(p), pl = meta.player;
    all[k] = { ...(all[k] || {}), d: { s: pl.s, dim: meta.dim || 0, inv: pl.inv, armor: pl.armor, sel: pl.sel, it: pl.it, ender: pl.ender, off: pl.off, pend: pl.pend, adv: meta.adv || null, adv2: meta.adv2 || null, stats: meta.stats || null }, at: Date.now() + 1000, dirty: 1 };
    localStorage.setItem('nemo-pdata', JSON.stringify(all)); } catch (e) {}
  meta.privDirty = []; meta.privPlayerDirty = false; await putWorld(meta);
}
// chunks saved while a linked world is played offline: remembered for the upload
{ const sc = saveChunk; saveChunk = function (c) {
    if (c && c.modified && W.active && !W.pano && W.meta && W.meta.priv && !W.meta.remote && W.id === W.meta.id && !PRIV.quiet && !(typeof MP !== 'undefined' && MP.on)) { /* (not the title screen's world, nor the server's) */ const dk = dkey(c.cx, c.cz), l = W.meta.privDirty || (W.meta.privDirty = []); if (!l.includes(dk)) { l.push(dk); PRIV.metaDue = true; } }
    return sc.apply(this, arguments); };
  addEventListener('load', () => { const swm = saveWorldMeta; saveWorldMeta = function () { if (W.active && W.meta && W.meta.priv && !W.meta.remote && !PRIV.quiet) W.meta.privPlayerDirty = true; return swm.apply(this, arguments); }; }); } // (main.js comes later)
setInterval(() => { if (PRIV.metaDue && W.active && W.meta && W.meta.priv && !W.meta.remote) { PRIV.metaDue = false; putWorld(W.meta); } }, 2000);
// ---------- playing a linked world ----------
async function privPlay(meta) {
  if (PRIV.pulling) { showMenu('loading', '서버에서 받은 내용을 이 세계에 맞추는 중'); await PRIV.pulling; const m = (await listWorlds()).find(w => w.id === meta.id); if (m) meta = m; }
  const p = meta.priv; let m2 = meta;
  try { const rec = await mirGet('S|' + privHost(p)); if (rec && rec.at && rec.at > (meta.privSyncAt || 0)) m2 = await privPull(p, meta.id) || meta; } catch (e) {} // a session that ended without a goodbye (the tab closed)
  if (!navigator.onLine) { privOffline(m2, '인터넷에 연결되어 있지 않아'); return; }
  showMenu('mp_join'); const say = t => { MP.status = t; const el = $('mpStatus'); if (el) el.textContent = t; };
  try {
    say('비공개 서버에 접속하는 중...'); privKeySet(p.wid, p.key);
    if ((m2.privDirty && m2.privDirty.length) || m2.privPlayerDirty) { say('오프라인에서 플레이한 내용을 서버에 올리는 중...'); await privPush(m2); }
    PRIV.sp = m2.id; const r = await mpJoinWs(p.url, null, p.wid); if (r !== 'noworld') say('접속했습니다. 세계를 받는 중...');
  } catch (e) {
    PRIV.sp = null;
    if (e && e.fromServer && /초대 코드/.test(e.message)) { alert(e.message); showMenu('worlds'); return; }
    privOffline(m2, '서버에 연결할 수 없어');
  }
}
function privOffline(meta, why) { startWorld(meta.id, meta).then(() => { if (UI.flash) UI.flash(why + ' 이 기기의 사본으로 엽니다. 다음에 서버에 접속하면 올라갑니다'); }); }
// leaving the server: its copy into the single-player world
{ const ms = mpStop; mpStop = function () { const sp = PRIV.sp, host = MIR.host, wid = MP.worldId, url = MP.lastUrl;
    // the chunks this browser was running: newer than any copy the server will still send (it stops sending as you go)
    let snap = null; try { if (MP.on && MP.server && MP.role === 'host' && W.active && wid && privKeyOf(wid)) snap = [...W.chunks.values()].filter(c => c.edited).map(c => [dkey(c.cx, c.cz), { v: 3, it: ITEM_TABLE, ch: CH, my: MINY, b: rleEnc(c.blocks), m: rleEnc(c.meta), l: rleEnc(c.light), bio: c.biome.slice(), t: serTiles(c), mobs: chunkKeep(c, false) }]); } catch (e) { snap = null; }
    const r = ms.apply(this, arguments);
    if (sp || (wid && privKeyOf(wid))) { PRIV.sp = null; const all = privRead(PRIV_KEYS), key = all[wid];
      if (key && host) PRIV.pulling = (async () => { await new Promise(r => setTimeout(r, 5500)); await MIR.busy; const m = await privPull({ url, wid, key }, sp); if (m && snap) for (const [dk, rec] of snap) { await dbReq('chunks', 'readwrite', st => { st.put(rec, m.id + ':' + dk); st.delete('mplog:' + m.id + ':' + dk); }); } return m; })().catch(e => console.warn('비공개 서버 사본 저장 실패', e)).finally(() => { PRIV.pulling = null; }); } // (after the last copies have come in; playing it again waits for this) // (after the last copies have come in)
    return r; }; }
// ---------- making one, joining one by its code ----------
async function privCreate(id) {
  const url = mpDefaultAddr(); if (!url) { alert('멀티플레이 서버 주소가 없습니다. 멀티플레이 화면에서 서버 주소를 한 번 넣어 주세요'); return; }
  const all = await listWorlds(), meta = (all || []).find(w => w.id === id); if (!meta) return;
  if (meta.priv) { prompt('이미 비공개 서버입니다. 친구에게 이 초대 코드를 알려 주세요', privCode(meta.priv)); return; }
  if (!confirm(`'${meta.name}' 세계를 비공개 서버로 만들까요?\n\n서버에 올라가고, 초대 코드를 아는 사람만 들어올 수 있습니다. 싱글플레이 목록에도 그대로 남아 서버와 같이 맞춰집니다.`)) return;
  await startWorld(id); await new Promise(r => setTimeout(r, 1500));
  const key = privNewKey(); MP.uploadPriv = { key }; let up;
  showMenu('loading', '비공개 서버를 만드는 중');
  try { up = await mpUpload(url); } catch (e) { MP.uploadPriv = null; alert('비공개 서버를 만들지 못했습니다: ' + e.message); quitToTitle(); return; }
  MP.uploadPriv = null; if (!up.wid) { alert('서버가 세계 번호를 주지 않았습니다 (서버가 오래된 버전일 수 있습니다)'); quitToTitle(); return; }
  W.meta.priv = { url, wid: up.wid, key, name: W.meta.name }; W.meta.privSyncAt = Date.now(); privKeySet(up.wid, key);
  PRIV.quiet = true; try { saveAll(true); await new Promise(r => setTimeout(r, 300)); const m = W.meta; quitToTitle(); m.privDirty = []; m.privPlayerDirty = false; await putWorld(m); PRIV.created = m; } finally { PRIV.quiet = false; } // (what is saved now is already on the server)
  const m = PRIV.created;
  prompt('비공개 서버를 만들었습니다. 친구에게 이 초대 코드를 알려 주세요 (멀티플레이 → 초대 코드로 들어가기)', privCode(m.priv));
  privPlay(m);
}
async function privJoinCode(s) {
  const p = privParse(s); if (!p) { alert('초대 코드가 올바르지 않습니다 (예: w1abc2de3f.ABCD2345)'); return; }
  p.url = p.url || mpDefaultAddr(); privKeySet(p.wid, p.key);
  const inv = privRead(PRIV_INV).filter(q => q.wid !== p.wid); inv.unshift({ ...p, name: '비공개 서버 ' + p.wid.slice(-4), at: Date.now() }); privWrite(PRIV_INV, inv.slice(0, 20));
  const all = await listWorlds(), mine = (all || []).find(w => w.priv && w.priv.wid === p.wid);
  if (mine) { privPlay(mine); return; }
  showMenu('mp_join'); PRIV.sp = null;
  try { const r = await mpJoinWs(p.url, null, p.wid); if (r !== 'noworld') { MP.status = '접속했습니다. 세계를 받는 중...'; } } catch (e) { alert(e.message || '접속하지 못했습니다'); showMenu('worlds'); }
}
// ---------- in the world list ----------
function privListExtra(ws) { const have = new Set(ws.filter(w => w.priv).map(w => w.priv.wid)); return privRead(PRIV_INV).filter(q => !have.has(q.wid)); }
