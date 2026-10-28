// Multiplayer basics: one player hosts their world (like Java's "Open to LAN"), others join it.
// Two ways to connect: a relay server (node tools/server.js, it also serves the game on your network) or,
// with no server at all, WebRTC with invite / answer codes copied between the players.
// The host's world is the real one: guests generate the same terrain from the seed, fetch the chunks the host
// has changed, and every block a player breaks or places is sent to everyone. Players see each other (skin,
// held item, armour, pose, custom skins), chat is shared, the host's clock and weather rule, and the host's mobs are mirrored
// to guests (guests can hit them), container contents follow every click, the host's dropped items can be picked
// up by guests, a guest's inventory is kept on their device per host world, and the host's mobs chase, hit and shoot
// whichever player is nearest.
const MP_SUMMON_KEYS = ['baby', 'variant', 'size', 'vtype', 'prof', 'persistent', 'playerMade', 'placed', 'charge', 'hp', 'trap'];
const MP = { server: false, auth: {}, rolePending: false, queue: [], replaying: false, on: false, role: null, name: null, id: 0, link: null, peers: new Map(), local: false, applying: false, allowSpawn: false, nextId: 1, eid: 1, rtc: null, status: '' };
const MP_NAME_KEY = 'nemo-mp-name', MP_ADDR_KEY = 'nemo-mp-addr';
try { MP.name = localStorage.getItem(MP_NAME_KEY); } catch (e) {}
if (!MP.name) MP.name = '플레이어' + (100 + Math.floor(Math.random() * 900));
// the address offered first: the last one used, then the one this game was published with (js/config.js or the server's
// SERVER_URL), then the server this page came from, if it came from one (not a static host such as GitHub Pages)
// pages hosts that serve files only: they can't be a multiplayer server
const MP_STATIC = /(^|\.)(github\.io|claude\.ai|claudeusercontent\.com|netlify\.app|vercel\.app|pages\.dev)$/i;
const mpStaticHost = a => { try { return MP_STATIC.test(new URL(mpWsUrl(a)).hostname); } catch (e) { return false; } };
const mpDefaultAddr = () => { try { const a = localStorage.getItem(MP_ADDR_KEY); if (a && !mpStaticHost(a)) return a; } catch (e) {}
  if (typeof NEMO_CONFIG !== 'undefined' && NEMO_CONFIG.server) return mpWsUrl(NEMO_CONFIG.server);
  if (/^https?:$/.test(location.protocol) && !MP_STATIC.test(location.hostname)) return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/mp';
  return location.protocol === 'https:' ? '' : 'ws://192.168.0.2:8080/mp'; }; // on GitHub Pages: empty, the field shows what to write

// ---------- binary <-> text for chunk data ----------
function mpB64(ta) { const u8 = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function mpUnB64(s, T) { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer); }
async function mpPack(text) { const cs = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate')); return mpB64(new Uint8Array(await new Response(cs).arrayBuffer())); }
async function mpUnpack(code) { const u8 = mpUnB64(code.replace(/\s+/g, ''), Uint8Array); return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'))).text(); }

// ---------- transports: every message goes guest -> host or host -> guest(s) ----------
// relay server: the server forwards guests' messages to the host and the host's to one guest or all of them
// "my-server.onrender.com", "https://my-server.onrender.com" or "192.168.0.2:8080" -> a WebSocket address ending in /mp
function mpWsUrl(a) {
  a = String(a || '').trim(); if (!/^[a-z]+:\/\//i.test(a)) a = (/^(localhost|\d+\.\d+\.\d+\.\d+)(:|\/|$)/.test(a) ? 'ws://' : 'wss://') + a;
  a = a.replace(/^http(s?):\/\//i, 'ws$1://'); try { const u = new URL(a); if (u.pathname === '/' || u.pathname === '') u.pathname = '/mp'; return u.href; } catch (e) { return a; }
}
// a hosted server (Render's free plan and the like) sleeps when nobody uses it and takes up to a minute to wake:
// knock on its web page, then keep trying for a while instead of failing at once
async function mpWebSocket(url, role, extra) {
  if (!String(url || '').trim()) throw new Error('서버 주소를 넣어 주세요 (예: 이름.onrender.com)');
  if (mpStaticHost(url)) throw new Error('이 주소는 게임 파일만 있는 곳이라 멀티플레이 서버가 아닙니다. Render 서버 주소(이름.onrender.com)를 넣어 주세요');
  url = mpWsUrl(url); const local = /^wss?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url), t0 = Date.now();
  const say = t => { MP.status = t; const el = $('mpStatus'); if (el) el.textContent = t; };
  for (let k = 0; ; k++) {
    try { return await mpWsOnce(url, role, extra); }
    catch (e) {
      if (local || e.fromServer || Date.now() - t0 > 75000) throw e;
      if (k === 0) { say('서버를 깨우는 중... (잠들어 있던 서버는 1분쯤 걸릴 수 있어요)'); try { fetch(url.replace(/^ws/, 'http').replace(/\/mp.*$/, '/'), { mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (er) {} }
      else say(`서버를 깨우는 중... ${Math.round((Date.now() - t0) / 1000)}초`);
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}
function mpWsOnce(url, role, extra) {
  return new Promise((res, rej) => {
    let ws; try { ws = new WebSocket(url); } catch (e) { rej(e); return; }
    const link = { kind: 'ws', send(o, to) { if (ws.readyState === 1) ws.send(JSON.stringify(to != null ? { ...o, to } : o)); }, close() { try { ws.close(); } catch (e) {} } };
    let ok = false;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', role, ...(extra || {}) }));
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      if (!ok) { if (m.t === 'hello') { ok = true; MP.id = m.id; link.hello = m; res(link); } else if (m.t === 'error') { const er = new Error(m.msg); er.fromServer = true; rej(er); ws.close(); } return; }
      if (MP.core && role === 'host') { if (m.t === 'leave') MP.core.leave(m.from); else MP.core.message(m.from, m); return; } // a guest of your world: the world core takes it
      if (m.t === 'leave') { mpPeerGone(m.from); return; } if (m.t === 'hostgone') { mpLost('호스트가 세계를 닫았습니다'); return; }
      if (m.t === 'error') { MP.status = m.msg; const el = $('mpStatus'); if (el) el.textContent = m.msg; else chatMsg(m.msg, '#ff5555'); return; }
      mpHandle(m, MP.server || MP.role === 'host' ? m.from : 0); };
    ws.onerror = () => { if (!ok) rej(new Error('서버에 연결하지 못했습니다')); };
    ws.onclose = () => { if (ok && MP.link === link) mpLost('서버와 연결이 끊겼습니다'); };
  });
}
// WebRTC data channels, a star around the host; long messages are split (data channels cap message size)
const RTC_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };
function rtcWire(dc, onMsg, onClose) {
  const parts = {};
  dc.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; }
    if (m.t === 'part') { const p = parts[m.k] || (parts[m.k] = []); p[m.i] = m.s; if (p.filter(x => x != null).length === m.n) { delete parts[m.k]; try { onMsg(JSON.parse(p.join(''))); } catch (er) {} } return; }
    onMsg(m); };
  dc.onclose = onClose;
  return o => { if (dc.readyState !== 'open') return; const s = JSON.stringify(o); if (s.length < 60000) { dc.send(s); return; } const k = Math.random().toString(36).slice(2), n = Math.ceil(s.length / 60000); for (let i = 0; i < n; i++) dc.send(JSON.stringify({ t: 'part', k, i, n, s: s.slice(i * 60000, (i + 1) * 60000) })); };
}
const iceDone = pc => new Promise(r => { if (pc.iceGatheringState === 'complete') return r(); const t = setTimeout(r, 4000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } }); });
// host: one invite at a time; the answer code from the guest completes it
async function mpMakeInvite() {
  const pc = new RTCPeerConnection(RTC_CFG), dc = pc.createDataChannel('mp', { ordered: true });
  await pc.setLocalDescription(await pc.createOffer()); await iceDone(pc);
  MP.rtc = { pc, dc, code: await mpPack(pc.localDescription.sdp) };
  dc.onopen = () => { const id = MP.nextId++, send = rtcWire(dc, m => MP.core ? MP.core.message(id, m) : mpHandle(m, id), () => MP.core ? MP.core.leave(id) : mpPeerGone(id)); MP.rtcLinks.set(id, send); MP.status = '새 참가자 연결됨'; if (UI.menu === 'mp_host') showMenu('mp_host'); };
  return MP.rtc.code;
}
async function mpAcceptAnswer(code) { if (!MP.rtc) throw new Error('먼저 초대 코드를 만드세요'); await MP.rtc.pc.setRemoteDescription({ type: 'answer', sdp: await mpUnpack(code) }); MP.rtc = null; }
function mpRtcHostLink() { MP.rtcLinks = new Map(); return { kind: 'rtc', send(o, to) { if (to != null) { const s = MP.rtcLinks.get(to); if (s) s(o); } else for (const s of MP.rtcLinks.values()) s(o); }, close() { MP.rtcLinks = new Map(); } }; }
// guest: paste the host's invite, hand back the answer; the channel opens once the host enters it
async function mpAnswerInvite(code) {
  const pc = new RTCPeerConnection(RTC_CFG);
  pc.ondatachannel = e => { const dc = e.channel; dc.onopen = () => { const send = rtcWire(dc, m => mpHandle(m, 0), () => mpLost('호스트와 연결이 끊겼습니다')); MP.link = { kind: 'rtc', send: o => send(o), close: () => { try { pc.close(); } catch (er) {} } }; MP.server = true; MP.rolePending = true; mpSend({ t: 'join', name: accName(), skin: mpSkin(), login: accLoginMsg() }); }; };
  await pc.setRemoteDescription({ type: 'offer', sdp: await mpUnpack(code) });
  await pc.setLocalDescription(await pc.createAnswer()); await iceDone(pc);
  MP.rtcGuest = pc; return mpPack(pc.localDescription.sdp);
}
const mpSend = (o, to) => { if (MP.link) MP.link.send(o, to); };
// a guest's request to whoever runs its dimension (the host, or in a server world the dimension's runner)
const mpToAuth = o => mpSend({ ...o, dim: o.dim != null ? o.dim : W.dim }, MP.server ? 'auth' : undefined);
const mpRelay = () => MP.role === 'host' && !MP.server; // a host passes guests' messages on; a server does that itself
const mpSkin = () => { // a custom skin travels as a small PNG
  const s = skinChoice(), out = { tex: s.tex === 'custom_skin' ? (s.slim ? 'alex' : 'steve') : s.tex, slim: s.slim };
  if (s.tex === 'custom_skin') { const c = entCanvas('custom_skin'); if (c) out.data = c.toDataURL('image/png'); }
  return out;
};
function mpSkinTex(p) { // another player's custom skin, decoded once into a pack texture of its own
  const sk = p.skin || {}; if (!sk.data || p.skinKey || typeof sk.data !== 'string' || !/^data:image\/png;base64,/.test(sk.data) || sk.data.length > 150000) return;
  p.skinKey = 'mp_skin_' + p.id + '_' + Date.now(); const img = new Image();
  img.onload = () => { if (img.width !== 64 || (img.height !== 64 && img.height !== 32)) return; const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    PACKPX.ent[p.skinKey] = { px: new Uint8Array(g.getImageData(0, 0, 64, 64).data.buffer), w: 64, h: 64 }; p.skinReady = true; mpDropAvatar(p); };
  img.src = sk.data;
}

// ---------- starting and stopping ----------
// your own world opened to others: this browser runs the world core (js/mpcore.js) on this world's IndexedDB, and
// you are its player 0; friends reach it through the relay server or WebRTC. Same rules as a server world: each
// dimension is run by a player there, so everyone can go anywhere.
async function mpHostStart(kind) {
  if (!W.active || W.meta.remote) throw new Error('먼저 세계에 들어가세요');
  const relay = kind === 'ws' ? await mpWebSocket($('mpAddr') ? $('mpAddr').value.trim() : mpDefaultAddr(), 'host', { name: MP.name, world: W.meta.name, mode: PL.mode }) : mpRtcHostLink();
  MP.roomCode = relay.hello && relay.hello.room || null; MP.addr = kind === 'ws' ? ($('mpAddr') ? $('mpAddr').value.trim() : mpDefaultAddr()) : null;
  saveAll(true); await new Promise(r => setTimeout(r, 300));
  W.mpLogs = await mpLogKeys(W.id);
  Object.assign(MP, { on: true, server: true, isHost: true, role: 'guest', rolePending: true, id: 0, eid: 1, auth: {}, queue: [], relay, inbox: [] }); MP.peers.clear();
  MP.store = mpHostStore(); MP.core = mpWorldCore(MP.store, mpCoreOut);
  MP.link = { kind: 'local', send(o, to) { MP.core.message(0, to != null ? { ...o, to } : { ...o }); }, close() {} };
  MP.timers = [setInterval(() => MP.core && MP.core.tick(), 1000), setInterval(() => MP.store && MP.store.flush(), 3000)];
  mpInstall(); mpSend({ t: 'join', name: accName(), skin: mpSkin(), login: accLoginMsg() });
  chatMsg(MP.roomCode ? `멀티플레이가 열렸습니다 · 방 코드 ${MP.roomCode} — 친구는 타이틀 → 멀티플레이 목록에서 "${MP.name}님의 세계"를 누르면 들어와요` : '멀티플레이가 열렸습니다. 친구가 참가할 수 있어요.', '#ffff55');
}
// the core's messages: to you (in order, after the current one), or out to a guest
function mpCoreOut(id, o) {
  if (id !== 0) { if (MP.relay) MP.relay.send(o, id); return; }
  MP.inbox.push(o); if (MP.inbox.length === 1) Promise.resolve().then(() => { const l = MP.inbox; MP.inbox = []; for (const m of l) mpHandle(m, m.from); });
}
const mpLogKeys = async id => new Set(((await dbReq('chunks', 'readonly', st => st.getAllKeys(IDBKeyRange.bound('mplog:' + id + ':', 'mplog:' + id + ':￿')))) || []).map(k => k.slice(('mplog:' + id + ':').length)));
// the world core's storage in this browser: the world's own chunk records, plus the changes made since each was stored
function mpHostStore() {
  const id = W.id, logKey = dk => 'mplog:' + id + ':' + dk, dirty = new Map(), sh = {}; for (const k of MP_SHARED) if (W.meta[k] !== undefined) sh[k] = W.meta[k];
  const state = { meta: { name: W.meta.name, seed: W.seed, gen: W.gen || 1, my: MINY, exp: W.exp, mode: W.meta.mode === 'creative' ? 'creative' : 'survival', diff: PL.difficulty, cheats: W.cheats, spawn: W.worldSpawn, gamerules: W.meta.gamerules || {}, shared: sh },
    time: W.time, rain: W.rainTarget, thunder: W.thunderOn, weatherT: 24000, players: W.meta.mpPlayers || (W.meta.mpPlayers = {}) };
  const toNet = r => { if (!r || typeof r !== 'object') return null; // (dbReq gives true for a missing key) if (!r.b) return { v: 2, it: r.it, mobs: r.mobs || null };
    let b = r.b, m = r.m, l = r.l; const h = r.ch || 128; if (r.v < 3) { const n = 256 * h, dec = a => r.v >= 2 ? rleDec(a, n, Uint8Array) : a; b = rleEnc(Uint16Array.from(dec(b))); m = rleEnc(dec(m)); l = rleEnc(dec(l)); } // older saves: 8-bit ids
    return { v: 3, it: r.it, ch: h, my: r.my, b: mpB64(b), m: mpB64(m), l: mpB64(l), bio: Array.from(r.bio), t: r.t || [], mobs: r.mobs || null }; };
  const fromNet = r => r.b ? { v: 3, it: r.it, ch: r.ch, my: r.my, b: mpUnB64(r.b, Uint16Array), m: mpUnB64(r.m, Uint8Array), l: mpUnB64(r.l, Uint8Array), bio: Uint8Array.from(r.bio), t: r.t || [], mobs: r.mobs || null } : { v: 2, it: r.it, mobs: r.mobs || null };
  return { state, keys: new Set([...W.saved, ...(W.mpLogs || [])]),
    async load(dk) { const rec = await dbReq('chunks', 'readonly', st => st.get(id + ':' + dk)), lg = await dbReq('chunks', 'readonly', st => st.get(logKey(dk))); const ok = lg && typeof lg === 'object'; return { rec: toNet(rec), edits: ok && lg.edits || [], tiles: ok && lg.tiles || {} }; },
    save(dk, c) { dirty.set(dk, c); },
    saveState() { W.meta.mpPlayers = state.players; for (const k in state.meta.shared) W.meta[k] = state.meta.shared[k]; if (state.meta.gamerules) W.meta.gamerules = state.meta.gamerules; },
    log(t) { if (/접속|나감/.test(t)) return; chatMsg(t, '#aaaaaa'); },
    async flush() { const l = [...dirty]; dirty.clear();
      for (const [dk, c] of l) {
        if (c.recChanged && c.rec) { c.recChanged = false; const rec = fromNet(c.rec); await dbReq('chunks', 'readwrite', st => st.put(rec, id + ':' + dk)); W.saved.add(dk); }
        if (c.edits.length || Object.keys(c.tiles).length) { await dbReq('chunks', 'readwrite', st => st.put({ edits: c.edits, tiles: c.tiles }, logKey(dk))); (W.mpLogs || (W.mpLogs = new Set())).add(dk); }
        else { await dbReq('chunks', 'readwrite', st => st.delete(logKey(dk))); if (W.mpLogs) W.mpLogs.delete(dk); }
      } } };
}
function mpHostWelcome(m) { MP.id = m.you; MP.auth = m.auth || {}; for (const q of m.players) MP.peers.set(q.id, { id: q.id, name: q.name, skin: q.skin, s: null }); mpSend({ t: 'dim', dim: W.dim }); }
// ---------- this browser's copy of a server world ----------
// The server sends what changes (and, on joining, what this copy lacks); everything is kept per server address in
// IndexedDB ('nemo-mirror'), one copy per world of each server. If the server comes back without a world (a free host
// wipes its disk on restart), opening it puts the copy back. Records ('host|world' is MIR.host):
// 'S|host|world' -> { wid, state, vers: { dk: version } }, 'C|host|world|dk' -> chunk entry.
const MIR = { host: null, known: new Map(), rec: null, busy: Promise.resolve() }; // known: 'host|world' -> world name
const mirHost = url => { try { return new URL(mpWsUrl(url)).host; } catch (e) { return String(url || ''); } };
function mirDB() { return MIR.db || (MIR.db = new Promise((res, rej) => { const q = indexedDB.open('nemo-mirror', 1); q.onupgradeneeded = () => q.result.createObjectStore('c'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); })); }
async function mirTx(mode, f) { const db = await mirDB(); return new Promise((res, rej) => { const t = db.transaction('c', mode), st = t.objectStore('c'), r = f(st); t.oncomplete = () => res(r && 'result' in r ? r.result : undefined); t.onerror = () => rej(t.error); }); }
const mirGet = k => mirTx('readonly', st => st.get(k)).catch(() => null);
mirTx('readonly', st => st.getAll(IDBKeyRange.bound('S|', 'S|\uffff'))).then(l => { for (const r of l || []) if (r && r.host && r.state && r.state.meta) MIR.known.set(r.host, r.state.meta.name); }).catch(() => {});
function mirSave(m) { // queued: copies arrive faster than IndexedDB writes them
  const host = MIR.host; if (!host || !m.wid) return;
  MIR.busy = MIR.busy.then(async () => {
    let rec = MIR.rec && MIR.rec.host === host ? MIR.rec : await mirGet('S|' + host);
    if (!rec || rec.wid !== m.wid || m.reset) { // another world than the one copied before: start over
      if (rec) { const ks = await mirTx('readonly', st => st.getAllKeys(IDBKeyRange.bound('C|' + host + '|', 'C|' + host + '|\uffff'))); await mirTx('readwrite', st => { for (const k of ks || []) st.delete(k); }); }
      rec = { host, wid: m.wid, state: null, vers: {} };
    }
    if (m.state) rec.state = m.state; for (const [dk, v] of m.l || []) rec.vers[dk] = v; rec.at = Date.now(); MIR.rec = rec;
    await mirTx('readwrite', st => { for (const [dk, , e] of m.l || []) st.put(e, 'C|' + host + '|' + dk); st.put(rec, 'S|' + host); });
    if (rec.state && rec.state.meta) MIR.known.set(host, rec.state.meta.name);
  }).catch(e => console.warn('서버 세계 사본 저장 실패', e));
}
async function mirHave() { const rec = await mirGet('S|' + MIR.host); mpSend({ t: 'mirrorhave', wid: rec ? rec.wid : null, vers: rec ? rec.vers : {} }); }
// the server is empty and this browser has a copy of its world: send it all back
async function mirRestore(host) {
  const rec = await mirGet('S|' + host); if (!rec || !rec.state || !rec.state.meta) return false;
  const say = t => { MP.status = t; const el = $('mpStatus'); if (el) el.textContent = t; };
  mpSend({ t: 'restore', part: 'begin', state: rec.state });
  const dks = Object.keys(rec.vers); let n = 0;
  for (let i = 0; i < dks.length; i += 8) {
    const l = []; for (const dk of dks.slice(i, i + 8)) { const e = await mirGet('C|' + host + '|' + dk); if (e) l.push([dk, rec.vers[dk], e]); }
    mpSend({ t: 'restore', part: 'chunk', l }); n += l.length; say(`서버 세계를 되살리는 중... ${n}/${dks.length}`); await new Promise(r => setTimeout(r, 20));
  }
  mpSend({ t: 'restore', part: 'end' }); return true;
}
// room: a player's open world by its code; world: a server world by its id ('+' makes a new one)
async function mpJoinWs(url, room, world) {
  MP.role = 'guest'; MP.on = true; MP.peers.clear(); MP.server = false; MP.auth = {};
  try { MP.link = await mpWebSocket(url, 'join', room ? { room } : world === '+' ? { newWorld: true } : world ? { world } : null); } catch (e) { MP.on = false; MP.role = null; throw e; }
  MP.roomCode = MP.link.hello.kind === 'guest' ? MP.link.hello.room || null : null;
  mpInstall();
  MP.server = true; MP.rolePending = true; // a server world, or a player's world (that runs the same world core in its browser)
  MIR.host = MP.link.hello.kind === 'world' ? mirHost(url) + '|' + (MP.link.hello.wid || 'world') : null; MP.worldId = MP.link.hello.wid || null;
  if (MP.link.hello.kind === 'world' && !MP.link.hello.world) { if (await mirRestore(MIR.host)) return 'restoring'; showMenu('mp_create'); return 'noworld'; } // 'restored' then joins
  mpSend({ t: 'join', name: accName(), skin: mpSkin(), login: accLoginMsg() });
}
function mpStop() {
  if (!MP.on) return;
  const host = MP.isHost, ran = MP.role === 'host', st = MP.store;
  if (MP.server) mpServerLeave(host); else if (MP.role === 'host') mpSend({ t: 'bye' }); else { mpGuestSave(); mpSend({ t: 'leave' }); }
  if (host) { for (const id of MP.core.players.keys()) if (id !== 0) MP.relay.send({ t: 'bye' }, id); for (const t of MP.timers || []) clearInterval(t); MP.core.store = null;
    setTimeout(() => { st.flush(); setTimeout(() => st.flush(), 500); }, 50); try { MP.relay.close(); } catch (e) {} MP.relay = null; MP.core = null; MP.store = null; MP.isHost = false; }
  if (MP.link) { const l = MP.link; if (MP.server && MIR.host) { const done = () => { if (MIR.closing === done) MIR.closing = null; l.close(); }; MIR.closing = done; l.send({ t: 'flush' }); setTimeout(done, 5000); } else if (MP.server) setTimeout(() => l.close(), 600); else l.close(); } /* a server world: wait for the final copy */ MP.link = null; /* the last stored chunks get through before the connection closes */ if (MP.rtcGuest) { try { MP.rtcGuest.close(); } catch (e) {} MP.rtcGuest = null; }
  for (const p of MP.peers.values()) mpDropAvatar(p); MP.peers.clear();
  for (const e of ENT) if (e.remote) removeEnt(e);
  MP.on = false; MP.role = null; MP.rtc = null; MP.server = false; MP.roomCode = null; MP.auth = {}; MP.rolePending = false; MP.queue = [];
  if (host && !ran && W.active) mpDropChunks(); // you were following someone else's run of this dimension
}
function mpLost(why) {
  if (!MP.on) return; const guest = MP.role === 'guest'; mpStop(); chatMsg(why, '#ff5555');
  if (guest && W.active) { quitToTitle(); UI.flash(why); }
}
function mpPeerGone(id) { const p = MP.peers.get(id); if (!p) return; mpDropAvatar(p); mpDropPeerFx(p); if (p.skinKey) { if (entTex[p.skinKey]) { entTex[p.skinKey].dispose(); delete entTex[p.skinKey]; } delete PACKPX.ent[p.skinKey]; } MP.peers.delete(id); chatMsg(p.name + '님이 나갔습니다', '#ffff55'); if (mpRelay()) mpSend({ t: 'gone', id }); }

// ---------- message handling ----------
function mpHandle(m, from) {
  const host = MP.role === 'host';
  switch (m.t) {
    case 'join': if (!host || MP.server) return; { // a new guest: hand over the world's seed, clock and what has been edited
      const p = { id: from, name: String(m.name || '손님').slice(0, 16), skin: m.skin || { tex: 'steve', slim: false }, s: null }; MP.peers.set(from, p);
      const edited = [...W.saved]; for (const c of W.chunks.values()) if (c.edited) edited.push(dkey(c.cx, c.cz));
      mpSend({ t: 'welcome', you: from, seed: W.seed, gen: W.gen || 1, exp: W.exp, mode: PL.mode === 'hardcore' ? 'survival' : PL.mode, diff: PL.difficulty, time: W.time, rain: W.rain, thunder: W.thunderOn, dim: W.dim,
        at: [PL.x, PL.y, PL.z], spawn: W.worldSpawn, edited: [...new Set(edited)], host: { name: MP.name, skin: mpSkin() }, players: [...MP.peers.values()].filter(q => q.id !== from).map(q => ({ id: q.id, name: q.name, skin: q.skin })), gr: W.meta.gamerules || null }, from);
      mpSend({ t: 'peer', id: from, name: p.name, skin: p.skin }); chatMsg(p.name + '님이 참가했습니다', '#ffff55'); if (UI.menu === 'mp_host') showMenu('mp_host'); return;
    }
    case 'welcome': if (MP.isHost) mpHostWelcome(m); else if (MP.server) mpEnterServerWorld(m); else if (!host) mpEnterHostWorld(m); return;
    case 'noworld': showMenu('mp_create'); return;
    case 'created': case 'restored': if (m.t === 'restored') chatMsg('저장해 둔 사본으로 서버 세계를 되살렸습니다', '#55ff55'); mpSend({ t: 'join', name: accName(), skin: mpSkin(), login: accLoginMsg() }); return;
    case 'mirror': mirSave(m); return;
    case 'flushed': if (MIR.closing) MIR.closing(); return;
    case 'auth': mpGotAuth(m.dim, m.id); return;
    case 'stored': W.saved.add(m.dk); return;
    case 'chunkmobs': if (host) mpRestoreMobs(m.l); return;
    case 'peer': if (m.id === MP.id) return; MP.peers.set(m.id, { id: m.id, name: m.name, skin: m.skin, s: null }); chatMsg(m.name + '님이 참가했습니다', '#ffff55'); return;
    case 'gone': mpPeerGone(m.id); return;
    case 'leave': if (host) mpPeerGone(from); return;
    case 'bye': mpLost('호스트가 세계를 닫았습니다'); return;
    case 'pl': { const id = MP.server ? m.from : host ? from : m.id; if (id === MP.id) return; const p = MP.peers.get(id); if (!p) return; p.s = m; p.at = performance.now(); (p.hist || (p.hist = [])).push([p.at, +m.x, +m.y, +m.z]); if (p.hist.length > 6) p.hist.shift(); if (mpRelay()) mpSend({ ...m, id }); return; }
    case 'chat': chatMsg('<' + String(m.name).slice(0, 16) + '> ' + String(m.text).slice(0, 256)); if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id); return;
    case 'set': mpApplySet(m); return;
    case 'proj': mpGotProj(m, from); return;
    case 'deco': mpGotDeco(m, from); return;
    case 'tie': if (host && [m.x, m.y, m.z].every(Number.isInteger) && FENCES.has(getBlock(m.x, m.y, m.z))) { const id = MP.server ? m.from : from; for (const e of ENT) if (e.leash && e.leash.p === id && !e.dead) e.leash = [m.x, m.y, m.z]; } return; // a guest ties up what it leads
    case 'splash': mpGotSplash(m, from); return;
    case 'fw': if (m.dim === W.dim && [m.x, m.y, m.z].every(isFinite)) { MP.fwIn = true; try { launchRocket(+m.x, +m.y, +m.z, { fw: m.fw && typeof m.fw === 'object' ? m.fw : null }, false, Array.isArray(m.shot) && m.shot.length === 3 && m.shot.every(isFinite) ? m.shot.map(Number) : null); if (ROCKETS.length) ROCKETS[ROCKETS.length - 1].remote = true; } finally { MP.fwIn = false; } } if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id); return; // its stars hurt only what is here, the sender's mobs stay theirs
    case 'adv': if (!host || MP.server) { if (typeof m.id === 'string' && ADVM[m.id]) advGrant(m.id, m.crit == null ? undefined : String(m.crit)); } return;
    case 'boom': mpGotBoom(m, from); return;
    case 'primed': mpGotPrimed(m, from); return;
    case 'prime': if (host && [m.x, m.y, m.z].every(isFinite)) { primeTNT(Math.floor(m.x), Math.floor(m.y), Math.floor(m.z), Math.max(1, Math.min(200, +m.fuse || 80))); } return;
    case 'blast': if (host && [m.x, m.y, m.z, m.p].every(isFinite)) explode(+m.x, +m.y, +m.z, Math.max(0.5, Math.min(6, +m.p)), !!m.fire); return;
    case 'setl': if (Array.isArray(m.l)) mpApplyGuestSets(m.l.slice(0, 4096).filter(e => e && e.dim === m.dim)); return;
    case 'sets': if (!host) mpApplySets(m); return;
    case 'chunk': if (host && !MP.server) mpServeChunk(m, from); return;
    case 'chunkdata': if (!host || MP.server) mpGotChunk(m); return;
    case 'time': if (host && !MP.server) return; if (Math.abs(W.time - m.time) > 30) W.time = m.time; W.rainTarget = m.rain; if (Math.abs(W.rain - m.rain) > 0.5) W.rain = m.rain; W.thunderOn = m.thunder; return;
    case 'mobs': if (!host) mpMirrorMobs(m.l); return;
    case 'hurt': if (!host) hurtPlayer(+m.dmg || 0, m.cause || 'mob'); return; // the host's mobs hit this guest
    case 'kb': if (!host) { PL.vx += +m.vx || 0; PL.vy += +m.vy || 0; PL.vz += +m.vz || 0; } return;
    case 'eff': if (!host && EFF[m.k]) addEffect(PL, m.k, m.dur, m.lv); return;
    case 'tile': mpApplyTile(m, from); return;
    case 'tslots': if (host) mpTileSlots(m, from); return;
    case 'tilefix': if (!host) mpTileFix(m); return;
    case 'unride': if (!host && PL.riding && PL.riding.remote && PL.riding.rid === m.e) { const e = PL.riding;
      if (m.seat !== 2 && e.rider2 === PL) return; // an older refusal of the front seat: already in the back
      if (m.seat !== 2 && e.kind === 'boat' && e.rider === PL && !e.seat2Other && !e.mob) { e.rider = 'other'; e.rider2 = PL; e.mpWas = false; UI.flash('뒷자리에 탔습니다'); } // both got on at once: the back seat
      else { dismount(); UI.flash('다른 플레이어가 이미 타고 있습니다'); } } return;
    case 'items': if (!host) mpMirrorItems(m.l); return;
    case 'fx': if (!host && Array.isArray(m.l)) mpMirrorFx(m.l); return;
    case 'deflect': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'fireball'), p = MP.peers.get(from), d = Array.isArray(m.d) && m.d.length === 3 && m.d.every(isFinite) ? m.d : null; if (e && p && d) { e.ax = d[0] * 0.1; e.ay = d[1] * 0.1; e.az = d[2] * 0.1; e.vx = d[0]; e.vy = d[1]; e.vz = d[2]; e.owner = PL; e.guestOwner = p; } } return; // a guest bats a ghast's fireball back
    case 'bfx': mpGotBfx(m, from); return;
    case 'pull': { const v = [m.vx, m.vy, m.vz].map(Number); if (!v.every(isFinite) || v.some(x => Math.abs(x) > 4)) return;
      if (m.e != null) { if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'mob'); if (e) { e.vx = (e.vx || 0) + v[0]; e.vy = (e.vy || 0) + v[1]; e.vz = (e.vz || 0) + v[2]; } } return; } // a guest's fishing rod pulls the runner's mob
      if (m.tgt != null && m.tgt !== MP.id && mpRelay()) { mpSend({ ...m }, m.tgt); return; } // the host passes a guest's pull on
      PL.vx += v[0]; PL.vy += v[1]; PL.vz += v[2]; return; } // someone reeled you in
    case 'snd': if (m.dim === W.dim && [m.x, m.y, m.z].every(isFinite) && typeof m.n === 'string') { const d = Math.hypot(PL.x - m.x, PL.y - m.y, PL.z - m.z), o = m.o && typeof m.o === 'object' ? m.o : {}; if (d < 16) { MP.sndIn = true; try { play(m.n, { mat: o.mat, pitch: isFinite(o.pitch) ? +o.pitch : undefined, vol: (isFinite(o.vol) ? +o.vol : 1) * (1 - d / 16) }); } finally { MP.sndIn = false; } } } if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id); return;
    case 'bolt': if (!host && m.dim === W.dim && [m.x, m.y, m.z].every(isFinite)) mpBoltFx(+m.x, +m.y, +m.z); return;
    case 'strike': if (host && m.dim === W.dim && [m.x, m.y, m.z].every(Number.isInteger)) strikeLightning(m.x, m.y, m.z, !!m.rod); return;
    case 'ignite': if (!host) PL.fire = Math.max(PL.fire || 0, Math.min(200, +m.f || 0)); return;
    case 'xps': if (!host) mpMirrorXP(m.l); return;
    case 'xp': if (host) spawnXP(+m.x, +m.y, +m.z, Math.min(2000, +m.v || 0)); return;
    case 'pickxp': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'xp'); if (e) { removeEnt(e); mpSend({ t: 'givexp', v: e.value }, from); } } return;
    case 'givexp': if (!host) { addXP(Math.min(2000, +m.v || 0)); play('xp', { vol: 0.3 }); } return;
    case 'drop': if (host && m.st && ITEMS[m.st.id]) { const e = dropItem(m.x, m.y, m.z, m.st.id, m.st.n, m.vel, Math.min(60, +m.delay || 10), m.st.d, m.st); if (e) e.from = from; } return;
    case 'pick': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'item'); if (e) { removeEnt(e); mpSend({ t: 'give', st: e.stack }, from); } } return;
    case 'give': if (!host && m.st && ITEMS[m.st.id]) { INV.giveOrDrop({ ...m.st }); play('pop', { vol: 0.4 }); UI.hudDirty = true; } return;
    case 'hit': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead), p = MP.peers.get(from), hit = () => hurtMob(e, Math.min(30, +m.dmg || 0), PL, +m.kx || 0, +m.kz || 0, 'player');
      if (e) { if (p && p.s) mpProxy(p, hit); else hit(); } } return; // a kill by a guest counts as a player's kill (experience, player-only drops), and the mob turns on that guest
    case 'pvp': if (mpRelay() && m.tgt !== 0) { mpSend({ ...m, from }, m.tgt); return; } mpGotHit(m, MP.peers.get(MP.server ? m.from : host ? from : m.from)); return;
    case 'hitfx': { const p = MP.peers.get(MP.server ? m.from : host ? from : m.id); if (p) p.hurtFx = 10; if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend({ ...m, id: from }, id); return; }
    case 'use': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead), p = MP.peers.get(from); if (e && p && p.s) mpRemoteUse(p, e, m.st && ITEMS[m.st.id] ? m.st : null, m.sneak); } return;
    case 'trades': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'mob'); if (e && (e.type === 'villager' || e.type === 'wandering_trader')) { if (e.type === 'wandering_trader') e.prof = 'wandering'; mpSend({ t: 'tradelist', e: m.e, l: villagerOffers(e).map(o => ({ ...o, made: null })) }, from); } } return;
    case 'tradelist': if (!host) { const e = ENT.find(q => q.remote && q.rid === m.e && !q.dead); if (e && Array.isArray(m.l)) { e.trades = m.l; if (UI.screen && GUI.type === 'trade' && GUI.ctx && GUI.ctx.e === e) UI.renderScreen(); } } return;
    case 'traded': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'mob'), o = e && e.trades && e.trades[+m.i]; if (o && o.uses < o.max) { o.uses++; o.e = null; o.made = null; e.traded = true; e.rep = Math.min(150, (e.rep || 0) + 2); } } return;
    case 'cartinv': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'minecart' && q.items); if (e) { if (typeof cartFillLoot === 'function') cartFillLoot(e); mpSend({ t: 'cartitems', e: m.e, items: e.items }, from); } } return;
    case 'cartitems': if (!host) { const e = ENT.find(q => q.remote && q.rid === m.e && !q.dead && q.kind === 'minecart'); if (e && e.items && Array.isArray(m.items)) { for (let i = 0; i < e.items.length; i++) { const st = m.items[i]; e.items[i] = st && ITEMS[st.id] ? st : null; } e.loot = null; if (UI.screen && GUI.ctx && GUI.ctx.cart === e) UI.renderScreen(); } } return;
    case 'cartset': if (host && Array.isArray(m.items)) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'minecart' && q.items); if (e) { e.loot = null; for (let i = 0; i < e.items.length; i++) { const st = m.items[i]; e.items[i] = st && ITEMS[st.id] ? st : null; } if (UI.screen && GUI.ctx && GUI.ctx.cart === e) UI.renderScreen(); } } return;
    case 'gear': if (host && Array.isArray(m.gear)) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'mob'); if (e && typeof horseGearChanged === 'function') { e.gear = [0, 1].map(i => m.gear[i] && ITEMS[m.gear[i].id] ? m.gear[i] : null); horseGearChanged(e); } } return;
    case 'summon': if (host && MOBDEF[m.type] && m.type !== 'player' && isFinite(m.x) && isFinite(m.y) && isFinite(m.z)) { const o = m.o && typeof m.o === 'object' ? m.o : {}, e = spawnMob(m.type, +m.x, +m.y, +m.z, { baby: !!o.baby, variant: o.variant, size: +o.size || undefined, vtype: o.vtype, prof: o.prof });
      if (e) { for (const k of MP_SUMMON_KEYS) if (k !== 'baby' && o[k] != null && typeof o[k] !== 'object') e[k] = k === 'hp' ? Math.max(1, Math.min(e.hp, +o[k] || e.hp)) : o[k]; if (o.baby) e.baby = 24000; } } return;
    case 'killall': if (host) for (const e of [...ENT]) if (e.kind === 'mob' && !e.dead && !e.remote && (!m.type || e.type === m.type)) removeEnt(e); return;
    case 'held': if (!host) { const h = INV.slots[INV.sel]; if ((h ? h.id : 0) === m.was) { INV.slots[INV.sel] = m.st && ITEMS[m.st.id] ? m.st : null; UI.hudDirty = true; } } return;
    case 'vehs': if (!host) mpMirrorVehicles(m.l); return;
    case 'veh': if (host) { MP.allowSpawn = true; try { if (m.kind === 'boat') placeBoat(+m.x, +m.y, +m.z, +m.yaw || 0, String(m.sub || 'oak')); else if (m.kind === 'minecart') spawnMinecart(+m.x, +m.y, +m.z, String(m.sub || 'minecart'), { yaw: +m.yaw || 0 }); } finally { MP.allowSpawn = false; } } return;
    case 'vhit': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.onHit), p = MP.peers.get(from); if (e) { if (p && p.s) mpProxy(p, () => e.onHit(e)); else e.onHit(e); } } return;
    case 'ride2': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead); if (e) mpRidden2(e, m, from); } return;
    case 'ride': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead); if (e) mpRidden(e, m, from); } return;
    case 'tame': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'mob'); if (e && typeof horseTame === 'function' && e.owner !== 'player') horseTame(e); } return;
    case 'sys': chatMsg(String(m.text).slice(0, 256), /^#[0-9a-f]{3,6}$/i.test(m.c || '') ? m.c : '#ffffff'); if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id); return;
    case 'wake': if ((!host || MP.server) && PL.sleeping) { PL.rest = 0; wakeUp('좋은 아침이에요!'); } return;
  }
}
// a guest becomes a visitor in the host's world: same seed, nothing saved locally
async function mpEnterHostWorld(m) {
  MP.id = m.you;
  MP.peers.set(0, { id: 0, name: m.host.name, skin: m.host.skin, s: null });
  for (const q of m.players) MP.peers.set(q.id, { id: q.id, name: q.name, skin: q.skin, s: null });
  const meta = { id: 'mp-' + Date.now(), name: m.host.name + '의 세계', seed: m.seed, gen: m.gen || 1, mode: m.mode, diff: m.diff, cheats: false, exp: m.exp, spawn: m.spawn, remote: true, gamerules: m.gr, dim: 0 };
  await startWorld(meta.id, meta);
  if (m.dim !== W.dim && typeof switchDim === 'function') { /* guests start where the host's world spawns */ }
  W.saved = new Set(m.edited); W.time = m.time; W.rain = W.rainTarget = m.rain; W.thunderOn = m.thunder;
  if (m.dim === W.dim) { PL.x = m.at[0] + 1.5; PL.y = m.at[1] + 0.5; PL.z = m.at[2] + 0.5; PL.px = PL.x; PL.py = PL.y; PL.pz = PL.z; W.needSpawnFix = false; }
  MP.saveKey = 'nemo-mp-guest:' + m.seed + ':' + m.host.name; mpGuestLoad(m.dim);
  chatMsg(m.host.name + '님의 세계에 참가했습니다', '#ffff55');
}
// a guest's inventory, health and place are kept on the guest's device for that host's world
function mpGuestSave() {
  if (MP.role !== 'guest' || !MP.saveKey || !W.active) return;
  const s = {}; for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'health', 'food', 'sat', 'level', 'xpP', 'xpTotal']) s[k] = PL[k];
  try { localStorage.setItem(MP.saveKey, JSON.stringify({ s, dim: W.dim, inv: INV.slots, armor: INV.armor, off: INV.off, sel: INV.sel })); } catch (e) {}
}
function mpGuestLoad(dim) {
  let d = null; try { d = JSON.parse(localStorage.getItem(MP.saveKey)); } catch (e) {} if (!d) return;
  const ok = st => st && ITEMS[st.id] ? st : null;
  INV.slots = d.inv.map(ok); while (INV.slots.length < 36) INV.slots.push(null); INV.armor = (d.armor || []).map(ok); while (INV.armor.length < 4) INV.armor.push(null); INV.off = ok(d.off); INV.sel = d.sel || 0;
  const { x, y, z, ...rest } = d.s; Object.assign(PL, rest); if (d.dim === dim) { PL.x = x; PL.y = y; PL.z = z; PL.px = x; PL.py = y; PL.pz = z; }
  UI.hudDirty = true;
}
// containers: whoever changes a chest / furnace / hopper... sends its contents; the host keeps them
function mpTileChanged(x, y, z) { const t = getTile(x, y, z); if (t) mpSend({ t: 'tile', x, y, z, dim: W.dim, dk: dkey(x >> 4, z >> 4), tile: JSON.parse(JSON.stringify(t)) }); }
function mpApplyTile(m, from) {
  if (m.tile && m.tile._mp) delete m.tile._mp;
  const host = MP.role === 'host', c = m.dim === W.dim && chunkAt(m.x >> 4, m.z >> 4), i = BI(m.x, m.y, m.z);
  if (c) { const old = c.tiles.get(i);
    if (old) { for (const k of Object.keys(old)) if (!(k in m.tile)) delete old[k];
      // arrays are filled in place: an open screen's slots point at them
      for (const k of Object.keys(m.tile)) { const a = old[k], b = m.tile[k]; if (Array.isArray(a) && Array.isArray(b)) { a.length = b.length; for (let j = 0; j < b.length; j++) a[j] = b[j]; } else old[k] = b; } }
    else c.tiles.set(i, m.tile);
    c.modified = c.edited = true; if (/^(furnace|brewing|campfire)$/.test(m.tile.type)) c.hasFurnace = true; // so it keeps working here
    if (GUI.ctx && GUI.ctx.x === m.x && GUI.ctx.y === m.y && GUI.ctx.z === m.z) { GUI.ctx.mpBase = mpJ(c.tiles.get(i)); if (UI.screen) UI.renderScreen(); }
    if (m.tile.type === 'jukebox') { const t = c.tiles.get(i), k = m.x + ',' + m.y + ',' + m.z, st = t.items && t.items[0]; // someone else's record: heard here too
      if (t.playing && st && ITEMS[st.id] && ITEMS[st.id].disc) { if (!PLAYING.has(k)) playDisc(ITEMS[st.id].key.replace('music_disc_', ''), m.x, m.y, m.z); } else stopDisc(m.x, m.y, m.z); } }
  else if (host && !MP.server) { const T = W.meta.mpTiles || (W.meta.mpTiles = {}); (T[m.dk] || (T[m.dk] = {}))[i] = m.tile; }
  if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id);
}
// a guest's clicks in a container go to the dimension's runner as slot changes ("slot k was A, is now B"); the runner
// takes them only if every slot still holds what the guest saw, so two players can't both take the same stack. A
// refused change comes back with the real contents and the guest's inventory is put back as it was
const MP_TSENT = new WeakMap(); // what a runner last sent of each working furnace / brewing stand
const mpJ = v => v == null ? null : JSON.parse(JSON.stringify(v));
const mpCanon = v => JSON.stringify(v == null ? null : v, (k, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(q => [q, x[q]])) : x);
const mpStEq = (a, b) => mpCanon(a || null) === mpCanon(b || null);
function mpTileEdit(c) {
  const t = getTile(c.x, c.y, c.z); if (!t) return;
  const base = c.mpBase;
  if (!base || !Array.isArray(t.items) || !Array.isArray(base.items) || base.items.length !== t.items.length) { mpTileChanged(c.x, c.y, c.z); c.mpBase = mpJ(t); return; }
  const ch = [], rest = {};
  t.items.forEach((st, k) => { if (!mpStEq(st, base.items[k])) ch.push([k, mpJ(base.items[k]), mpJ(st)]); });
  for (const k of Object.keys(t)) if (k !== 'items' && mpCanon(t[k]) !== mpCanon(base[k])) rest[k] = mpJ(t[k]);
  c.mpBase = mpJ(t);
  if (ch.length || Object.keys(rest).length) mpToAuth({ t: 'tslots', x: c.x, y: c.y, z: c.z, dk: dkey(c.x >> 4, c.z >> 4), ch, rest, tile: mpJ(t) });
}
function mpTileSlots(m, from) {
  if (!Array.isArray(m.ch)) return;
  const c = m.dim === W.dim && chunkAt(m.x >> 4, m.z >> 4), i = BI(m.x, m.y, m.z), t = c && c.tiles.get(i);
  const msg = tile => ({ t: 'tile', x: m.x, y: m.y, z: m.z, dim: m.dim, dk: m.dk, tile });
  if (!t || !Array.isArray(t.items)) { if (m.tile) { if (c) mpApplyTile(msg(m.tile), from); if (MP.server || !c) mpSend(msg(m.tile)); } return; } // not here to check: the guest's copy
  if (m.ch.some(([k, before]) => k < 0 || k >= t.items.length || !mpStEq(t.items[k], before))) { mpSend({ t: 'tilefix', x: m.x, y: m.y, z: m.z, dim: m.dim, dk: m.dk, tile: mpJ(t), ch: m.ch }, from); return; }
  for (const [k, , after] of m.ch) t.items[k] = after && ITEMS[after.id] ? after : null;
  if (m.rest) for (const k of Object.keys(m.rest)) if (k !== 'type') t[k] = m.rest[k];
  c.modified = c.edited = true;
  if (GUI.ctx && GUI.ctx.x === m.x && GUI.ctx.y === m.y && GUI.ctx.z === m.z) { GUI.ctx.mpBase = mpJ(t); if (UI.screen) UI.renderScreen(); }
  if (typeof rsNotify === 'function') rsNotify(m.x, m.y, m.z);
  mpSend(msg(mpJ(t))); // everyone (the guest too) gets what the chest now holds
}
function mpTileFix(m) {
  // undo what the refused clicks moved: whatever left the chest went to this player, whatever went in came from them
  const net = new Map();
  for (const [, b, a] of m.ch) for (const [st, sg] of [[b, 1], [a, -1]]) if (st) { const k = mpCanon({ ...st, n: 0 }), o = net.get(k) || { st, n: 0 }; o.n += sg * st.n; net.set(k, o); }
  for (const { st, n } of net.values()) {
    if (n < 0) { INV.giveOrDrop({ ...mpJ(st), n: -n }); continue; }
    let left = n; const take = (arr, j) => { const s = arr[j]; if (left <= 0 || !s || !mpStEq({ ...s, n: 0 }, { ...st, n: 0 })) return; const q = Math.min(left, s.n); s.n -= q; left -= q; if (!s.n) arr[j] = null; };
    const cur = [INV.cursor]; take(cur, 0); INV.cursor = cur[0];
    for (let j = 0; j < INV.slots.length && left > 0; j++) take(INV.slots, j);
  }
  mpApplyTile({ ...m, t: 'tile' }, null); UI.hudDirty = true;
}
// the host's dropped items, mirrored to guests: a guest walking over one asks the host for it
function mpMirrorItems(l) {
  const seen = new Set();
  for (const [id, st, x, y, z] of l) {
    seen.add(id); let e = ENT.find(q => q.remote && q.rid === id && !q.dead && q.kind === 'item');
    if (!e && st && ITEMS[st.id]) { MP.allowSpawn = true; try { e = dropItem(x, y, z, st.id, st.n, [0, 0, 0], 9999, st.d, st); } finally { MP.allowSpawn = false; } if (!e) continue; e.remote = true; e.rid = id; e.tick = mpPuppetItem; }
    if (e) { e.tx = x; e.ty = y; e.tz = z; }
  }
  for (const e of ENT) if (e.remote && e.kind === 'item' && !e.dead && !seen.has(e.rid)) removeEnt(e);
}
function mpMirrorXP(l) { // the host's experience orbs; walking into one asks the host for its points
  const seen = new Set();
  for (const [id, v, x, y, z] of l) {
    seen.add(id); let e = ENT.find(q => q.remote && q.rid === id && !q.dead && q.kind === 'xp');
    if (!e) { const n0 = ENT.length; MP.allowSpawn = true; try { spawnXP(x, y, z, v); } finally { MP.allowSpawn = false; } e = ENT.slice(n0).find(q => q.kind === 'xp'); if (!e) continue; e.remote = true; e.rid = id; e.tick = mpPuppetItem; }
    e.tx = x; e.ty = y; e.tz = z;
  }
  for (const e of ENT) if (e.remote && e.kind === 'xp' && !e.dead && !seen.has(e.rid)) removeEnt(e);
}
function mpPuppetItem(e) {
  if (e.tx == null) return; e.x += (e.tx - e.x) * 0.5; e.y += (e.ty - e.y) * 0.5; e.z += (e.tz - e.z) * 0.5;
  if (!e.asked && !PL.dead && PL.mode !== 'spectator' && Math.abs(PL.x - e.x) < 1.2 && Math.abs(PL.z - e.z) < 1.2 && e.y > PL.y - 0.6 && e.y < PL.y + 2) { e.asked = true; mpToAuth({ t: e.kind === 'xp' ? 'pickxp' : 'pick', e: e.rid }); setTimeout(() => { e.asked = false; }, 1500); }
}
// blocks: the player who did it sends it; the host applies guests' changes and passes them on
// the host runs the whole world (fluids, crops, redstone, fire, mobs) and sends every change, batched once a tick;
// a guest sends what its player did, the host applies it like a player action and the result comes back to everyone
function mpBlockChanged(x, y, z, id, m, metaOnly) {
  if (MP.replaying) return; // changes already in the server's record, being put back as a chunk loads
  const e = metaOnly ? [x, y, z, id, m, 1] : [x, y, z, id, m];
  if (MP.rolePending) { MP.queue.push(e); return; } // just arrived in a dimension: sent once it is known who runs it
  if (MP.role === 'host') { if (MP.peers.size || MP.server) (MP.batch || (MP.batch = [])).push(e); return; } // a server world keeps every change
  // everything one action changes goes together (both halves of a door or bed): the runner applies them all before
  // any block checks its neighbours, or the first half would find no partner and break
  (MP.gsets || (MP.gsets = [])).push({ x, y, z, id, m, mo: metaOnly ? 1 : 0, dim: W.dim, dk: dkey(x >> 4, z >> 4) });
  if (MP.gsets.length === 1) queueMicrotask(mpFlushSets);
}
function mpFlushSets() { const l = MP.gsets; MP.gsets = null; if (!l || !MP.on) return; if (l.length === 1) mpToAuth({ t: 'set', ...l[0] }); else mpToAuth({ t: 'setl', dim: l[0].dim, l }); }
function mpApplySets(m) { // guests: the host's changes
  if (m.dim !== W.dim) return;
  MP.applying = true;
  try { for (const [x, y, z, id, mt, mo] of m.l) { if (!isLoaded(x, z)) { W.saved.add(dkey(x >> 4, z >> 4)); continue; } if (mo && getBlock(x, y, z) === id) setMeta(x, y, z, mt); else setBlock(x, y, z, id, mt, { noUpdate: true, keepTile: true }); } }
  finally { MP.applying = false; }
}
function mpApplySet(m) { mpApplyGuestSets([m]); } // the host: a guest's action
function mpApplyGuestSets(l) {
  if (MP.role !== 'host') return;
  const here = l.filter(m => m.dim === W.dim && isLoaded(m.x, m.z)), away = l.filter(m => !here.includes(m));
  if (here.length) {
    MP.applying = true;
    try {
      const done = [];
      for (const m of here) { if (!BLOCKS[m.id] && m.id) continue; if (m.mo) { if (getBlock(m.x, m.y, m.z) !== m.id) continue; setMeta(m.x, m.y, m.z, m.m); }
        else { if (getBlock(m.x, m.y, m.z) !== m.id) { const c = chunkAt(m.x >> 4, m.z >> 4); c.tiles.delete(BI(m.x, m.y, m.z)); } // what was in it the guest already dropped
          setBlock(m.x, m.y, m.z, m.id, m.m, { noUpdate: true }); }
        done.push(m); }
      for (const m of done) {
        if (!m.mo) { neighborUpdate(m.x, m.y, m.z); for (const [dx, dy, dz] of N6) neighborUpdate(m.x + dx, m.y + dy, m.z + dz); observerCheck(m.x, m.y, m.z); }
        // what the player's own code would have set going: redstone, button release, fluids and falling blocks
        const b = m.id; rsNotify(m.x, m.y, m.z);
        if (b === RSB.lever || b === RSB.button) { const a = switchAttach(m.x, m.y, m.z, m.m); rsNotify(a[0], a[1], a[2]); if (b === RSB.button && (m.m & 8)) { const k = (m.m >> 4) & 15; rsLater(m.x, m.y, m.z, k >= 1 && k <= 8 ? 30 : 20); } }
        if (FLUID[b]) schedule(m.x, m.y, m.z, 1);
        if (BLOCKS[b] && BLOCKS[b].fall) schedule(m.x, m.y, m.z, 2);
        for (const [dx, dy, dz] of N6) { const n = getBlock(m.x + dx, m.y + dy, m.z + dz); if (FLUID[n]) schedule(m.x + dx, m.y + dy, m.z + dz, n === 27 ? 5 : 30); }
      }
    } finally { MP.applying = false; }
  }
  for (const m of away) {
    if (MP.server) mpSend({ t: 'sets', dim: m.dim, l: [[m.x, m.y, m.z, m.id, m.m]] }); // a server world keeps it until someone loads that chunk
    else { // not loaded here: kept with the world and put in place when the host loads that chunk
      const E = W.meta.mpEdits || (W.meta.mpEdits = {}); (E[m.dk] || (E[m.dk] = [])).push([m.x, m.y, m.z, m.id, m.m]);
      for (const id of MP.peers.keys()) mpSend({ t: 'sets', dim: m.dim, l: [[m.x, m.y, m.z, m.id, m.m]] }, id);
    }
  }
}
// chunk requests: the host answers with its saved / loaded chunk, plus edits waiting for it
async function mpServeChunk(m, from) {
  const dk = DIM_PREFIX[m.dim] + m.cx + ',' + m.cz, edits = (W.meta.mpEdits && W.meta.mpEdits[dk]) || null;
  const out = { t: 'chunkdata', cx: m.cx, cz: m.cz, dim: m.dim, edits };
  const c = m.dim === W.dim && W.chunks.get(ckey(m.cx, m.cz));
  if (c && c.edited) Object.assign(out, { b: mpB64(rleEnc(c.blocks)), m: mpB64(rleEnc(c.meta)), l: mpB64(rleEnc(c.light)), bio: Array.from(c.biome), tl: serTiles(c), ch: CH, my: MINY });
  else {
    const key = W.id + ':' + dk, pend = saveDone(key); if (pend) await pend;
    const rec = await dbReq('chunks', 'readonly', st => st.get(key));
    if (rec && rec.b && rec.v >= 3) Object.assign(out, { b: mpB64(rec.b), m: mpB64(rec.m), l: mpB64(rec.l), bio: Array.from(rec.bio), tl: rec.t || [], ch: rec.ch || CH, my: rec.my });
    else out.none = true;
  }
  const pt = W.meta.mpTiles && W.meta.mpTiles[dk]; if (pt && out.tl) { const tl = out.tl.filter(([i]) => !(i in pt)); for (const i in pt) tl.push([+i, pt[i]]); out.tl = tl; } else if (pt) out.tiles = pt;
  mpSend(out, from);
}
const mpEdits = new Map(), mpTileWait = new Map(); // chunk key -> edits / containers to apply when it loads (guests)
function mpRequestChunk(cx, cz) { W.pending.set(ckey(cx, cz), 'load'); mpSend({ t: 'chunk', cx, cz, dim: W.dim }); }
function mpGotChunk(m) {
  if (m.dim !== W.dim) return; const key = ckey(m.cx, m.cz);
  if (W.pending.get(key) !== 'load') return; W.pending.delete(key);
  if (m.edits) mpEdits.set(key, m.edits);
  if (m.tiles) { const sh = ((m.tmy != null ? m.tmy : MINY) - MINY) << 8, tl = {}; for (const i in m.tiles) { const j = +i + sh; if (j >= 0 && j < CVOL) tl[j] = m.tiles[i]; } m.tiles = tl; mpTileWait.set(key, tl); } // the world's rows may start lower (1.18)
  const rm = m.it && typeof itemRemapFor === 'function' ? itemRemapFor(m.it) : null; if (rm) { remapItems(m.tl, rm); remapItems(m.mobs, rm); remapItems(m.tiles, rm); }
  if (m.none) { W.saved.delete(DIM_PREFIX[m.dim] + m.cx + ',' + m.cz); if (m.mobs) W.pendingMobs.set(key, m.mobs); return; } // plain terrain (with its animals): generated here
  const n = 256 * m.ch, dec = (s, T) => rleDec(mpUnB64(s, T), n, T).subarray(0, n);
  const d = { cx: m.cx, cz: m.cz, blocks: dec(m.b, Uint16Array), meta: dec(m.m, Uint8Array), light: dec(m.l, Uint8Array), biome: Uint8Array.from(m.bio), mobs: m.mobs || null, fromSave: true, tileList: m.tl || [] };
  fitRows(d, m.my || 0, m.ch, m.dim); // saved with another world height (before 1.18, or by a 1.18 game)
  W.inbox.push(d);
}
function mpChunkLoaded(c) {
  const host = MP.role === 'host', dk = dkey(c.cx, c.cz);
  const own = host && !MP.server;
  if (own && W.meta.mpTiles && W.meta.mpTiles[dk]) { for (const [i, t] of Object.entries(W.meta.mpTiles[dk])) c.tiles.set(+i, t); delete W.meta.mpTiles[dk]; c.modified = c.edited = true; }
  if (!own && mpTileWait.has(c.key)) { for (const [i, t] of Object.entries(mpTileWait.get(c.key))) c.tiles.set(+i, t); mpTileWait.delete(c.key); }
  const list = own ? W.meta.mpEdits && W.meta.mpEdits[dk] : mpEdits.get(c.key);
  if (!list) return;
  MP.applying = true; MP.replaying = MP.server; try { for (const [x, y, z, id, m, mo] of list) { if (mo && getBlock(x, y, z) === id) setMeta(x, y, z, m); else setBlock(x, y, z, id, m, { noUpdate: true, keepTile: true }); } } finally { MP.applying = false; MP.replaying = false; }
  if (own) delete W.meta.mpEdits[dk]; else mpEdits.delete(c.key);
  if (MP.server && host) c.modified = c.edited = true; // stored again with the changes in it
}

// ---------- every tick: your state out; the host also sends the clock and nearby mobs ----------
function mpPoseOut() { // how the arms are held (bow drawn, shield up, eating...), the bed's direction, fire, the block being dug, the hook and eye in the air
  const ps = playerPoseInputs(0), o = { pr: ps.right, plf: ps.left, two: ps.two, chg: +(ps.charge || 0).toFixed(2), swl: ps.swingLeft ? 1 : 0, by: PSTATE.bedYaw || 0, lh: mainRight() ? 0 : 1, fire: PL.fire > 0 && !PL.inWater ? 1 : 0 }, ec = effSwirlColor(PL.eff); if (ec) o.ec = ec;
  const t = TARGET; if (t && t.type === 'block' && MINE.prog > 0 && MINE.id === t.id && !creative()) o.mine = [t.x, t.y, t.z, Math.floor(MINE.prog * 10)];
  const fx = []; for (const e of ENT) if (!e.dead && !e.remote && (e.kind === 'bobber' || e.kind === 'eye') && fx.length < 2) fx.push([e.kind, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2)]); if (fx.length) o.fx = fx;
  return o;
}
function mpTick() {
  if (!MP.on || !W.active) return; MP.sndN = 0;
  { const [h, off] = handItems(); mpSend({ t: 'pl', id: MP.role === 'host' && !MP.server ? 0 : MP.id, x: +PL.x.toFixed(3), y: +PL.y.toFixed(3), z: +PL.z.toFixed(3), yaw: +PL.yaw.toFixed(3), pitch: +PL.pitch.toFixed(3), dim: W.dim,
    sneak: PL.sneaking && !PL.flying ? 1 : 0, swing: R.hand.swing > 0 ? +(1 - R.hand.swing).toFixed(2) : 0, held: h ? h.id : 0, off: off ? off.id : 0, fly: PL.flying ? 1 : 0, dead: PL.dead ? 1 : 0, mode: PL.mode, h: PL.h, sleep: PL.sleeping ? 1 : 0, pose: PL.pose || 'stand', glide: PL.gliding ? 1 : 0, ride: PL.riding ? 1 : 0,
    armor: INV.armor.map(s => s ? [s.id, s.e ? 1 : 0] : 0), inv: effLv(PL, 'invisibility') ? 1 : 0, ...mpPoseOut() }); }
  if (MP.server && W.tickN % 200 === 0) mpSendPdata();
  if (MP.role !== 'host') { if (W.tickN % 200 === 0 && !MP.server) mpGuestSave(); return; }
  if (MP.server && W.tickN % 600 === 0) mpSendShared();
  if (MP.server && W.tickN % 200 === 100) mpMobSnapshot();
  if (MP.batch && MP.batch.length) { mpSend({ t: 'sets', dim: W.dim, l: MP.batch }); MP.batch = []; }
  // guests' surroundings stay loaded and alive on the host: chunks, random ticks (crops, fire, ice), mob spawning
  const here = [...MP.peers.values()].filter(p => p.s && p.s.dim === W.dim && performance.now() - p.at < 5000);
  W.keepCenters = here.length ? here.map(p => [p.s.x, p.s.z, 3]) : null;
  for (const p of here) {
    if (Math.abs(p.s.x - PL.x) < 48 && Math.abs(p.s.z - PL.z) < 48) continue; // already covered by the host's own area
    randomTicks(Math.floor(p.s.x), Math.floor(p.s.z));
    if (W.tickN % 10 === 0 && gr('doMobSpawning')) mpProxy(p, () => { if (W.dim === 0) trySpawnHostile(); else trySpawnDimension(); });
  }
  // experience orbs fly to the nearest player, guests included, and a guest gets the points on touching one
  if (here.length) for (const e of ENT) {
    if (e.dead || e.kind !== 'xp' || e.remote) continue;
    const dh = Math.hypot(PL.x - e.x, PL.y + 0.8 - e.y, PL.z - e.z); let g = null, gd = 8;
    for (const p of here) { const d = Math.hypot(p.s.x - e.x, p.s.y + 0.8 - e.y, p.s.z - e.z); if (d < gd && d < dh) { gd = d; g = p; } }
    if (!g) continue;
    if (gd < 1) { removeEnt(e); mpSend({ t: 'givexp', v: e.value }, g.id); continue; }
    const f = (1 - gd / 8) ** 2 * 0.1; e.vx += (g.s.x - e.x) / gd * f; e.vy += (g.s.y + 0.8 - e.y) / gd * f; e.vz += (g.s.z - e.z) / gd * f;
  }
  // containers that change by themselves (furnaces, brewing stands, campfires) near guests: sent when they change
  if (W.tickN % 10 === 0 && here.length) for (const c of W.chunks.values()) {
    if (!c.hasFurnace || !here.some(p => Math.abs(c.cx * 16 + 8 - p.s.x) < 40 && Math.abs(c.cz * 16 + 8 - p.s.z) < 40)) continue;
    for (const [i, t] of c.tiles) { if (t.type !== 'furnace' && t.type !== 'brewing' && t.type !== 'campfire') continue; if (t._mp) delete t._mp; /* an older version kept this inside the tile */ const j = JSON.stringify(t); if (MP_TSENT.get(t) === j) continue; MP_TSENT.set(t, j);
      const x = c.cx * 16 + (i & 15), y = (i >> 8) + MINY, z = c.cz * 16 + ((i >> 4) & 15); mpSend({ t: 'tile', x, y, z, dim: W.dim, dk: dkey(c.cx, c.cz), tile: JSON.parse(j) }); }
  }
  if (W.tickN % 40 === 0 && !MP.server) mpSend({ t: 'time', time: W.time, rain: W.rainTarget, thunder: W.thunderOn });
  if (W.tickN % 2 === 0) for (const p of MP.peers.values()) { // mobs and vehicles near each guest 10 times a second, items 5
    if (!p.s || p.s.dim !== W.dim) continue; const l = [];
    for (const e of ENT) { if (e.dead || e.kind !== 'mob' || Math.abs(e.x - p.s.x) > 64 || Math.abs(e.z - p.s.z) > 64) continue; if (!e.mpid) e.mpid = mpNewId();
      l.push([e.mpid, e.type, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +e.yaw.toFixed(2), e.baby ? 1 : 0, e.hurt > 0 ? 1 : 0, e.variant != null ? e.variant : null, e.size || 0, e.vtype || null, e.prof || null, e.sheared ? 1 : 0, e.deathT ? 1 : 0, e.saddle ? 1 : 0, e.owner === 'player' ? 1 : 0, e.chest ? 1 : 0, e.spd || 0, e.jumpS || 0, e.rider === PL ? -1 : e.mpRider || 0, e.harmor || null, e.leash === 'player' ? { p: MP.id } : e.leash || 0, mpMobVis(e)]); }
    mpSend({ t: 'mobs', l }, p.id);
    mpSendVehicles(p);
    if (W.tickN % 4) continue;
    const it = []; for (const e of ENT) { if (e.dead || e.kind !== 'item' || e.remote || Math.abs(e.x - p.s.x) > 32 || Math.abs(e.z - p.s.z) > 32) continue; if (!e.mpid) e.mpid = mpNewId(); it.push([e.mpid, { id: e.stack.id, n: e.stack.n, d: e.stack.d, e: e.stack.e }, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2)]); }
    mpSend({ t: 'items', l: it }, p.id);
    const fx = []; for (const e of ENT) { if (e.dead || e.remote || !MP_FX[e.kind] || Math.abs(e.x - p.s.x) > 64 || Math.abs(e.z - p.s.z) > 64 || (e.kind === 'arrow' && (e.visual || e.owner === PL))) continue; if (!e.mpid) e.mpid = mpNewId(); fx.push([e.mpid, e.kind, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), MP_FX[e.kind](e)]); }
    if (fx.length || p.fxOn) { mpSend({ t: 'fx', l: fx }, p.id); p.fxOn = fx.length > 0; }
    const xo = []; for (const e of ENT) { if (e.dead || e.kind !== 'xp' || e.remote || Math.abs(e.x - p.s.x) > 24 || Math.abs(e.z - p.s.z) > 24) continue; if (!e.mpid) e.mpid = mpNewId(); xo.push([e.mpid, e.value, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2)]); }
    mpSend({ t: 'xps', l: xo }, p.id);
  }
}
function mpNewId() { return MP.server ? MP.id * 1000000 + MP.eid++ : MP.eid++; } // unique even when another player takes over a dimension
// guests: the host's mobs as puppets that move where the host says
function mpMirrorMobs(l) {
  const seen = new Set();
  for (const [id, type, x, y, z, yaw, baby, hurt, variant, size, vtype, prof, sheared, dying, saddle, tame, chest, spd, jumpS, rider, harmor, leash, vis] of l) {
    seen.add(id); let e = ENT.find(q => q.remote && q.rid === id && !q.dead && q.kind === 'mob'); const v = vis && typeof vis === 'object' ? vis : {};
    if (e && PL.riding !== e && ((variant != null && e.variant !== variant) || !!baby !== !!e.baby || (size && e.size !== size) || (prof && e.prof !== prof) || (vtype && e.vtype !== vtype) || (!sheared && e.sheared))) { removeEnt(e); e = null; } // it grew up, changed job or colour: built again
    if (!e && MOBDEF[type] && !dying) { MP.allowSpawn = true; try { e = spawnMob(type, x, y, z, { baby, variant, size, vtype, prof, sheared, captain: v.captain, carpet: v.carpet, gene: v.gene, gene2: v.gene2 }); } finally { MP.allowSpawn = false; } e.remote = true; e.idleSnd = 100 + Math.random() * 400; e.rid = id; e.persistent = true; e.yaw = yaw; }
    if (!e) continue; e.tx = x; e.ty = y; e.tz = z; e.tyaw = yaw; if (hurt && !e.hurt) { e.hurt = 10; mpMobSound(e, e.def.snd === 'groan' || e.def.snd === 'rattle' || e.def.snd === 'hiss' || e.def.snd === 'spider' ? 'hurt' : e.def.snd, 0.8); } if (dying && !e.deathT) e.deathT = 1;
    if (sheared && !e.sheared && e.type === 'sheep') setSheared(e);
    mpApplyMobVis(e, v);
    // what riding needs: saddle, tame, chest and the horse's own speed and jump
    if (saddle != null) { const ch = !!saddle !== !!e.saddle || !!chest !== !!e.chest || (harmor || null) !== (e.harmor || null); e.harmor = harmor || null; e.saddle = !!saddle; e.chest = !!chest; if (tame) e.owner = 'player'; if (spd) e.spd = spd; if (jumpS) e.jumpS = jumpS; if (ch && typeof horseParts === 'function' && e.gear) horseParts(e); }
    if (e.rider !== PL) e.rider = rider && rider !== MP.id ? 'other' : null; e.riderId = rider > 0 ? rider : rider === -1 ? 'runner' : 0;
    e.leash = leash && (Array.isArray(leash) ? leash.length === 3 && leash.every(Number.isInteger) : leash.p != null) ? leash : null; // a lead: to a fence or to someone ({p: player id})
  }
  for (const e of ENT) if (e.remote && e.kind === 'mob' && !e.dead && !seen.has(e.rid)) { if (PL.riding === e) dismount(); removeEnt(e); }
}
function mpPuppetTick(e) {
  if (e.rider === PL) { if (e.def.ride) e.def.ride(e, 0); mpRideSend(e); return; } // you ride it: it goes where you steer, and the runner follows
  if (e.mpWas) mpRideOff(e);
  if (e.tx == null) return; const dx = e.tx - e.x, dz = e.tz - e.z;
  e.x += dx * 0.5; e.y += (e.ty - e.y) * 0.5; e.z += dz * 0.5; e.yaw += wrapA(e.tyaw - e.yaw) * 0.5;
  const sp = Math.hypot(dx, dz); e.walkAmt = Math.min(1, sp * 6); e.walk = (e.walk || 0) + sp * 3; if (e.hurt > 0) e.hurt--; if (e.deathT) e.deathT++;
  if (--e.idleSnd <= 0 && !e.deathT) { e.idleSnd = 300 + Math.random() * 500; mpMobSound(e, e.def.snd, 0.6); } // its own noises, heard here
  if (e.fire > 0 && Math.random() < 0.3) R.simpleParticle(e.x + (Math.random() - .5) * e.w * 2, e.y + Math.random() * e.h, e.z + (Math.random() - .5) * e.w * 2, [1, 0.6, 0.1], { kind: 'flame', size: 0.12, vy: 1, grav: -0.2, life: 0.4 });
}
// what the runner's mobs look like right now (anger, creeper fuse, sitting, sleeping, spells, fire, boss health...)
const MP_MOBV = ['fuse', 'charged', 'sitting', 'sleeping', 'lying', 'roll', 'swing', 'cast', 'peek', 'charge', 'phase', 'squish', 'flying', 'nectar', 'spikes', 'playDead', 'hasTrident', 'carpet', 'noPumpkin', 'gene', 'gene2', 'bite', 'barter', 'captain', 'stung', 'inWater', 'onGround', 'trap', 'name'];
function mpMobVis(e) {
  const v = {}; for (const k of MP_MOBV) { const x = e[k]; if (x != null && x !== false && x !== 0 && (typeof x !== 'object')) v[k] = typeof x === 'number' ? +x.toFixed(2) : x; }
  if (e.target) v.tgt = 1; if (e.fire > 0) v.fire = 1; if (e.eff && e.eff.glowing) v.glow = 1; if (e.def.boss || e.hp < e.def.hp) v.hp = Math.ceil(e.hp); const ec = effSwirlColor(e.eff); if (ec) v.ec = ec;
  return v;
}
function mpApplyMobVis(e, v) {
  const f0 = e.fuse || 0;
  for (const k of MP_MOBV) e[k] = v[k];
  e.target = v.tgt ? PL : null; e.fire = v.fire ? 2 : 0; e.ec = Array.isArray(v.ec) && v.ec.length === 3 ? v.ec : null; e.eff = v.glow ? { glowing: { t: 40, lv: 0 } } : null; if (v.hp != null && isFinite(v.hp)) e.hp = +v.hp;
  if (e.fuse > 0 && !f0) mpMobSound(e, 'fuse', 1);
}
function mpMobSound(e, snd, vol) { if (!snd) return; const d = Math.hypot(PL.x - e.x, PL.y - e.y, PL.z - e.z); if (d < 16) play(snd, { vol: vol * (1 - d / 16) }); }

// ---------- a saved server world (node tools/server.js) ----------
// The server keeps the world; whoever is first in a dimension runs it (MP.role 'host' there) and stores its chunks
// back to the server; the others follow as guests. When the runner leaves, the server names the next one.
const MP_SHARED = ['dragonKilled', 'maps', 'mapN', 'siegeDay', 'netherIn', 'keepInv'];
async function mpEnterServerWorld(m) {
  MP.id = m.you; MP.auth = m.auth || {}; MP.peers.clear();
  for (const q of m.players) MP.peers.set(q.id, { id: q.id, name: q.name, skin: q.skin, s: null });
  const sm = m.meta, d = m.pdata;
  const meta = { id: 'srv-' + sm.seed + '-' + sm.name, name: sm.name, seed: sm.seed, gen: sm.gen || 1, mode: d && d.s && d.s.mode || sm.mode, diff: sm.diff, cheats: sm.cheats, exp: sm.exp, spawn: sm.spawn, remote: true, server: true, gamerules: sm.gamerules || {}, ...(sm.shared || {}),
    dim: d ? d.dim || 0 : 0, player: d ? { s: d.s, inv: d.inv, armor: d.armor, sel: d.sel, it: d.it, ender: d.ender, off: d.off, pend: d.pend || null } : null, time: m.time, rain: m.rain, thunder: m.thunder };
  MP.rolePending = true; MP.role = 'guest';
  await startWorld(meta.id, meta);
  W.saved = new Set(m.stored); W.time = m.time; W.rain = W.rainTarget = m.rain; W.thunderOn = m.thunder;
  if (d && d.adv) W.meta.adv = d.adv; if (d && d.adv2) { W.meta.adv2 = d.adv2; W.meta.advMigrated = true; } if (d && d.stats) W.meta.stats = d.stats;
  if (!sm.spawn) mpSend({ t: 'meta', shared: {}, spawn: W.worldSpawn });
  mpSend({ t: 'dim', dim: W.dim });
  chatMsg(sm.name + ' 서버 세계에 들어왔습니다', '#ffff55');
  mirHave(); // the server fills in this browser's copy of the world
}
function mpGotAuth(dim, id) {
  if (id == null) delete MP.auth[dim]; else MP.auth[dim] = id;
  if (!MP.server || !W.active || dim !== W.dim || id == null) return;
  const was = MP.role, now = id === MP.id ? 'host' : 'guest'; MP.role = now;
  if (now === 'guest' && MP.lastAuth !== id) for (const e of [...ENT]) if (e.remote) { if (PL.riding === e) dismount(); removeEnt(e); } // the new runner's mobs replace the old one's
  MP.lastAuth = id;
  const q = MP.queue; MP.queue = []; MP.rolePending = false;
  if (now === 'host' && was !== 'host') mpBecomeRunner();
  if (q.length) { if (now === 'host') mpSend({ t: 'sets', dim: W.dim, l: q }); else for (const e of q) mpToAuth({ t: 'set', x: e[0], y: e[1], z: e[2], id: e[3], m: e[4], mo: e[5] ? 1 : 0, dk: dkey(e[0] >> 4, e[2] >> 4) }); }
}
// taking over a dimension: the previous runner's figures go, its stored mobs come back to life here
function mpBecomeRunner() {
  for (const e of [...ENT]) if (e.remote) removeEnt(e);
  const dks = [...W.chunks.values()].map(c => dkey(c.cx, c.cz)); if (dks.length) mpSend({ t: 'chunkmobs', dks });
  chatMsg('이 차원의 계산을 맡았습니다', '#aaaaaa');
}
function mpRestoreMobs(l) {
  const keep = new Set(['frame', 'painting', 'armor_stand']); // already here from the chunk itself
  for (const [dk, mobs] of l) { const m = /(-?\d+),(-?\d+)$/.exec(dk); if (!m) continue; const c = chunkAt(+m[1], +m[2]); if (!c) continue;
    const near = ENT.some(e => e.kind === 'mob' && !e.dead && Math.floor(e.x) >> 4 === c.cx && Math.floor(e.z) >> 4 === c.cz); // already has its own mobs
    const list = (mobs || []).filter(e => !keep.has(e[0]) && (!near || e[0] === 'boat' || e[0] === 'minecart')); if (!list.length) continue;
    W.onChunkLoaded({ cx: c.cx, cz: c.cz, key: 'restore', mobs: list, spawns: null }, false); }
}
// a dimension's runner stores its chunks on the server instead of this browser
function mpStoreChunk(c) {
  if (!c.modified) return; c.modified = false;
  const dk = dkey(c.cx, c.cz); W.saved.add(dk);
  const mobs = c.mobsFresh || W.chunks.get(c.key) !== c ? c.mobs || null : chunkKeep(c, false); c.mobsFresh = false; // a chunk still here: what stands in it now
  const rec = c.edited ? { v: 3, it: ITEM_TABLE, ch: CH, my: MINY, b: mpB64(rleEnc(c.blocks)), m: mpB64(rleEnc(c.meta)), l: mpB64(rleEnc(c.light)), bio: Array.from(c.biome), t: serTiles(c), mobs } : { v: 2, it: ITEM_TABLE, mobs };
  mpSend({ t: 'store', dk, rec });
}
function mpPdata() {
  offUnswap(); const s = {}; for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'health', 'food', 'sat', 'exh', 'air', 'level', 'xpP', 'xpTotal', 'mode', 'flying', 'spawn', 'fire', 'absorb', 'dead', 'eff', 'rest', 'spawnDim', 'spawnBed']) s[k] = PL[k];
  const pend = [INV.cursor, ...INV.craft2, ...INV.craft3].filter(st => st && st.n > 0); // in your hands or a crafting grid: yours too
  return { s, dim: W.dim, inv: INV.slots, armor: INV.armor, sel: INV.sel, it: ITEM_TABLE, ender: PL.ender, off: INV.off, pend: pend.length ? pend : null, adv: W.meta.adv || null, adv2: W.meta.adv2 || null, stats: W.meta.stats || null };
}
function mpSendPdata() { if (MP.server && W.active && !MP.rolePending) mpSend({ t: 'pdata', d: mpPdata() }); }
let mpSharedLast = '';
function mpSendShared() { const sh = {}; for (const k of MP_SHARED) if (W.meta[k] !== undefined) sh[k] = W.meta[k]; const j = JSON.stringify(sh) + JSON.stringify(W.meta.gamerules || {}); if (j === mpSharedLast) return; mpSharedLast = j; mpSend({ t: 'meta', shared: sh, gamerules: W.meta.gamerules || {} }); }
function mpServerLeave(stay) { // keep everything in the world's store before going (stay: the host closes multiplayer and plays on)
  if (!W.active) return;
  mpSendPdata();
  if (MP.role === 'host') { mpSendShared(); if (MP.batch && MP.batch.length) { mpSend({ t: 'sets', dim: W.dim, l: MP.batch }); MP.batch = []; }
    for (const c of W.chunks.values()) { if (stay) { c.mobs = chunkKeep(c, false); c.mobsFresh = true; c.modified = true; } else R.onChunkUnloaded(c); mpStoreChunk(c); } }
}
// every ten seconds the runner sends what lives in its chunks, so whoever takes over starts from the world as it was
function mpMobSnapshot() {
  const l = []; for (const c of W.chunks.values()) { const k = chunkKeep(c, false); if (k.length || c.mobs) l.push([dkey(c.cx, c.cz), k]); }
  if (l.length) mpSend({ t: 'mobsnap', dim: W.dim, it: ITEM_TABLE, l });
}
// after closing a world you didn't run: its chunks come back from the save, with their mobs
function mpDropChunks() { for (const c of [...W.chunks.values()]) { c.modified = false; if (W.onChunkUnloaded) W.onChunkUnloaded(c); W.chunks.delete(c.key); } W.lastKey = -1; }
// your own world, sent to a server so others can play it without you: chunks, world data and your player
async function mpUpload(url) {
  if (!W.active || W.meta.remote) throw new Error('먼저 올릴 세계에 들어가세요');
  saveAll(true); await new Promise(r => setTimeout(r, 400));
  const link = await mpWebSocket(url, 'join', { newWorld: true }); if (link.hello.kind !== 'world') { link.close(); throw new Error('이 주소는 서버 세계를 받지 않습니다'); }
  if (link.hello.world) { link.close(); throw new Error('이 서버는 세계를 하나만 받습니다 (' + link.hello.world.name + ')'); } // an older server
  const sh = {}; for (const k of MP_SHARED) if (W.meta[k] !== undefined) sh[k] = W.meta[k];
  link.send({ t: 'create', meta: { name: W.meta.name, seed: W.seed, gen: W.gen || 1, my: MINY, exp: W.exp, mode: W.meta.mode === 'creative' ? 'creative' : 'survival', diff: PL.difficulty, cheats: W.cheats, spawn: W.worldSpawn, gamerules: W.meta.gamerules || {}, shared: sh, time: W.time } });
  const keys = await dbReq('chunks', 'readonly', st => st.getAllKeys()); const mine = (keys || []).filter(k => typeof k === 'string' && k.startsWith(W.id + ':'));
  let n = 0;
  for (const k of mine) { const rec = await dbReq('chunks', 'readonly', st => st.get(k)); if (!rec) continue; const dk = k.slice(W.id.length + 1);
    const out = rec.b ? { v: 3, it: rec.it, ch: rec.ch || 128, my: rec.my, b: mpB64(rec.b), m: mpB64(rec.m), l: mpB64(rec.l), bio: Array.from(rec.bio), t: rec.t || [], mobs: rec.mobs || null } : { v: 2, it: rec.it, mobs: rec.mobs || null };
    if (rec.b && rec.v < 3) continue; // very old saves stay local
    link.send({ t: 'store', dk, rec: out }); if (++n % 50 === 0) { MP.status = `올리는 중... ${n}/${mine.length}`; const el = $('mpStatus'); if (el) el.textContent = MP.status; await new Promise(r => setTimeout(r, 0)); } }
  link.send({ t: 'pdata', name: MP.name, d: mpPdata() }); // you carry on where you were, with what you had
  await new Promise(r => setTimeout(r, 600)); link.close();
  return { n, wid: link.hello.wid || null };
}

// ---------- riding and vehicles ----------
// Boats and minecarts belong to the dimension's runner like mobs and are mirrored to everyone. Whoever rides a boat,
// a minecart, a horse, a pig or a strider steers it on their own screen and the runner follows them.
function mpSendVehicles(p) {
  const l = [];
  for (const e of ENT) { if (e.dead || (e.kind !== 'boat' && e.kind !== 'minecart') || e.remote || Math.abs(e.x - p.s.x) > 64 || Math.abs(e.z - p.s.z) > 64) continue; if (!e.mpid) e.mpid = mpNewId();
    l.push([e.mpid, e.kind, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +e.yaw.toFixed(3), e.kind === 'boat' ? e.wood : e.ctype, e.rider === PL ? -1 : e.mpRider || 0, e.rider2 === PL ? -1 : e.mpRider2 && performance.now() - e.mpRider2At < 1500 ? e.mpRider2 : e.mob ? -2 : 0]); }
  mpSend({ t: 'vehs', l }, p.id);
}
function mpMirrorVehicles(l) {
  const seen = new Set();
  for (const [id, kind, x, y, z, yaw, sub, rider, rider2] of l) {
    seen.add(id); let e = ENT.find(q => q.remote && q.rid === id && !q.dead && q.kind === kind);
    if (!e) { MP.allowSpawn = true; try { e = kind === 'boat' ? placeBoat(x, y, z, yaw, sub) : spawnMinecart(x, y, z, sub, { yaw }); } finally { MP.allowSpawn = false; } if (!e) continue;
      e.remote = true; e.rid = id; e.vTick = e.tick; e.tick = mpVehTick; e.onHit = () => mpToAuth({ t: 'vhit', e: id }); }
    e.tx = x; e.ty = y; e.tz = z; e.tyaw = yaw;
    if (e.rider !== PL) e.rider = rider && rider !== MP.id ? 'other' : null;
    e.seat2Other = !!(rider2 && rider2 !== MP.id); e.riderId = rider > 0 ? rider : rider === -1 ? 'runner' : 0; e.seat2Id = rider2 > 0 ? rider2 : rider2 === -1 ? 'runner' : 0; // who sits where, for their figures
  }
  for (const e of ENT) if (e.remote && (e.kind === 'boat' || e.kind === 'minecart') && !e.dead && !seen.has(e.rid)) { if (PL.riding === e) dismount(); removeEnt(e); }
}
function mpVehTick(e) {
  if (e.rider === PL) { if (e.mpWas2) { e.mpWas2 = false; mpToAuth({ t: 'ride2', e: e.rid, off: 1 }); } e.vTick(e); mpRideSend(e); return; }
  if (e.mpWas) mpRideOff(e);
  if (e.rider2 === PL) { e.mpWas2 = true; if (W.tickN % 10 === 0) mpToAuth({ t: 'ride2', e: e.rid }); } else if (e.mpWas2) { e.mpWas2 = false; mpToAuth({ t: 'ride2', e: e.rid, off: 1 }); }
  if (e.tx == null) return; e.x += (e.tx - e.x) * 0.5; e.y += (e.ty - e.y) * 0.5; e.z += (e.tz - e.z) * 0.5; e.yaw += wrapA(e.tyaw - e.yaw) * 0.5;
}
function mpRideSend(e) { e.mpWas = true; mpToAuth({ t: 'ride', e: e.rid, x: +e.x.toFixed(3), y: +e.y.toFixed(3), z: +e.z.toFixed(3), yaw: +e.yaw.toFixed(3), vx: +(e.vx || 0).toFixed(3), vz: +(e.vz || 0).toFixed(3) }); }
function mpRideOff(e) { e.mpWas = false; mpToAuth({ t: 'ride', e: e.rid, off: 1 }); }
// the runner: someone else is steering this one
function mpRidden(e, m, from) {
  if (m.off) { if (e.mpRider === from) { e.mpRider = 0; if (e.mpTick0) { e.tick = e.mpTick0; e.mpTick0 = null; } } return; }
  if (e.rider === PL || (e.mpRider && e.mpRider !== from && performance.now() - e.mpRideAt < 1500)) { mpSend({ t: 'unride', e: m.e, seat: 1 }, from); return; } // one driver: whoever got on first
  if (e.mpRider2 === from) e.mpRider2 = 0;
  const far = e.mpRider !== from || Math.hypot(e.x - m.x, e.z - m.z) > 4; e.mpRider = from; e.mpRideAt = performance.now(); e.rtx = +m.x; e.rty = +m.y; e.rtz = +m.z; e.rtyaw = +m.yaw; if (far) { e.x = +m.x; e.y = +m.y; e.z = +m.z; e.yaw = +m.yaw; } e.vx = +m.vx || 0; e.vz = +m.vz || 0; e.vy = 0; e.fallY = null; // followed smoothly between messages
  if (e.kind !== 'mob' && !e.mpTick0) { e.mpTick0 = e.tick; e.tick = mpRiddenTick; }
}
function mpRidden2(e, m, from) { // a boat's back seat
  if (m.off) { if (e.mpRider2 === from) e.mpRider2 = 0; return; }
  if (e.kind !== 'boat' || e.mob || e.rider2 === PL || (e.mpRider2 && e.mpRider2 !== from && performance.now() - e.mpRider2At < 1500)) { mpSend({ t: 'unride', e: m.e, seat: 2 }, from); return; }
  e.mpRider2 = from; e.mpRider2At = performance.now();
}
function mpRiddenTick(e) { if (performance.now() - e.mpRideAt > 1500) { e.mpRider = 0; e.tick = e.mpTick0; e.mpTick0 = null; return; } if (e.rtx != null) { e.x += (e.rtx + e.vx - e.x) * 0.6; e.y += (e.rty - e.y) * 0.6; e.z += (e.rtz + e.vz - e.z) * 0.6; e.yaw += wrapA(e.rtyaw - e.yaw) * 0.6; } }

// ---------- the host's mobs fight guests too ----------
// Mob AI reads PL; for a mob whose nearest player is a guest, PL stands where that guest is for the length of the mob's
// tick, and damage, knockback and effects meant for "PL" go to the guest instead
const PROXY_KEYS = ['x', 'y', 'z', 'px', 'py', 'pz', 'vx', 'vy', 'vz', 'mode', 'dead', 'eff', 'h', 'sneaking', 'onGround', 'fire'];
function mpNearestGuest(e) {
  let best = null, bd = PL.dead || PL.mode === 'creative' || PL.mode === 'spectator' ? Infinity : (PL.x - e.x) ** 2 + (PL.y - e.y) ** 2 + (PL.z - e.z) ** 2;
  for (const p of MP.peers.values()) { const s = p.s; if (!s || s.dim !== W.dim || s.dead || s.mode === 'creative' || s.mode === 'spectator' || performance.now() - p.at > 5000) continue;
    const d = (s.x - e.x) ** 2 + (s.y - e.y) ** 2 + (s.z - e.z) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}
function mpProxy(p, fn) {
  const save = {}; for (const k of PROXY_KEYS) save[k] = PL[k];
  const s = p.s; Object.assign(PL, { x: s.x, y: s.y, z: s.z, px: s.x, py: s.y, pz: s.z, vx: 0, vy: 0, vz: 0, mode: s.mode || 'survival', dead: false, eff: {}, h: s.h || 1.8, sneaking: !!s.sneak, onGround: true, fire: 0 });
  MP.proxy = p;
  try { fn(); } finally {
    const kb = [PL.vx, PL.vy, PL.vz], fire = PL.fire; MP.proxy = null; for (const k of PROXY_KEYS) PL[k] = save[k]; if (fire > 0) mpSend({ t: 'ignite', f: fire }, p.id); // set alight by a blaze or a bolt: the guest burns, not the host
    if (kb[0] || kb[1] || kb[2]) mpSend({ t: 'kb', vx: kb[0], vy: kb[1], vz: kb[2] }, p.id);
  }
}
// your own arrow reaching another player: they take it like a hit from you (their armour, shield, enchantments)
function mpArrowAtPeer(e) {
  if (e.stuck || e.thrown || e.visual || e.hitDone || MP.pvp === false) return false;
  const steps = Math.max(1, Math.ceil(Math.hypot(e.vx, e.vy, e.vz) / 0.25));
  for (const p of MP.peers.values()) { const s = p.s; if (!s || s.dim !== W.dim || s.dead || s.mode === 'creative' || s.mode === 'spectator' || !p.pos || performance.now() - p.at > 5000) continue;
    const [px, py, pz] = p.pos, hg = s.h || 1.8;
    for (let k = 1; k <= steps; k++) { const x = e.x + e.vx * k / steps, y = e.y + e.vy * k / steps, z = e.z + e.vz * k / steps;
      if (x > px - 0.4 && x < px + 0.4 && z > pz - 0.4 && z < pz + 0.4 && y > py && y < py + hg) {
        const dmg = e.trident ? 8 : Math.ceil(Math.hypot(e.vx, e.vy, e.vz) * e.dmgMul);
        mpSend({ t: 'pvp', tgt: p.id, from: MP.server ? MP.id : MP.role === 'host' ? 0 : MP.id, dmg, kb: e.punch || 0, yaw: +Math.atan2(-e.vx, -e.vz).toFixed(3), ax: e.x - e.vx * 4, az: e.z - e.vz * 4, fire: e.flame ? 100 : 0 }, MP.role === 'host' || MP.server ? p.id : undefined);
        p.hurtFx = 10; play('hit', { vol: 0.5 });
        if (e.trident) { e.vx *= -0.1; e.vz *= -0.1; e.vy = 0.1; e.hitDone = true; return false; } // drops, to be picked up or called back
        removeEnt(e); return true; } } }
  return false;
}
// someone else's arrow: just flies and sticks
function mpVisualArrow(e) {
  if (!e.stuck) { const nx = e.x + e.vx, ny = e.y + e.vy, nz = e.z + e.vz;
    if (SOLID[getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz))]) { if (e.visThrown) { removeEnt(e); return; } e.stuck = true; }
    else { e.x = nx; e.y = ny; e.z = nz; e.vy -= 0.05; e.vx *= 0.99; e.vy *= 0.99; e.vz *= 0.99; } }
  if (e.age > (e.stuck ? 200 : 300) || e.y < voidY()) removeEnt(e);
}
// Explosion.explode's damage to a player (the same as for the one in whose world it went off)
function mpBlastSelf(x, y, z, power) {
  if (PL.dead || PL.mode === 'creative' || PL.mode === 'spectator') return;
  const rad = power * 2, cx = PL.x, cy = PL.y + (PL.h || 1.8) / 2, cz = PL.z, d = Math.hypot(cx - x, cy - y, cz - z) / rad; if (d > 1) return;
  const imp = 1 - d, dmg = Math.floor((imp * imp + imp) / 2 * 7 * rad + 1), kx = (cx - x) / (d * rad + .01), ky = (cy - y) / (d * rad + .01), kz = (cz - z) / (d * rad + .01);
  hurtPlayer(dmg * DIFF_MUL(), 'explosion', null, { x, y, z }); PL.vx += kx * imp * 1.2; PL.vy += ky * imp * 1.2; PL.vz += kz * imp * 1.2;
}
function mpGotBoom(m, from) {
  if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id);
  if (m.dim !== W.dim || MP.role === 'host' || ![m.x, m.y, m.z, m.p].every(isFinite)) return;
  const x = +m.x, y = +m.y, z = +m.z, power = Math.min(10, +m.p);
  play('explode'); vibrate(x, y, z);
  for (let i = 0; i < 30; i++) R.simpleParticle(x + (Math.random() - .5) * power * 1.5, y + (Math.random() - .5) * power, z + (Math.random() - .5) * power * 1.5, [0.85, 0.85, 0.85], { kind: 'explosion', size: 0.6 + Math.random() * 0.6, life: 0.6 + Math.random() * 0.4 });
  if (m.px !== MP.id) mpBlastSelf(x, y, z, power);
}
function mpGotPrimed(m, from) { // the runner's lit TNT, flashing here until it goes off there
  if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id);
  if (m.dim !== W.dim || MP.role === 'host' || ![m.x, m.y, m.z].every(isFinite)) return;
  MP.allowSpawn = true; try { const e = Ent('tnt', +m.x + .5, +m.y, +m.z + .5); e.kind = 'tnt'; e.fuse = 100000; e.w = 0.49; e.h = 0.98; e.vy = 0.2; e.vx = e.vz = 0; e.mesh = new THREE.Mesh(R.blockGeometry(BID.tnt), R.blockMaterial()); addEnt(e); play('fuse'); setTimeout(() => { if (!e.dead) removeEnt(e); }, Math.min(200, +m.fuse || 80) * 50); } finally { MP.allowSpawn = false; }
}
function mpGotProj(m, from) {
  if (m.dim === W.dim && [m.x, m.y, m.z, m.vx, m.vy, m.vz].every(isFinite)) { const e = shootArrow(+m.x, +m.y, +m.z, +m.vx, +m.vy, +m.vz, null, 0); if (e) { e.visual = true; e.noPickup = true; if (m.k) { scene.remove(e.mesh); e.mesh = R.itemMesh(IID.trident); e.mesh.scale.setScalar(0.8); scene.add(e.mesh); } else if (m.th && ITEMS[m.th]) { scene.remove(e.mesh); e.mesh = R.itemMesh(+m.th); e.mesh.scale.setScalar(0.3); scene.add(e.mesh); e.visThrown = true; } } } // snowballs, eggs, pearls, potions: seen in flight
  if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id);
}
// ---------- item frames, paintings and armor stands: every copy follows whoever changed it ----------
const MP_DECO = ['frame', 'painting', 'armor_stand'];
function mpDecoSend(e, op) {
  if (!MP.on || MP.decoIn || !W.active || MP.loading || !e) return;
  const m = { t: 'deco', dim: W.dim, op, k: e.kind };
  if (e.kind === 'armor_stand') Object.assign(m, { x: +e.x.toFixed(2), y: +e.y.toFixed(2), z: +e.z.toFixed(2), yaw: e.yaw, armor: e.armor }); else Object.assign(m, { ax: e.ax, ay: e.ay, az: e.az, f: e.f });
  if (e.kind === 'frame') Object.assign(m, { glow: e.glow, item: e.item, rot: e.rot }); else if (e.kind === 'painting') m.motif = e.motif;
  mpSend(m);
}
function mpGotDeco(m, from) { // a chunk not here yet brings its own decorations
  const st = m.k === 'armor_stand', ok = MP_DECO.includes(m.k) && (st ? [m.x, m.y, m.z].every(isFinite) : [m.ax, m.ay, m.az].every(Number.isInteger) && S.DIR6[m.f]);
  if (ok && m.dim === W.dim && isLoaded(Math.floor(st ? m.x : m.ax), Math.floor(st ? m.z : m.az))) { const e = ENT.find(o => o.kind === m.k && !o.dead && (st ? Math.abs(o.x - m.x) < 0.6 && Math.abs(o.z - m.z) < 0.6 && Math.abs(o.y - m.y) < 1.5 : o.ax === m.ax && o.ay === m.ay && o.az === m.az && o.f === m.f));
    const good = s => s && typeof s === 'object' && ITEMS[s.id] ? s : null;
    MP.decoIn = true; try {
      if (m.op === 'del') { if (e) removeEnt(e); }
      else if (m.k === 'frame') { const item = good(m.item), rot = (m.rot | 0) & 7; if (!e) spawnFrame(m.ax, m.ay, m.az, m.f, { glow: !!m.glow, item, rot }); else { e.item = item; e.rot = rot; frameRebuild(e); } }
      else if (m.k === 'painting') { if (!e && PAINTINGS.some(p => p[0] === m.motif)) spawnPainting(m.ax, m.ay, m.az, m.f, m.motif); }
      else { const armor = [0, 1, 2, 3].map(i => good(Array.isArray(m.armor) && m.armor[i])); if (!e) spawnArmorStand(+m.x, +m.y, +m.z, +m.yaw || 0, armor); else { e.armor = armor; scene.remove(e.mesh); e.mesh = standMesh(e); scene.add(e.mesh); } }
      if (m.k === 'frame' && MP.role === 'host') rsNotify(m.ax, m.ay, m.az); // comparators read frames
    } finally { MP.decoIn = false; } }
  if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id);
}
function mpDecoHook(e) { // a new decoration: its hits and its own removal (lost wall, fell out of the world) reach everyone
  if (!e) return e; const hit = e.onHit, tick = e.tick;
  e.onHit = function (q) { const r = hit.apply(this, arguments); mpDecoSend(q, q.dead ? 'del' : 'set'); return r; };
  e.tick = function (q) { if (MP.on && MP.role === 'guest' && q.kind !== 'armor_stand') return; const r = tick.apply(this, arguments); if (q.dead) mpDecoSend(q, 'del'); return r; }; // a guest's frames follow the runner's
  if (MP.act && !MP.decoIn) mpDecoSend(e, 'add');
  return e;
}
// ---------- splash potions and lingering clouds reach every player (and the runner's mobs) ----------
function mpGotSplash(m, from) {
  if (m.dim === W.dim && [m.x, m.y, m.z].every(isFinite)) { MP.splashIn = true; try {
    if (m.k === 'cloud') { if (POTION[m.type]) spawnCloud(+m.x, +m.y, +m.z, m.type, { r: Math.min(8, +m.r || 3), dur: Math.min(2400, +m.dur || 600), breath: !!m.breath, col: isFinite(m.col) ? +m.col : undefined }); }
    else if (ITEMS[m.id] && ITEMS[m.id].splash) splashPotion(m.id, +m.x, +m.y, +m.z, m.dm != null ? ENT.find(q => !q.dead && q.kind === 'mob' && (q.remote ? q.rid : q.mpid) === m.dm) : null);
  } finally { MP.splashIn = false; } }
  if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id);
}
function mpArrowAtGuest(e) { // host-side arrows also hit guests where they stand
  if (e.stuck || e.thrown || e.owner === PL) return false;
  for (const p of MP.peers.values()) { const s = p.s; if (!s || s.dim !== W.dim || s.dead || s.mode === 'creative') continue;
    if (e.x > s.x - 0.4 && e.x < s.x + 0.4 && e.z > s.z - 0.4 && e.z < s.z + 0.4 && e.y > s.y && e.y < s.y + 1.8) {
      const dmg = Math.ceil(Math.hypot(e.vx, e.vy, e.vz) * e.dmgMul); mpSend({ t: 'hurt', dmg: dmg * DIFF_MUL(), cause: 'arrow' }, p.id); mpSend({ t: 'kb', vx: e.vx * 0.3, vy: 0.2, vz: e.vz * 0.3 }, p.id); removeEnt(e); return true; } }
  return false;
}

const MP_SND_SKIP = new Set(['break', 'place', 'dig', 'step', 'pop', 'xp', 'levelup', 'hurt']); // sent another way, or only for you
const MP_FX = { arrow: e => [e.stuck ? 1 : 0, e.trident ? 1 : 0, +e.vx.toFixed(2), +e.vy.toFixed(2), +e.vz.toFixed(2), e.spit ? 1 : 0], fireball: e => e.small ? 1 : 0, wskull: e => e.blue ? 1 : 0, bullet: () => 0, fang: e => e.mesh && e.mesh.visible ? 1 : 0, falling: e => [e.block, e.bmeta || 0] };
function mpMirrorFx(l) {
  const seen = new Set();
  for (const [id, k, x, y, z, s] of l) { if (![x, y, z].every(isFinite)) continue; seen.add(id); let e = ENT.find(q => q.kind === 'mpfx' && q.rid === id && !q.dead);
    if (!e) { e = mpFxMake(k, x, y, z, s); if (!e) continue; e.rid = id; }
    e.tx = x; e.ty = y; e.tz = z; e.fs = s; }
  for (const e of ENT) if (e.kind === 'mpfx' && !e.dead && !seen.has(e.rid)) removeEnt(e);
}
function mpFxMake(k, x, y, z, s) {
  let mesh = null;
  if (k === 'arrow') { mesh = Array.isArray(s) && s[1] ? R.itemMesh(IID.trident) : new THREE.Mesh(arrowGeo, arrowMat.clone()); if (Array.isArray(s) && s[5]) { mesh.scale.setScalar(0.3); mesh.material.color.set(0xf0f0e8); } } // a llama's spit is a small white blob
  else if (k === 'fireball') { mesh = R.itemMesh(IID.fire_charge); mesh.scale.setScalar(s ? 0.3 : 1); }
  else if (k === 'wskull') mesh = new THREE.Mesh(skullGeo, new THREE.MeshBasicMaterial({ color: s ? 0x6a8aff : 0x2a2a2a }));
  else if (k === 'bullet') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xf8f0d0 }));
  else if (k === 'fang') { mesh = new THREE.Group(); for (const sd of [-1, 1]) { const m = new THREE.Mesh(fangGeo, fangMat.clone()); m.position.set(0, 0.3, sd * 0.15); mesh.add(m); } }
  else if (k === 'falling' && Array.isArray(s) && BLOCKS[s[0]]) mesh = new THREE.Mesh(R.blockGeometry(itemOfBlock(s[0], s[1] | 0)), R.blockMaterial());
  if (!mesh) return null;
  const e = Ent('mpfx', x, y, z); e.kind = 'mpfx'; e.fk = k; e.mesh = mesh; e.w = k === 'fireball' && !s ? 0.5 : 0; e.h = k === 'fireball' && !s ? 1 : 0; e.tick = mpFxTick; e.render = mpFxRender;
  if (k === 'fireball' && !s) { e.hittable = true; e.onHit = q => { mpToAuth({ t: 'deflect', e: q.rid, d: lookDir() }); play('hit'); }; } // big fireballs can be hit back
  return addEnt(e);
}
function mpFxTick(e) { if (e.tx == null) return; e.x += (e.tx - e.x) * 0.6; e.y += (e.ty - e.y) * 0.6; e.z += (e.tz - e.z) * 0.6; if (e.fk === 'fireball' && Math.random() < 0.5) R.simpleParticle(e.x, e.y + (e.fs ? 0.16 : 0.5), e.z, [0.4, 0.4, 0.4], { kind: 'smoke', size: e.fs ? 0.15 : 0.4, vy: 0.1, grav: 0, life: 0.4 }); }
function mpFxRender(e, x, y, z, br, now) {
  const m = e.mesh, s = e.fs;
  if (e.fk === 'arrow') { m.position.set(x, y, z); if (Array.isArray(s) && !s[0] && (s[2] || s[3] || s[4])) m.lookAt(x + s[2], y + s[3], z + s[4]); m.traverse(o => { if (o.isMesh) R.setMeshLight(o, br); }); }
  else if (e.fk === 'falling') { m.position.set(x, y + 0.5, z); R.setMeshLight(m, br); }
  else if (e.fk === 'fang') { m.position.set(x, y, z); m.visible = !!s; }
  else { m.position.set(x, y + (e.fk === 'fireball' ? (s ? 0.16 : 0.5) : 0.15), z); m.rotation.set(now / 200, now / 300, 0); if (e.fk === 'fireball') m.traverse(o => { if (o.isMesh) R.setMeshLight(o, 1.4); }); }
}
// ---------- what other players do to blocks: the sound and the pieces flying ----------
function mpGotBfx(m, from) {
  if (m.dim === W.dim && [m.x, m.y, m.z].every(Number.isInteger) && BLOCKS[m.id]) { const d = Math.hypot(PL.x - m.x - .5, PL.y - m.y, PL.z - m.z - .5);
    if (d < 24) { const mat = soundMat(m.id), vol = 1 - d / 24; if (m.k === 'dig') play('dig', { mat, vol: 0.5 * vol }); else play(m.k === 'place' ? 'place' : 'break', { mat, vol }); R.blockParticles(m.x, m.y, m.z, m.id, m.k === 'dig' ? 1 : m.k === 'place' ? 0 : 24, lightBright(m.x + .5, m.y + 1, m.z + .5), m.m | 0); } }
  if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id);
}
// ---------- lightning: the runner strikes, everyone sees the bolt (and takes it where they stand) ----------
function mpBoltFx(x, y, z) {
  W.flash = 1; boltMesh(x + .5, y, z + .5);
  const dist = Math.hypot(PL.x - x - .5, PL.z - z - .5); play('thunder', { vol: Math.max(0.15, 1 - dist / 160) }); if (dist < 24) play('explode', { vol: 0.5 * (1 - dist / 24) });
  if (!PL.dead && Math.abs(PL.x - x - .5) < 3 && Math.abs(PL.z - z - .5) < 3 && PL.y > y - 3 && PL.y < y + 6 && !creative()) { PL.fire = Math.max(PL.fire, 160); hurtPlayer(5, 'lightning'); }
}
// ---------- the fishing line and the eye of ender another player threw ----------
function mpPeerFx(p, s, light) {
  const want = Array.isArray(s.fx) ? s.fx : [], have = p.fxm || (p.fxm = {});
  for (const k of ['bobber', 'eye']) {
    const f = want.find(q => Array.isArray(q) && q[0] === k && [q[1], q[2], q[3]].every(isFinite)); let o = have[k];
    if (!f) { if (o) { scene.remove(o); o.traverse(q => { if (q.material) q.material.dispose(); if (q.geometry && k === 'bobber' && q.isLine) q.geometry.dispose(); }); delete have[k]; } continue; }
    if (!o) { o = have[k] = new THREE.Group();
      if (k === 'eye') { const m = R.itemMesh(IID.ender_eye); m.scale.setScalar(0.3); o.add(m); }
      else { o.add(fishHookMesh()); const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x101010 })); ln.frustumCulled = false; o.add(ln); o.userData.line = ln; }
      scene.add(o); }
    o.position.set(+f[1], +f[2] + 0.06, +f[3]); o.visible = !s.dead;
    if (o.userData.line) { const yw = s.yaw, hx = p.pos[0] - Math.sin(yw) * 0.6 + Math.cos(yw) * 0.35, hy = p.pos[1] + (s.sneak ? 1.25 : 1.45), hz = p.pos[2] - Math.cos(yw) * 0.6 - Math.sin(yw) * 0.35;
      const a = o.userData.line.geometry.attributes.position; a.setXYZ(0, 0, 0, 0); a.setXYZ(1, hx - o.position.x, hy - o.position.y, hz - o.position.z); a.needsUpdate = true; }
    o.traverse(q => { if (q.isMesh || q.isSprite) R.setMeshLight(q, light); });
  }
}
function mpDropPeerFx(p) { if (p.fxm) { for (const k in p.fxm) scene.remove(p.fxm[k]); p.fxm = null; } if (p.crack) { scene.remove(p.crack); p.crack.material.dispose(); p.crack = null; } }
// ---------- other players' figures ----------
function mpAvatar(p) {
  if (p.m) return p.m;
  mpSkinTex(p);
  const sk = p.skin || {}, m = buildModel(sk.slim ? 'player_slim' : 'player', { skin: p.skinReady ? p.skinKey : PACKPX.ent[sk.tex] ? sk.tex : 'steve' });
  m.userData.armorKey = ''; m.userData.armor = []; m.userData.heldKey = ['', '']; m.userData.held = [null, null]; if (m.userData.mat2) m.userData.mat2.visible = false;
  m.userData.st = { bodyYaw: NaN, limb: 0, limbD: 0, wingP: 0.2617994, wingR: -0.2617994, wingY: 0, wingPy: 0, lean: 0, deathT: 0 };
  p.tag = makeNameTag(p.name); p.m = m; p.pos = null; scene.add(m); return m; // the name above the head, as Java draws it (entities.js)
}
const MP_HURT = new THREE.Color(1, 0.6, 0.6);
function mpPlaceTag(p, s, ps, light) { // Java: the player's height + 0.5 (1.8 standing, 1.5 sneaking, 0.6 swimming or gliding, 0.2 in bed); none while invisible
  const h = ps.sleep ? 0.2 : ps.swim || ps.gliding ? 0.6 : ps.sneak ? 1.5 : 1.8;
  placeNameTag(p.tag, p.pos[0], p.pos[1] + h, p.pos[2], !s.dead && !s.inv && !(s.mode === 'spectator' && PL.mode !== 'spectator'), ps.sneak, light);
}
function mpDropAvatar(p) { if (p.m) { scene.remove(p.m); p.m.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.dispose(); }); dropNameTag(p.tag); p.tag = null; p.m = null; } } // the figure's own materials (textures and shapes are shared)
function mpSeatOf(p) {
  const id = p.id, runner = MP.auth && MP.auth[W.dim], fresh = t => performance.now() - (t || 0) < 1500;
  const is = v => v != null && v !== 0 && (v === id || (v === 'runner' && runner === id)); // 0 is "nobody" (and also the host's own id)
  for (const e of ENT) { if (e.dead || !e.mesh || !(e.kind === 'boat' || e.kind === 'minecart' || e.kind === 'mob')) continue;
    const drv = e.remote ? is(e.riderId) : !!e.mpRider && e.mpRider === id, back = e.kind === 'boat' && (e.remote ? is(e.seat2Id) : !!e.mpRider2 && e.mpRider2 === id && fresh(e.mpRider2At)); // (the driver's claim lapses on its own after 1.5 s without word)
    if (!drv && !back) continue;
    const m = e.mesh.position, yaw = e.yaw || 0, two = e.kind === 'boat' && (e.remote ? !!e.seat2Id : (e.mpRider2 && fresh(e.mpRider2At)) || e.rider2 === PL || e.mob);
    const f = back ? -0.6 : two ? 0.2 : 0, dy = e.kind === 'boat' ? 0.95 + 0.18 : e.rideY != null ? e.rideY : 0.18; // a boat is drawn 0.95 lower than it stands
    return [m.x - Math.sin(yaw) * f, m.y + dy, m.z - Math.cos(yaw) * f]; }
  return null;
}
function mpRender(dt) {
  if (!MP.on) return;
  for (const p of MP.peers.values()) {
    const s = p.s; if (!s || s.dim !== W.dim || performance.now() - p.at > 5000) { if (p.m) { p.m.visible = false; p.tag.back.visible = p.tag.front.visible = false; } mpDropPeerFx(p); continue; }
    const m = mpAvatar(p), st = m.userData.st, k = Math.min(1, dt * 12);
    // drawn a little in the past, between the two updates around that moment, so the figure moves at an even pace
    // (updates come 20 times a second); the legs swing with the speed between updates, as Java's limbDistance does
    const last = p.pos || [s.x, s.y, s.z], H = p.hist || [], rt = performance.now() - 80; let a = H[H.length - 1], b = a;
    for (let i = H.length - 1; i > 0; i--) if (H[i - 1][0] <= rt) { a = H[i - 1]; b = H[i]; break; }
    const f = b && a && b[0] > a[0] ? Math.min(1, Math.max(0, (rt - a[0]) / (b[0] - a[0]))) : 1;
    p.pos = a ? [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f] : [s.x, s.y, s.z];
    if (Math.hypot(p.pos[0] - last[0], p.pos[2] - last[2]) > 8) p.hist = [[performance.now(), s.x, s.y, s.z]]; // a teleport: no sliding across the world
    const seat = s.ride ? mpSeatOf(p) : null; if (seat) p.pos = seat; // riding: sat on the boat, cart or horse as it is drawn here, not floating beside it
    const mvx = p.pos[0] - last[0], mvz = p.pos[2] - last[2], dtT = dt * 20, segT = a && b && b[0] > a[0] ? (b[0] - a[0]) / 50 : 0;
    p.spd = segT ? Math.hypot(b[1] - a[1], b[3] - a[3]) / segT : 0; // blocks per tick
    if (!(st.bodyYaw === st.bodyYaw)) st.bodyYaw = s.yaw;
    const glide = !!s.glide, swim = s.pose === 'swim' && !glide; p.glideT = glide ? (p.glideT || 0) + dtT : 0;
    const pk = v => typeof v === 'string' && /^(item|block|spear|spy)$/.test(v) ? v : null, hasPose = 'pr' in s;
    const ps = { headYaw: 0, headPitch: -s.pitch, headPitchW: -s.pitch, yaw: s.yaw, right: hasPose ? pk(s.pr) : s.held ? 'item' : null, left: hasPose ? pk(s.plf) : s.off ? 'item' : null, two: /^(bow|xbow|xcharge)$/.test(s.two || '') ? s.two : null, charge: +s.chg || 0, swing: s.swing, swingLeft: !!s.swl,
      sneak: (!!s.sneak || s.pose === 'crouch') && !s.fly && !glide, riding: !!s.ride, flying: !!s.fly, gliding: glide, glideT: p.glideT, vel2: mvx * mvx + mvz * mvz, vy: (s.y - last[1]) || 0, swim, sleep: !!s.sleep, bedYaw: +s.by || 0, age: performance.now() / 50 };
    tickBodyYaw(st, ps, mvx, mvz, dtT);
    const spd = Math.min(1, (p.spd || 0) * 4); st.limbD += (spd - st.limbD) * Math.min(1, 0.4 * dtT); st.limb += st.limbD * dtT;
    st.lean += ((swim ? 1 : 0) - st.lean) * Math.min(1, 0.18 * dtT);
    ps.headYaw = glide || swim ? 0 : -wrapA(s.yaw - st.bodyYaw);
    const ghost = s.mode === 'spectator' && PL.mode !== 'spectator'; // spectators are seen only by other spectators
    m.visible = !s.dead && !ghost; posePlayer(m, ps); placePlayer(m, ps, p.pos[0], p.pos[1], p.pos[2]);
    const light = lightBright(p.pos[0], p.pos[1] + 1, p.pos[2]), hurt = p.hurtFx > 0; if (hurt) p.hurtFx -= dtT;
    mpPlaceTag(p, s, ps, light);
    for (const mt of m.userData.mats) { mt.color.setScalar(light); if (hurt) mt.color.multiply(MP_HURT); mt.visible = !s.inv; } // invisible: only the armour and what's in the hands show
    updateArmor(m, light, (s.armor || []).map(a => a ? { id: a[0], n: 1, e: a[1] ? { protection: 1 } : null } : null).map(a => a && ITEMS[a.id] ? a : null));
    updateHeld(m, [s.held && ITEMS[s.held] ? { id: s.held, n: 1 } : null, s.off && ITEMS[s.off] ? { id: s.off, n: 1 } : null], light, !s.lh);
    if (s.fire && !s.dead && Math.random() < 0.3) R.simpleParticle(p.pos[0] + (Math.random() - .5) * 0.6, p.pos[1] + Math.random() * 1.8, p.pos[2] + (Math.random() - .5) * 0.6, [1, 0.6, 0.1], { kind: 'flame', size: 0.12, vy: 1, grav: -0.2, life: 0.4 });
    mpPeerFx(p, s, light); if (Array.isArray(s.ec) && s.ec.length === 3 && !s.dead) effSwirl(p.pos[0], p.pos[1], p.pos[2], 1.8, s.ec, dt); // their potion effects
    const mn = Array.isArray(s.mine) && s.mine.length === 4 && s.mine.every(Number.isInteger) ? s.mine : null, mid = mn && getBlock(mn[0], mn[1], mn[2]); // the cracks in the block they dig
    if (mn && mid && (p.digT = (p.digT || 0) + dtT) > 4) { p.digT = 0; mpGotBfx({ dim: W.dim, x: mn[0], y: mn[1], z: mn[2], id: mid, m: getMeta(mn[0], mn[1], mn[2]), k: 'dig' }); }
    if (mn && mid) { if (!p.crack) { p.crack = new THREE.Mesh(R.crack.geometry, R.crack.material.clone()); scene.add(p.crack); } p.crack.geometry = crackGeometry(mid, getMeta(mn[0], mn[1], mn[2])); p.crack.position.set(mn[0] + .5, mn[1] + .5, mn[2] + .5); p.crack.scale.setScalar(1.002); p.crack.material.map = R.crackTexs[Math.max(0, Math.min(9, mn[3]))]; p.crack.visible = true; }
    else if (p.crack) p.crack.visible = false;
  }
}

// ---------- hooks into the game (installed once, they do nothing outside multiplayer) ----------
let mpHooked = false;
function mpInstall() {
  if (mpHooked) return; mpHooked = true;
  const wrapLocal = f => function () { MP.local = true; try { return f.apply(this, arguments); } finally { MP.local = false; } };
  playerTick = wrapLocal(playerTick); onUsePress = wrapLocal(onUsePress); onUseRelease = wrapLocal(onUseRelease);
  const gt = gameTick; gameTick = function () { gt(); mpTick(); };
  const upm = updatePlayerModel; updatePlayerModel = function (dt) { upm.apply(this, arguments); mpRender(dt); };
  const g0 = gr; gr = k => (MP.role === 'guest' && (k === 'doWeatherCycle' || k === 'doMobSpawning')) || (MP.server && k === 'doWeatherCycle') ? false : g0(k); // the host's (or the server's) world decides; clocks run here and are corrected
  const sm = spawnMob; spawnMob = function () { const e = sm.apply(this, arguments); if (MP.role === 'guest' && !MP.allowSpawn) { removeEnt(e); // guests only show the host's mobs
      if (e && (MP.cmd || MP.act) && W.active && !MP.loading) { const [type, x, y, z] = arguments; queueMicrotask(() => { const o = {}; for (const k of MP_SUMMON_KEYS) if (e[k] != null && e[k] !== false) o[k] = e[k]; mpToAuth({ t: 'summon', type, x, y, z, o }); }); } } // a guest's egg, golem, crystal: the runner makes the real mob once the caller has set its fields
    return e; };
  for (const n of ['spawnFrame', 'spawnPainting', 'spawnArmorStand']) { const f = window[n]; if (typeof f === 'function') window[n] = function () { return mpDecoHook(f.apply(this, arguments)); }; }
  for (const n of ['frameUse', 'standUse']) { const f = window[n]; if (typeof f === 'function') window[n] = function (e) { const r = f.apply(this, arguments); mpDecoSend(e, e.dead ? 'del' : 'set'); return r; }; }
  const spl = splashPotion; splashPotion = function (id, x, y, z, direct) { if (MP.on && !MP.splashIn && W.active) mpSend({ t: 'splash', dim: W.dim, id, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), dm: direct && direct !== PL ? (direct.remote ? direct.rid : direct.mpid) : null }); return spl.apply(this, arguments); };
  const scl = spawnCloud; spawnCloud = function (x, y, z, type, o) { if (MP.on && !MP.splashIn && W.active) mpSend({ t: 'splash', k: 'cloud', dim: W.dim, x, y, z, type, r: o && o.r, dur: o && o.dur, breath: o && o.breath, col: o && o.col }); return scl.apply(this, arguments); };
  const lr = launchRocket; launchRocket = function (x, y, z, st, rider, shot) { const r = lr.apply(this, arguments); if (MP.on && !rider && !MP.fwIn && W.active) mpSend({ t: 'fw', dim: W.dim, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), fw: st && st.fw || null, shot: shot || null }); return r; }; // everyone sees (and feels) a rocket
  const i6 = items6Use; items6Use = function (t, h) { if (MP.role === 'guest' && h && h.id === IID.lead && t && t.type === 'block' && FENCES.has(t.id) && ENT.some(e => e.remote && e.leash && e.leash.p === MP.id)) { mpToAuth({ t: 'tie', x: t.x, y: t.y, z: t.z }); play('place', { mat: 'wool' }); swing(); return true; } return i6.apply(this, arguments); };
  const bb = breakBlock; breakBlock = function (x, y, z) { const id = getBlock(x, y, z), m = getMeta(x, y, z), r = bb.apply(this, arguments); if (MP.on && id && getBlock(x, y, z) !== id && W.active) mpSend({ t: 'bfx', k: 'break', dim: W.dim, x, y, z, id, m }); return r; }; // others hear it and see the pieces
  const pbk = placeBlock; placeBlock = function (t) { const at = t ? [[t.x, t.y, t.z], [t.x + t.nx, t.y + t.ny, t.z + t.nz]] : [], was = at.map(q => getBlock(...q)), r = pbk.apply(this, arguments);
    if (MP.on && W.active) at.forEach((q, i) => { const id = getBlock(...q); if (id && id !== was[i]) mpSend({ t: 'bfx', k: 'place', dim: W.dim, x: q[0], y: q[1], z: q[2], id, m: getMeta(...q) }); }); return r; };
  const slk = strikeLightning; strikeLightning = function (x, y, z, rod) { if (MP.on && MP.role === 'guest') { if (!MP.wx && W.active) mpToAuth({ t: 'strike', x, y, z, rod: rod ? 1 : 0 }); return; } const r = slk.apply(this, arguments); if (MP.on && W.active) mpSend({ t: 'bolt', dim: W.dim, x, y, z }); return r; }; // the runner strikes; a guest's trident asks it to
  const wtk = weatherTick; weatherTick = function () { MP.wx = true; try { return wtk.apply(this, arguments); } finally { MP.wx = false; } }; // a guest's sky only follows the runner's bolts
  for (const n of ['fireballTick', 'witherSkullTick', 'bulletTick']) { const f = window[n]; if (typeof f === 'function') window[n] = function (e) { if (MP.role === 'host' && MP.peers.size) { const g = e.guestOwner || mpNearestGuest(e); if (g) return mpProxy(g, () => f(e)); } return f(e); }; } // projectiles chase and hit the nearest player, guests too
  const sfg = spawnFang; spawnFang = function () { const e = sfg.apply(this, arguments); if (e && e.tick) { const t = e.tick; e.tick = function (q) { if (MP.role === 'host' && MP.peers.size) { const g = mpNearestGuest(q); if (g) return mpProxy(g, () => t(q)); } return t(q); }; } return e; };
  const ib = interactBlock; interactBlock = function (t, dry) { if (dry || !MP.on || !t || t.type !== 'block') return ib.apply(this, arguments); const j0 = JSON.stringify(getTile(t.x, t.y, t.z) || null), r = ib.apply(this, arguments);
    const j1 = JSON.stringify(getTile(t.x, t.y, t.z) || null); if (j1 !== j0 && j1 !== 'null' && !UI.screen) mpTileChanged(t.x, t.y, t.z); return r; }; // a record, a book, a cake bite changed in place: everyone gets it
  const fpl = fishPull; fishPull = function (h, vx, vy, vz) { if (h.remote && h.kind === 'mob') { mpToAuth({ t: 'pull', e: h.rid, vx, vy, vz }); return; } return fpl.apply(this, arguments); }; // the runner's mob is pulled on the runner
  const btk = bobberTick; bobberTick = function (e) { // a hook can catch another player too
    if (MP.on && e.hookPeer != null) { const p = MP.peers.get(e.hookPeer); if (p && p.pos && p.s && !p.s.dead && p.s.dim === W.dim) { e.x = p.pos[0]; e.y = p.pos[1] + 1.4; e.z = p.pos[2]; const hd = PL.held(); if (!hd || hd.id !== IID.fishing_rod || Math.hypot(e.x - PL.x, e.z - PL.z) > 32 || PL.dead) removeEnt(e); return; } e.hookPeer = null; }
    const r = btk.apply(this, arguments);
    if (MP.on && !e.dead && !e.hooked && e.age > 2) for (const p of MP.peers.values()) { const q = p.pos, s = p.s; if (!q || !s || s.dead || s.dim !== W.dim || s.mode === 'spectator') continue; if (Math.abs(q[0] - e.x) < 0.4 && Math.abs(q[2] - e.z) < 0.4 && e.y > q[1] - 0.1 && e.y < q[1] + 1.8) { e.hookPeer = p.id; play('hit', { vol: 0.4 }); break; } }
    return r; };
  const urd = useRod; useRod = function () { const b = ENT.find(e => e.kind === 'bobber' && !e.dead); if (MP.on && b && b.hookPeer != null) { const p = MP.peers.get(b.hookPeer); if (p && p.pos) { const dx = PL.x - p.pos[0], dy = PL.y - p.pos[1], dz = PL.z - p.pos[2]; mpSend({ t: 'pull', tgt: p.id, vx: dx * 0.1, vy: dy * 0.1 + Math.sqrt(Math.hypot(dx, dy, dz)) * 0.08, vz: dz * 0.1 }, MP.server ? p.id : (MP.role === 'host' ? p.id : undefined)); } b.hookPeer = null; swing(); removeEnt(b); damageItem(INV.slots, INV.sel, 5); return; } return urd.apply(this, arguments); };
  const oth = onThrownHit; onThrownHit = function (e) { const a0 = MP.act; MP.act = e.owner === PL; try { return oth.apply(this, arguments); } finally { MP.act = a0; } }; // your egg's chick, your pearl's endermite
  for (const n of ['useItem', 'golemCheck', 'witherCheck', 'breakBlock']) { const f = window[n]; if (typeof f === 'function') window[n] = function () { const a0 = MP.act; MP.act = true; try { return f.apply(this, arguments); } finally { MP.act = a0; } }; } // player actions whose mobs are real
  const mt = mobTick, mt2 = e => { if (e.remote) return mpPuppetTick(e); if (e.mpRider && performance.now() - e.mpRideAt < 1500) return; /* a guest steers it */ if (MP.role === 'host' && MP.peers.size && !e.deathT) { const g = mpNearestGuest(e); if (g) return mpProxy(g, () => mt(e)); } return mt(e); };
  mobTick = e => { MP.tickMob = e; if (!(e.love > 0)) e.loveBy = undefined; try { return mt2(e); } finally { MP.tickMob = null; } };
  // whatever a guest did through the runner (a kill, taming, breeding, a trade...) counts for that guest, not the runner
  const ag = advGrant; advGrant = function (id, crit) {
    const lb = (id === 'husbandry/breed_an_animal' || id === 'husbandry/bred_all_animals') && MP.tickMob ? MP.tickMob.loveBy : undefined; // a baby: whoever fed the parent
    if (lb != null) { if (lb !== MP.id) mpSend({ t: 'adv', id, crit: crit == null ? null : crit }, lb); return; }
    if (MP.proxy && !(id === 'husbandry/breed_an_animal' || id === 'husbandry/bred_all_animals')) { mpSend({ t: 'adv', id, crit: crit == null ? null : crit }, MP.proxy.id); return; } return ag.apply(this, arguments); };
  const hp = hurtPlayer; hurtPlayer = function (dmg, cause) { if (MP.proxy) { mpSend({ t: 'hurt', dmg, cause }, MP.proxy.id); return true; } return hp.apply(this, arguments); };
  const ae = addEffect; addEffect = function (t, k, dur, lv) { if (MP.proxy && t === PL) { mpSend({ t: 'eff', k, dur, lv: lv || 0 }, MP.proxy.id); return; } return ae.apply(this, arguments); };
  const pl = play; play = function (name, o) { if (MP.proxy) return; // a guest's fight isn't heard at the host's ears
    if (MP.on && MP.act && !MP.sndIn && W.active && !MP_SND_SKIP.has(name) && (MP.sndN = (MP.sndN || 0) + 1) <= 4) mpSend({ t: 'snd', dim: W.dim, x: +PL.x.toFixed(1), y: +PL.y.toFixed(1), z: +PL.z.toFixed(1), n: name, o: o && typeof o === 'object' ? { mat: o.mat, pitch: o.pitch, vol: o.vol } : null }); // doors, note blocks, bells, buckets... heard nearby
    return pl.apply(this, arguments); };
  const at = arrowTick; arrowTick = function (e) { if (e.visual) return mpVisualArrow(e); if (MP.peers.size && e.owner === PL && mpArrowAtPeer(e)) return; if (MP.role === 'host' && MP.peers.size && mpArrowAtGuest(e)) return; return at.apply(this, arguments); };
  // your arrows and tridents fly on the others' screens too (only for looks: hits are worked out by whoever shot)
  // explosions happen in the runner's world: a guest's TNT, bed or anchor asks for one there; everyone else gets the bang,
  // the smoke and their own share of the damage
  const pt = primeTNT; primeTNT = function (x, y, z, fuse = 80) { if (MP.on && MP.role === 'guest' && !MP.allowSpawn) { if (W.active && !MP.loading) mpToAuth({ t: 'prime', x, y, z, fuse }); return; } const r = pt.apply(this, arguments); if (MP.on && MP.role === 'host') mpSend({ t: 'primed', dim: W.dim, x, y, z, fuse }); return r; };
  const ex = explode; explode = function (x, y, z, power, fire) {
    if (MP.on && MP.role === 'guest') { if (W.active && !MP.loading) mpToAuth({ t: 'blast', x, y, z, p: power, fire: fire ? 1 : 0 }); return; }
    const pr = MP.proxy, r = ex.apply(this, arguments);
    if (MP.on && MP.role === 'host') { mpSend({ t: 'boom', dim: W.dim, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), p: power, px: pr ? pr.id : null }); if (pr) queueMicrotask(() => mpBlastSelf(x, y, z, power)); } // a blast worked out for a guest hit that guest; you get yours after
    return r; };
  const sa = shootArrow; shootArrow = function (x, y, z, vx, vy, vz, owner) { const e = sa.apply(this, arguments); if (MP.on && owner === PL && e && !MP.allowSpawn) queueMicrotask(() => { if (!e.dead) mpSend({ t: 'proj', dim: W.dim, x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), vx: +vx.toFixed(3), vy: +vy.toFixed(3), vz: +vz.toFixed(3), k: e.trident ? 1 : 0, th: e.thrown || 0 }); }); return e; };
  const hm = hurtMob; hurtMob = function (e, dmg, attacker, kx = 0, kz = 0) { if (e.remote) { if (attacker === PL) { mpToAuth({ t: 'hit', e: e.rid, dmg, kx, kz }); e.hurt = 10; return true; } return false; } return hm.apply(this, arguments); };
  if (typeof ensureDragon === 'function') { const ed = ensureDragon; ensureDragon = function () { if (MP.role !== 'guest') ed(); }; }
  const lc = loadChunk; loadChunk = (cx, cz) => MP.role === 'guest' || MP.server ? mpRequestChunk(cx, cz) : lc(cx, cz);
  const sc = saveChunk; saveChunk = function (c) { if (MP.server) { if (MP.role === 'host' && !MP.rolePending) mpStoreChunk(c); return; } return sc.apply(this, arguments); };
  const sw = switchDim; switchDim = function () { // a server world: each dimension has its own runner
    const srv = MP.server; if (srv) { mpSendPdata(); if (MP.role === 'host') { mpSendShared(); if (MP.batch && MP.batch.length) { mpSend({ t: 'sets', dim: W.dim, l: MP.batch }); MP.batch = []; } } }
    const r = sw.apply(this, arguments);
    if (srv) { MP.role = 'guest'; MP.rolePending = true; MP.queue = []; mpSend({ t: 'dim', dim: W.dim }); }
    return r; };
  const rcmd = runCommand; runCommand = function (cmd) { const t0 = W.time, r0 = W.rainTarget;
    // a guest's /summon and /kill @e act on the runner's mobs
    if (MP.role === 'guest') { const k = String(cmd || '').trim().replace(/^\//, '').match(/^kill\s+(@e\S*)/); if (k) { const m = k[1].match(/type=(?:minecraft:)?([a-z_]+)/); mpToAuth({ t: 'killall', type: m ? m[1] : null }); } }
    MP.cmd = true; let r; try { r = rcmd.apply(this, arguments); } finally { MP.cmd = false; } if (MP.server && (Math.abs(W.time - t0) > 40 || W.rainTarget !== r0)) mpSend({ t: 'timeset', time: W.time, rain: W.rainTarget, thunder: W.thunderOn }); return r; };
  addEventListener('pagehide', () => { if (MP.on && MP.server) mpServerLeave(); });
  for (const n of ['tickScheduled', 'rsTick', 'randomTicks', 'furnaceTick', 'tileTick', 'spawnerTick']) { const f = window[n]; if (typeof f === 'function') window[n] = function () { if (MP.role !== 'guest') return f.apply(this, arguments); }; } // a guest's world is the host's
  const di = dropItem; dropItem = function (x, y, z, id, n, vel, delay, dur, extra) { // a guest's drops become the host's items, so everyone sees (and can take) them
    if (MP.role === 'guest' && !MP.allowSpawn && W.active) { if (!n || ITEMS[id] == null) return null; const st = extra ? { ...extra, id, n } : { id, n }; if (dur != null) st.d = dur; mpToAuth({ t: 'drop', x, y, z, st, vel: vel || null, delay: delay == null ? 10 : delay }); return null; }
    return di.apply(this, arguments); };
  const sx = spawnXP; spawnXP = function (x, y, z, amt) { if (MP.role === 'guest' && !MP.allowSpawn && W.active) { if (amt > 0) mpToAuth({ t: 'xp', x, y, z, v: amt }); return; } return sx.apply(this, arguments); }; // shared orbs too
  // a block entity made by a player's own action (a placed furnace, chest, sign...) reaches the others right after the block
  const st0 = setTile; setTile = function (x, y, z, t) { st0.apply(this, arguments); if (MP.on && MP.local && !MP.applying && t) queueMicrotask(() => mpTileChanged(x, y, z)); };
  const ac = afterClick; afterClick = function () { ac.apply(this, arguments); const c = GUI.ctx; if (MP.on && c && c.x != null) { if (MP.role === 'guest') mpTileEdit(c); else mpTileChanged(c.x, c.y, c.z); }
    // a guest changes what is in the runner's chest or hopper minecart, or the gear of the runner's horse
    if (MP.role === 'guest' && c && c.cart && c.cart.remote) mpToAuth({ t: 'cartset', e: c.cart.rid, items: c.cart.items });
    if (MP.role === 'guest' && c && c.horse && c.horse.remote) mpToAuth({ t: 'gear', e: c.horse.rid, gear: c.horse.gear }); };
  const ol = W.onChunkLoaded; W.onChunkLoaded = (c, fresh) => { MP.loading = true; try { if (ol) ol(c, fresh); } finally { MP.loading = false; } if (MP.on) mpChunkLoaded(c); };
  const ui0 = useItem; useItem = function (first) { const t = TARGET; if (MP.role === 'guest' && first && t && t.type === 'ent' && t.e.remote && t.e.kind === 'mob' && mpRemoteUsable(t.e)) { const h = PL.held(); mpToAuth({ t: 'use', e: t.e.rid, st: h ? { ...h } : null, sneak: PL.sneaking ? 1 : 0 }); swing(); USE.placeCd = 4; return; } return ui0.apply(this, arguments); };
  const ia = INV.add; INV.add = st => { if (MP.useFor) { mpSend({ t: 'give', st }, MP.useFor.id); return 0; } return ia(st); }; // milk, a bowl of stew... go to the guest
  const os = UI.openScreen; UI.openScreen = (a, b) => { if (!MP.useFor) os(a, b); };
  // a guest trades with the runner's villager: its offers come from the runner, the guest pays with its own items and the runner counts the trade
  const os2 = UI.openScreen; UI.openScreen = (a, b) => { if (MP.role === 'guest' && b && b.cart && b.cart.remote) mpToAuth({ t: 'cartinv', e: b.cart.rid }); if (a === 'trade' && MP.role === 'guest' && b && b.e && b.e.remote) { b.e.trades = b.e.trades || []; mpToAuth({ t: 'trades', e: b.e.rid }); } os2(a, b); if (MP.on && b && b.x != null) { const t = getTile(b.x, b.y, b.z); if (t) b.mpBase = mpJ(t); } };
  const tt = tradeTake; tradeTake = function (c) { const r = tt.apply(this, arguments); if (MP.role === 'guest' && c.e && c.e.remote) mpToAuth({ t: 'traded', e: c.e.rid, i: c.sel }); return r; };
  const pb = placeBoat; placeBoat = function (x, y, z, yaw, wood) { if (MP.on && MP.role === 'guest' && !MP.allowSpawn) { if (W.active && !MP.loading) mpToAuth({ t: 'veh', kind: 'boat', x, y, z, yaw, sub: wood || 'oak' }); return null; } return pb.apply(this, arguments); };
  const pm = spawnMinecart; spawnMinecart = function (x, y, z, ctype, o) { if (MP.on && MP.role === 'guest' && !MP.allowSpawn) { if (W.active && !MP.loading) mpToAuth({ t: 'veh', kind: 'minecart', x, y, z, yaw: o && o.yaw || 0, sub: ctype || 'minecart' }); return null; } return pm.apply(this, arguments); };
  if (typeof horseTame === 'function') { const ht = horseTame; horseTame = function (e) { ht.apply(this, arguments); if (e.remote) mpToAuth({ t: 'tame', e: e.rid }); }; } // tamed by riding it, on a guest's screen
  const rc = raycast; raycast = function () { const r = rc.apply(this, arguments); if (!MP.on) return r; const h = mpRayPeer(); return h && (!r || h.t < r.t) ? h : r; };
  const ae0 = attackEntity; attackEntity = e => e.kind === 'peer' ? mpAttackPeer(e.peer) : ae0(e);
  const sd = UI.showDeath; UI.showDeath = msg => { if (MP.on) { msg = PL.lastHurtBy === 'player' && MP.lastHitBy ? MP.name + '님이 ' + MP.lastHitBy + '님에게 살해당했습니다' : msg.replace(/^플레이어가 /, MP.name + '님이 '); mpSend({ t: 'sys', text: msg }); } return sd(msg); };
}

// ---------- players hitting each other ----------
// another player in the crosshair is a target like a mob; the damage is worked out by the attacker (weapon, charge,
// critical hit) and the one hit takes it through their own armour, shield and enchantments
function mpRayPeer() {
  if (!MP.on || PL.mode === 'spectator') return null;
  const [dx, dy, dz] = lookDir(), ox = PL.x, oy = PL.y + PL.eyeH, oz = PL.z, lim = creative() ? 5 : 3; let best = null;
  for (const p of MP.peers.values()) { const s = p.s; if (!s || s.dim !== W.dim || s.dead || s.mode === 'spectator' || !p.pos || performance.now() - p.at > 5000) continue;
    const [x, y, z] = p.pos, hg = s.h || 1.8, h = rayBox(ox, oy, oz, dx, dy, dz, [x - .35, y, z - .35, x + .35, y + hg, z + .35]);
    if (h && h[0] <= lim && (!best || h[0] < best.t)) { const e = p.hit || (p.hit = { kind: 'peer', peer: p, w: .3 }); e.x = x; e.y = y; e.z = z; e.h = hg; best = { type: 'ent', e, t: h[0] }; } }
  return best;
}
function mpAttackPeer(p) {
  const s = p.s; if (!s || s.dead || s.mode === 'creative' || s.mode === 'spectator' || MP.pvp === false) { PL.attackT = 0; return; }
  const h = PL.held(), tool = h && ITEMS[h.id] && ITEMS[h.id].tool, sharp = enchLv(h, 'sharpness'), as = tool ? tool.as : 4;
  const q = Math.min(1, (PL.attackT + 0.5) / (20 / as)); let dmg = Math.max(0, (tool ? tool.dmg : 1) + (sharp ? 0.5 * sharp + 0.5 : 0) + meleeBonus()) * (0.2 + q * q * 0.8);
  const crit = q > 0.9 && PL.vy < 0 && !PL.onGround && !PL.inWater;
  if (crit) { dmg *= 1.5; for (let i = 0; i < 10; i++) R.simpleParticle(p.pos[0] + (Math.random() - .5) * .6, p.pos[1] + 1.1, p.pos[2] + (Math.random() - .5) * .6, [0.9, 0.9, 0.8], { kind: 'crit', size: 0.08, vy: 1 }); }
  PL.attackT = 0; const kb = enchLv(h, 'knockback') + (PL.sprinting && q > 0.9 ? 1 : 0);
  mpSend({ t: 'pvp', tgt: p.id, from: MP.server ? MP.id : MP.role === 'host' ? 0 : MP.id, dmg: +dmg.toFixed(2), kb, yaw: +PL.yaw.toFixed(3), ax: PL.x, az: PL.z, fire: enchLv(h, 'fire_aspect') * 80 }, MP.role === 'host' || MP.server ? p.id : undefined);
  if (kb > 0) { PL.vx *= 0.6; PL.vz *= 0.6; PL.sprinting = false; }
  PL.exh += 0.1; p.hurtFx = 10; play('hit');
  if (tool) damageItem(INV.slots, INV.sel, tool.type === S.TOOL.SWORD || h.id === IID.trident ? 1 : 2);
}
function mpGotHit(m, att) {
  if (PL.dead || W.dim !== (att && att.s ? att.s.dim : W.dim)) return;
  const src = { x: att && att.s ? att.s.x : +m.ax, z: att && att.s ? att.s.z : +m.az, kind: 'peer' };
  MP.lastHitBy = att ? att.name : null;
  if (!hurtPlayer(Math.min(100, +m.dmg || 0), 'player', src)) return;
  mpSend({ t: 'hitfx', id: MP.role === 'host' && !MP.server ? 0 : MP.id });
  if (m.fire > 0 && !effLv(PL, 'fire_resistance')) PL.fire = Math.max(PL.fire || 0, Math.min(160, +m.fire));
  // LivingEntity.takeKnockback: 0.4 away from the attacker, and the knockback level along the attacker's look
  const kn = (str, x, z) => { const l = Math.hypot(x, z) || 1; PL.vx = PL.vx / 2 - x / l * str; PL.vz = PL.vz / 2 - z / l * str; if (PL.onGround) PL.vy = Math.min(0.4, PL.vy / 2 + str); };
  kn(0.4, src.x - PL.x, src.z - PL.z); if (m.kb > 0) kn(Math.min(5, m.kb) * 0.5, Math.sin(m.yaw), Math.cos(m.yaw));
}
// a guest's right click on one of the host's mobs (feeding, shearing, milking, dyeing, taming, naming...) happens on the
// host, holding the guest's item; what the item becomes and anything handed over goes back to the guest
function mpRemoteUsable(e) { const h = PL.held(); if (e.type === 'villager' || e.type === 'wandering_trader') return !!(h && h.id === IID.name_tag && h.name); if (!h) return !!e.leash || ['wolf', 'cat', 'parrot', 'fox'].includes(e.type); return true; }
function mpLeashHolder(l) { // {p: id}: that player (yourself included) while in this world and dimension (a tab in the background still holds on)
  if (!l || l.p == null) return null; if (l.p === MP.id) return PL;
  const p = MP.peers.get(l.p); return p && p.s && p.s.dim === W.dim ? { x: +p.s.x, y: +p.s.y, z: +p.s.z, dead: !!p.s.dead } : null;
}
function mpRemoteUse(p, e, st, sneak) {
  const sel = INV.sel, keep = INV.slots[sel], keepT = TARGET;
  INV.slots[sel] = st ? { ...st } : null; TARGET = { type: 'ent', e, t: 1 }; MP.useFor = p;
  const love0 = e.love, l0 = e.leash; if (l0 && l0.p === p.id) e.leash = 'player'; // the guest's own lead, as the item code knows it
  try { mpProxy(p, () => { PL.sneaking = !!sneak; useItem(true); }); if (e.love > 0 && !(love0 > 0)) e.loveBy = p.id; if (e.leash === 'player' && l0 !== 'player') e.leash = { p: p.id }; }
  finally { const after = INV.slots[sel]; INV.slots[sel] = keep; TARGET = keepT; MP.useFor = null; mpSend({ t: 'held', st: after || null, was: st ? st.id : 0 }, p.id); }
}
// the night passes when everyone in the world is asleep (the host decides, and wakes the guests)
function mpCanSkipNight() {
  if (!MP.on) return true; if (MP.role !== 'host' || MP.server) return false; // a server world's night passes on the server
  const here = [...MP.peers.values()].filter(p => p.s && p.s.dim === W.dim && p.s.mode !== 'spectator' && performance.now() - p.at < 5000);
  const asleep = here.filter(p => p.s.sleep).length;
  if (asleep < here.length) { if (W.tickN % 20 === 0) UI.flash(`잠자는 플레이어 ${asleep + 1}/${here.length + 1}`); return false; }
  mpSend({ t: 'wake' }); return true;
}
// Tab: who is playing
let mpListEl = null;
function mpShowList(on) {
  if (!mpListEl) { mpListEl = document.createElement('div'); mpListEl.id = 'plist'; document.body.appendChild(mpListEl); }
  if (!on || !W.active) { mpListEl.hidden = true; return; }
  const me = MP.on ? MP.name : '플레이어', rows = [me + (MP.isHost ? ' (호스트)' : '')];
  for (const p of MP.peers.values()) rows.push(p.name + (p.id === 0 ? ' (호스트)' : '') + (p.s && p.s.dim !== W.dim ? ' · ' + ({ '-1': '네더', 1: '디 엔드', 0: '오버월드' })[p.s.dim] : p.s && p.pos ? ' · ' + Math.round(Math.hypot(p.pos[0] - PL.x, p.pos[2] - PL.z)) + 'm' : ''));
  mpListEl.innerHTML = (MP.on ? `<div class="ph">${MP.roomCode ? '방 코드 ' + esc(MP.roomCode) + ' · ' : MP.server && !MP.isHost ? '서버 세계 · ' : ''}${rows.length}명</div>` : '') + rows.map(r => `<div>${esc(r)}</div>`).join(''); mpListEl.hidden = false;
}
addEventListener('keydown', e => { if (e.code === 'Tab' && W.active && !UI.menu && !UI.screen && !UI.chatOpen) mpShowList(true); });
addEventListener('keyup', e => { if (e.code === 'Tab') mpShowList(false); });
addEventListener('blur', () => mpShowList(false));

// ---------- menus ----------
function mpMenu(name) {
  const nameRow = ACC.user ? `<label>내 이름 (로그인함 — 바꾸려면 타이틀에서 로그아웃)<input id="mpName" value="${esc(ACC.user.name)}" maxlength="16" disabled></label>` : `<label>내 이름<input id="mpName" value="${esc(MP.name)}" maxlength="16"></label>`, addr = `<label>서버 주소 (Render 서버나 node tools/server.js)<input id="mpAddr" value="${esc(mpDefaultAddr())}" placeholder="이름.onrender.com"></label>`;
  const st = `<p class="muted" id="mpStatus">${esc(MP.status || '')}</p>`;
  if (name === 'mp_create') return `<h2>서버 세계 만들기</h2><div class="form"><p class="muted">이 서버에는 아직 세계가 없습니다. 새로 만들면 서버 컴퓨터에 저장되어, 만든 사람이 없어도 누구나 접속해 플레이할 수 있습니다.</p><label>세계 이름<input id="mpWName" value="서버 세계" maxlength="40"></label><label>시드 (비우면 무작위)<input id="mpSeed" maxlength="32"></label><label>게임 모드<select id="mpMode"><option value="survival">서바이벌</option><option value="creative">크리에이티브</option></select></label><label class="chk"><input type="checkbox" id="mpCheats"> 명령어 허용</label>${btn('만들고 들어가기', 'mp_createworld')}${st}</div><div class="btncol">${btn('취소', 'mp_cancel')}</div>`;
  if (name === 'mp_join') { setTimeout(() => { if (MPL.state !== 'loading' && UI.menu === 'mp_join') mpRefreshList(MPL.addr || undefined); }); return `<h2>멀티플레이</h2><div class="form">${nameRow}
    <div class="mpsrv"><span id="mpSrv">${mpSrvLine()}</span>${btn('새로고침', 'mp_refresh', 'sm')}</div>
    <div class="wlist mpl" id="mpList">${mpListHtml()}</div>
    <div class="mprow"><input id="mpRoom" maxlength="8" placeholder="방 코드 (예: K7QF)" autocomplete="off" spellcheck="false">${btn('방 코드로 참가', 'mp_code')}</div>
    ${st}<p class="muted">같이 하는 방법: ① 한 명이 자기 세계에서 Esc → <b>멀티플레이 열기</b> → <b>서버로 열기</b> ② 다른 사람은 여기 목록에서 그 세계의 <b>참가</b>를 누르거나 방 코드를 넣기 · 서버 세계는 누구나 언제든 들어갈 수 있어요</p>
    <details class="mpadv"><summary>다른 서버 · 서버 없이 연결</summary>${addr}${btn('이 주소로 목록 보기', 'mp_refresh')}<p class="muted">서버 없이: 호스트가 보낸 초대 코드를 붙여 넣으세요.</p><textarea id="mpCode" rows="3" placeholder="초대 코드"></textarea>${btn('초대 코드로 참가', 'mp_answer')}<textarea id="mpOut" rows="3" readonly placeholder="여기 나오는 답장 코드를 호스트에게 보내세요"></textarea></details></div><div class="btncol">${btn('뒤로', 'title')}</div>`; }
  if (name === 'mp_host') {
    if (!MP.on) return `<h2>멀티플레이 열기</h2><div class="form">${nameRow}${btn('서버 세계로 올리기 (추천)', 'mp_upload')}<p class="muted">이 세계를 서버(${esc(mpShortAddr(mpDefaultAddr()))})에 올려 계속 남는 서버 세계로 만들고 바로 들어갑니다. 모든 플레이어의 멀티플레이 목록에 남아, 내가 없어도 누구나 언제든 다시 들어갈 수 있어요. 내 싱글플레이 세계는 그대로 남습니다.</p>
      ${btn('잠깐 열기 (내가 나가면 닫힘)', 'mp_hostws')}<p class="muted">지금 이 세계를 내 컴퓨터에서 연 채로 친구를 부릅니다. 방 코드가 생기고 "${esc(MP.name)}님의 세계"로 목록에 나타나지만, 내가 나가면 닫힙니다.</p>
      <details class="mpadv"><summary>다른 서버 · 서버 없이 열기</summary>${addr}${btn('서버 없이 열기 (초대 코드)', 'mp_hostrtc')}</details>${st}</div><div class="btncol">${btn('뒤로', 'pause')}</div>`;
    const list = [...MP.peers.values()].map(p => esc(p.name)).join(', ') || '아직 없음';
    const rtc = MP.link && MP.link.kind === 'rtc' ? `${btn('초대 코드 만들기', 'mp_invite')}<textarea id="mpOut" rows="3" readonly placeholder="초대 코드: 참가할 친구에게 보내세요">${MP.rtc ? MP.rtc.code : ''}</textarea><textarea id="mpCode" rows="3" placeholder="친구가 보낸 답장 코드"></textarea>${btn('답장 코드 넣기', 'mp_accept')}` : '';
    const code = MP.roomCode ? `<div class="mpcodebox">방 코드<b>${esc(MP.roomCode)}</b></div><p class="muted">${MP.isHost ? `친구는 타이틀 → 멀티플레이에서 "${esc(MP.name)}님의 세계"의 <b>참가</b>를 누르거나 이 방 코드를 넣으면 들어와요` : '이 방 코드를 친구에게 알려 주면 같은 세계로 들어올 수 있어요'}${MP.addr ? ' · 서버: ' + esc(mpShortAddr(MP.addr)) : ''}</p>` : MP.server && !MP.isHost ? '<p class="muted">서버 세계 — 누구나 멀티플레이 목록에서 들어올 수 있어요</p>' : '';
    return `<h2>멀티플레이 (${MP.isHost ? '호스트' : MP.role === 'host' ? '참가 중 · 이 차원 계산 담당' : '참가 중'})</h2><div class="form">${code}<p>참가자: ${esc(MP.name)}${MP.peers.size ? ', ' + list : ''}</p>${MP.role === 'host' || MP.isHost ? rtc : ''}${st}</div><div class="btncol">${btn(MP.isHost || (MP.role === 'host' && !MP.server) ? '멀티플레이 닫기' : '나가기', 'mp_stop')}${btn('뒤로', 'pause')}</div>`;
  }
  return '';
}
// ---------- the join screen's list: what the server has open ----------
const mpShortAddr = a => { try { return new URL(mpWsUrl(a)).host; } catch (e) { return String(a || ''); } };
function mpRoomsUrl(a) { const u = new URL(mpWsUrl(a)); u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:'; u.pathname = '/rooms'; u.search = ''; return u.href; }
const MPL = { state: 'idle', data: null, msg: '', addr: '', gen: 0 };
function mpSrvLine() {
  const a = MPL.addr || mpDefaultAddr(); if (!a) return '서버 주소가 없습니다 — 아래 "다른 서버"에 넣어 주세요';
  const dot = { ok: '<i class="dot on"></i>', err: '<i class="dot off"></i>' }[MPL.state] || '<i class="dot wait"></i>';
  return `${dot}서버 ${esc(mpShortAddr(a))}${MPL.state === 'ok' ? '' : MPL.msg ? ' · ' + esc(MPL.msg) : ''}`;
}
function mpListHtml() {
  const d = MPL.data, rows = [];
  // every server world stays on the list, as single-player worlds do; an older server sends just one (d.world)
  const list = d ? d.worlds || (d.world ? [{ ...d.world, id: null }] : []) : [];
  for (const wd of list) rows.push(`<div class="mpi"><div><b>🌍 ${esc(wd.name)}</b><span>서버 세계 · ${MODE_NAME[wd.mode] || '서바이벌'} · ${wd.players ? wd.players + '명 접속 중' : '지금은 아무도 없어요'} · 언제든 들어갈 수 있어요</span></div>${btn('참가', 'mp_go:' + (wd.id ? '@' + esc(wd.id) : ''), 'sm')}</div>`);
  // worlds this browser has played on this server that the server no longer has (its disk was wiped): bring them back
  if (d) { const h = mirHost(MPL.addr || mpDefaultAddr()) + '|', have = new Set(list.map(wd => wd.id || 'world'));
    for (const [k, name] of MIR.known) if (k.startsWith(h) && !have.has(k.slice(h.length))) rows.push(`<div class="mpi"><div><b>🔄 ${esc(name)}</b><span>서버가 다시 시작되며 지워진 서버 세계예요. 이 브라우저에 저장된 사본으로 되살리고 들어갑니다</span></div>${btn('되살리기', 'mp_go:@' + esc(k.slice(h.length)), 'sm')}</div>`); }
  if (d) for (const r of d.rooms || []) rows.push(`<div class="mpi"><div><b>🏠 ${esc(r.host)}님의 세계${r.world ? ' "' + esc(r.world) + '"' : ''}</b><span>방 코드 ${esc(r.code)} · ${MODE_NAME[r.mode] || '서바이벌'} · ${r.players}명</span></div>${btn('참가', 'mp_go:' + esc(r.code), 'sm')}</div>`);
  if (d) rows.push(`<div class="mpi"><div><b>🌱 새 서버 세계 만들기</b><span>서버에 계속 남는 새 세계를 만듭니다. 만든 사람이 없어도 누구나 언제든 들어올 수 있어요</span></div>${btn('만들기', d.worlds ? 'mp_go:@+' : 'mp_go:', 'sm')}</div>`);
  if (rows.length) return rows.join('');
  return `<p class="muted mpempty">${MPL.state === 'err' ? esc(MPL.msg || '서버에 연결하지 못했습니다') : MPL.state === 'ok' ? '열린 세계가 없습니다' : esc(MPL.msg || '서버 목록을 불러오는 중...')}</p>`;
}
function mpListPaint() { const l = $('mpList'), s = $('mpSrv'); if (l) l.innerHTML = mpListHtml(); if (s) s.innerHTML = mpSrvLine(); }
// a sleeping hosted server takes up to a minute to answer: keep knocking while the list is on screen
async function mpRefreshList(addr) {
  const a = (addr || mpDefaultAddr() || '').trim(), gen = ++MPL.gen; MPL.addr = a;
  if (!a) { MPL.state = 'err'; MPL.msg = '서버 주소가 없습니다'; mpListPaint(); return; }
  if (mpStaticHost(a)) { MPL.state = 'err'; MPL.msg = '이 주소는 멀티플레이 서버가 아닙니다 (Render 서버 주소를 넣어 주세요)'; mpListPaint(); return; }
  MPL.state = 'loading'; MPL.msg = '목록을 불러오는 중...'; if (!MPL.data || MPL.dataAddr !== a) MPL.data = null; mpListPaint();
  const t0 = Date.now();
  while (gen === MPL.gen && UI.menu === 'mp_join') {
    try {
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), 8000);
      const r = await fetch(mpRoomsUrl(a), { cache: 'no-store', signal: ac.signal }); clearTimeout(to);
      if (!r.ok) throw new Error(r.status === 404 ? '이 서버는 목록을 보여 주지 않아요 (예전 서버) — 방 코드로 참가하세요' : '서버 오류 ' + r.status);
      const d = await r.json(); if (gen !== MPL.gen) return;
      MPL.data = d; MPL.dataAddr = a; MPL.state = 'ok'; MPL.msg = ''; mpListPaint(); return;
    } catch (e) {
      if (gen !== MPL.gen) return;
      const s = Math.round((Date.now() - t0) / 1000);
      if (/예전 서버|서버 오류/.test(e.message) || s > 90) { MPL.state = 'err'; MPL.msg = /예전 서버|서버 오류/.test(e.message) ? e.message : '서버에 연결하지 못했습니다 — 주소를 확인하거나 새로고침을 눌러 보세요'; mpListPaint(); return; }
      MPL.state = 'loading'; MPL.msg = s < 5 ? '연결하는 중...' : `서버를 깨우는 중... ${s}초 (잠들어 있던 서버는 1분쯤 걸려요)`; mpListPaint();
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}
async function mpAction(a) {
  const nm = $('mpName'); if (nm && nm.value.trim()) { MP.name = nm.value.trim().slice(0, 16); try { localStorage.setItem(MP_NAME_KEY, MP.name); } catch (e) {} }
  const ad = $('mpAddr'); if (ad && ad.value.trim()) try { localStorage.setItem(MP_ADDR_KEY, ad.value.trim()); } catch (e) {}
  const say = t => { MP.status = t; const el = $('mpStatus'); if (el) el.textContent = t; };
  const codeIn = $('mpCode') ? $('mpCode').value : '';
  try {
    if (a === 'mp_join' || a === 'mp_host') { MP.status = ''; showMenu(a); }
    else if (a === 'mp_refresh') { const v = ad && ad.value.trim(); mpRefreshList(v || undefined); }
    else if (a.startsWith('mp_go:') || a === 'mp_code') {
      let room = a === 'mp_code' ? ($('mpRoom').value || '').trim().toUpperCase() : a.slice(6), world = null;
      if (room.startsWith('@')) { world = room.slice(1); room = ''; } // a server world by its id
      if (a === 'mp_code' && !room) { say('방 코드를 넣어 주세요'); return; }
      const where = (MPL.addr || (ad && ad.value.trim()) || mpDefaultAddr()).trim(); try { localStorage.setItem(MP_ADDR_KEY, where); } catch (e) {}
      say('접속하는 중...'); const r = await mpJoinWs(where, room || null, world); if (r !== 'noworld') say('접속했습니다. 세계를 받는 중...'); }
    else if (a === 'mp_joinws') { say('접속하는 중...'); const r = await mpJoinWs(ad.value.trim()); if (r !== 'noworld') say('접속했습니다. 세계를 받는 중...'); }
    else if (a === 'mp_createworld') { const sd = ($('mpSeed').value || '').trim(); mpSend({ t: 'create', meta: { name: ($('mpWName').value || '서버 세계').trim(), seed: seedFrom(sd || String(Math.floor(Math.random() * 1e9))), gen: 3, my: MINY, mode: $('mpMode').value, diff: 2, cheats: $('mpCheats').checked, exp: true } }); say('세계를 만드는 중...'); }
    else if (a === 'mp_cancel') { mpStop(); showMenu('title'); }
    else if (a === 'mp_upload') { say('서버에 올리는 중...'); const where = ad.value.trim(), up = await mpUpload(where); say(`올렸습니다 (청크 ${up.n}개). 서버 세계로 들어가는 중...`);
      saveAll(true); await new Promise(r => setTimeout(r, 300)); quitToTitle(); showMenu('mp_join'); await mpJoinWs(where, null, up.wid); } // from now on it is played on the server, where it stays
    else if (a === 'mp_answer') { say('답장 코드를 만드는 중...'); MP.role = 'guest'; MP.on = true; mpInstall(); const code = await mpAnswerInvite(codeIn); $('mpOut').value = code; $('mpOut').select(); say('답장 코드를 호스트에게 보내세요. 호스트가 넣으면 연결됩니다.'); }
    else if (a === 'mp_hostws') { say('서버에 여는 중...'); await mpHostStart('ws'); MP.status = '서버에 열렸습니다'; showMenu('mp_host'); }
    else if (a === 'mp_hostrtc') { await mpHostStart('rtc'); MP.status = '초대 코드를 만들어 친구에게 보내세요'; showMenu('mp_host'); }
    else if (a === 'mp_invite') { say('초대 코드를 만드는 중...'); await mpMakeInvite(); MP.status = '초대 코드를 보내고, 친구의 답장 코드를 넣으세요'; showMenu('mp_host'); }
    else if (a === 'mp_accept') { await mpAcceptAnswer(codeIn); say('연결하는 중...'); }
    else if (a === 'mp_stop') { const guest = !MP.isHost && !(MP.role === 'host' && !MP.server); mpStop(); if (guest) quitToTitle(); else showMenu('pause'); }
  } catch (e) { if (a === 'mp_joinws' || a === 'mp_hostws' || a === 'mp_code' || a.startsWith('mp_go:')) { MP.on = false; MP.role = null; MP.link = null; } say('실패: ' + (e.message || e)); }
}
