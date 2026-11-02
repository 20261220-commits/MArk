// Chat commands with Java Edition's syntax: target selectors (@s @p @a @r @e with [type=, distance=, limit=, sort=, name=,
// gamemode=, x= y= z= dx= dy= dz=]), relative (~) and local (^) coordinates, block states (oak_stairs[facing=east]),
// and the usual arguments of each command. /locate, /gamerule and /keepinventory still go to the older handler (ui.js).
function cmdTokens(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    while (s[i] === ' ') i++; if (i >= s.length) break;
    let j = i, depth = 0, q = null;
    for (; j < s.length; j++) { const ch = s[j]; if (q) { if (ch === '\\') { j++; continue; } if (ch === q) q = null; continue; } if (ch === '"' || ch === "'") { q = ch; continue; } if (ch === '[' || ch === '{') depth++; else if (ch === ']' || ch === '}') depth--; else if (ch === ' ' && depth <= 0) break; }
    out.push(s.slice(i, j)); i = j;
  }
  return out;
}
const cmdId = k => String(k || '').replace(/^minecraft:/, '');
// a range like "5", "..10", "2..", "2..8"
function cmdRange(v) { const m = String(v).match(/^(-?[\d.]*?)(\.\.)?(-?[\d.]*)$/); if (!m) return null; if (!m[2]) { const n = +v; return isFinite(n) ? [n, n] : null; } return [m[1] === '' ? -Infinity : +m[1], m[3] === '' ? Infinity : +m[3]]; }
// one player record per player: this one, and the others in a multiplayer world (only their place is known here)
function cmdPlayers() {
  const me = { self: true, name: MP.on ? MP.name : '플레이어', x: PL.x, y: PL.y, z: PL.z, mode: PL.mode, ent: PL };
  const L = [me];
  if (MP.on) for (const p of MP.peers.values()) if (p.s && p.pos && p.s.dim === W.dim) L.push({ self: false, name: p.name, x: p.pos[0], y: p.pos[1], z: p.pos[2], mode: p.s.mode, peer: p });
  return L;
}
// a selector or a player name -> list of targets ({ self } / { peer } / { ent }), or null when it isn't one
function cmdSelect(tok) {
  if (!tok) return null;
  const players = cmdPlayers();
  if (tok[0] !== '@') { const p = players.find(q => q.name === tok || (q.self && tok === '플레이어')); return p ? [p] : null; }
  const m = tok.match(/^@([pares])(?:\[(.*)\])?$/); if (!m) return null;
  const args = {}; if (m[2]) for (const kv of m[2].split(',')) { const i = kv.indexOf('='); if (i > 0) { const k = kv.slice(0, i).trim(), v = kv.slice(i + 1).trim(); (args[k] = args[k] || []).push(v); } }
  const one = k => args[k] && args[k][0];
  const base = [one('x') != null ? +one('x') : PL.x, one('y') != null ? +one('y') : PL.y, one('z') != null ? +one('z') : PL.z];
  let L;
  if (m[1] === 'e') { L = players.slice(); for (const e of ENT) if (!e.dead && (e.kind === 'mob' || e.kind === 'item' || e.kind === 'arrow' || e.kind === 'boat' || e.kind === 'minecart' || e.kind === 'xp' || e.kind === 'tnt' || e.kind === 'armor_stand' || e.kind === 'frame' || e.kind === 'painting')) L.push({ ent: e, x: e.x, y: e.y, z: e.z, type: e.kind === 'mob' ? e.type : e.kind === 'xp' ? 'experience_orb' : e.kind === 'frame' ? (e.glow ? 'glow_item_frame' : 'item_frame') : e.kind, name: e.name }); }
  else if (m[1] === 's') L = [players[0]];
  else L = players.slice();
  for (const t of L) if (t.type == null) t.type = 'player';
  for (const v of args.type || []) { const neg = v[0] === '!', k = cmdId(neg ? v.slice(1) : v); L = L.filter(t => (t.type === k) !== neg); }
  for (const v of args.name || []) { const neg = v[0] === '!', k = (neg ? v.slice(1) : v).replace(/^"|"$/g, ''); L = L.filter(t => (t.name === k) !== neg); }
  for (const v of args.gamemode || []) { const neg = v[0] === '!', k = neg ? v.slice(1) : v; L = L.filter(t => t.type === 'player' && ((t.mode === k) !== neg)); }
  const dist = one('distance') && cmdRange(one('distance'));
  if (dist) L = L.filter(t => { const d = Math.hypot(t.x - base[0], t.y - base[1], t.z - base[2]); return d >= dist[0] && d <= dist[1]; });
  if (one('dx') != null || one('dy') != null || one('dz') != null) { const dx = +one('dx') || 0, dy = +one('dy') || 0, dz = +one('dz') || 0; L = L.filter(t => t.x >= Math.min(base[0], base[0] + dx) && t.x <= Math.max(base[0], base[0] + dx) + 1 && t.y >= Math.min(base[1], base[1] + dy) && t.y <= Math.max(base[1], base[1] + dy) + 1 && t.z >= Math.min(base[2], base[2] + dz) && t.z <= Math.max(base[2], base[2] + dz) + 1); }
  const d2 = t => Math.hypot(t.x - base[0], t.y - base[1], t.z - base[2]);
  const sort = one('sort') || (m[1] === 'p' ? 'nearest' : m[1] === 'r' ? 'random' : 'arbitrary');
  if (sort === 'nearest') L.sort((a, b) => d2(a) - d2(b)); else if (sort === 'furthest') L.sort((a, b) => d2(b) - d2(a)); else if (sort === 'random') L.sort(() => Math.random() - 0.5);
  const lim = one('limit') != null ? Math.max(0, +one('limit') | 0) : m[1] === 'p' || m[1] === 'r' ? 1 : Infinity;
  return L.slice(0, lim);
}
// three coordinate words from a[i]: absolute, ~relative or ^local - left, up, forward. block: whole numbers, no centring
function cmdPos(a, i, block, from) {
  const t = a.slice(i, i + 3); if (t.length < 3) return null;
  const o = from || [PL.x, PL.y, PL.z];
  if (t.some(v => v[0] === '^')) {
    if (!t.every(v => v[0] === '^')) return null;
    const [l, u, f] = t.map(v => +(v.slice(1)) || 0), Y = PL.yaw, P = PL.pitch;
    const fw = [-Math.sin(Y) * Math.cos(P), Math.sin(P), -Math.cos(Y) * Math.cos(P)], lf = [-Math.cos(Y), 0, Math.sin(Y)], up = [Math.sin(P) * Math.sin(Y), Math.cos(P), Math.sin(P) * Math.cos(Y)];
    const p = [0, 1, 2].map(k => o[k] + lf[k] * l + up[k] * u + fw[k] * f); return block ? p.map(Math.floor) : p;
  }
  const p = t.map((v, k) => { if (v[0] === '~') { const d = v.length > 1 ? +v.slice(1) : 0; return isFinite(d) ? o[k] + d : NaN; } const n = +v; if (!isFinite(n) || v === '') return NaN; return !block && k !== 1 && !v.includes('.') ? n + 0.5 : n; });
  if (p.some(isNaN)) return null;
  return block ? p.map(Math.floor) : p;
}
// "oak_stairs[facing=east]" or "stone" -> [id, meta]
function cmdBlock(s) {
  const k = cmdId(s); if (!k) return null;
  if (k === 'air' || k === 'cave_air' || k === 'void_air') return [0, 0];
  const name = k.split('[')[0];
  if (typeof VKEY !== 'undefined' && VKEY[name] && !k.includes('[')) return [VKEY[name][0], VKEY[name][1]];
  if (BID[name] != null && !k.includes('[')) return [BID[name], 0];
  const v = S.vanillaState && S.vanillaState(k, 0); if (v) return v;
  return BID[name] != null ? [BID[name], 0] : null;
}
const cmdText = s => { s = String(s || '').trim(); if (s[0] === '{' || s[0] === '[' || s[0] === '"') { try { const j = JSON.parse(s); const f = x => typeof x === 'string' ? x : Array.isArray(x) ? x.map(f).join('') : x && typeof x === 'object' ? (x.text || x.translate || '') + (x.extra ? x.extra.map(f).join('') : '') : ''; return f(j); } catch (e) {} } return s.replace(/^"|"$/g, ''); };
const CMD_HELP = '/gamemode · /difficulty · /time set|add|query · /weather · /give · /clear · /tp · /summon · /kill · /effect give|clear · /enchant · /xp add|set|query · /setblock · /fill · /clone · /spawnpoint · /setworldspawn · /gamerule · /locate · /say · /me · /msg · /tellraw · /title · /list · /seed · /playsound · /defaultgamemode · /help — 대상: @s @p @a @r @e[type=..,distance=..,limit=..,sort=..] · 좌표: ~ ^';

function runCommand(cmd) {
  cmd = String(cmd || '').trim().replace(/^\//, ''); if (!cmd) return;
  const a = cmdTokens(cmd), c = cmdId(a.shift() || '').toLowerCase();
  const err = t => { chatMsg(t, '#ff5555'); return false; }, ok = t => { chatMsg(t, '#aaaaaa'); return true; };
  if (!W.cheats && c !== 'help' && c !== 'seed' && c !== 'list' && c !== 'me' && c !== 'msg' && c !== 'tell' && c !== 'w') return err('이 세계에서는 명령어가 허용되지 않습니다');
  const me = MP.on ? MP.name : '플레이어';
  // targets that may only be this player (the others' inventories and health live in their own browsers)
  const selfOnly = (tok, what) => { if (tok == null) return { self: true }; const L = cmdSelect(tok); if (!L) return { bad: true }; const s = L.find(t => t.self); const others = L.filter(t => !t.self && t.type === 'player').length; if (others) chatMsg(`다른 플레이어에게는 ${what}을(를) 이 화면에서 적용할 수 없습니다 (${others}명 건너뜀)`, '#ffaa00'); return s ? { self: true, ents: L.filter(t => t.ent && t.ent !== PL) } : { self: false, ents: L.filter(t => t.ent && t.ent !== PL) }; };
  switch (c) {
    case 'help': case '?': return ok(CMD_HELP);
    case 'gamemode': {
      const m = { survival: 'survival', s: 'survival', 0: 'survival', creative: 'creative', c: 'creative', 1: 'creative', adventure: 'adventure', a: 'adventure', 2: 'adventure', spectator: 'spectator', sp: 'spectator', 3: 'spectator' }[(a[0] || '').toLowerCase()];
      if (!m) return err('알 수 없는 게임 모드: ' + (a[0] || '')); const t = selfOnly(a[1], '게임 모드'); if (t.bad) return err('대상을 찾을 수 없습니다: ' + a[1]); if (!t.self) return false;
      PL.mode = m; if (m !== 'creative' && m !== 'spectator') PL.flying = false; if (m === 'spectator') PL.flying = true; UI.hudDirty = true; return ok(`${me}의 게임 모드를 ${MODE_NAME[m]}(으)로 변경했습니다`);
    }
    case 'defaultgamemode': { const m = { survival: 'survival', creative: 'creative', adventure: 'adventure', spectator: 'spectator' }[a[0]]; if (!m) return err('알 수 없는 게임 모드'); W.meta.mode = m; return ok('기본 게임 모드: ' + MODE_NAME[m]); }
    case 'difficulty': { if (!a[0]) return ok('난이도: ' + DIFF_NAME[PL.difficulty]); const d = { peaceful: 0, easy: 1, normal: 2, hard: 3 }[a[0]] ?? +a[0]; if (!(d >= 0 && d <= 3)) return err('난이도: peaceful, easy, normal, hard'); PL.difficulty = d; if (d === 0) for (const e of [...ENT]) if (e.kind === 'mob' && e.def.hostile) removeEnt(e); return ok('난이도를 ' + DIFF_NAME[d] + '(으)로 설정했습니다'); }
    case 'time': {
      const tv = v => { const n = { day: 1000, noon: 6000, night: 13000, midnight: 18000 }[v]; if (n != null) return n; const m = String(v).match(/^(\d+(?:\.\d+)?)([dst]?)$/); return m ? Math.round(+m[1] * (m[2] === 'd' ? 24000 : m[2] === 's' ? 20 : 1)) : NaN; };
      if (a[0] === 'query') { const q = a[1] === 'daytime' ? ((W.time % 24000) + 24000) % 24000 : a[1] === 'day' ? Math.floor(W.time / 24000) : a[1] === 'gametime' ? W.tickN : NaN; return isNaN(q) ? err('/time query daytime|gametime|day') : ok('시간: ' + q); }
      const t = tv(a[1]); if (!(a[0] === 'set' || a[0] === 'add') || isNaN(t)) return err('/time set <day|noon|night|midnight|틱> 또는 /time add <틱>');
      if (a[0] === 'add') W.time += t; else W.time = Math.floor(W.time / 24000) * 24000 + t; return ok('시간을 ' + (((W.time % 24000) + 24000) % 24000) + '(으)로 설정했습니다');
    }
    case 'weather': {
      const k = a[0]; if (k !== 'clear' && k !== 'rain' && k !== 'thunder') return err('/weather clear|rain|thunder [초]');
      const dur = a[1] != null ? Math.max(1, (+a[1] || 0) * 20) : 6000 + Math.random() * 12000;
      W.rainTarget = k === 'clear' ? 0 : 1; W.thunderOn = k === 'thunder'; W.rainTimer = W.thunderTimer = dur; return ok(k === 'clear' ? '날씨를 맑음으로 변경했습니다' : k === 'rain' ? '날씨를 비로 변경했습니다' : '날씨를 뇌우로 변경했습니다');
    }
    case 'give': {
      const t = selfOnly(a[0], '아이템'); if (t.bad) return err('대상을 찾을 수 없습니다: ' + a[0]); if (!t.self) return false;
      const raw = a[1] || '', k = cmdId(raw.split('{')[0]), id = IID[k] != null ? IID[k] : ITEMS.findIndex(d => d && d.name === raw);
      if (id == null || id < 0 || !ITEMS[id]) return err('알 수 없는 아이템: ' + raw);
      const n = Math.max(1, Math.min(6400, a[2] != null ? +a[2] | 0 : 1)); let left = n; while (left > 0) { const m = Math.min(left, maxStack(id)); INV.giveOrDrop({ id, n: m }); left -= m; }
      play('pop', { vol: 0.4 }); return ok(`[${itemName(id)}] ${n}개를 ${me}에게 주었습니다`);
    }
    case 'clear': {
      const t = selfOnly(a[0], '인벤토리 비우기'); if (t.bad) return err('대상을 찾을 수 없습니다: ' + a[0]); if (!t.self) return false;
      const k = a[1] && cmdId(a[1]), id = k ? IID[k] : null; if (k && id == null) return err('알 수 없는 아이템: ' + a[1]);
      const max = a[2] != null ? Math.max(0, +a[2] | 0) : Infinity; let n = 0;
      const lists = [[INV.slots], [INV.armor], [INV, 'off']];
      for (const [arr, key] of lists) { const ks = key ? [key] : arr.map((_, i) => i); for (const i of ks) { const s = arr[i]; if (!s || (id != null && s.id !== id)) continue; if (max === 0) { n += s.n; continue; } const take = Math.min(s.n, max - n); if (take <= 0) continue; s.n -= take; n += take; if (s.n <= 0) arr[i] = null; } }
      UI.hudDirty = true; return max === 0 ? ok(`${me}에게 해당 아이템 ${n}개가 있습니다`) : n ? ok(`${me}의 아이템 ${n}개를 없앴습니다`) : err('없앨 아이템이 없습니다');
    }
    case 'tp': case 'teleport': {
      // tp <dest> · tp <x y z> · tp <targets> <dest> · tp <targets> <x y z> [yaw pitch | facing <x y z>|facing entity <t>]
      let who = null, rest = a;
      const firstSel = cmdSelect(a[0]);
      if (firstSel && (a.length === 1)) { const d = firstSel[0]; if (!d) return err('대상을 찾을 수 없습니다'); who = [cmdPlayers()[0]]; rest = null; return cmdTeleport(who, [d.x, d.y, d.z], null, ok, err); }
      if (firstSel && a.length >= 2) { who = firstSel; rest = a.slice(1); } else { who = [cmdPlayers()[0]]; }
      if (!who.length) return err('대상을 찾을 수 없습니다: ' + a[0]);
      const destSel = rest.length === 1 ? cmdSelect(rest[0]) : null;
      if (destSel) { const d = destSel[0]; if (!d) return err('목적지를 찾을 수 없습니다: ' + rest[0]); return cmdTeleport(who, [d.x, d.y, d.z], null, ok, err); }
      const p = cmdPos(rest, 0); if (!p) return err('좌표가 잘못되었습니다');
      let rot = null;
      if (rest[3] === 'facing') { const f = rest[4] === 'entity' ? (cmdSelect(rest[5]) || [])[0] : null, fp = f ? [f.x, f.y + 1.6, f.z] : cmdPos(rest, 4); if (fp) { const dx = fp[0] - p[0], dy = fp[1] - (p[1] + 1.62), dz = fp[2] - p[2]; rot = [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; } }
      else if (rest[3] != null) { const yaw = rest[3][0] === '~' ? (Math.PI - PL.yaw) * 180 / Math.PI + (+rest[3].slice(1) || 0) : +rest[3], pit = rest[4] == null ? null : rest[4][0] === '~' ? PL.pitch * -180 / Math.PI + (+rest[4].slice(1) || 0) : +rest[4]; if (isFinite(yaw)) rot = [Math.PI - yaw * Math.PI / 180, /* Java's yaw: 0 south, 90 west */ pit != null && isFinite(pit) ? Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, -pit * Math.PI / 180)) : PL.pitch]; }
      return cmdTeleport(who, p, rot, ok, err);
    }
    case 'summon': {
      const t = cmdId(a[0]); if (!MOBDEF[t] || t === 'player') return err('알 수 없는 개체: ' + (a[0] || ''));
      const [dx, , dz] = lookDir(); const p = a.length >= 4 ? cmdPos(a, 1) : [PL.x + dx * 2, PL.y, PL.z + dz * 2]; if (!p) return err('좌표가 잘못되었습니다');
      const nbt = a.slice(4).join(' ');
      const e = spawnMob(t, p[0], p[1], p[2], /IsBaby:1|Age:-\d/.test(nbt) ? { baby: true } : undefined);
      if (e && nbt) { if (/NoAI:1/.test(nbt)) e.ai = null; if (/PersistenceRequired:1/.test(nbt)) e.persistent = true; const nm = nbt.match(/CustomName:'?"?\{?"?(?:text"?:"?)?([^"'}]+)/); if (nm) e.name = nm[1]; }
      return ok(`${t}을(를) 소환했습니다`);
    }
    case 'kill': {
      const L = a[0] ? cmdSelect(a[0]) : [cmdPlayers()[0]]; if (!L) return err('대상을 찾을 수 없습니다: ' + a[0]);
      let n = 0; for (const t of L) { if (t.self) { hurtPlayer(1e6, 'kill'); n++; } else if (t.ent && t.ent !== PL) { if (t.ent.kind === 'mob') hurtMob(t.ent, 1e6, null); if (!t.ent.dead && t.ent.kind !== 'mob') removeEnt(t.ent); else if (!t.ent.dead) removeEnt(t.ent); n++; } }
      return n ? ok(`${n}개를 없앴습니다`) : err('대상이 없습니다');
    }
    case 'effect': {
      const sub = a[0]; if (sub !== 'give' && sub !== 'clear') return err('/effect give <대상> <효과> [초] [증폭] [true] · /effect clear [대상] [효과]');
      const L = a[1] ? cmdSelect(a[1]) : [cmdPlayers()[0]]; if (!L) return err('대상을 찾을 수 없습니다: ' + a[1]);
      const tgt = L.map(t => t.self ? PL : t.ent && t.ent.kind === 'mob' ? t.ent : null).filter(Boolean);
      if (sub === 'clear') { const k = a[2] && cmdId(a[2]); for (const e of tgt) { if (k) { if (e.eff) delete e.eff[k]; } else clearEffects(e); } renderEffects(); return ok('효과를 없앴습니다'); }
      const k = cmdId(a[2]); if (!EFF[k]) return err('알 수 없는 효과: ' + (a[2] || ''));
      const sec = a[3] == null ? 30 : a[3] === 'infinite' ? 1e6 : Math.max(0, +a[3]), amp = Math.max(0, Math.min(255, +a[4] | 0)); if (isNaN(sec)) return err('시간이 잘못되었습니다');
      for (const e of tgt) { if (sec === 0) { if (e.eff) delete e.eff[k]; } else addEffect(e, k, Math.round(sec * 20), amp); }
      renderEffects(); return tgt.length ? ok(`${EFF[k][0]} ${amp + 1} 효과를 ${tgt.length}개 대상에게 ${sec}초 동안 주었습니다`) : err('효과를 줄 대상이 없습니다');
    }
    case 'enchant': {
      const t = selfOnly(a[0], '마법 부여'); if (t.bad) return err('대상을 찾을 수 없습니다: ' + a[0]); if (!t.self) return false;
      const k = cmdId(a[1]), h = PL.held(); if (!ENCH[k]) return err('알 수 없는 마법: ' + (a[1] || '')); if (!h) return err('손에 아이템을 드세요');
      const lv = a[2] != null ? +a[2] | 0 : 1; if (lv < 1 || lv > ENCH[k][1]) return err(`${ENCH[k][0]}의 최대 레벨은 ${ENCH[k][1]}입니다`);
      if (typeof enchKinds === 'function' && !ENCH[k][2].some(x => enchKinds(h.id).includes(x))) return err(`${itemName(h.id)}에는 ${ENCH[k][0]}을(를) 부여할 수 없습니다`);
      if (h.e && ENCH_EXCL.some(g => g.includes(k) && g.some(o => o !== k && h.e[o]))) return err('함께 쓸 수 없는 마법이 이미 있습니다');
      h.e = { ...(h.e || {}), [k]: lv }; UI.hudDirty = true; return ok(`${itemName(h.id)}에 ${ENCH[k][0]} ${lv} 마법을 부여했습니다`);
    }
    case 'xp': case 'experience': {
      let sub = a[0], r = a.slice(1); if (sub !== 'add' && sub !== 'set' && sub !== 'query') { sub = 'add'; r = /^-?\d+l?$/i.test(a[0] || '') ? [null, ...a] : a; }
      const t = selfOnly(r[0] || undefined, '경험치'); if (t.bad) return err('대상을 찾을 수 없습니다: ' + r[0]); if (!t.self) return false;
      if (sub === 'query') { return ok(r[1] === 'levels' ? `${me}의 레벨: ${PL.level}` : `${me}의 경험치: ${Math.round(PL.xpP * xpNeeded(PL.level))} (레벨 ${PL.level})`); }
      const raw = r[1] || '', levels = r[2] === 'levels' || /l$/i.test(raw), v = parseInt(raw); if (isNaN(v)) return err('/xp add|set <대상> <양> [points|levels]');
      if (levels) { PL.level = Math.max(0, sub === 'set' ? v : PL.level + v); if (sub === 'set') PL.xpP = Math.min(PL.xpP, 0.999); }
      else if (sub === 'set') { PL.xpP = Math.max(0, Math.min(v, xpNeeded(PL.level) - 1)) / xpNeeded(PL.level); }
      else if (v >= 0) addXP(v); else { let left = -v; while (left > 0) { const have = Math.round(PL.xpP * xpNeeded(PL.level)); if (have >= left) { PL.xpP = (have - left) / xpNeeded(PL.level); left = 0; } else if (PL.level > 0) { left -= have + 1; PL.level--; PL.xpP = (xpNeeded(PL.level) - 1) / xpNeeded(PL.level); } else { PL.xpP = 0; left = 0; } } } // taking points away can drop levels
      UI.hudDirty = true; return ok(levels ? `레벨: ${PL.level}` : `경험치를 ${sub === 'set' ? '설정' : '추가'}했습니다 (레벨 ${PL.level})`);
    }
    case 'setblock': case 'fill': {
      const n = c === 'fill' ? 6 : 3, p1 = cmdPos(a, 0, true), p2 = c === 'fill' ? cmdPos(a, 3, true) : p1; if (!p1 || !p2) return err('좌표가 잘못되었습니다');
      const blk = cmdBlock(a[n]); if (!blk) return err('알 수 없는 블록: ' + (a[n] || ''));
      const mode = a[n + 1] || 'replace', filt = mode === 'replace' && a[n + 2] ? cmdBlock(a[n + 2]) : null; if (mode === 'replace' && a[n + 2] && !filt) return err('알 수 없는 블록: ' + a[n + 2]);
      if (c === 'setblock' && !['replace', 'keep', 'destroy'].includes(mode)) return err('/setblock <x y z> <블록> [replace|keep|destroy]');
      if (c === 'fill' && !['replace', 'keep', 'destroy', 'hollow', 'outline'].includes(mode)) return err('/fill <시작> <끝> <블록> [replace [블록]|keep|destroy|hollow|outline]');
      const [x0, y0, z0] = p1.map((v, k) => Math.min(v, p2[k])), [x1, y1, z1] = p1.map((v, k) => Math.max(v, p2[k]));
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 32768) return err('영역이 너무 큽니다 (최대 32768 블록)');
      let cnt = 0;
      for (let x = x0; x <= x1; x++) for (let y = Math.max(MINY, y0); y <= Math.min(MAXY - 1, y1); y++) for (let z = z0; z <= z1; z++) {
        const edge = x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1, cur = getBlock(x, y, z);
        if (mode === 'keep' && cur) continue; if (mode === 'outline' && !edge) continue; if (filt && (cur !== filt[0] || (filt[1] && getMeta(x, y, z) !== filt[1]))) continue;
        const [id, m] = mode === 'hollow' && !edge ? [0, 0] : blk;
        if (cur === id && getMeta(x, y, z) === m) continue;
        if (mode === 'destroy' && cur) for (const [iid, k] of blockDrops(cur, getMeta(x, y, z), null).items) dropItem(x + .5, y + .3, z + .5, iid, k);
        setBlock(x, y, z, id, m); cnt++;
      }
      return cnt ? ok(c === 'fill' ? `${cnt}개 블록을 채웠습니다` : '블록을 바꿨습니다') : err('바뀐 블록이 없습니다');
    }
    case 'clone': {
      const b0 = cmdPos(a, 0, true), b1 = cmdPos(a, 3, true), d = cmdPos(a, 6, true); if (!b0 || !b1 || !d) return err('/clone <시작> <끝> <목적지> [replace|masked]');
      const mask = a[9] === 'masked', move = a[10] === 'move';
      const [x0, y0, z0] = b0.map((v, k) => Math.min(v, b1[k])), [x1, y1, z1] = b0.map((v, k) => Math.max(v, b1[k]));
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 32768) return err('영역이 너무 큽니다 (최대 32768 블록)');
      const buf = []; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const t = getTile(x, y, z); buf.push([x - x0, y - y0, z - z0, getBlock(x, y, z), getMeta(x, y, z), t ? JSON.parse(JSON.stringify(t)) : null]); }
      if (move) for (const [ox, oy, oz] of buf) setBlock(x0 + ox, y0 + oy, z0 + oz, 0);
      let cnt = 0; for (const [ox, oy, oz, id, m, t] of buf) { if (mask && !id) continue; setBlock(d[0] + ox, d[1] + oy, d[2] + oz, id, m); if (t) setTile(d[0] + ox, d[1] + oy, d[2] + oz, t); cnt++; }
      return ok(`${cnt}개 블록을 복제했습니다`);
    }
    case 'spawnpoint': {
      const t = selfOnly(a[0], '스폰 지점'); if (t.bad) return err('대상을 찾을 수 없습니다: ' + a[0]); if (!t.self) return false;
      const p = a.length >= 4 ? cmdPos(a, 1, true) : [Math.floor(PL.x), Math.floor(PL.y), Math.floor(PL.z)]; if (!p) return err('좌표가 잘못되었습니다');
      PL.spawn = p; PL.spawnBed = false; if (W.dim === 0) PL.spawnDim = 0; return ok(`${me}의 스폰 지점을 ${p.join(', ')}(으)로 설정했습니다`);
    }
    case 'setworldspawn': { const p = a.length >= 3 ? cmdPos(a, 0, true) : [Math.floor(PL.x), Math.floor(PL.y), Math.floor(PL.z)]; if (!p) return err('좌표가 잘못되었습니다'); W.meta.worldSpawn = p; W.worldSpawn = p; return ok('세계 스폰 지점을 ' + p.join(', ') + '(으)로 설정했습니다'); }
    case 'say': { const s = '[' + me + '] ' + a.join(' '); chatMsg(s, '#ffffff'); if (MP.on) mpSend({ t: 'sys', text: s, c: '#ffffff' }); return true; }
    case 'me': { const s = '* ' + me + ' ' + a.join(' '); chatMsg(s, '#ffffff'); if (MP.on) mpSend({ t: 'sys', text: s, c: '#ffffff' }); return true; }
    case 'msg': case 'tell': case 'w': { const to = a[0], text = a.slice(1).join(' '); if (!to || !text) return err('/msg <대상> <메시지>'); const L = cmdSelect(to); if (!L || !L.length) return err('대상을 찾을 수 없습니다: ' + to); chatMsg(`${L.map(t => t.name).join(', ')}에게 속삭임: ${text}`, '#aaaaaa'); if (MP.on && (MP.server || MP.role === 'host')) for (const t of L) if (t.peer) mpSend({ t: 'sys', text: `${me}님이 당신에게 속삭임: ${text}`, c: '#aaaaaa' }, t.peer.id); return true; }
    case 'tellraw': { const L = cmdSelect(a[0]); if (!L) return err('대상을 찾을 수 없습니다: ' + a[0]); const s = cmdText(a.slice(1).join(' ')); if (L.some(t => t.self)) chatMsg(s, '#ffffff'); return true; }
    case 'title': {
      const L = cmdSelect(a[0]); if (!L) return err('대상을 찾을 수 없습니다: ' + a[0]); if (!L.some(t => t.self)) return true;
      const k = a[1]; if (k === 'clear' || k === 'reset' || k === 'times') return true; if (k !== 'title' && k !== 'subtitle' && k !== 'actionbar') return err('/title <대상> title|subtitle|actionbar <글>');
      UI.flash(cmdText(a.slice(2).join(' '))); return true;
    }
    case 'list': { const L = cmdPlayers(); return ok(`접속한 플레이어 ${L.length}명: ${L.map(t => t.name).join(', ')}`); }
    case 'seed': return ok('시드: [' + W.seed + ']');
    case 'playsound': { const k = cmdId(a[0]).split('.').pop(); play(k, { vol: Math.min(1, +a[6] || 1) }); return true; }
    case 'particle': case 'stopsound': case 'function': return ok('이 명령어는 효과 없이 받아들였습니다');
    case 'locate': case 'gamerule': case 'keepinventory': return runCommandBasic(cmd);
    default: return err('알 수 없는 명령어입니다: /' + c + ' — /help 를 입력하세요');
  }
}
function cmdTeleport(who, p, rot, ok, err) {
  let n = 0;
  for (const t of who) {
    if (t.self) { if (PL.riding) dismount(); PL.x = PL.px = p[0]; PL.y = PL.py = p[1]; PL.z = PL.pz = p[2]; PL.vx = PL.vy = PL.vz = 0; PL.fallDist = 0; if (rot) { PL.yaw = rot[0]; PL.pitch = rot[1]; } n++; }
    else if (t.ent && t.ent !== PL) { const e = t.ent; e.x = e.px = p[0]; e.y = e.py = p[1]; e.z = e.pz = p[2]; e.vx = e.vy = e.vz = 0; if (rot) e.yaw = rot[0]; n++; }
    else if (t.peer) chatMsg(`${t.name}님은 이 화면에서 옮길 수 없습니다`, '#ffaa00');
  }
  return n ? ok(`${n}개 대상을 ${p.map(v => v.toFixed(1)).join(', ')}(으)로 순간이동했습니다`) : err('옮길 대상이 없습니다');
}
