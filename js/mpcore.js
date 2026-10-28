// The world's side of multiplayer, shared by the server (tools/server.js, files on disk) and a player who opens their own
// world to others (this browser, IndexedDB): who is playing and where, who runs each dimension, the clock and the weather,
// every chunk's stored state with the changes made since, containers, each player's saved inventory and place.
// The first player in a dimension runs it (mobs, fluids, crops, redstone) and stores its chunks here; when that player
// leaves or changes dimension, the next one there takes over with the stored mobs.
//   store: { state: { meta, time, rain, thunder, weatherT, players }, keys: Set of chunk keys, load(dk) -> Promise of
//            { rec, edits, tiles } | null, save(dk, entry), saveState(), log(text) }
//   out(id, message): deliver a message to one player
// SHA-256 of a text (UTF-8), as hex: the same in a browser (even on plain http, where crypto.subtle is missing) and in Node
function mpSha256(str) {
  const b = unescape(encodeURIComponent(str)), n = b.length, words = [], K = [], H = [];
  const frac = x => (x - Math.floor(x)) * 4294967296 | 0;
  for (let c = 2, k = 0; k < 64; c++) { let pr = true; for (let d = 2; d * d <= c; d++) if (c % d === 0) { pr = false; break; } if (pr) { if (k < 8) H[k] = frac(Math.pow(c, 1 / 2)); K[k++] = frac(Math.pow(c, 1 / 3)); } }
  for (let i = 0; i < n; i++) words[i >> 2] |= b.charCodeAt(i) << (24 - (i % 4) * 8);
  words[n >> 2] |= 0x80 << (24 - (n % 4) * 8); const L = (((n + 8) >> 6) + 1) * 16; for (let i = words.length; i < L; i++) words[i] = words[i] | 0; words[L - 1] = n * 8;
  const r = (x, k) => (x >>> k) | (x << (32 - k)), w = new Array(64);
  for (let o = 0; o < L; o += 16) {
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      w[i] = i < 16 ? words[o + i] | 0 : (r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10)) + w[i - 7] + (r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3)) + w[i - 16] | 0;
      const t1 = h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i] | 0, t2 = (r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c)) | 0;
      h = g; g = f; f = e; e = d + t1 | 0; d = c; c = bb; bb = a; a = t1 + t2 | 0;
    }
    H[0] = H[0] + a | 0; H[1] = H[1] + bb | 0; H[2] = H[2] + c | 0; H[3] = H[3] + d | 0; H[4] = H[4] + e | 0; H[5] = H[5] + f | 0; H[6] = H[6] + g | 0; H[7] = H[7] + h | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}
function mpWorldCore(store, out) {
  const S = store.state, players = new Map(), auth = new Map(), cache = new Map(), fails = new Map();
  const blank = () => ({ rec: null, edits: [], tiles: {} });
  const entry = dk => { let p = cache.get(dk); if (!p) { p = store.keys.has(dk) ? Promise.resolve(store.load(dk)).then(c => c || blank(), () => blank()) : Promise.resolve(blank()); cache.set(dk, p); } return p; };
  const touch = (dk, e) => { store.keys.add(dk); store.save(dk, e); };
  const prefix = dim => ({ '-1': 'n', 1: 'e' }[dim] || '');
  const chunkKey = (dim, x, z) => prefix(dim) + (x >> 4) + ',' + (z >> 4);
  const send = (p, o) => out(p.id, o);
  const others = (p, o, sameDim) => { for (const q of players.values()) if (q !== p && q.joined && (!sameDim || q.dim === p.dim)) out(q.id, o); };
  function pickAuth(dim) {
    const cur = auth.get(dim), here = [...players.values()].filter(q => q.joined && q.dim === dim);
    if (cur != null && here.some(q => q.id === cur)) return;
    if (here.length) auth.set(dim, here[0].id); else auth.delete(dim);
    const o = { t: 'auth', dim, id: auth.has(dim) ? auth.get(dim) : null }; for (const q of players.values()) if (q.joined) out(q.id, o);
  }
  function setDim(p, dim) { if (p.dim === dim) return; const old = p.dim; p.dim = dim; if (old != null) pickAuth(old); pickAuth(dim); send(p, { t: 'auth', dim, id: auth.get(dim) }); }
  function tick() { // once a second: 20 ticks of the clock and the weather while anyone plays
    if (!players.size || !S.meta) return;
    const g = S.meta.gamerules || {};
    if (g.doDaylightCycle !== false) S.time += 20;
    if (g.doWeatherCycle !== false && (S.weatherT = (S.weatherT || 24000) - 20) <= 0) { const on = S.rain < 0.5; S.rain = on ? 1 : 0; S.thunder = on && Math.random() < 0.3; S.weatherT = on ? 12000 + Math.random() * 12000 : 12000 + Math.random() * 168000; }
    // the night passes once everyone in the Overworld has been in bed for a few seconds
    const ow = [...players.values()].filter(q => q.joined && q.dim === 0 && q.s && q.s.mode !== 'spectator');
    const asleep = ow.length && ow.every(q => q.s.sleep); S.sleepT = asleep ? (S.sleepT || 0) + 1 : 0;
    if (S.sleepT >= 5) { S.time = Math.ceil(S.time / 24000) * 24000; S.rain = 0; S.thunder = false; S.sleepT = 0; for (const q of players.values()) if (q.joined) out(q.id, { t: 'wake' }); }
    for (const q of players.values()) if (q.joined) out(q.id, { t: 'time', time: S.time, rain: S.rain, thunder: S.thunder });
    if (S.time % 200 === 0) store.saveState();
  }
  function message(id, m) {
    let p = players.get(id); if (!p) { p = { id, name: null, dim: null, joined: false, s: null }; players.set(id, p); }
    const from = id; m.from = from;
    switch (m.t) {
      case 'create': // a new world, or the start of an upload of an existing one
        if (S.meta) { send(p, { t: 'error', msg: '이 서버에는 이미 세계가 있습니다' }); return; }
        S.meta = { name: String(m.meta.name || '서버 세계').slice(0, 40), seed: m.meta.seed, gen: +m.meta.gen || 1, exp: m.meta.exp !== false, mode: m.meta.mode === 'creative' ? 'creative' : 'survival', diff: +m.meta.diff || 2, cheats: !!m.meta.cheats, spawn: m.meta.spawn || null, gamerules: m.meta.gamerules || {}, shared: m.meta.shared || {} };
        S.time = +m.meta.time || 1000; S.rain = 0; store.saveState(); store.log(`새 세계 "${S.meta.name}" (시드 ${S.meta.seed})`); send(p, { t: 'created' }); return;
      case 'join': {
        if (!S.meta) { send(p, { t: 'noworld' }); return; }
        p.name = (typeof m.name === 'string' && m.name.trim() ? m.name.trim() : '손님').slice(0, 16); p.skin = m.skin || null; p.account = null;
        // a nickname with a password: the first time on this world it makes the account (only a salted hash of the
        // proof is kept), after that the same password is needed. A name with an account can't be used without it.
        S.logins = S.logins || {};
        const lg = m.login && typeof m.login.name === 'string' && typeof m.login.cred === 'string' && /^[0-9a-f]{64}$/.test(m.login.cred) ? m.login : null;
        if (lg) {
          p.name = lg.name.trim().slice(0, 16) || p.name; const k = p.name.toLowerCase(), rec = S.logins[k], now = Date.now();
          const f = fails.get(k); if (f && f.n >= 5 && now - f.t < 30000) { send(p, { t: 'error', msg: '비밀번호를 여러 번 틀렸습니다. 30초 뒤에 다시 해 보세요' }); return; }
          if (rec && mpSha256(rec.salt + lg.cred) !== rec.h) { fails.set(k, { n: (f && now - f.t < 30000 ? f.n : 0) + 1, t: now }); send(p, { t: 'error', msg: `비밀번호가 틀렸습니다 ("${p.name}" 계정은 이 세계에 이미 있습니다)` }); return; }
          fails.delete(k); p.account = k;
          if (!rec) { // a new account takes over what that name had saved here
            const salt = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');
            S.logins[k] = { salt, h: mpSha256(salt + lg.cred), at: now };
            const old = Object.keys(S.players).find(n => n.toLowerCase() === k) || (S.accounts && S.accounts[p.name] ? 'g:' + S.accounts[p.name] : null);
            if (old && S.players[old] && !S.players['a:' + k]) { S.players['a:' + k] = S.players[old]; delete S.players[old]; }
            if (S.accounts) delete S.accounts[p.name];
            store.saveState(); store.log(`${p.name} 계정을 만들었습니다`);
          }
        }
        p.key = p.account ? 'a:' + p.account : p.name;
        for (const q of players.values()) if (q !== p && q.joined && (q.name.toLowerCase() === p.name.toLowerCase() || q.key === p.key)) { send(p, { t: 'error', msg: p.account && q.key === p.key ? '이 계정으로 이미 접속해 있습니다' : '같은 이름의 플레이어가 이미 있습니다' }); return; }
        if (!p.account && S.logins[p.name.toLowerCase()]) { send(p, { t: 'error', msg: `"${p.name}" 이름에는 비밀번호가 걸려 있습니다. 타이틀 → 로그인에서 이 이름과 비밀번호로 로그인한 뒤 접속하세요` }); return; }
        p.joined = true;
        send(p, { t: 'welcome', you: from, meta: S.meta, time: S.time, rain: S.rain, thunder: S.thunder, pdata: S.players[p.key] || null, stored: [...store.keys],
          players: [...players.values()].filter(q => q !== p && q.joined).map(q => ({ id: q.id, name: q.name, skin: q.skin })), auth: Object.fromEntries(auth) });
        others(p, { t: 'peer', id: from, name: p.name, skin: p.skin }); store.log(`${p.name} 접속 (${[...players.values()].filter(q => q.joined).length}명)`); return;
      }
      case 'dim': setDim(p, +m.dim || 0); return;
      case 'pl': p.s = m; if (m.dim !== p.dim && p.joined) setDim(p, m.dim); others(p, m); return;
      case 'pdata': { const nm = p.key || p.name || (typeof m.name === 'string' ? m.name.slice(0, 16) : null); if (nm && m.d) { S.players[nm] = m.d; store.saveState(); } return; }
      case 'meta': if (S.meta && m.shared) { S.meta.shared = { ...S.meta.shared, ...m.shared }; if (m.spawn) S.meta.spawn = m.spawn; if (m.gamerules) S.meta.gamerules = m.gamerules; store.saveState(); } return;
      case 'timeset': S.time = +m.time || S.time; if (m.rain != null) { S.rain = m.rain; S.thunder = !!m.thunder; } return;
      case 'chunk': { const dk = prefix(m.dim) + m.cx + ',' + m.cz; if (!store.keys.has(dk)) { send(p, { t: 'chunkdata', cx: m.cx, cz: m.cz, dim: m.dim, none: true }); return; }
        entry(dk).then(c => { const o = { t: 'chunkdata', cx: m.cx, cz: m.cz, dim: m.dim, edits: c.edits.length ? c.edits : null, tiles: Object.keys(c.tiles).length ? c.tiles : null };
          if (c.rec && c.rec.b) Object.assign(o, { b: c.rec.b, m: c.rec.m, l: c.rec.l, bio: c.rec.bio, tl: c.rec.t || [], ch: c.rec.ch, my: c.rec.my, it: c.rec.it, mobs: c.rec.mobs || null }); else { o.none = true; if (c.rec) o.mobs = c.rec.mobs || null; }
          send(p, o); }); return; }
      case 'chunkmobs': Promise.all((m.dks || []).filter(dk => store.keys.has(dk)).map(dk => entry(dk).then(c => c.rec && c.rec.mobs ? [dk, c.rec.mobs] : null))).then(l => send(p, { t: 'chunkmobs', l: l.filter(Boolean) })); return;
      case 'store': if (typeof m.dk !== 'string' || !m.rec) return; entry(m.dk).then(c => { c.rec = m.rec; c.edits = []; c.tiles = {}; c.recChanged = true; touch(m.dk, c); }); others(p, { t: 'stored', dk: m.dk }); return;
      case 'mobsnap': // the runner's mobs, items and vehicles every few seconds: what the next runner starts from
        if (auth.get(p.dim) !== from) return;
        for (const [dk, list] of m.l || []) entry(dk).then(c => { if (c.rec) c.rec.mobs = list; else c.rec = { v: 2, it: m.it, mobs: list }; c.recChanged = true; touch(dk, c); });
        return;
      case 'sets': // the dimension's runner: every change, kept until that chunk is stored again
        if (auth.get(p.dim) !== from) return;
        for (const e of m.l || []) { const dk = chunkKey(m.dim, e[0], e[2]); entry(dk).then(c => { c.edits.push(e); if (c.edits.length > 20000) c.edits.splice(0, c.edits.length - 20000); touch(dk, c); }); }
        others(p, m, true); return;
      case 'tile': if (typeof m.dk === 'string' && m.tile) { const i = ((m.y + 64) << 8) | ((m.z & 15) << 4) | (m.x & 15); /* as the game keeps tiles: rows from y -64 */ entry(m.dk).then(c => { c.tiles[i] = m.tile; touch(m.dk, c); }); } others(p, m, true); return;
      case 'chat': case 'sys': case 'hitfx': others(p, m); return;
    }
    // anything else: to one player, to the dimension's runner, to the dimension, or to everyone
    const to = m.to; delete m.to;
    if (typeof to === 'number') { if (players.has(to)) out(to, m); }
    else if (to === 'auth') { const a = auth.get(m.dim != null ? m.dim : p.dim); if (a != null && a !== from) out(a, m); }
    else if (to === 'dim') others(p, m, true);
    else others(p, m);
  }
  function leave(id) {
    const p = players.get(id); if (!p) return; players.delete(id); if (!p.joined) return;
    others(p, { t: 'gone', id }); store.log(`${p.name} 나감 (${[...players.values()].filter(q => q.joined).length}명)`);
    if (p.dim != null) pickAuth(p.dim);
    store.saveState();
  }
  return { message, leave, tick, players, auth };
}
if (typeof module !== 'undefined') module.exports = { mpWorldCore, mpSha256 };
