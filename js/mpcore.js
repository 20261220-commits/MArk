// The world's side of multiplayer, shared by the server (tools/server.js, files on disk) and a player who opens their own
// world to others (this browser, IndexedDB): who is playing and where, who runs each dimension, the clock and the weather,
// every chunk's stored state with the changes made since, containers, each player's saved inventory and place.
// The first player in a dimension runs it (mobs, fluids, crops, redstone) and stores its chunks here; when that player
// leaves or changes dimension, the next one there takes over with the stored mobs.
//   store: { state: { meta, time, rain, thunder, weatherT, players }, keys: Set of chunk keys, load(dk) -> Promise of
//            { rec, edits, tiles } | null, save(dk, entry), saveState(), log(text) }
//   out(id, message): deliver a message to one player
function mpWorldCore(store, out) {
  const S = store.state, players = new Map(), auth = new Map(), cache = new Map();
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
        S.meta = { name: String(m.meta.name || '서버 세계').slice(0, 40), seed: m.meta.seed, exp: m.meta.exp !== false, mode: m.meta.mode === 'creative' ? 'creative' : 'survival', diff: +m.meta.diff || 2, cheats: !!m.meta.cheats, spawn: m.meta.spawn || null, gamerules: m.meta.gamerules || {}, shared: m.meta.shared || {} };
        S.time = +m.meta.time || 1000; S.rain = 0; store.saveState(); store.log(`새 세계 "${S.meta.name}" (시드 ${S.meta.seed})`); send(p, { t: 'created' }); return;
      case 'join': {
        if (!S.meta) { send(p, { t: 'noworld' }); return; }
        p.name = String(m.name || '손님').slice(0, 16); p.skin = m.skin || null;
        for (const q of players.values()) if (q !== p && q.joined && q.name === p.name) { send(p, { t: 'error', msg: '같은 이름의 플레이어가 이미 있습니다' }); return; }
        p.joined = true;
        send(p, { t: 'welcome', you: from, meta: S.meta, time: S.time, rain: S.rain, thunder: S.thunder, pdata: S.players[p.name] || null, stored: [...store.keys],
          players: [...players.values()].filter(q => q !== p && q.joined).map(q => ({ id: q.id, name: q.name, skin: q.skin })), auth: Object.fromEntries(auth) });
        others(p, { t: 'peer', id: from, name: p.name, skin: p.skin }); store.log(`${p.name} 접속 (${[...players.values()].filter(q => q.joined).length}명)`); return;
      }
      case 'dim': setDim(p, +m.dim || 0); return;
      case 'pl': p.s = m; if (m.dim !== p.dim && p.joined) setDim(p, m.dim); others(p, m); return;
      case 'pdata': { const nm = p.name || (typeof m.name === 'string' ? m.name.slice(0, 16) : null); if (nm && m.d) { S.players[nm] = m.d; store.saveState(); } return; }
      case 'meta': if (S.meta && m.shared) { S.meta.shared = { ...S.meta.shared, ...m.shared }; if (m.spawn) S.meta.spawn = m.spawn; if (m.gamerules) S.meta.gamerules = m.gamerules; store.saveState(); } return;
      case 'timeset': S.time = +m.time || S.time; if (m.rain != null) { S.rain = m.rain; S.thunder = !!m.thunder; } return;
      case 'chunk': { const dk = prefix(m.dim) + m.cx + ',' + m.cz; if (!store.keys.has(dk)) { send(p, { t: 'chunkdata', cx: m.cx, cz: m.cz, dim: m.dim, none: true }); return; }
        entry(dk).then(c => { const o = { t: 'chunkdata', cx: m.cx, cz: m.cz, dim: m.dim, edits: c.edits.length ? c.edits : null, tiles: Object.keys(c.tiles).length ? c.tiles : null };
          if (c.rec && c.rec.b) Object.assign(o, { b: c.rec.b, m: c.rec.m, l: c.rec.l, bio: c.rec.bio, tl: c.rec.t || [], ch: c.rec.ch, it: c.rec.it, mobs: c.rec.mobs || null }); else { o.none = true; if (c.rec) o.mobs = c.rec.mobs || null; }
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
      case 'tile': if (typeof m.dk === 'string' && m.tile) { const i = (m.y << 8) | ((m.z & 15) << 4) | (m.x & 15); entry(m.dk).then(c => { c.tiles[i] = m.tile; touch(m.dk, c); }); } others(p, m, true); return;
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
if (typeof module !== 'undefined') module.exports = { mpWorldCore };
