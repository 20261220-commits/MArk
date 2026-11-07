// Keeping the game's two sites alike: the game opened from claude.ai and from the server's own address
// (mark.yubinl3756.workers.dev) each keep their saves in their own browser storage, and the browser never lets one see
// the other's. A logged-in player's single-player worlds and settings go through the Cloudflare server instead
// (cf/worker.js, /sync), kept under the account: each site sends what is newer here and takes what is newer there.
//  - worlds: the whole save (world data and every stored chunk), the newer one wins; a world deleted on one site goes
//    from the other too
//  - settings, keys, skins, the multiplayer name and server, private server invites: each the newer one
//  - not the jar textures (Mojang's files never leave the player's browser) and not the login itself (log in with the
//    same name and password on both sites: that is what joins them)
const CS_KEYS = ['nemo-mc-117-options', 'nemo-mc-117-skin', 'nemo-skins', 'nemo-mp-name', 'nemo-mp-addr', 'nemo-pdata', 'nemo-privinvites', 'nemo-privkeys'];
const CS_MT = 'nemo-sync-mtime', CS_DEL = 'nemo-sync-del';
const CS = { busy: false, at: 0, msg: '', last: 0, quiet: false };
// when each synced setting last changed here (every write of one is noted)
{ const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { set.call(this, k, v); if (this === window.localStorage && !CS.quiet && CS_KEYS.includes(k)) { try { const m = JSON.parse(this.getItem(CS_MT) || '{}'); m[k] = Date.now(); set.call(this, CS_MT, JSON.stringify(m)); } catch (e) {} } }; }
const csRead = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };
// settings from before syncing began carry the time 1: sent if the server has none, else the server's taken (the first
// site to sync gives its settings to the other)
try { if (localStorage.getItem(CS_MT) == null) { const m = {}; for (const k of CS_KEYS) if (localStorage.getItem(k) != null) m[k] = 1; CS.quiet = true; localStorage.setItem(CS_MT, JSON.stringify(m)); CS.quiet = false; } } catch (e) { CS.quiet = false; }
function csBase() { if (typeof NEMO_CONFIG !== 'undefined' && NEMO_CONFIG.sync) return NEMO_CONFIG.sync; /* (tests: another address) */ const s = typeof NEMO_CONFIG !== 'undefined' ? (NEMO_CONFIG.servers && NEMO_CONFIG.servers[0] ? NEMO_CONFIG.servers[0][1] : NEMO_CONFIG.server) : ''; return s ? 'https://' + String(s).replace(/^\w+:\/\//, '').replace(/\/.*$/, '') : ''; }
async function csFetch(path, opt = {}) {
  const r = await fetch(csBase() + path, { ...opt, cache: 'no-store', headers: { ...(opt.headers || {}), 'x-nemo-user': ACC.user.name, 'x-nemo-cred': ACC.cred } });
  if (!r.ok) { let m = '서버 오류 ' + r.status; try { m = (await r.clone().json()).error || m; } catch (e) {} const er = new Error(m); er.status = r.status; throw er; }
  return r;
}
// a save as one gzipped text: typed arrays (the chunks' blocks, meta and light) written as base64
function csB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
const csEnc = (k, v) => ArrayBuffer.isView(v) ? { $t: v.constructor.name, d: csB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) } : v;
const csDec = (k, v) => { if (v && typeof v === 'object' && typeof v.$t === 'string' && typeof v.d === 'string' && /Array$/.test(v.$t) && typeof window[v.$t] === 'function') { const b = atob(v.d), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new window[v.$t](u.buffer); } return v; };
async function csPackWorld(w) {
  const range = IDBKeyRange.bound(w.id + ':', w.id + ':￿');
  const keys = await dbReq('chunks', 'readonly', st => st.getAllKeys(range)) || [], vals = await dbReq('chunks', 'readonly', st => st.getAll(range)) || [];
  const text = JSON.stringify({ v: 1, world: w, chunks: keys.map((k, i) => [k.slice(w.id.length + 1), vals[i]]) }, csEnc);
  return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
}
async function csUnpackWorld(buf) {
  const text = await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text(), o = JSON.parse(text, csDec);
  if (!o || !o.world || !o.world.id || !Array.isArray(o.chunks)) throw new Error('망가진 세계');
  const id = o.world.id;
  await dbReq('chunks', 'readwrite', st => st.delete(IDBKeyRange.bound(id + ':', id + ':￿')));
  for (let i = 0; i < o.chunks.length; i += 200) { const part = o.chunks.slice(i, i + 200); await dbReq('chunks', 'readwrite', st => { for (const [k, rec] of part) st.put(rec, id + ':' + k); }); }
  await putWorld(o.world);
  return o.world;
}
// one round: settings both ways, then worlds both ways (never the world being played)
async function cloudSync(why) {
  if (!ACC.user || !ACC.cred || CS.busy || !csBase() || (W.active && why !== 'test')) return null;
  CS.busy = true; CS.msg = '동기화하는 중...'; csPaint();
  let got = 0, sent = 0, gone = 0, prefsGot = false;
  try {
    const list = await (await csFetch('/sync/list')).json();
    // settings
    const mt = csRead(CS_MT, {}), up = {};
    for (const k of CS_KEYS) { const v = localStorage.getItem(k); if (v != null && (mt[k] || 0) > (list.prefs[k] || 0) && !(mt[k] === 1 && list.prefs[k])) up[k] = { at: mt[k], v }; }
    if (Object.keys(up).length) await csFetch('/sync/prefs', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(up) });
    const newer = k => list.prefs[k] && (list.prefs[k] > (mt[k] || 0) || mt[k] === 1);
    if (CS_KEYS.some(newer)) {
      const all = await (await csFetch('/sync/prefs')).json(), m2 = csRead(CS_MT, {});
      CS.quiet = true; try { for (const k of CS_KEYS) if (all[k] && (all[k].at > (m2[k] || 0) || m2[k] === 1)) { localStorage.setItem(k, all[k].v); m2[k] = all[k].at; prefsGot = true; } localStorage.setItem(CS_MT, JSON.stringify(m2)); } finally { CS.quiet = false; }
      if (prefsGot) csApplyPrefs();
    }
    // worlds deleted here since the last round
    for (const d of csRead(CS_DEL, [])) { await csFetch('/sync/world?id=' + encodeURIComponent(d.id) + '&at=' + d.at, { method: 'DELETE' }); }
    CS.quiet = true; try { localStorage.removeItem(CS_DEL); } finally { CS.quiet = false; }
    const local = new Map(((await listWorlds()) || []).filter(w => w && w.id && !w.remote).map(w => [w.id, w])), remote = new Map((list.worlds || []).map(s => [s.id, s]));
    for (const s of remote.values()) { const l = local.get(s.id); if (s.del && l && (l.last || 0) <= s.last && !(W.active && W.id === s.id)) { await deleteWorld(s.id, true); local.delete(s.id); gone++; } }
    for (const w of local.values()) { if (W.active && W.id === w.id) continue; const s = remote.get(w.id);
      if (!s || (w.last || 0) > s.last) { CS.msg = `"${w.name}" 올리는 중...`; csPaint(); const buf = await csPackWorld(w); await csFetch('/sync/world?id=' + encodeURIComponent(w.id) + '&last=' + (w.last || 0) + '&name=' + encodeURIComponent(w.name || ''), { method: 'PUT', body: buf }); sent++; } }
    for (const s of remote.values()) { if (s.del || (W.active && W.id === s.id)) continue; const l = local.get(s.id);
      if (!l || s.last > (l.last || 0)) { CS.msg = `"${s.name}" 받는 중...`; csPaint(); await csUnpackWorld(await (await csFetch('/sync/world?id=' + encodeURIComponent(s.id))).arrayBuffer()); got++; } }
    CS.last = Date.now(); CS.msg = '☁ 동기화됨 · ' + new Date().toLocaleTimeString() + (got || sent || gone ? ` (받음 ${got} · 올림 ${sent}${gone ? ' · 지움 ' + gone : ''})` : '');
  } catch (e) { CS.msg = '☁ 동기화 실패: ' + (e.status === 403 ? '이 닉네임은 다른 비밀번호로 동기화된 적이 있어요' : e.message || e); }
  finally { CS.busy = false; CS.at = Date.now(); csPaint(); if ((got || gone) && UI.menu === 'worlds') showMenu('worlds'); }
  return { got, sent, gone, prefsGot };
}
// settings that came from the other site, put to use now
function csApplyPrefs() {
  try { const o = JSON.parse(localStorage.getItem('nemo-mc-117-options') || 'null'); if (o) { Object.assign(OPT, o); if (typeof applyOpt === 'function') applyOpt(); } } catch (e) {}
  try { const n = localStorage.getItem('nemo-mp-name'); if (n && typeof MP !== 'undefined') MP.name = n; } catch (e) {}
  if (typeof loadCustomSkin === 'function' && OPT.skin === 'custom') loadCustomSkin(() => { if (typeof rebuildPlayer === 'function') rebuildPlayer(); });
  if (UI.menu === 'title' || UI.menu === 'options' || UI.menu === 'skins') showMenu(UI.menu);
}
// the world list's line about it
function csLine() {
  if (!ACC.user) return `<p class="muted" id="csStatus">☁ 로그인하면 이 게임의 두 주소(claude.ai 링크와 ${esc(csBase().replace('https://', ''))})의 세계와 설정이 똑같이 맞춰져요 (두 곳에서 같은 닉네임·비밀번호로 로그인)</p>`;
  return `<p class="muted" id="csStatus">${esc(CS.msg || '☁ 동기화 대기 중')}</p>`;
}
function csPaint() { const el = document.getElementById('csStatus'); if (el) el.textContent = CS.msg; }
// a world deleted here: the other site lets it go too (sent with the next round)
{ const dw = deleteWorld; deleteWorld = async function (id, fromSync) { const r = await dw.apply(this, arguments); if (!fromSync && ACC.user) { const l = csRead(CS_DEL, []); l.push({ id, at: Date.now() }); CS.quiet = true; try { localStorage.setItem(CS_DEL, JSON.stringify(l.slice(-50))); } finally { CS.quiet = false; } setTimeout(() => cloudSync('delete'), 500); } return r; }; }
// when: a while after the game opens, on the world list (at most every 15 s), back at the title after playing, after logging in
setTimeout(() => cloudSync('start'), 4000);
{ const sm = showMenu; showMenu = function (name) { const r = sm.apply(this, arguments); if (name === 'worlds' && ACC.user && !CS.busy && Date.now() - CS.at > 15000) setTimeout(() => cloudSync('list'), 100); return r; }; }
{ const qt = quitToTitle; quitToTitle = function () { const r = qt.apply(this, arguments); setTimeout(() => cloudSync('quit'), 1500); return r; }; }
{ const al = accLogin; accLogin = function () { const r = al.apply(this, arguments); if (ACC.user) setTimeout(() => cloudSync('login'), 300); return r; }; }
