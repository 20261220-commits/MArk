// Multiplayer basics: one player hosts their world (like Java's "Open to LAN"), others join it.
// Two ways to connect: a relay server (node tools/server.js, it also serves the game on your network) or,
// with no server at all, WebRTC with invite / answer codes copied between the players.
// The host's world is the real one: guests generate the same terrain from the seed, fetch the chunks the host
// has changed, and every block a player breaks or places is sent to everyone. Players see each other (skin,
// held item, armour, pose), chat is shared, the host's clock and weather rule, and the host's mobs are mirrored
// to guests (guests can hit them). Not synced yet: container contents, dropped items, mobs attacking guests.
const MP = { on: false, role: null, name: null, id: 0, link: null, peers: new Map(), local: false, applying: false, allowSpawn: false, nextId: 1, eid: 1, rtc: null, status: '' };
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
      if (!ok) { if (m.t === 'hello') { ok = true; MP.id = m.id; res(link); } else if (m.t === 'error') { rej(new Error(m.msg)); ws.close(); } return; }
      if (m.t === 'leave') { mpPeerGone(m.from); return; } if (m.t === 'hostgone') { mpLost('호스트가 세계를 닫았습니다'); return; }
      mpHandle(m, MP.role === 'host' ? m.from : 0); };
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
  dc.onopen = () => { const id = MP.nextId++, send = rtcWire(dc, m => mpHandle(m, id), () => mpPeerGone(id)); MP.rtcLinks.set(id, send); MP.status = '새 참가자 연결됨'; if (UI.menu === 'mp_host') showMenu('mp_host'); };
  return MP.rtc.code;
}
async function mpAcceptAnswer(code) { if (!MP.rtc) throw new Error('먼저 초대 코드를 만드세요'); await MP.rtc.pc.setRemoteDescription({ type: 'answer', sdp: await mpUnpack(code) }); MP.rtc = null; }
function mpRtcHostLink() { MP.rtcLinks = new Map(); return { kind: 'rtc', send(o, to) { if (to != null) { const s = MP.rtcLinks.get(to); if (s) s(o); } else for (const s of MP.rtcLinks.values()) s(o); }, close() { MP.rtcLinks = new Map(); } }; }
// guest: paste the host's invite, hand back the answer; the channel opens once the host enters it
async function mpAnswerInvite(code) {
  const pc = new RTCPeerConnection(RTC_CFG);
  pc.ondatachannel = e => { const dc = e.channel; dc.onopen = () => { const send = rtcWire(dc, m => mpHandle(m, 0), () => mpLost('호스트와 연결이 끊겼습니다')); MP.link = { kind: 'rtc', send: o => send(o), close: () => { try { pc.close(); } catch (er) {} } }; mpSend({ t: 'join', name: MP.name, skin: mpSkin() }); }; };
  await pc.setRemoteDescription({ type: 'offer', sdp: await mpUnpack(code) });
  await pc.setLocalDescription(await pc.createAnswer()); await iceDone(pc);
  MP.rtcGuest = pc; return mpPack(pc.localDescription.sdp);
}
const mpSend = (o, to) => { if (MP.link) MP.link.send(o, to); };
const mpSkin = () => { const s = skinChoice(); return { tex: s.tex === 'custom_skin' ? (s.slim ? 'alex' : 'steve') : s.tex, slim: s.slim }; };

// ---------- starting and stopping ----------
async function mpHostStart(kind) {
  if (!W.active || W.meta.remote) throw new Error('먼저 세계에 들어가세요');
  MP.role = 'host'; MP.on = true; MP.eid = 1; MP.peers.clear();
  MP.link = kind === 'ws' ? await mpWebSocket($('mpAddr').value.trim(), 'host') : mpRtcHostLink();
  mpInstall(); chatMsg('멀티플레이가 열렸습니다. 친구가 참가할 수 있어요.', '#ffff55');
}
async function mpJoinWs(url) { MP.role = 'guest'; MP.on = true; MP.peers.clear(); MP.link = await mpWebSocket(url, 'guest'); mpInstall(); mpSend({ t: 'join', name: MP.name, skin: mpSkin() }); }
function mpStop() {
  if (!MP.on) return;
  if (MP.role === 'host') mpSend({ t: 'bye' }); else mpSend({ t: 'leave' });
  if (MP.link) MP.link.close(); MP.link = null; if (MP.rtcGuest) { try { MP.rtcGuest.close(); } catch (e) {} MP.rtcGuest = null; }
  for (const p of MP.peers.values()) mpDropAvatar(p); MP.peers.clear();
  for (const e of ENT) if (e.remote) removeEnt(e);
  MP.on = false; MP.role = null; MP.rtc = null;
}
function mpLost(why) {
  if (!MP.on) return; const guest = MP.role === 'guest'; mpStop(); chatMsg(why, '#ff5555');
  if (guest && W.active) { quitToTitle(); UI.flash(why); }
}
function mpPeerGone(id) { const p = MP.peers.get(id); if (!p) return; mpDropAvatar(p); MP.peers.delete(id); chatMsg(p.name + '님이 나갔습니다', '#ffff55'); if (MP.role === 'host') mpSend({ t: 'gone', id }); }

// ---------- message handling ----------
function mpHandle(m, from) {
  const host = MP.role === 'host';
  switch (m.t) {
    case 'join': if (!host) return; { // a new guest: hand over the world's seed, clock and what has been edited
      const p = { id: from, name: String(m.name || '손님').slice(0, 16), skin: m.skin || { tex: 'steve', slim: false }, s: null }; MP.peers.set(from, p);
      const edited = [...W.saved]; for (const c of W.chunks.values()) if (c.edited) edited.push(dkey(c.cx, c.cz));
      mpSend({ t: 'welcome', you: from, seed: W.seed, exp: W.exp, mode: PL.mode === 'hardcore' ? 'survival' : PL.mode, diff: PL.difficulty, time: W.time, rain: W.rain, thunder: W.thunderOn, dim: W.dim,
        at: [PL.x, PL.y, PL.z], spawn: W.worldSpawn, edited: [...new Set(edited)], host: { name: MP.name, skin: mpSkin() }, players: [...MP.peers.values()].filter(q => q.id !== from).map(q => ({ id: q.id, name: q.name, skin: q.skin })), gr: W.meta.gamerules || null }, from);
      mpSend({ t: 'peer', id: from, name: p.name, skin: p.skin }); chatMsg(p.name + '님이 참가했습니다', '#ffff55'); if (UI.menu === 'mp_host') showMenu('mp_host'); return;
    }
    case 'welcome': if (host) return; mpEnterHostWorld(m); return;
    case 'peer': if (m.id === MP.id) return; MP.peers.set(m.id, { id: m.id, name: m.name, skin: m.skin, s: null }); chatMsg(m.name + '님이 참가했습니다', '#ffff55'); return;
    case 'gone': mpPeerGone(m.id); return;
    case 'leave': if (host) mpPeerGone(from); return;
    case 'bye': mpLost('호스트가 세계를 닫았습니다'); return;
    case 'pl': { const id = host ? from : m.id; if (id === MP.id && !host) return; const p = MP.peers.get(id); if (!p) return; p.s = m; p.at = performance.now(); if (host) mpSend({ ...m, id }); return; }
    case 'chat': chatMsg('<' + String(m.name).slice(0, 16) + '> ' + String(m.text).slice(0, 256)); if (host) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id); return;
    case 'set': mpApplySet(m, from); return;
    case 'chunk': if (host) mpServeChunk(m, from); return;
    case 'chunkdata': if (!host) mpGotChunk(m); return;
    case 'time': if (host) return; W.time = m.time; W.rainTarget = m.rain; if (Math.abs(W.rain - m.rain) > 0.5) W.rain = m.rain; W.thunderOn = m.thunder; return;
    case 'mobs': if (!host) mpMirrorMobs(m.l); return;
    case 'hit': if (host) { const e = ENT.find(q => q.mpid === m.e && !q.dead); if (e) hurtMob(e, Math.min(30, +m.dmg || 0), null, +m.kx || 0, +m.kz || 0, 'player'); } return;
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
  chatMsg(m.host.name + '님의 세계에 참가했습니다', '#ffff55');
}
// blocks: the player who did it sends it; the host applies guests' changes and passes them on
function mpBlockChanged(x, y, z, id, m) {
  const msg = { t: 'set', x, y, z, id, m, dim: W.dim, dk: dkey(x >> 4, z >> 4) };
  mpSend(msg);
}
function mpApplySet(m, from) {
  const host = MP.role === 'host';
  if (m.dim === W.dim && isLoaded(m.x, m.z)) { MP.applying = true; try { setBlock(m.x, m.y, m.z, m.id, m.m); } finally { MP.applying = false; } }
  else if (host) { // not loaded here: kept with the world and put in place when the host loads that chunk
    const E = W.meta.mpEdits || (W.meta.mpEdits = {}); (E[m.dk] || (E[m.dk] = [])).push([m.x, m.y, m.z, m.id, m.m]);
  } else W.saved.add(m.dk); // a guest fetches that chunk from the host when it gets near
  if (host) for (const id of MP.peers.keys()) if (id !== from) mpSend(m, id);
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
  mpSend(out, from);
}
const mpEdits = new Map(); // chunk key -> edits to apply when it loads (guests)
function mpRequestChunk(cx, cz) { W.pending.set(ckey(cx, cz), 'load'); mpSend({ t: 'chunk', cx, cz, dim: W.dim }); }
function mpGotChunk(m) {
  if (m.dim !== W.dim) return; const key = ckey(m.cx, m.cz);
  if (W.pending.get(key) !== 'load') return; W.pending.delete(key);
  if (m.edits) mpEdits.set(key, m.edits);
  if (m.none) { W.saved.delete(DIM_PREFIX[m.dim] + m.cx + ',' + m.cz); return; } // the host has the plain terrain: generate it here
  const n = 256 * m.ch, dec = (s, T, fill) => { const a = rleDec(mpUnB64(s, T), n, T), out = new T(CVOL); out.set(a.subarray(0, Math.min(n, CVOL))); if (fill) out.fill(fill, n); return out; };
  W.inbox.push({ cx: m.cx, cz: m.cz, blocks: dec(m.b, Uint16Array), meta: dec(m.m, Uint8Array), light: dec(m.l, Uint8Array, 0xf0), biome: Uint8Array.from(m.bio), mobs: null, fromSave: true, tileList: m.tl || [] });
}
function mpChunkLoaded(c) {
  const host = MP.role === 'host', dk = dkey(c.cx, c.cz);
  const list = host ? W.meta.mpEdits && W.meta.mpEdits[dk] : mpEdits.get(c.key);
  if (!list) return;
  MP.applying = true; try { for (const [x, y, z, id, m] of list) setBlock(x, y, z, id, m); } finally { MP.applying = false; }
  if (host) delete W.meta.mpEdits[dk]; else mpEdits.delete(c.key);
}

// ---------- every tick: your state out; the host also sends the clock and nearby mobs ----------
function mpTick() {
  if (!MP.on || !W.active) return;
  if (W.tickN % 2 === 0) { const [h, off] = handItems(); mpSend({ t: 'pl', id: MP.role === 'host' ? 0 : MP.id, x: +PL.x.toFixed(3), y: +PL.y.toFixed(3), z: +PL.z.toFixed(3), yaw: +PL.yaw.toFixed(3), pitch: +PL.pitch.toFixed(3), dim: W.dim,
    sneak: PL.sneaking && !PL.flying ? 1 : 0, swing: R.hand.swing > 0 ? +(1 - R.hand.swing).toFixed(2) : 0, held: h ? h.id : 0, off: off ? off.id : 0, fly: PL.flying ? 1 : 0, dead: PL.dead ? 1 : 0, sleep: PL.sleeping ? 1 : 0,
    armor: INV.armor.map(s => s ? [s.id, s.e ? 1 : 0] : 0) }); }
  if (MP.role !== 'host') return;
  if (W.tickN % 40 === 0) mpSend({ t: 'time', time: W.time, rain: W.rainTarget, thunder: W.thunderOn });
  if (W.tickN % 4 === 0) for (const p of MP.peers.values()) { // mobs near each guest, 5 times a second
    if (!p.s || p.s.dim !== W.dim) continue; const l = [];
    for (const e of ENT) { if (e.dead || e.kind !== 'mob' || Math.abs(e.x - p.s.x) > 64 || Math.abs(e.z - p.s.z) > 64) continue; if (!e.mpid) e.mpid = MP.eid++;
      l.push([e.mpid, e.type, +e.x.toFixed(2), +e.y.toFixed(2), +e.z.toFixed(2), +e.yaw.toFixed(2), e.baby ? 1 : 0, e.hurt > 0 ? 1 : 0, e.variant != null ? e.variant : null, e.size || 0, e.vtype || null, e.prof || null, e.sheared ? 1 : 0, e.deathT ? 1 : 0]); }
    mpSend({ t: 'mobs', l }, p.id);
  }
}
// guests: the host's mobs as puppets that move where the host says
function mpMirrorMobs(l) {
  const seen = new Set();
  for (const [id, type, x, y, z, yaw, baby, hurt, variant, size, vtype, prof, sheared, dying] of l) {
    seen.add(id); let e = ENT.find(q => q.remote && q.rid === id && !q.dead);
    if (!e && MOBDEF[type] && !dying) { MP.allowSpawn = true; try { e = spawnMob(type, x, y, z, { baby, variant, size, vtype, prof, sheared }); } finally { MP.allowSpawn = false; } e.remote = true; e.rid = id; e.persistent = true; e.yaw = yaw; }
    if (!e) continue; e.tx = x; e.ty = y; e.tz = z; e.tyaw = yaw; if (hurt && !e.hurt) e.hurt = 10; if (dying && !e.deathT) e.deathT = 1;
  }
  for (const e of ENT) if (e.remote && !e.dead && !seen.has(e.rid)) removeEnt(e);
}
function mpPuppetTick(e) {
  if (e.tx == null) return; const dx = e.tx - e.x, dz = e.tz - e.z;
  e.x += dx * 0.5; e.y += (e.ty - e.y) * 0.5; e.z += dz * 0.5; e.yaw += wrapA(e.tyaw - e.yaw) * 0.5;
  const sp = Math.hypot(dx, dz); e.walkAmt = Math.min(1, sp * 6); e.walk = (e.walk || 0) + sp * 3; if (e.hurt > 0) e.hurt--; if (e.deathT) e.deathT++;
}

// ---------- other players' figures ----------
function mpAvatar(p) {
  if (p.m) return p.m;
  const sk = p.skin || {}, m = buildModel(sk.slim ? 'player_slim' : 'player', { skin: PACKPX.ent[sk.tex] ? sk.tex : 'steve' });
  m.userData.armorKey = ''; m.userData.armor = []; m.userData.heldKey = ['', '']; m.userData.held = [null, null]; if (m.userData.mat2) m.userData.mat2.visible = false;
  m.userData.st = { bodyYaw: NaN, limb: 0, limbD: 0, wingP: 0.2617994, wingR: -0.2617994, wingY: 0, wingPy: 0, lean: 0, deathT: 0 };
  const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold 28px sans-serif'; const w = Math.ceil(g.measureText(p.name).width) + 16; c.width = w; c.height = 40;
  g.font = 'bold 28px sans-serif'; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, 40); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(p.name, 8, 21);
  const t = new THREE.CanvasTexture(c), tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); tag.scale.set(w / 40 * 0.3, 0.3, 1); tag.renderOrder = 5;
  p.tag = tag; p.m = m; p.pos = null; scene.add(m, tag); return m;
}
function mpDropAvatar(p) { if (p.m) { scene.remove(p.m); scene.remove(p.tag); p.m = null; } }
function mpRender(dt) {
  if (!MP.on) return;
  for (const p of MP.peers.values()) {
    const s = p.s; if (!s || s.dim !== W.dim || performance.now() - p.at > 5000) { if (p.m) p.m.visible = p.tag.visible = false; continue; }
    const m = mpAvatar(p), st = m.userData.st, k = Math.min(1, dt * 12);
    const last = p.pos || [s.x, s.y, s.z]; p.pos = [last[0] + (s.x - last[0]) * k, last[1] + (s.y - last[1]) * k, last[2] + (s.z - last[2]) * k];
    const mvx = p.pos[0] - last[0], mvz = p.pos[2] - last[2], dtT = dt * 20;
    if (!(st.bodyYaw === st.bodyYaw)) st.bodyYaw = s.yaw;
    const ps = { headYaw: 0, headPitch: -s.pitch, headPitchW: -s.pitch, yaw: s.yaw, right: s.held ? 'item' : null, left: s.off ? 'item' : null, two: null, charge: 0, swing: s.swing, swingLeft: false,
      sneak: !!s.sneak, riding: false, flying: !!s.fly, gliding: false, glideT: 0, vel2: mvx * mvx + mvz * mvz, vy: 0, swim: false, sleep: !!s.sleep, bedYaw: 0, age: performance.now() / 50 };
    tickBodyYaw(st, ps, mvx, mvz, dtT);
    const spd = Math.min(1, Math.hypot(mvx, mvz) / Math.max(dt, 1e-3) / 20 * 4); st.limbD += (spd - st.limbD) * Math.min(1, 0.4 * dtT); st.limb += st.limbD * dtT;
    ps.headYaw = -wrapA(s.yaw - st.bodyYaw);
    m.visible = p.tag.visible = !s.dead; posePlayer(m, ps); placePlayer(m, ps, p.pos[0], p.pos[1], p.pos[2]);
    p.tag.position.set(p.pos[0], p.pos[1] + (s.sneak ? 1.95 : 2.15), p.pos[2]);
    const light = lightBright(p.pos[0], p.pos[1] + 1, p.pos[2]); for (const mt of m.userData.mats) mt.color.setScalar(light);
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
  const g0 = gr; gr = k => MP.role === 'guest' && (k === 'doDaylightCycle' || k === 'doWeatherCycle' || k === 'doMobSpawning') ? false : g0(k); // the host's world decides
  const sm = spawnMob; spawnMob = function () { const e = sm.apply(this, arguments); if (MP.role === 'guest' && !MP.allowSpawn) removeEnt(e); return e; }; // guests only show the host's mobs
  const mt = mobTick; mobTick = e => e.remote ? mpPuppetTick(e) : mt(e);
  const hm = hurtMob; hurtMob = function (e, dmg, attacker, kx = 0, kz = 0) { if (e.remote) { if (attacker === PL) { mpSend({ t: 'hit', e: e.rid, dmg, kx, kz }); e.hurt = 10; return true; } return false; } return hm.apply(this, arguments); };
  if (typeof ensureDragon === 'function') { const ed = ensureDragon; ensureDragon = function () { if (MP.role !== 'guest') ed(); }; }
  const lc = loadChunk; loadChunk = (cx, cz) => MP.role === 'guest' ? mpRequestChunk(cx, cz) : lc(cx, cz);
  const ol = W.onChunkLoaded; W.onChunkLoaded = (c, fresh) => { if (ol) ol(c, fresh); if (MP.on) mpChunkLoaded(c); };
}

// ---------- menus ----------
function mpMenu(name) {
  const nameRow = `<label>내 이름<input id="mpName" value="${esc(MP.name)}" maxlength="16"></label>`, addr = `<label>서버 주소 (node tools/server.js)<input id="mpAddr" value="${esc(mpDefaultAddr())}"></label>`;
  const st = `<p class="muted" id="mpStatus">${esc(MP.status || '')}</p>`;
  if (name === 'mp_join') return `<h2>멀티플레이</h2><div class="form">${nameRow}${addr}${btn('서버에 접속', 'mp_joinws')}<p class="muted">서버 없이: 호스트가 보낸 초대 코드를 붙여 넣으세요.</p><textarea id="mpCode" rows="3" placeholder="초대 코드"></textarea>${btn('초대 코드로 참가', 'mp_answer')}<textarea id="mpOut" rows="3" readonly placeholder="여기 나오는 답장 코드를 호스트에게 보내세요"></textarea>${st}</div><div class="btncol">${btn('뒤로', 'title')}</div>`;
  if (name === 'mp_host') {
    if (!MP.on) return `<h2>멀티플레이 열기</h2><div class="form">${nameRow}${addr}${btn('서버로 열기', 'mp_hostws')}${btn('서버 없이 열기 (초대 코드)', 'mp_hostrtc')}<p class="muted">같은 서버 주소로 친구가 참가하거나, 초대 코드를 주고받아 연결합니다. 세계는 이 컴퓨터에 저장됩니다.</p>${st}</div><div class="btncol">${btn('뒤로', 'pause')}</div>`;
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
    else if (a === 'mp_joinws') { say('접속하는 중...'); await mpJoinWs(ad.value.trim()); say('접속했습니다. 세계를 받는 중...'); }
    else if (a === 'mp_answer') { say('답장 코드를 만드는 중...'); MP.role = 'guest'; MP.on = true; mpInstall(); const code = await mpAnswerInvite(codeIn); $('mpOut').value = code; $('mpOut').select(); say('답장 코드를 호스트에게 보내세요. 호스트가 넣으면 연결됩니다.'); }
    else if (a === 'mp_hostws') { say('서버에 여는 중...'); await mpHostStart('ws'); MP.status = '서버에 열렸습니다'; showMenu('mp_host'); }
    else if (a === 'mp_hostrtc') { await mpHostStart('rtc'); MP.status = '초대 코드를 만들어 친구에게 보내세요'; showMenu('mp_host'); }
    else if (a === 'mp_invite') { say('초대 코드를 만드는 중...'); await mpMakeInvite(); MP.status = '초대 코드를 보내고, 친구의 답장 코드를 넣으세요'; showMenu('mp_host'); }
    else if (a === 'mp_accept') { await mpAcceptAnswer(codeIn); say('연결하는 중...'); }
    else if (a === 'mp_stop') { const guest = MP.role === 'guest'; mpStop(); if (guest) quitToTitle(); else showMenu('pause'); }
  } catch (e) { if (a === 'mp_joinws' || a === 'mp_hostws') { MP.on = false; MP.role = null; MP.link = null; } say('실패: ' + (e.message || e)); }
}
