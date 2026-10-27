// Multiplayer basics: one player hosts their world (like Java's "Open to LAN"), others join it.
// Two ways to connect: a relay server (node tools/server.js, it also serves the game on your network) or,
// with no server at all, WebRTC with invite / answer codes copied between the players.
// The host's world is the real one: guests generate the same terrain from the seed, fetch the chunks the host
// has changed, and every block a player breaks or places is sent to everyone. Players see each other (skin,
// held item, armour, pose, custom skins), chat is shared, the host's clock and weather rule, and the host's mobs are mirrored
// to guests (guests can hit them), container contents follow every click, the host's dropped items can be picked
// up by guests, a guest's inventory is kept on their device per host world, and the host's mobs chase, hit and shoot
// whichever player is nearest.
const MP = { server: false, auth: {}, rolePending: false, queue: [], replaying: false, on: false, role: null, name: null, id: 0, link: null, peers: new Map(), local: false, applying: false, allowSpawn: false, nextId: 1, eid: 1, rtc: null, status: '' };
const MP_NAME_KEY = 'nemo-mp-name', MP_ADDR_KEY = 'nemo-mp-addr';
try { MP.name = localStorage.getItem(MP_NAME_KEY); } catch (e) {}
if (!MP.name) MP.name = '플레이어' + (100 + Math.floor(Math.random() * 900));
const mpDefaultAddr = () => { try { const a = localStorage.getItem(MP_ADDR_KEY); if (a) return a; } catch (e) {} return /^https?:$/.test(location.protocol) ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/mp' : 'ws://192.168.0.2:8080/mp'; };

// ---------- binary <-> text for chunk data ----------
function mpB64(ta) { const u8 = new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
function mpUnB64(s, T) { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new T(u8.buffer); }
async function mpPack(text) { const cs = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate')); return mpB64(new Uint8Array(await new Response(cs).arrayBuffer())); }
async function mpUnpack(code) { const u8 = mpUnB64(code.replace(/\s+/g, ''), Uint8Array); return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate'))).text(); }

// ---------- transports: every message goes guest -> host or host -> guest(s) ----------
// relay server: the server forwards guests' messages to the host and the host's to one guest or all of them
function mpWebSocket(url, role) {
  return new Promise((res, rej) => {
    let ws; try { ws = new WebSocket(url); } catch (e) { rej(e); return; }
    const link = { kind: 'ws', send(o, to) { if (ws.readyState === 1) ws.send(JSON.stringify(to != null ? { ...o, to } : o)); }, close() { try { ws.close(); } catch (e) {} } };
    let ok = false;
    ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', role }));
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (er) { return; }
      if (!ok) { if (m.t === 'hello') { ok = true; MP.id = m.id; link.hello = m; res(link); } else if (m.t === 'error') { rej(new Error(m.msg)); ws.close(); } return; }
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
  pc.ondatachannel = e => { const dc = e.channel; dc.onopen = () => { const send = rtcWire(dc, m => mpHandle(m, 0), () => mpLost('호스트와 연결이 끊겼습니다')); MP.link = { kind: 'rtc', send: o => send(o), close: () => { try { pc.close(); } catch (er) {} } }; MP.server = true; MP.rolePending = true; mpSend({ t: 'join', name: MP.name, skin: mpSkin() }); }; };
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
  const relay = kind === 'ws' ? await mpWebSocket($('mpAddr').value.trim(), 'host') : mpRtcHostLink();
  saveAll(true); await new Promise(r => setTimeout(r, 300));
  W.mpLogs = await mpLogKeys(W.id);
  Object.assign(MP, { on: true, server: true, isHost: true, role: 'guest', rolePending: true, id: 0, eid: 1, auth: {}, queue: [], relay, inbox: [] }); MP.peers.clear();
  MP.store = mpHostStore(); MP.core = mpWorldCore(MP.store, mpCoreOut);
  MP.link = { kind: 'local', send(o, to) { MP.core.message(0, to != null ? { ...o, to } : { ...o }); }, close() {} };
  MP.timers = [setInterval(() => MP.core && MP.core.tick(), 1000), setInterval(() => MP.store && MP.store.flush(), 3000)];
  mpInstall(); mpSend({ t: 'join', name: MP.name, skin: mpSkin() });
  chatMsg('멀티플레이가 열렸습니다. 친구가 참가할 수 있어요.', '#ffff55');
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
  const state = { meta: { name: W.meta.name, seed: W.seed, exp: W.exp, mode: W.meta.mode === 'creative' ? 'creative' : 'survival', diff: PL.difficulty, cheats: W.cheats, spawn: W.worldSpawn, gamerules: W.meta.gamerules || {}, shared: sh },
    time: W.time, rain: W.rainTarget, thunder: W.thunderOn, weatherT: 24000, players: W.meta.mpPlayers || (W.meta.mpPlayers = {}) };
  const toNet = r => { if (!r || typeof r !== 'object') return null; // (dbReq gives true for a missing key) if (!r.b) return { v: 2, it: r.it, mobs: r.mobs || null };
    let b = r.b, m = r.m, l = r.l; const h = r.ch || 128; if (r.v < 3) { const n = 256 * h, dec = a => r.v >= 2 ? rleDec(a, n, Uint8Array) : a; b = rleEnc(Uint16Array.from(dec(b))); m = rleEnc(dec(m)); l = rleEnc(dec(l)); } // older saves: 8-bit ids
    return { v: 3, it: r.it, ch: h, b: mpB64(b), m: mpB64(m), l: mpB64(l), bio: Array.from(r.bio), t: r.t || [], mobs: r.mobs || null }; };
  const fromNet = r => r.b ? { v: 3, it: r.it, ch: r.ch, b: mpUnB64(r.b, Uint16Array), m: mpUnB64(r.m, Uint8Array), l: mpUnB64(r.l, Uint8Array), bio: Uint8Array.from(r.bio), t: r.t || [], mobs: r.mobs || null } : { v: 2, it: r.it, mobs: r.mobs || null };
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
async function mpJoinWs(url) {
  MP.role = 'guest'; MP.on = true; MP.peers.clear(); MP.server = false; MP.auth = {};
  try { MP.link = await mpWebSocket(url, 'join'); } catch (e) { MP.on = false; MP.role = null; throw e; }
  mpInstall();
  MP.server = true; MP.rolePending = true; // a server world, or a player's world (that runs the same world core in its browser)
  if (MP.link.hello.kind === 'world' && !MP.link.hello.world) { showMenu('mp_create'); return 'noworld'; }
  mpSend({ t: 'join', name: MP.name, skin: mpSkin() });
}
function mpStop() {
  if (!MP.on) return;
  const host = MP.isHost, ran = MP.role === 'host', st = MP.store;
  if (MP.server) mpServerLeave(host); else if (MP.role === 'host') mpSend({ t: 'bye' }); else { mpGuestSave(); mpSend({ t: 'leave' }); }
  if (host) { for (const id of MP.core.players.keys()) if (id !== 0) MP.relay.send({ t: 'bye' }, id); for (const t of MP.timers || []) clearInterval(t); MP.core.store = null;
    setTimeout(() => { st.flush(); setTimeout(() => st.flush(), 500); }, 50); try { MP.relay.close(); } catch (e) {} MP.relay = null; MP.core = null; MP.store = null; MP.isHost = false; }
  if (MP.link) { const l = MP.link; if (MP.server) setTimeout(() => l.close(), 600); else l.close(); } MP.link = null; // the last stored chunks get through before the connection closes if (MP.rtcGuest) { try { MP.rtcGuest.close(); } catch (e) {} MP.rtcGuest = null; }
  for (const p of MP.peers.values()) mpDropAvatar(p); MP.peers.clear();
  for (const e of ENT) if (e.remote) removeEnt(e);
  MP.on = false; MP.role = null; MP.rtc = null; MP.server = false; MP.auth = {}; MP.rolePending = false; MP.queue = [];
  if (host && !ran && W.active) mpDropChunks(); // you were following someone else's run of this dimension
}
function mpLost(why) {
  if (!MP.on) return; const guest = MP.role === 'guest'; mpStop(); chatMsg(why, '#ff5555');
  if (guest && W.active) { quitToTitle(); UI.flash(why); }
}
function mpPeerGone(id) { const p = MP.peers.get(id); if (!p) return; mpDropAvatar(p); MP.peers.delete(id); chatMsg(p.name + '님이 나갔습니다', '#ffff55'); if (mpRelay()) mpSend({ t: 'gone', id }); }

// ---------- message handling ----------
function mpHandle(m, from) {
  const host = MP.role === 'host';
  switch (m.t) {
    case 'join': if (!host || MP.server) return; { // a new guest: hand over the world's seed, clock and what has been edited
      const p = { id: from, name: String(m.name || '손님').slice(0, 16), skin: m.skin || { tex: 'steve', slim: false }, s: null }; MP.peers.set(from, p);
      const edited = [...W.saved]; for (const c of W.chunks.values()) if (c.edited) edited.push(dkey(c.cx, c.cz));
      mpSend({ t: 'welcome', you: from, seed: W.seed, exp: W.exp, mode: PL.mode === 'hardcore' ? 'survival' : PL.mode, diff: PL.difficulty, time: W.time, rain: W.rain, thunder: W.thunderOn, dim: W.dim,
        at: [PL.x, PL.y, PL.z], spawn: W.worldSpawn, edited: [...new Set(edited)], host: { name: MP.name, skin: mpSkin() }, players: [...MP.peers.values()].filter(q => q.id !== from).map(q => ({ id: q.id, name: q.name, skin: q.skin })), gr: W.meta.gamerules || null }, from);
      mpSend({ t: 'peer', id: from, name: p.name, skin: p.skin }); chatMsg(p.name + '님이 참가했습니다', '#ffff55'); if (UI.menu === 'mp_host') showMenu('mp_host'); return;
    }
    case 'welcome': if (MP.isHost) mpHostWelcome(m); else if (MP.server) mpEnterServerWorld(m); else if (!host) mpEnterHostWorld(m); return;
    case 'noworld': showMenu('mp_create'); return;
    case 'created': mpSend({ t: 'join', name: MP.name, skin: mpSkin() }); return;
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
    case 'sets': if (!host) mpApplySets(m); return;
    case 'chunk': if (host && !MP.server) mpServeChunk(m, from); return;
    case 'chunkdata': if (!host || MP.server) mpGotChunk(m); return;
    case 'time': if (host && !MP.server) return; if (Math.abs(W.time - m.time) > 30) W.time = m.time; W.rainTarget = m.rain; if (Math.abs(W.rain - m.rain) > 0.5) W.rain = m.rain; W.thunderOn = m.thunder; return;
    case 'mobs': if (!host) mpMirrorMobs(m.l); return;
    case 'hurt': if (!host) hurtPlayer(+m.dmg || 0, m.cause || 'mob'); return; // the host's mobs hit this guest
    case 'kb': if (!host) { PL.vx += +m.vx || 0; PL.vy += +m.vy || 0; PL.vz += +m.vz || 0; } return;
    case 'eff': if (!host && EFF[m.k]) addEffect(PL, m.k, m.dur, m.lv); return;
    case 'tile': mpApplyTile(m, from); return;
    case 'items': if (!host) mpMirrorItems(m.l); return;
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
    case 'summon': if (host && MOBDEF[m.type] && m.type !== 'player' && isFinite(m.x) && isFinite(m.y) && isFinite(m.z)) spawnMob(m.type, +m.x, +m.y, +m.z); return;
    case 'killall': if (host) for (const e of [...ENT]) if (e.kind === 'mob' && !e.dead && !e.remote && (!m.type || e.type === m.type)) removeEnt(e); return;
    case 'held': if (!host) { const h = INV.slots[INV.sel]; if ((h ? h.id : 0) === m.was) { INV.slots[INV.sel] = m.st && ITEMS[m.st.id] ? m.st : null; UI.hudDirty = true; } } return;
    case 'vehs': if (!host) mpMirrorVehicles(m.l); return;
    case 'veh': if (host) { MP.allowSpawn = true; try { if (m.kind === 'boat') placeBoat(+m.x, +m.y, +m.z, +m.yaw || 0, String(m.sub || 'oak')); else if (m.kind === 'minecart') spawnMinecart(+m.x, +m.y, +m.z, String(m.sub || 'minecart'), { yaw: +m.yaw || 0 }); } finally { MP.allowSpawn = false; } } return;
    case 'vhit': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.onHit), p = MP.peers.get(from); if (e) { if (p && p.s) mpProxy(p, () => e.onHit(e)); else e.onHit(e); } } return;
    case 'ride': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead); if (e && e.rider !== PL) mpRidden(e, m, from); } return;
    case 'tame': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead && q.kind === 'mob'); if (e && typeof horseTame === 'function' && e.owner !== 'player') horseTame(e); } return;
    case 'sys': chatMsg(String(m.text).slice(0, 256), /^#[0-9a-f]{3,6}$/i.test(m.c || '') ? m.c : '#ffffff'); if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id); return;
    case 'wake': if ((!host || MP.server) && PL.sleeping) { PL.sleeping = 0; PL.rest = 0; UI.flash('좋은 아침이에요!'); } return;
  }
}
// a guest becomes a visitor in the host's world: same seed, nothing saved locally
async function mpEnterHostWorld(m) {
  MP.id = m.you;
  MP.peers.set(0, { id: 0, name: m.host.name, skin: m.host.skin, s: null });
  for (const q of m.players) MP.peers.set(q.id, { id: q.id, name: q.name, skin: q.skin, s: null });
  const meta = { id: 'mp-' + Date.now(), name: m.host.name + '의 세계', seed: m.seed, mode: m.mode, diff: m.diff, cheats: false, exp: m.exp, spawn: m.spawn, remote: true, gamerules: m.gr, dim: 0 };
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
  const host = MP.role === 'host', c = m.dim === W.dim && chunkAt(m.x >> 4, m.z >> 4), i = (m.y << 8) | ((m.z & 15) << 4) | (m.x & 15);
  if (c) { const old = c.tiles.get(i); if (old) { for (const k of Object.keys(old)) if (!(k in m.tile)) delete old[k]; Object.assign(old, m.tile); } else c.tiles.set(i, m.tile); c.modified = c.edited = true;
    if (UI.screen && GUI.ctx && GUI.ctx.x === m.x && GUI.ctx.y === m.y && GUI.ctx.z === m.z) UI.renderScreen(); }
  else if (host && !MP.server) { const T = W.meta.mpTiles || (W.meta.mpTiles = {}); (T[m.dk] || (T[m.dk] = {}))[i] = m.tile; }
  if (mpRelay()) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id);
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
  mpToAuth({ t: 'set', x, y, z, id, m, mo: metaOnly ? 1 : 0, dim: W.dim, dk: dkey(x >> 4, z >> 4) });
}
function mpApplySets(m) { // guests: the host's changes
  if (m.dim !== W.dim) return;
  MP.applying = true;
  try { for (const [x, y, z, id, mt, mo] of m.l) { if (!isLoaded(x, z)) { W.saved.add(dkey(x >> 4, z >> 4)); continue; } if (mo && getBlock(x, y, z) === id) setMeta(x, y, z, mt); else setBlock(x, y, z, id, mt, { noUpdate: true, keepTile: true }); } }
  finally { MP.applying = false; }
}
function mpApplySet(m) { // the host: a guest's action
  if (MP.role !== 'host') return;
  if (m.dim === W.dim && isLoaded(m.x, m.z)) {
    MP.applying = true;
    try {
      if (m.mo) { if (getBlock(m.x, m.y, m.z) !== m.id) return; setMeta(m.x, m.y, m.z, m.m); }
      else setBlock(m.x, m.y, m.z, m.id, m.m);
      // what the player's own code would have set going: redstone, button release, fluids and falling blocks
      const b = m.id; rsNotify(m.x, m.y, m.z);
      if (b === RSB.lever || b === RSB.button) { const a = switchAttach(m.x, m.y, m.z, m.m); rsNotify(a[0], a[1], a[2]); if (b === RSB.button && (m.m & 8)) { const k = (m.m >> 4) & 15; rsLater(m.x, m.y, m.z, k >= 1 && k <= 8 ? 30 : 20); } }
      if (FLUID[b]) schedule(m.x, m.y, m.z, 1);
      if (BLOCKS[b] && BLOCKS[b].fall) schedule(m.x, m.y, m.z, 2);
      for (const [dx, dy, dz] of N6) { const n = getBlock(m.x + dx, m.y + dy, m.z + dz); if (FLUID[n]) schedule(m.x + dx, m.y + dy, m.z + dz, n === 27 ? 5 : 30); }
    } finally { MP.applying = false; }
  } else if (MP.server) mpSend({ t: 'sets', dim: m.dim, l: [[m.x, m.y, m.z, m.id, m.m]] }); // a server world keeps it until someone loads that chunk
  else { // not loaded here: kept with the world and put in place when the host loads that chunk
    const E = W.meta.mpEdits || (W.meta.mpEdits = {}); (E[m.dk] || (E[m.dk] = [])).push([m.x, m.y, m.z, m.id, m.m]);
    for (const id of MP.peers.keys()) mpSend({ t: 'sets', dim: m.dim, l: [[m.x, m.y, m.z, m.id, m.m]] }, id);
  }
}
// chunk requests: the host answers with its saved / loaded chunk, plus edits waiting for it
async function mpServeChunk(m, from) {
  const dk = DIM_PREFIX[m.dim] + m.cx + ',' + m.cz, edits = (W.meta.mpEdits && W.meta.mpEdits[dk]) || null;
  const out = { t: 'chunkdata', cx: m.cx, cz: m.cz, dim: m.dim, edits };
  const c = m.dim === W.dim && W.chunks.get(ckey(m.cx, m.cz));
  if (c && c.edited) Object.assign(out, { b: mpB64(rleEnc(c.blocks)), m: mpB64(rleEnc(c.meta)), l: mpB64(rleEnc(c.light)), bio: Array.from(c.biome), tl: serTiles(c), ch: CH });
  else {
    const key = W.id + ':' + dk, pend = saveDone(key); if (pend) await pend;
    const rec = await dbReq('chunks', 'readonly', st => st.get(key));
    if (rec && rec.b && rec.v >= 3) Object.assign(out, { b: mpB64(rec.b), m: mpB64(rec.m), l: mpB64(rec.l), bio: Array.from(rec.bio), tl: rec.t || [], ch: rec.ch || CH });
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
  if (m.edits) mpEdits.set(key, m.edits); if (m.tiles) mpTileWait.set(key, m.tiles);
  const rm = m.it && typeof itemRemapFor === 'function' ? itemRemapFor(m.it) : null; if (rm) { remapItems(m.tl, rm); remapItems(m.mobs, rm); remapItems(m.tiles, rm); }
  if (m.none) { W.saved.delete(DIM_PREFIX[m.dim] + m.cx + ',' + m.cz); if (m.mobs) W.pendingMobs.set(key, m.mobs); return; } // plain terrain (with its animals): generated here
  const n = 256 * m.ch, dec = (s, T, fill) => { const a = rleDec(mpUnB64(s, T), n, T), out = new T(CVOL); out.set(a.subarray(0, Math.min(n, CVOL))); if (fill) out.fill(fill, n); return out; };
  W.inbox.push({ cx: m.cx, cz: m.cz, blocks: dec(m.b, Uint16Array), meta: dec(m.m, Uint8Array), light: dec(m.l, Uint8Array, 0xf0), biome: Uint8Array.from(m.bio), mobs: m.mobs || null, fromSave: true, tileList: m.tl || [] });
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
function mpTick() {
  if (!MP.on || !W.active) return;
  if (W.tickN % 2 === 0) { const [h, off] = handItems(); mpSend({ t: 'pl', id: MP.role === 'host' && !MP.server ? 0 : MP.id, x: +PL.x.toFixed(3), y: +PL.y.toFixed(3), z: +PL.z.toFixed(3), yaw: +PL.yaw.toFixed(3), pitch: +PL.pitch.toFixed(3), dim: W.dim,
    sneak: PL.sneaking && !PL.flying ? 1 : 0, swing: R.hand.swing > 0 ? +(1 - R.hand.swing).toFixed(2) : 0, held: h ? h.id : 0, off: off ? off.id : 0, fly: PL.flying ? 1 : 0, dead: PL.dead ? 1 : 0, mode: PL.mode, h: PL.h, sleep: PL.sleeping ? 1 : 0, pose: PL.pose || 'stand', glide: PL.gliding ? 1 : 0, ride: PL.riding ? 1 : 0,
    armor: INV.armor.map(s => s ? [s.id, s.e ? 1 : 0] : 0) }); }
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
    for (const [i, t] of c.tiles) { if (t.type !== 'furnace' && t.type !== 'brewing' && t.type !== 'campfire') continue; const j = JSON.stringify(t); if (t._mp === j.length + ':' + j.slice(-40)) continue; t._mp = j.length + ':' + j.slice(-40);
      const x = c.cx * 16 + (i & 15), y = i >> 8, z = c.cz * 16 + ((i >> 4) & 15); mpSend({ t: 'tile', x, y, z, dim: W.dim, dk: dkey(c.cx, c.cz), tile: JSON.parse(j) }); }
  }
  if (W.tickN % 40 === 0 && !MP.server) mpSend({ t: 'time', time: W.time, rain: W.rainTarget, thunder: W.thunderOn });
  if (W.tickN % 4 === 0) for (const p of MP.peers.values()) { // mobs near each guest, 5 times a second
    if (!p.s || p.s.dim !== W.dim) continue; const l = [];
    for (const e of ENT) { if (e.dead || e.kind !== 'mob' || Math.abs(e.x - p.s.x) > 64 || Math.abs(e.z - p.s.z) > 64) continue; if (!e.mpid) e.mpid = mpNewId();
      l.push([e.mpid, e.type, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +e.yaw.toFixed(2), e.baby ? 1 : 0, e.hurt > 0 ? 1 : 0, e.variant != null ? e.variant : null, e.size || 0, e.vtype || null, e.prof || null, e.sheared ? 1 : 0, e.deathT ? 1 : 0, e.saddle ? 1 : 0, e.owner === 'player' ? 1 : 0, e.chest ? 1 : 0, e.spd || 0, e.jumpS || 0, e.rider === PL ? -1 : e.mpRider || 0, e.harmor || null]); }
    mpSend({ t: 'mobs', l }, p.id);
    mpSendVehicles(p);
    const it = []; for (const e of ENT) { if (e.dead || e.kind !== 'item' || e.remote || Math.abs(e.x - p.s.x) > 32 || Math.abs(e.z - p.s.z) > 32) continue; if (!e.mpid) e.mpid = mpNewId(); it.push([e.mpid, { id: e.stack.id, n: e.stack.n, d: e.stack.d, e: e.stack.e }, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2)]); }
    mpSend({ t: 'items', l: it }, p.id);
    const xo = []; for (const e of ENT) { if (e.dead || e.kind !== 'xp' || e.remote || Math.abs(e.x - p.s.x) > 24 || Math.abs(e.z - p.s.z) > 24) continue; if (!e.mpid) e.mpid = mpNewId(); xo.push([e.mpid, e.value, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2)]); }
    mpSend({ t: 'xps', l: xo }, p.id);
  }
}
function mpNewId() { return MP.server ? MP.id * 1000000 + MP.eid++ : MP.eid++; } // unique even when another player takes over a dimension
// guests: the host's mobs as puppets that move where the host says
function mpMirrorMobs(l) {
  const seen = new Set();
  for (const [id, type, x, y, z, yaw, baby, hurt, variant, size, vtype, prof, sheared, dying, saddle, tame, chest, spd, jumpS, rider, harmor] of l) {
    seen.add(id); let e = ENT.find(q => q.remote && q.rid === id && !q.dead && q.kind === 'mob');
    if (!e && MOBDEF[type] && !dying) { MP.allowSpawn = true; try { e = spawnMob(type, x, y, z, { baby, variant, size, vtype, prof, sheared }); } finally { MP.allowSpawn = false; } e.remote = true; e.rid = id; e.persistent = true; e.yaw = yaw; }
    if (!e) continue; e.tx = x; e.ty = y; e.tz = z; e.tyaw = yaw; if (hurt && !e.hurt) e.hurt = 10; if (dying && !e.deathT) e.deathT = 1;
    // what riding needs: saddle, tame, chest and the horse's own speed and jump
    if (saddle != null) { const ch = !!saddle !== !!e.saddle || !!chest !== !!e.chest || (harmor || null) !== (e.harmor || null); e.harmor = harmor || null; e.saddle = !!saddle; e.chest = !!chest; if (tame) e.owner = 'player'; if (spd) e.spd = spd; if (jumpS) e.jumpS = jumpS; if (ch && typeof horseParts === 'function' && e.gear) horseParts(e); }
    if (e.rider !== PL) e.rider = rider && rider !== MP.id ? 'other' : null;
  }
  for (const e of ENT) if (e.remote && e.kind === 'mob' && !e.dead && !seen.has(e.rid)) { if (PL.riding === e) dismount(); removeEnt(e); }
}
function mpPuppetTick(e) {
  if (e.rider === PL) { if (e.def.ride) e.def.ride(e, 0); mpRideSend(e); return; } // you ride it: it goes where you steer, and the runner follows
  if (e.mpWas) mpRideOff(e);
  if (e.tx == null) return; const dx = e.tx - e.x, dz = e.tz - e.z;
  e.x += dx * 0.5; e.y += (e.ty - e.y) * 0.5; e.z += dz * 0.5; e.yaw += wrapA(e.tyaw - e.yaw) * 0.5;
  const sp = Math.hypot(dx, dz); e.walkAmt = Math.min(1, sp * 6); e.walk = (e.walk || 0) + sp * 3; if (e.hurt > 0) e.hurt--; if (e.deathT) e.deathT++;
}

// ---------- a saved server world (node tools/server.js) ----------
// The server keeps the world; whoever is first in a dimension runs it (MP.role 'host' there) and stores its chunks
// back to the server; the others follow as guests. When the runner leaves, the server names the next one.
const MP_SHARED = ['dragonKilled', 'maps', 'mapN', 'siegeDay', 'netherIn', 'keepInv'];
async function mpEnterServerWorld(m) {
  MP.id = m.you; MP.auth = m.auth || {}; MP.peers.clear();
  for (const q of m.players) MP.peers.set(q.id, { id: q.id, name: q.name, skin: q.skin, s: null });
  const sm = m.meta, d = m.pdata;
  const meta = { id: 'srv-' + sm.seed + '-' + sm.name, name: sm.name, seed: sm.seed, mode: d && d.s && d.s.mode || sm.mode, diff: sm.diff, cheats: sm.cheats, exp: sm.exp, spawn: sm.spawn, remote: true, server: true, gamerules: sm.gamerules || {}, ...(sm.shared || {}),
    dim: d ? d.dim || 0 : 0, player: d ? { s: d.s, inv: d.inv, armor: d.armor, sel: d.sel, it: d.it, ender: d.ender, off: d.off } : null, time: m.time, rain: m.rain, thunder: m.thunder };
  MP.rolePending = true; MP.role = 'guest';
  await startWorld(meta.id, meta);
  W.saved = new Set(m.stored); W.time = m.time; W.rain = W.rainTarget = m.rain; W.thunderOn = m.thunder;
  if (d && d.adv) W.meta.adv = d.adv; if (d && d.stats) W.meta.stats = d.stats;
  if (!sm.spawn) mpSend({ t: 'meta', shared: {}, spawn: W.worldSpawn });
  mpSend({ t: 'dim', dim: W.dim });
  chatMsg(sm.name + ' 서버 세계에 들어왔습니다', '#ffff55');
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
  const rec = c.edited ? { v: 3, it: ITEM_TABLE, ch: CH, b: mpB64(rleEnc(c.blocks)), m: mpB64(rleEnc(c.meta)), l: mpB64(rleEnc(c.light)), bio: Array.from(c.biome), t: serTiles(c), mobs } : { v: 2, it: ITEM_TABLE, mobs };
  mpSend({ t: 'store', dk, rec });
}
function mpPdata() {
  offUnswap(); const s = {}; for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'health', 'food', 'sat', 'exh', 'air', 'level', 'xpP', 'xpTotal', 'mode', 'flying', 'spawn', 'fire', 'absorb', 'dead', 'eff', 'rest', 'spawnDim']) s[k] = PL[k];
  return { s, dim: W.dim, inv: INV.slots, armor: INV.armor, sel: INV.sel, it: ITEM_TABLE, ender: PL.ender, off: INV.off, adv: W.meta.adv || null, stats: W.meta.stats || null };
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
  const link = await mpWebSocket(url, 'world'); if (link.hello.kind !== 'world') { link.close(); throw new Error('이 주소는 서버 세계를 받지 않습니다'); }
  if (link.hello.world) { link.close(); throw new Error('서버에 이미 세계가 있습니다 (' + link.hello.world.name + ')'); }
  const sh = {}; for (const k of MP_SHARED) if (W.meta[k] !== undefined) sh[k] = W.meta[k];
  link.send({ t: 'create', meta: { name: W.meta.name, seed: W.seed, exp: W.exp, mode: W.meta.mode === 'creative' ? 'creative' : 'survival', diff: PL.difficulty, cheats: W.cheats, spawn: W.worldSpawn, gamerules: W.meta.gamerules || {}, shared: sh, time: W.time } });
  const keys = await dbReq('chunks', 'readonly', st => st.getAllKeys()); const mine = (keys || []).filter(k => typeof k === 'string' && k.startsWith(W.id + ':'));
  let n = 0;
  for (const k of mine) { const rec = await dbReq('chunks', 'readonly', st => st.get(k)); if (!rec) continue; const dk = k.slice(W.id.length + 1);
    const out = rec.b ? { v: 3, it: rec.it, ch: rec.ch || 128, b: mpB64(rec.b), m: mpB64(rec.m), l: mpB64(rec.l), bio: Array.from(rec.bio), t: rec.t || [], mobs: rec.mobs || null } : { v: 2, it: rec.it, mobs: rec.mobs || null };
    if (rec.b && rec.v < 3) continue; // very old saves stay local
    link.send({ t: 'store', dk, rec: out }); if (++n % 50 === 0) { MP.status = `올리는 중... ${n}/${mine.length}`; const el = $('mpStatus'); if (el) el.textContent = MP.status; await new Promise(r => setTimeout(r, 0)); } }
  link.send({ t: 'pdata', name: MP.name, d: mpPdata() }); // you carry on where you were, with what you had
  await new Promise(r => setTimeout(r, 600)); link.close();
  return n;
}

// ---------- riding and vehicles ----------
// Boats and minecarts belong to the dimension's runner like mobs and are mirrored to everyone. Whoever rides a boat,
// a minecart, a horse, a pig or a strider steers it on their own screen and the runner follows them.
function mpSendVehicles(p) {
  const l = [];
  for (const e of ENT) { if (e.dead || (e.kind !== 'boat' && e.kind !== 'minecart') || e.remote || Math.abs(e.x - p.s.x) > 64 || Math.abs(e.z - p.s.z) > 64) continue; if (!e.mpid) e.mpid = mpNewId();
    l.push([e.mpid, e.kind, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +e.yaw.toFixed(3), e.kind === 'boat' ? e.wood : e.ctype, e.rider === PL ? -1 : e.mpRider || 0]); }
  mpSend({ t: 'vehs', l }, p.id);
}
function mpMirrorVehicles(l) {
  const seen = new Set();
  for (const [id, kind, x, y, z, yaw, sub, rider] of l) {
    seen.add(id); let e = ENT.find(q => q.remote && q.rid === id && !q.dead && q.kind === kind);
    if (!e) { MP.allowSpawn = true; try { e = kind === 'boat' ? placeBoat(x, y, z, yaw, sub) : spawnMinecart(x, y, z, sub, { yaw }); } finally { MP.allowSpawn = false; } if (!e) continue;
      e.remote = true; e.rid = id; e.vTick = e.tick; e.tick = mpVehTick; e.onHit = () => mpToAuth({ t: 'vhit', e: id }); }
    e.tx = x; e.ty = y; e.tz = z; e.tyaw = yaw;
    if (e.rider !== PL) e.rider = rider && rider !== MP.id ? 'other' : null;
  }
  for (const e of ENT) if (e.remote && (e.kind === 'boat' || e.kind === 'minecart') && !e.dead && !seen.has(e.rid)) { if (PL.riding === e) dismount(); removeEnt(e); }
}
function mpVehTick(e) {
  if (e.rider === PL) { e.vTick(e); mpRideSend(e); return; }
  if (e.mpWas) mpRideOff(e);
  if (e.tx == null) return; e.x += (e.tx - e.x) * 0.5; e.y += (e.ty - e.y) * 0.5; e.z += (e.tz - e.z) * 0.5; e.yaw += wrapA(e.tyaw - e.yaw) * 0.5;
}
function mpRideSend(e) { e.mpWas = true; if (W.tickN % 2) return; mpToAuth({ t: 'ride', e: e.rid, x: +e.x.toFixed(3), y: +e.y.toFixed(3), z: +e.z.toFixed(3), yaw: +e.yaw.toFixed(3), vx: +(e.vx || 0).toFixed(3), vz: +(e.vz || 0).toFixed(3) }); }
function mpRideOff(e) { e.mpWas = false; mpToAuth({ t: 'ride', e: e.rid, off: 1 }); }
// the runner: someone else is steering this one
function mpRidden(e, m, from) {
  if (m.off) { e.mpRider = 0; if (e.mpTick0) { e.tick = e.mpTick0; e.mpTick0 = null; } return; }
  e.mpRider = from; e.mpRideAt = performance.now(); e.x = +m.x; e.y = +m.y; e.z = +m.z; e.yaw = +m.yaw; e.vx = +m.vx || 0; e.vz = +m.vz || 0; e.vy = 0; e.fallY = null;
  if (e.kind !== 'mob' && !e.mpTick0) { e.mpTick0 = e.tick; e.tick = mpRiddenTick; }
}
function mpRiddenTick(e) { if (performance.now() - e.mpRideAt > 1500) { e.mpRider = 0; e.tick = e.mpTick0; e.mpTick0 = null; } }

// ---------- the host's mobs fight guests too ----------
// Mob AI reads PL; for a mob whose nearest player is a guest, PL stands where that guest is for the length of the mob's
// tick, and damage, knockback and effects meant for "PL" go to the guest instead
const PROXY_KEYS = ['x', 'y', 'z', 'px', 'py', 'pz', 'vx', 'vy', 'vz', 'mode', 'dead', 'eff', 'h', 'sneaking', 'onGround'];
function mpNearestGuest(e) {
  let best = null, bd = PL.dead || PL.mode === 'creative' || PL.mode === 'spectator' ? Infinity : (PL.x - e.x) ** 2 + (PL.y - e.y) ** 2 + (PL.z - e.z) ** 2;
  for (const p of MP.peers.values()) { const s = p.s; if (!s || s.dim !== W.dim || s.dead || s.mode === 'creative' || s.mode === 'spectator' || performance.now() - p.at > 5000) continue;
    const d = (s.x - e.x) ** 2 + (s.y - e.y) ** 2 + (s.z - e.z) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}
function mpProxy(p, fn) {
  const save = {}; for (const k of PROXY_KEYS) save[k] = PL[k];
  const s = p.s; Object.assign(PL, { x: s.x, y: s.y, z: s.z, px: s.x, py: s.y, pz: s.z, vx: 0, vy: 0, vz: 0, mode: s.mode || 'survival', dead: false, eff: {}, h: s.h || 1.8, sneaking: !!s.sneak, onGround: true });
  MP.proxy = p;
  try { fn(); } finally {
    const kb = [PL.vx, PL.vy, PL.vz]; MP.proxy = null; for (const k of PROXY_KEYS) PL[k] = save[k];
    if (kb[0] || kb[1] || kb[2]) mpSend({ t: 'kb', vx: kb[0], vy: kb[1], vz: kb[2] }, p.id);
  }
}
function mpArrowAtGuest(e) { // host-side arrows also hit guests where they stand
  if (e.stuck || e.thrown || e.owner === PL) return false;
  for (const p of MP.peers.values()) { const s = p.s; if (!s || s.dim !== W.dim || s.dead || s.mode === 'creative') continue;
    if (e.x > s.x - 0.4 && e.x < s.x + 0.4 && e.z > s.z - 0.4 && e.z < s.z + 0.4 && e.y > s.y && e.y < s.y + 1.8) {
      const dmg = Math.ceil(Math.hypot(e.vx, e.vy, e.vz) * e.dmgMul); mpSend({ t: 'hurt', dmg: dmg * DIFF_MUL(), cause: 'arrow' }, p.id); mpSend({ t: 'kb', vx: e.vx * 0.3, vy: 0.2, vz: e.vz * 0.3 }, p.id); removeEnt(e); return true; } }
  return false;
}

// ---------- other players' figures ----------
function mpAvatar(p) {
  if (p.m) return p.m;
  mpSkinTex(p);
  const sk = p.skin || {}, m = buildModel(sk.slim ? 'player_slim' : 'player', { skin: p.skinReady ? p.skinKey : PACKPX.ent[sk.tex] ? sk.tex : 'steve' });
  m.userData.armorKey = ''; m.userData.armor = []; m.userData.heldKey = ['', '']; m.userData.held = [null, null]; if (m.userData.mat2) m.userData.mat2.visible = false;
  m.userData.st = { bodyYaw: NaN, limb: 0, limbD: 0, wingP: 0.2617994, wingR: -0.2617994, wingY: 0, wingPy: 0, lean: 0, deathT: 0 };
  // the name above the head as Java draws it: white text on a faint dark plate, bright where it can be seen and dim
  // through walls (the dim one is hidden while the player sneaks)
  const c = document.createElement('canvas'), g = c.getContext('2d'), F = '44px Galmuri11, sans-serif';
  const draw = () => { g.font = F; const w = Math.ceil(g.measureText(p.name).width) + 24; c.width = w; c.height = 60; g.font = F; g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(0, 0, w, 60); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(p.name, 12, 32); if (p.tags) for (const t of p.tags) t.userData.w = w / 60; };
  draw(); if (document.fonts) document.fonts.load(F).then(() => { draw(); t.needsUpdate = true; }).catch(() => {}); // the game's pixel font, once it has loaded
  const t = new THREE.CanvasTexture(c); t.minFilter = THREE.LinearFilter; t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; const w = c.width;
  const mk = (through) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: !through, depthWrite: false, transparent: true, opacity: through ? 0.3 : 1, fog: false })); sp.renderOrder = through ? 5 : 6; sp.userData.w = w / 60; return sp; };
  p.tags = [mk(true), mk(false)]; p.m = m; p.pos = null; scene.add(m, ...p.tags); return m;
}
const MP_HURT = new THREE.Color(1, 0.6, 0.6);
function mpPlaceTag(p, s, ps) {
  const y = p.pos[1] + (ps.sleep ? 0.6 : ps.swim || ps.gliding ? 0.9 : ps.sneak ? 1.85 : 2.05) + 0.25, d = Math.hypot(camera.position.x - p.pos[0], camera.position.y - y, camera.position.z - p.pos[2]);
  const k = 0.32 * Math.max(1, d / 10); // a little larger far away, so a name can still be read across a field
  p.tags.forEach((t, i) => { t.position.set(p.pos[0], y, p.pos[2]); t.scale.set(t.userData.w * k, k, 1); t.visible = !s.dead && d < 64 && !(i === 0 && ps.sneak); });
}
function mpDropAvatar(p) { if (p.m) { scene.remove(p.m); for (const t of p.tags) { scene.remove(t); t.material.map.dispose(); t.material.dispose(); } p.m = null; } }
function mpRender(dt) {
  if (!MP.on) return;
  for (const p of MP.peers.values()) {
    const s = p.s; if (!s || s.dim !== W.dim || performance.now() - p.at > 5000) { if (p.m) { p.m.visible = false; for (const t of p.tags) t.visible = false; } continue; }
    const m = mpAvatar(p), st = m.userData.st, k = Math.min(1, dt * 12);
    // drawn a little in the past, between the two updates around that moment, so the figure moves at an even pace
    // (updates come 10 times a second); the legs swing with the speed between updates, as Java's limbDistance does
    const last = p.pos || [s.x, s.y, s.z], H = p.hist || [], rt = performance.now() - 130; let a = H[H.length - 1], b = a;
    for (let i = H.length - 1; i > 0; i--) if (H[i - 1][0] <= rt) { a = H[i - 1]; b = H[i]; break; }
    const f = b && a && b[0] > a[0] ? Math.min(1, Math.max(0, (rt - a[0]) / (b[0] - a[0]))) : 1;
    p.pos = a ? [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f] : [s.x, s.y, s.z];
    if (Math.hypot(p.pos[0] - last[0], p.pos[2] - last[2]) > 8) p.hist = [[performance.now(), s.x, s.y, s.z]]; // a teleport: no sliding across the world
    const mvx = p.pos[0] - last[0], mvz = p.pos[2] - last[2], dtT = dt * 20, segT = a && b && b[0] > a[0] ? (b[0] - a[0]) / 50 : 0;
    p.spd = segT ? Math.hypot(b[1] - a[1], b[3] - a[3]) / segT : 0; // blocks per tick
    if (!(st.bodyYaw === st.bodyYaw)) st.bodyYaw = s.yaw;
    const glide = !!s.glide, swim = s.pose === 'swim' && !glide; p.glideT = glide ? (p.glideT || 0) + dtT : 0;
    const ps = { headYaw: 0, headPitch: -s.pitch, headPitchW: -s.pitch, yaw: s.yaw, right: s.held ? 'item' : null, left: s.off ? 'item' : null, two: null, charge: 0, swing: s.swing, swingLeft: false,
      sneak: (!!s.sneak || s.pose === 'crouch') && !s.fly && !glide, riding: !!s.ride, flying: !!s.fly, gliding: glide, glideT: p.glideT, vel2: mvx * mvx + mvz * mvz, vy: (s.y - last[1]) || 0, swim, sleep: !!s.sleep, bedYaw: 0, age: performance.now() / 50 };
    tickBodyYaw(st, ps, mvx, mvz, dtT);
    const spd = Math.min(1, (p.spd || 0) * 4); st.limbD += (spd - st.limbD) * Math.min(1, 0.4 * dtT); st.limb += st.limbD * dtT;
    st.lean += ((swim ? 1 : 0) - st.lean) * Math.min(1, 0.18 * dtT);
    ps.headYaw = glide || swim ? 0 : -wrapA(s.yaw - st.bodyYaw);
    m.visible = !s.dead; posePlayer(m, ps); placePlayer(m, ps, p.pos[0], p.pos[1], p.pos[2]);
    mpPlaceTag(p, s, ps);
    const light = lightBright(p.pos[0], p.pos[1] + 1, p.pos[2]), hurt = p.hurtFx > 0; if (hurt) p.hurtFx -= dtT;
    for (const mt of m.userData.mats) { mt.color.setScalar(light); if (hurt) mt.color.multiply(MP_HURT); }
    updateArmor(m, light, (s.armor || []).map(a => a ? { id: a[0], n: 1, e: a[1] ? { protection: 1 } : null } : null).map(a => a && ITEMS[a.id] ? a : null));
    updateHeld(m, [s.held && ITEMS[s.held] ? { id: s.held, n: 1 } : null, s.off && ITEMS[s.off] ? { id: s.off, n: 1 } : null], light);
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
  const sm = spawnMob; spawnMob = function () { if (MP.role === 'guest' && !MP.allowSpawn && MP.cmd) { const [type, x, y, z] = arguments; mpToAuth({ t: 'summon', type, x, y, z }); } const e = sm.apply(this, arguments); if (MP.role === 'guest' && !MP.allowSpawn) removeEnt(e); return e; }; // guests only show the host's mobs
  const mt = mobTick; mobTick = e => { if (e.remote) return mpPuppetTick(e); if (e.mpRider && performance.now() - e.mpRideAt < 1500) return; /* a guest steers it */ if (MP.role === 'host' && MP.peers.size && !e.deathT) { const g = mpNearestGuest(e); if (g) return mpProxy(g, () => mt(e)); } return mt(e); };
  const hp = hurtPlayer; hurtPlayer = function (dmg, cause) { if (MP.proxy) { mpSend({ t: 'hurt', dmg, cause }, MP.proxy.id); return true; } return hp.apply(this, arguments); };
  const ae = addEffect; addEffect = function (t, k, dur, lv) { if (MP.proxy && t === PL) { mpSend({ t: 'eff', k, dur, lv: lv || 0 }, MP.proxy.id); return; } return ae.apply(this, arguments); };
  const pl = play; play = function () { if (!MP.proxy) return pl.apply(this, arguments); }; // a guest's fight isn't heard at the host's ears
  const at = arrowTick; arrowTick = function (e) { if (MP.role === 'host' && MP.peers.size && mpArrowAtGuest(e)) return; return at.apply(this, arguments); };
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
  const ac = afterClick; afterClick = function () { ac.apply(this, arguments); const c = GUI.ctx; if (MP.on && c && c.x != null) mpTileChanged(c.x, c.y, c.z);
    // a guest changes what is in the runner's chest or hopper minecart, or the gear of the runner's horse
    if (MP.role === 'guest' && c && c.cart && c.cart.remote) mpToAuth({ t: 'cartset', e: c.cart.rid, items: c.cart.items });
    if (MP.role === 'guest' && c && c.horse && c.horse.remote) mpToAuth({ t: 'gear', e: c.horse.rid, gear: c.horse.gear }); };
  const ol = W.onChunkLoaded; W.onChunkLoaded = (c, fresh) => { MP.loading = true; try { if (ol) ol(c, fresh); } finally { MP.loading = false; } if (MP.on) mpChunkLoaded(c); };
  const ui0 = useItem; useItem = function (first) { const t = TARGET; if (MP.role === 'guest' && first && t && t.type === 'ent' && t.e.remote && t.e.kind === 'mob' && mpRemoteUsable(t.e)) { const h = PL.held(); mpToAuth({ t: 'use', e: t.e.rid, st: h ? { ...h } : null, sneak: PL.sneaking ? 1 : 0 }); swing(); USE.placeCd = 4; return; } return ui0.apply(this, arguments); };
  const ia = INV.add; INV.add = st => { if (MP.useFor) { mpSend({ t: 'give', st }, MP.useFor.id); return 0; } return ia(st); }; // milk, a bowl of stew... go to the guest
  const os = UI.openScreen; UI.openScreen = (a, b) => { if (!MP.useFor) os(a, b); };
  // a guest trades with the runner's villager: its offers come from the runner, the guest pays with its own items and the runner counts the trade
  const os2 = UI.openScreen; UI.openScreen = (a, b) => { if (MP.role === 'guest' && b && b.cart && b.cart.remote) mpToAuth({ t: 'cartinv', e: b.cart.rid }); if (a === 'trade' && MP.role === 'guest' && b && b.e && b.e.remote) { b.e.trades = b.e.trades || []; mpToAuth({ t: 'trades', e: b.e.rid }); } os2(a, b); };
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
  if (tool) damageItem(INV.slots, INV.sel, tool.type === S.TOOL.SWORD ? 1 : 2);
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
function mpRemoteUsable(e) { const h = PL.held(); if (e.type === 'villager' || e.type === 'wandering_trader') return false; if (!h) return ['wolf', 'cat', 'parrot', 'fox'].includes(e.type); return h.id !== IID.lead; }
function mpRemoteUse(p, e, st, sneak) {
  const sel = INV.sel, keep = INV.slots[sel], keepT = TARGET;
  INV.slots[sel] = st ? { ...st } : null; TARGET = { type: 'ent', e, t: 1 }; MP.useFor = p;
  try { mpProxy(p, () => { PL.sneaking = !!sneak; useItem(true); }); }
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
  const me = MP.on ? MP.name : '플레이어', rows = [me + (MP.role === 'host' ? ' (호스트)' : '')];
  for (const p of MP.peers.values()) rows.push(p.name + (p.id === 0 ? ' (호스트)' : '') + (p.s && p.s.dim !== W.dim ? ' · ' + ({ '-1': '네더', 1: '디 엔드', 0: '오버월드' })[p.s.dim] : p.s && p.pos ? ' · ' + Math.round(Math.hypot(p.pos[0] - PL.x, p.pos[2] - PL.z)) + 'm' : ''));
  mpListEl.innerHTML = rows.map(r => `<div>${esc(r)}</div>`).join(''); mpListEl.hidden = false;
}
addEventListener('keydown', e => { if (e.code === 'Tab' && W.active && !UI.menu && !UI.screen && !UI.chatOpen) mpShowList(true); });
addEventListener('keyup', e => { if (e.code === 'Tab') mpShowList(false); });
addEventListener('blur', () => mpShowList(false));

// ---------- menus ----------
function mpMenu(name) {
  const nameRow = `<label>내 이름<input id="mpName" value="${esc(MP.name)}" maxlength="16"></label>`, addr = `<label>서버 주소 (node tools/server.js)<input id="mpAddr" value="${esc(mpDefaultAddr())}"></label>`;
  const st = `<p class="muted" id="mpStatus">${esc(MP.status || '')}</p>`;
  if (name === 'mp_create') return `<h2>서버 세계 만들기</h2><div class="form"><p class="muted">이 서버에는 아직 세계가 없습니다. 새로 만들면 서버 컴퓨터에 저장되어, 만든 사람이 없어도 누구나 접속해 플레이할 수 있습니다.</p><label>세계 이름<input id="mpWName" value="서버 세계" maxlength="40"></label><label>시드 (비우면 무작위)<input id="mpSeed" maxlength="32"></label><label>게임 모드<select id="mpMode"><option value="survival">서바이벌</option><option value="creative">크리에이티브</option></select></label><label class="chk"><input type="checkbox" id="mpCheats"> 명령어 허용</label>${btn('만들고 들어가기', 'mp_createworld')}${st}</div><div class="btncol">${btn('취소', 'mp_cancel')}</div>`;
  if (name === 'mp_join') return `<h2>멀티플레이</h2><div class="form">${nameRow}${addr}${btn('서버에 접속', 'mp_joinws')}<p class="muted">서버 없이: 호스트가 보낸 초대 코드를 붙여 넣으세요.</p><textarea id="mpCode" rows="3" placeholder="초대 코드"></textarea>${btn('초대 코드로 참가', 'mp_answer')}<textarea id="mpOut" rows="3" readonly placeholder="여기 나오는 답장 코드를 호스트에게 보내세요"></textarea>${st}</div><div class="btncol">${btn('뒤로', 'title')}</div>`;
  if (name === 'mp_host') {
    if (!MP.on) return `<h2>멀티플레이 열기</h2><div class="form">${nameRow}${addr}${btn('서버로 열기', 'mp_hostws')}${btn('서버 없이 열기 (초대 코드)', 'mp_hostrtc')}${btn('서버 세계로 올리기 (내가 없어도 플레이)', 'mp_upload')}<p class="muted">같은 서버 주소로 친구가 참가하거나, 초대 코드를 주고받아 연결합니다. 세계는 이 컴퓨터에 저장됩니다.</p>${st}</div><div class="btncol">${btn('뒤로', 'pause')}</div>`;
    const list = [...MP.peers.values()].map(p => esc(p.name)).join(', ') || '아직 없음';
    const rtc = MP.link && MP.link.kind === 'rtc' ? `${btn('초대 코드 만들기', 'mp_invite')}<textarea id="mpOut" rows="3" readonly placeholder="초대 코드: 참가할 친구에게 보내세요">${MP.rtc ? MP.rtc.code : ''}</textarea><textarea id="mpCode" rows="3" placeholder="친구가 보낸 답장 코드"></textarea>${btn('답장 코드 넣기', 'mp_accept')}` : '';
    return `<h2>멀티플레이 (${MP.role === 'host' ? '호스트' : '참가 중'})</h2><div class="form"><p>참가자: ${list}</p>${MP.role === 'host' ? rtc : ''}${st}</div><div class="btncol">${btn(MP.role === 'host' ? '멀티플레이 닫기' : '나가기', 'mp_stop')}${btn('뒤로', 'pause')}</div>`;
  }
  return '';
}
async function mpAction(a) {
  const nm = $('mpName'); if (nm && nm.value.trim()) { MP.name = nm.value.trim().slice(0, 16); try { localStorage.setItem(MP_NAME_KEY, MP.name); } catch (e) {} }
  const ad = $('mpAddr'); if (ad && ad.value.trim()) try { localStorage.setItem(MP_ADDR_KEY, ad.value.trim()); } catch (e) {}
  const say = t => { MP.status = t; const el = $('mpStatus'); if (el) el.textContent = t; };
  const codeIn = $('mpCode') ? $('mpCode').value : '';
  try {
    if (a === 'mp_join' || a === 'mp_host') { MP.status = ''; showMenu(a); }
    else if (a === 'mp_joinws') { say('접속하는 중...'); const r = await mpJoinWs(ad.value.trim()); if (r !== 'noworld') say('접속했습니다. 세계를 받는 중...'); }
    else if (a === 'mp_createworld') { const sd = ($('mpSeed').value || '').trim(); mpSend({ t: 'create', meta: { name: ($('mpWName').value || '서버 세계').trim(), seed: seedFrom(sd || String(Math.floor(Math.random() * 1e9))), mode: $('mpMode').value, diff: 2, cheats: $('mpCheats').checked, exp: true } }); say('세계를 만드는 중...'); }
    else if (a === 'mp_cancel') { mpStop(); showMenu('title'); }
    else if (a === 'mp_upload') { say('서버에 올리는 중...'); const n = await mpUpload(ad.value.trim()); say(`올렸습니다 (청크 ${n}개). 이제 타이틀 → 멀티플레이 → 서버에 접속으로 누구나 들어올 수 있습니다.`); }
    else if (a === 'mp_answer') { say('답장 코드를 만드는 중...'); MP.role = 'guest'; MP.on = true; mpInstall(); const code = await mpAnswerInvite(codeIn); $('mpOut').value = code; $('mpOut').select(); say('답장 코드를 호스트에게 보내세요. 호스트가 넣으면 연결됩니다.'); }
    else if (a === 'mp_hostws') { say('서버에 여는 중...'); await mpHostStart('ws'); MP.status = '서버에 열렸습니다'; showMenu('mp_host'); }
    else if (a === 'mp_hostrtc') { await mpHostStart('rtc'); MP.status = '초대 코드를 만들어 친구에게 보내세요'; showMenu('mp_host'); }
    else if (a === 'mp_invite') { say('초대 코드를 만드는 중...'); await mpMakeInvite(); MP.status = '초대 코드를 보내고, 친구의 답장 코드를 넣으세요'; showMenu('mp_host'); }
    else if (a === 'mp_accept') { await mpAcceptAnswer(codeIn); say('연결하는 중...'); }
    else if (a === 'mp_stop') { const guest = MP.role === 'guest'; mpStop(); if (guest) quitToTitle(); else showMenu('pause'); }
  } catch (e) { if (a === 'mp_joinws' || a === 'mp_hostws') { MP.on = false; MP.role = null; MP.link = null; } say('실패: ' + (e.message || e)); }
}
