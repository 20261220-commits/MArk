// Game rules (/gamerule, kept per world as in Java) and statistics (the pause menu's Statistics screen: general,
// blocks mined, items crafted / used / broken / picked up / dropped, mobs killed and killed by).

// ---------- game rules ----------
const GAMERULES = {
  announceAdvancements: true, doDaylightCycle: true, doEntityDrops: true, doFireTick: true, doImmediateRespawn: false, doInsomnia: true,
  doMobLoot: true, doMobSpawning: true, doTileDrops: true, doWeatherCycle: true, drowningDamage: true, fallDamage: true, fireDamage: true,
  freezeDamage: true, keepInventory: false, mobGriefing: true, naturalRegeneration: true, randomTickSpeed: 3, showDeathMessages: true,
};
function gr(k) { const r = W.meta && W.meta.gamerules; return r && k in r ? r[k] : GAMERULES[k]; }
function setGamerule(k, v) {
  if (!(k in GAMERULES)) return false;
  const def = GAMERULES[k], val = typeof def === 'boolean' ? (v === 'true' ? true : v === 'false' ? false : null) : Math.max(0, Math.floor(+v));
  if (val === null || Number.isNaN(val)) return false;
  (W.meta.gamerules || (W.meta.gamerules = {}))[k] = val;
  if (k === 'keepInventory') W.keepInv = val;
  return true;
}

// ---------- statistics ----------
const STAT_NAMES = {
  play_time: '플레이 시간', time_since_death: '마지막 사망 이후', time_since_rest: '마지막 휴식 이후', deaths: '사망 횟수', mob_kills: '몹 처치',
  damage_dealt: '가한 피해', damage_taken: '받은 피해', jump: '점프', walk_one_cm: '걸은 거리', sprint_one_cm: '달린 거리', crouch_one_cm: '웅크려 걸은 거리',
  swim_one_cm: '헤엄친 거리', fly_one_cm: '날아간 거리', fall_one_cm: '떨어진 거리', climb_one_cm: '오른 거리', aviate_one_cm: '겉날개로 난 거리',
  boat_one_cm: '보트로 간 거리', minecart_one_cm: '광산 수레로 간 거리', horse_one_cm: '말로 간 거리', pig_one_cm: '돼지로 간 거리', strider_one_cm: '스트라이더로 간 거리',
  animals_bred: '번식시킨 동물', fish_caught: '잡은 물고기', traded_with_villager: '주민과 거래', enchant_item: '마법 부여한 아이템', sleep_in_bed: '침대에서 잔 횟수',
  open_chest: '상자 연 횟수', craft_item: '제작한 아이템', drop: '버린 아이템', eat_cake_slice: '먹은 케이크 조각', talked_to_villager: '주민과 대화',
};
const STAT_TIME = new Set(['play_time', 'time_since_death', 'time_since_rest']), STAT_DIST = new Set(Object.keys(STAT_NAMES).filter(k => k.endsWith('_cm')));
const ST = () => { if (!W.meta) return null; return W.meta.stats || (W.meta.stats = { c: {}, mined: {}, crafted: {}, used: {}, broken: {}, picked: {}, dropped: {}, killed: {}, killed_by: {} }); };
function stat(k, n = 1) { const s = ST(); if (s && PL.mode !== 'spectator') s.c[k] = (s.c[k] || 0) + n; }
function statOf(group, key, n = 1) { const s = ST(); if (!s || !key) return; const g = s[group] || (s[group] = {}); g[key] = (g[key] || 0) + n; }
// distances: per tick from the player's movement, split the way Java does
function statsTick() {
  const s = ST(); if (!s || !W.active || PL.dead) return;
  s.c.play_time = (s.c.play_time || 0) + 1; s.c.time_since_death = (s.c.time_since_death || 0) + 1; s.c.time_since_rest = (s.c.time_since_rest || 0) + 1;
  const dx = PL.x - PL.px, dy = PL.y - PL.py, dz = PL.z - PL.pz, h = Math.round(Math.hypot(dx, dz) * 100);
  if (PL.riding) { const t = PL.riding.kind === 'boat' ? 'boat' : PL.riding.kind === 'minecart' ? 'minecart' : PL.riding.type === 'pig' ? 'pig' : PL.riding.type === 'strider' ? 'strider' : 'horse'; if (h) stat(t + '_one_cm', Math.round(Math.hypot(dx, dy, dz) * 100)); return; }
  if (PL.gliding) { stat('aviate_one_cm', Math.round(Math.hypot(dx, dy, dz) * 100)); return; }
  if (PL.inWater) { if (h) stat('swim_one_cm', h); return; }
  if (PL.onLadder && dy > 0) stat('climb_one_cm', Math.round(dy * 100));
  if (PL.flying) { if (h) stat('fly_one_cm', Math.round(Math.hypot(dx, dy, dz) * 100)); return; }
  if (!PL.onGround && dy < 0) stat('fall_one_cm', Math.round(-dy * 100));
  if (PL.onGround && h) stat(PL.sneaking ? 'crouch_one_cm' : PL.sprinting ? 'sprint_one_cm' : 'walk_one_cm', h);
}
const fmtTime = t => { const s = t / 20; return s < 60 ? s.toFixed(2) + '초' : s < 3600 ? (s / 60).toFixed(2) + '분' : s < 86400 ? (s / 3600).toFixed(2) + '시간' : (s / 86400).toFixed(2) + '일'; };
const fmtDist = cm => cm < 100 ? cm + ' cm' : cm < 100000 ? (cm / 100).toFixed(2) + ' m' : (cm / 100000).toFixed(2) + ' km';
const STATUI = { tab: 'general' };
function statsHtml() {
  const s = ST() || { c: {} }, tabs = [['general', '일반'], ['blocks', '블록'], ['items', '아이템'], ['mobs', '몹']];
  let body = '';
  if (STATUI.tab === 'general') body = `<table class="stattab">${Object.keys(STAT_NAMES).map(k => { const v = s.c[k] || 0; return `<tr><td>${STAT_NAMES[k]}</td><td>${STAT_TIME.has(k) ? fmtTime(v) : STAT_DIST.has(k) ? fmtDist(v) : k.startsWith('damage') ? (v / 10).toFixed(1) + ' ♥' : v}</td></tr>`; }).join('')}</table>`;
  else if (STATUI.tab === 'blocks') { const keys = Object.keys(s.mined || {}).sort((a, b) => s.mined[b] - s.mined[a]); body = keys.length ? `<table class="stattab"><tr><th></th><th>캔 횟수</th></tr>${keys.map(k => `<tr><td>${icon(+k)} ${itemName(+k)}</td><td>${s.mined[k]}</td></tr>`).join('')}</table>` : '<p class="muted">아직 기록이 없어요</p>'; }
  else if (STATUI.tab === 'items') { const all = new Set([...Object.keys(s.crafted || {}), ...Object.keys(s.used || {}), ...Object.keys(s.broken || {}), ...Object.keys(s.picked || {}), ...Object.keys(s.dropped || {})]); const g = (n, k) => (s[n] || {})[k] || ''; body = all.size ? `<table class="stattab"><tr><th></th><th>제작</th><th>사용</th><th>부서짐</th><th>주움</th><th>버림</th></tr>${[...all].map(k => `<tr><td>${icon(+k)} ${itemName(+k)}</td><td>${g('crafted', k)}</td><td>${g('used', k)}</td><td>${g('broken', k)}</td><td>${g('picked', k)}</td><td>${g('dropped', k)}</td></tr>`).join('')}</table>` : '<p class="muted">아직 기록이 없어요</p>'; }
  else { const all = new Set([...Object.keys(s.killed || {}), ...Object.keys(s.killed_by || {})]); const nm = k => { const d = ITEMS.find(d => d && d.egg === k); return d ? d.name.replace(/ 생성 알$/, '') : k; }; body = all.size ? `<table class="stattab">${[...all].map(k => `<tr><td>${nm(k)}</td><td>${s.killed[k] ? `${s.killed[k]}마리 처치` : ''}</td><td>${(s.killed_by || {})[k] ? `${s.killed_by[k]}번 죽음` : ''}</td></tr>`).join('')}</table>` : '<p class="muted">아직 기록이 없어요</p>'; }
  return `<h2>통계</h2><div class="stattabs">${tabs.map(([k, n]) => btn(n, 'stat_' + k, STATUI.tab === k ? 'on' : '')).join('')}</div><div class="statbody">${body}</div><div class="btncol">${btn('완료', 'pause')}</div>`;
}
