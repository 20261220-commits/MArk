// UI: menus, HUD, chat/commands, container screens.
const $ = id => document.getElementById(id);
const UI = { screen: null, menu: 'title', hudDirty: true, chatOpen: false, debug: false, hideHud: false, msgs: [] };
const OPT_KEY = 'nemo-mc-117-options';
const OPT = { fov: 70, rd: 6, sens: 100, gamma: 50, vol: 60, fancy: false, smooth: true, clouds: true, bob: true, gui: 0, autoRes: true, showFps: false, invertY: false, fullscreen: false };
try { Object.assign(OPT, JSON.parse(localStorage.getItem(OPT_KEY)) || {}); } catch (e) {}
function saveOpt() { try { localStorage.setItem(OPT_KEY, JSON.stringify(OPT)); } catch (e) {} applyOpt(); }
function applyOpt() {
  R.rd = OPT.rd; R.fov = OPT.fov; R.gamma = OPT.gamma / 100; R.cloudsOn = OPT.clouds; setVolume(OPT.vol / 100);
  const s = OPT.gui || (innerWidth < 760 || innerHeight < 520 ? 1.5 : innerWidth > 1700 && innerHeight > 1000 ? 3 : 2);
  document.documentElement.style.setProperty('--s', s);
  if (!OPT.autoRes) { R.pixelScale = 1; R.resize(); }
}
addEventListener('resize', () => applyOpt());

// ---------- HUD sprites ----------
function hudSprite(rows, pal) { const c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length; const g = c.getContext('2d'); rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (pal[r[x]]) { g.fillStyle = pal[r[x]]; g.fillRect(x, y, 1, 1); } }); return c.toDataURL(); }
const HEARTROWS = ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'];
const mkHeart = (fillL, fillR, col = '#e3271c', hi = '#ff8f80') => hudSprite(HEARTROWS.map(r => r.split('').map((ch, x) => ch === 'k' ? 'k' : ch === '.' ? '.' : (x < 4 ? (fillL ? ch : 'e') : (fillR ? ch : 'e'))).join('')), { k: '#1a0a0a', r: col, w: hi, e: '#3a1414' });
const SPR_HUD = {
  heart: mkHeart(1, 1), half: mkHeart(1, 0), empty: mkHeart(0, 0), gold: mkHeart(1, 1, '#e8c020', '#fff2a0'), hard: mkHeart(1, 1, '#b01010', '#ffd0d0'),
  food: hudSprite(['....kk.', '...kbbk', '..kbbbk', '.kbbbk.', 'kwkkk..', 'kwk....', '.k.....'], { k: '#2a1608', b: '#b06a2a', w: '#f0e8d8' }),
  foodHalf: hudSprite(['....kk.', '...kbbk', '..kbbbk', '.kEEEk.', 'kEkkk..', 'kEk....', '.k.....'], { k: '#2a1608', b: '#b06a2a', E: '#3a2416' }),
  foodEmpty: hudSprite(['....kk.', '...kEEk', '..kEEEk', '.kEEEk.', 'kEkkk..', 'kEk....', '.k.....'], { k: '#2a1608', E: '#3a2416' }),
  armor: hudSprite(['kk...kk', 'kakkkak', 'kaaaaak', 'kaaaaak', '.kaaak.', '.kaaak.', '..kkk..'], { k: '#2a2a2a', a: '#d8d8d8' }),
  armorHalf: hudSprite(['kk...kk', 'kakkkEk', 'kaaaEEk', 'kaaaEEk', '.kaaEk.', '.kaaEk.', '..kkk..'], { k: '#2a2a2a', a: '#d8d8d8', E: '#4a4a4a' }),
  armorEmpty: hudSprite(['kk...kk', 'kEkkkEk', 'kEEEEEk', 'kEEEEEk', '.kEEEk.', '.kEEEk.', '..kkk..'], { k: '#2a2a2a', E: '#4a4a4a' }),
  bubble: hudSprite(['..bbb..', '.bwllb.', 'bwlllb.', 'bllllb.', '.bllb..', '..bb...', '.......'].map(r => r), { b: '#1a3a8a', w: '#ffffff', l: '#6aa8ff' }),
};
function icon(id, n, d, e) {
  if (!id) return '';
  const def = ITEMS[id], st = iconStyle(id, 16 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 2));
  let s = `<i class="ic" style="${st}"></i>`;
  if (e || (def && def.glint)) s += `<i class="glint" style="${st.replace(/background/g, '-webkit-mask')};${st.replace(/background/g, 'mask')}"></i>`;
  if (n > 1) s += `<b>${n}</b>`;
  if (def && def.dur && d) { const f = 1 - d / def.dur; s += `<u style="--f:${f};--c:hsl(${f * 120},100%,45%)"></u>`; }
  return s;
}
// ---------- HUD ----------
function buildHud() {
  const hb = $('hotbar'); hb.innerHTML = '';
  for (let i = 0; i < 9; i++) { const d = document.createElement('div'); d.className = 'hs'; d.dataset.i = i; hb.appendChild(d); }
  const sel = document.createElement('div'); sel.id = 'hsel'; hb.appendChild(sel);
}
let lastHeld = -2, heldNameT = 0;
function renderHud(dt) {
  const surv = PL.mode === 'survival' || PL.mode === 'hardcore' || PL.mode === 'adventure';
  $('bars').hidden = !surv; $('xpbar').hidden = !surv && PL.mode !== 'creative';
  if (PL.mode === 'creative') $('xpbar').hidden = true;
  $('hud').hidden = UI.hideHud || PL.mode === 'spectator' && false;
  $('hotbar').hidden = PL.mode === 'spectator';
  const h = PL.held(), hid = h ? h.id : 0;
  if (hid !== lastHeld) { lastHeld = hid; heldNameT = 2.5; $('heldName').textContent = hid ? itemName(hid) : ''; }
  heldNameT -= dt; $('heldName').style.opacity = Math.max(0, Math.min(1, heldNameT));
  $('hsel').style.transform = `translateX(calc(${INV.sel} * 20px * var(--s)))`;
  if (!UI.hudDirty) return;
  UI.hudDirty = false;
  const hs = document.querySelectorAll('#hotbar .hs');
  for (let i = 0; i < 9; i++) { const s = OFF.swapped && i === OFF.slot ? INV.off : INV.slots[i]; hs[i].innerHTML = s ? icon(s.id, s.n, s.d, s.e) : ''; }
  offhandHud();
  if (surv) {
    const hp = Math.ceil(PL.health), hearts = [], hard = PL.hardcore;
    for (let i = 0; i < 10; i++) { const v = hp - i * 2; hearts.push(`<img src="${v >= 2 ? (hard ? SPR_HUD.hard : SPR_HUD.heart) : v === 1 ? SPR_HUD.half : SPR_HUD.empty}" class="${PL.health <= 4 ? 'shake' : ''}" style="--d:${(i * 37) % 7}">`); }
    if (PL.absorb > 0) for (let i = 0; i < Math.ceil(PL.absorb / 2); i++) hearts.push(`<img src="${SPR_HUD.gold}">`);
    $('hearts').innerHTML = hearts.join('');
    const fd = []; for (let i = 0; i < 10; i++) { const v = PL.food - i * 2; fd.push(`<img src="${v >= 2 ? SPR_HUD.food : v === 1 ? SPR_HUD.foodHalf : SPR_HUD.foodEmpty}" class="${PL.sat <= 0 && PL.food < 20 && W.tickN % 2 ? 'jit' : ''}">`); }
    $('food').innerHTML = fd.join('');
    const [ap] = armorPoints(); const ar = [];
    if (ap > 0) for (let i = 0; i < 10; i++) { const v = ap - i * 2; ar.push(`<img src="${v >= 2 ? SPR_HUD.armor : v === 1 ? SPR_HUD.armorHalf : SPR_HUD.armorEmpty}">`); }
    $('armorbar').innerHTML = ar.join('');
    const air = []; if (PL.air < 300) { const n = Math.ceil(Math.max(0, PL.air) / 30); for (let i = 0; i < n; i++) air.push(`<img src="${SPR_HUD.bubble}">`); }
    $('air').innerHTML = air.join('');
  }
  $('xpbar').firstElementChild.style.width = (PL.xpP * 100) + '%';
  $('xplvl').textContent = PL.level > 0 ? PL.level : '';
}
function flash(t) { const el = $('toast'); el.textContent = t; el.classList.add('show'); clearTimeout(flash.t); flash.t = setTimeout(() => el.classList.remove('show'), 2200); }
UI.flash = flash;
function chatMsg(t, color) { UI.msgs.push({ t, c: color || '#fff', at: performance.now() }); if (UI.msgs.length > 50) UI.msgs.shift(); renderChat(); }
function renderChat() {
  const now = performance.now();
  const list = UI.chatOpen ? UI.msgs.slice(-14) : UI.msgs.filter(m => now - m.at < 10000).slice(-8);
  $('chatLog').innerHTML = list.map(m => `<div style="color:${m.c};opacity:${UI.chatOpen ? 1 : Math.min(1, (10000 - (now - m.at)) / 1000)}">${m.t.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])}</div>`).join('');
}
// ---------- debug ----------
let dbgT = 0;
function renderDebug(dt, fps) {
  const el = $('debug');
  el.hidden = !UI.debug && !OPT.showFps;
  if (el.hidden || (dbgT -= dt) > 0) return; dbgT = 0.25;
  if (!UI.debug) { el.textContent = fps + ' fps'; return; }
  const bx = Math.floor(PL.x), by = Math.floor(PL.y), bz = Math.floor(PL.z), l = getLight(bx, by, bz);
  const facing = ['북쪽 (-Z)', '서쪽 (-X)', '남쪽 (+Z)', '동쪽 (+X)'][[0, 1, 2, 3][((Math.round((((PL.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4) + 4) % 4]];
  let meshed = 0; for (const c of W.chunks.values()) if (c.mesh) meshed++;
  const t = TARGET && TARGET.type === 'block' ? `\n대상 블록: ${TARGET.x} ${TARGET.y} ${TARGET.z}\n${BLOCKS[TARGET.id].key} [${TARGET.m}]` : '';
  const P = typeof PERF !== 'undefined' ? PERF : null, ms = k => P && P.n ? (P[k] / P.n).toFixed(1) : '-';
  const perf = `틱 ${ms('tick')}ms · 청크 ${ms('stream')}+${ms('inbox')}ms · 렌더 ${ms('render')}ms`;
  if (P) { for (const k in P) P[k] = 0; }
  el.textContent = `네모 대륙 1.17 (Java Edition 스타일)\n${fps} fps · ${perf} · 해상도 ${Math.round(R.pixelScale * 100)}% · 렌더 거리 ${R.rd}\n청크: ${W.chunks.size} 로드 · ${meshed} 렌더 · 대기 ${W.pending.size}\n엔티티: ${ENT.length} · 파티클 ${R.particles.length}\n\nXYZ: ${PL.x.toFixed(3)} / ${PL.y.toFixed(5)} / ${PL.z.toFixed(3)}\n블록: ${bx} ${by} ${bz}\n청크: ${bx & 15} ${by} ${bz & 15} in ${bx >> 4} ${bz >> 4}\n방향: ${facing} (${(((-PL.yaw * 180 / Math.PI) % 360 + 540) % 360 - 180).toFixed(1)} / ${(-PL.pitch * 180 / Math.PI).toFixed(1)})\n바이옴: ${S.BIOMES[biomeAt(bx, bz)][0]}\n밝기: ${Math.max(l & 15, (l >> 4) - skyDarken())} (하늘 ${l >> 4}, 블록 ${l & 15})\n시간: ${Math.floor(((W.time % 24000) + 24000) % 24000)} (${Math.floor(W.time / 24000)}일차)${W.rain > 0.5 ? ' · 비' : ''}${t}`;
}

// ---------- container screens ----------
function slotHtml(i, cls = '') { const s = GUI.slots[i].get(); return `<div class="sl ${cls}" data-i="${i}">${s ? icon(s.id, s.n, s.d, s.e) : ''}</div>`; }
function invRows(start) { let h = '<div class="grid9">'; for (let k = 0; k < 27; k++) h += slotHtml(start + k); h += '</div><div class="grid9 hot">'; for (let k = 0; k < 9; k++) h += slotHtml(start + 27 + k); return h + '</div>'; }
UI.openScreen = (type, ctx) => {
  if (UI.screen) UI.closeScreen();
  if (type === 'inv' && PL.mode === 'creative') type = 'creative';
  UI.screen = type; GUI.type = type; GUI.ctx = ctx || {}; GUI.slots = buildSlots(type, GUI.ctx);
  $('screen').hidden = false; releaseLock(); clearInput();
  if (type === 'chest') play('door', { vol: 0.6 });
  UI.renderScreen();
};
UI.closeScreen = () => {
  if (!UI.screen) return;
  if (UI.screen === 'chest') play('door', { vol: 0.5 });
  closeScreenItems(); UI.screen = null; $('screen').hidden = true; $('tooltip').hidden = true; UI.hudDirty = true; grabLock();
};
// creative list: colour/material variants sit right after their base block
const ALL_ITEMS = () => ITEMS.filter(d => d && d.key !== 'name_tag' && d.key !== 'saddle').map(d => [d.id, d.block && d.place != null ? d.place * 32 + (d.vi || 0) : 1e6 + d.id]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
UI.renderScreen = () => {
  if (!UI.screen) return;
  const T = UI.screen, el = $('screen');
  let h = '';
  if (T === 'inv') {
    h = `<div class="panel inv"><div class="row top"><div class="col">${[4, 5, 6, 7].map(i => slotHtml(i + 1, 'armor a' + (i - 4))).join('')}${slotHtml(GUI.slots.length - 1, 'armor aoff')}</div><div class="doll"><div class="dollIn">${dollHtml()}</div></div><div class="cr"><div class="cap">제작</div><div class="g2">${[0, 1, 2, 3].map(i => slotHtml(i)).join('')}</div></div><div class="arrow"></div>${slotHtml(4, 'big')}</div><div class="cap">인벤토리</div>${invRows(9)}</div>`;
  } else if (T === 'craft') {
    h = `<div class="panel"><div class="cap">제작</div><div class="row top"><div class="g3">${[...Array(9).keys()].map(i => slotHtml(i)).join('')}</div><div class="arrow"></div>${slotHtml(9, 'big')}</div><div class="cap">인벤토리</div>${invRows(10)}</div>`;
  } else if (T === 'chest') {
    h = `<div class="panel"><div class="cap">${GUI.ctx.title || '상자'}</div><div class="grid9">${[...Array(GUI.slots.length - 36).keys()].map(i => slotHtml(i)).join('')}</div><div class="cap">인벤토리</div>${invRows(GUI.slots.length - 36)}</div>`;
  } else if (T === 'furnace') {
    const t = GUI.ctx.tile; const burn = t.burnMax ? t.burn / t.burnMax : 0, cook = t.cook / (t.kind ? 100 : 200);
    h = `<div class="panel"><div class="cap">${t.kind === 'blast' ? '용광로' : t.kind === 'smoker' ? '훈연기' : '화로'}</div><div class="row top furn"><div class="col">${slotHtml(0)}<div class="flame" style="--p:${burn}"></div>${slotHtml(1)}</div><div class="arrow prog" style="--p:${cook}"></div>${slotHtml(2, 'big')}</div><div class="cap">인벤토리</div>${invRows(3)}</div>`;
  } else if (T === 'loom') {
    h = loomHtml();
  } else if (T === 'horse') {
    const e = GUI.ctx.horse, n = e.chest ? e.items.length : 0; horseGearChanged(e);
    h = `<div class="panel"><div class="cap">${GUI.ctx.title}</div><div class="row top"><div class="col">${slotHtml(0)}${e.type === 'horse' ? slotHtml(1) : ''}</div><div class="col"><p class="tip">체력 ${Math.ceil(e.hp)}/${e.hpMax} · 속도 ${(e.spd * 43).toFixed(1)} m/s · 점프 ${(e.jumpS * e.jumpS * 7.1).toFixed(1)} 블록</p>${n ? `<div class="grid9" style="grid-template-columns:repeat(5,calc(18 * var(--px)))">${[...Array(n).keys()].map(i => slotHtml(2 + i)).join('')}</div>` : ''}</div></div><div class="cap">인벤토리</div>${invRows(2 + n)}</div>`;
  } else if (T === 'beacon') {
    h = beaconHtml();
  } else if (T === 'brewing') {
    const t = GUI.ctx.tile, prog = t.time ? 1 - t.time / 400 : 0;
    h = `<div class="panel"><div class="cap">양조기</div><div class="row top brew"><div class="col">${slotHtml(4, 'bfuel')}<div class="fuelbar"><i style="width:${t.fuel / 20 * 100}%"></i></div></div><div class="col bmid">${slotHtml(3)}<div class="bprog"><i style="height:${prog * 100}%"></i></div><div class="row">${slotHtml(0)}${slotHtml(1)}${slotHtml(2)}</div></div></div><div class="cap">인벤토리</div>${invRows(5)}</div>`;
  } else if (T === 'enchant') {
    const opts = enchantOptions();
    h = `<div class="panel"><div class="cap">마법 부여</div><div class="row top ench"><div class="col"><div class="row">${slotHtml(0)}${slotHtml(1, 'lapis')}</div><p class="tip">책장 ${opts.shelves}개</p></div><div class="eopts">${opts.list.map((o, i) => `<button class="eopt ${o.ok ? '' : 'off'}" data-ench="${i}"><span>${o.text}</span><b>${o.cost}</b><small>${i + 1} 청금석 · ${i + 1} 레벨</small></button>`).join('')}</div></div><div class="cap">인벤토리</div>${invRows(2)}</div>`;
  } else if (T === 'hopper') {
    h = `<div class="panel"><div class="cap">${GUI.ctx.title || '호퍼'}</div><div class="row top hop">${[0, 1, 2, 3, 4].map(i => slotHtml(i)).join('')}</div><div class="cap">인벤토리</div>${invRows(5)}</div>`;
  } else if (T === 'dispenser') {
    h = `<div class="panel"><div class="cap">${GUI.ctx.title || '발사기'}</div><div class="row top" style="justify-content:center"><div class="g3">${[...Array(9).keys()].map(i => slotHtml(i)).join('')}</div></div><div class="cap">인벤토리</div>${invRows(9)}</div>`;
  } else if (T === 'anvil') {
    const r = anvilResult(GUI.ctx), cost = r ? r.cost : 0, ok = r && (creative() || (PL.level >= cost && cost < 40));
    h = `<div class="panel"><div class="cap">수리 및 이름 짓기</div><input id="aname" maxlength="35" placeholder="${GUI.ctx.items[0] ? (GUI.ctx.items[0].name || ITEMS[GUI.ctx.items[0].id].name).replace(/"/g, '') : ''}" value="${(GUI.ctx.name || '').replace(/"/g, '')}" autocomplete="off" ${GUI.ctx.items[0] ? '' : 'disabled'}><div class="row top">${slotHtml(0)}<b class="plus">+</b>${slotHtml(1)}<div class="arrow"></div>${slotHtml(2, 'big')}</div><p class="tip acost ${ok ? '' : 'bad'}">${r ? (cost >= 40 && !creative() ? '너무 비쌉니다!' : '마법 부여 비용: ' + cost) : ''}</p><div class="cap">인벤토리</div>${invRows(3)}</div>`;
  } else if (T === 'smithing') {
    h = `<div class="panel"><div class="cap">네더라이트 장비로 업그레이드</div><div class="row top">${slotHtml(0)}<b class="plus">+</b>${slotHtml(1)}<div class="arrow"></div>${slotHtml(2, 'big')}</div><p class="tip">다이아몬드 장비 + 네더라이트 주괴</p><div class="cap">인벤토리</div>${invRows(3)}</div>`;
  } else if (T === 'trade') {
    const c = GUI.ctx, offers = villagerOffers(c.e);
    h = `<div class="panel trade"><div class="cap">${PROF_NAME[c.e.prof] || '주민'}</div><div class="row top"><div class="toffers">${offers.map((o, i) => `<button class="toff ${i === c.sel ? 'on' : ''} ${o.uses >= o.max ? 'off' : ''}" data-trade="${i}"><span>${icon(o.a, tradePrice(o))}</span><i class="tarr"></i><span>${icon(o.b, o.bn, 0, o.ench ? 1 : 0)}</span></button>`).join('')}</div><div class="col tslots"><div class="row">${slotHtml(0)}<div class="arrow"></div>${slotHtml(1, 'big')}</div><p class="tip">${(() => { const o = offers[c.sel]; return o ? itemName(o.a) + ' ' + o.an + '개 → ' + (o.ench ? '마법이 부여된 책' : itemName(o.b)) + ' ' + o.bn + '개' + (o.uses >= o.max ? ' (품절)' : '') : ''; })()}</p></div></div><div class="cap">인벤토리</div>${invRows(2)}</div>`;
  } else if (T === 'creative') {
    const q = GUI.search.trim().toLowerCase();
    const list = ALL_ITEMS().filter(id => !q || itemName(id).toLowerCase().includes(q) || ITEMS[id].key.includes(q));
    h = `<div class="panel creative"><div class="row"><div class="cap">크리에이티브 인벤토리</div><input id="csearch" placeholder="아이템 검색" value="${GUI.search.replace(/"/g, '')}" autocomplete="off"></div><div class="cgrid">${list.map(id => `<div class="sl" data-c="${id}">${icon(id, 1)}</div>`).join('')}</div><div class="row"><div class="grid9 hot">${[...Array(9).keys()].map(i => slotHtml(i)).join('')}</div><div class="sl trash" data-trash="1" title="아이템 삭제"></div></div><p class="tip">클릭: 한 묶음 · 우클릭: 1개 · Shift+클릭: 단축바로 · 휴지통: 삭제</p></div>`;
  } else if (typeof CUSTOM_SCREENS !== 'undefined' && CUSTOM_SCREENS[T]) h = CUSTOM_SCREENS[T].html();
  const cur = INV.cursor;
  el.innerHTML = h + `<div id="cursorItem" class="sl ghost">${cur ? icon(cur.id, cur.n, cur.d, cur.e) : ''}</div>`;
  const an = $('aname'); if (an) { an.oninput = () => { GUI.ctx.name = an.value; const pos = an.selectionStart; UI.renderScreen(); const n = $('aname'); n.focus(); n.setSelectionRange(pos, pos); }; an.onkeydown = e => e.stopPropagation(); an.onpointerdown = e => e.stopPropagation(); }
  const cs = $('csearch'); if (cs) { cs.oninput = () => { GUI.search = cs.value; const pos = cs.selectionStart; UI.renderScreen(); const n = $('csearch'); n.focus(); n.setSelectionRange(pos, pos); }; cs.onkeydown = e => e.stopPropagation(); }
  if (typeof CUSTOM_SCREENS !== 'undefined' && CUSTOM_SCREENS[T] && CUSTOM_SCREENS[T].bind) CUSTOM_SCREENS[T].bind();
  moveCursorItem(lastMouse.x, lastMouse.y);
};
function dollHtml() { return `<div class="doll-fig"><i class="dh"></i><i class="db"></i><i class="dl"></i><i class="dr"></i></div>`; }
const lastMouse = { x: 0, y: 0 };
function moveCursorItem(x, y) { const c = $('cursorItem'); if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; } }
function screenMouse(e) {
  lastMouse.x = e.clientX; lastMouse.y = e.clientY; moveCursorItem(e.clientX, e.clientY);
  // hit-test by position: pointer capture/touch keep e.target on the slot where the drag began
  const hit = document.elementFromPoint(e.clientX, e.clientY), el = hit && hit.closest && hit.closest('#screen .sl');
  const tip = $('tooltip');
  let id = null, st = null;
  if (el && el.dataset.i != null) { st = GUI.slots[+el.dataset.i] && GUI.slots[+el.dataset.i].get(); id = st && st.id; GUI.hover = +el.dataset.i; }
  else if (el && el.dataset.c) { id = +el.dataset.c; GUI.hover = -1; } else GUI.hover = -1;
  if (id && !INV.cursor) { const d = ITEMS[id]; tip.hidden = false; tip.innerHTML = `<span${st && st.e ? ' class="ench"' : ''}>${st && st.name ? '<i>' + st.name.replace(/</g, '&lt;') + '</i>' : d.name}</span>${enchText(st).map(t => `<small>${t}</small>`).join('')}${(d.lore || []).map(t => `<small class="lore">${t}</small>`).join('')}${st && st.ch ? `<small>장전됨: ${ITEMS[st.ch].name}</small>` : ''}${d.dur ? `<small>내구도: ${d.dur - (st && st.d || 0)} / ${d.dur}</small>` : ''}${d.tool ? `<small class="g">공격 피해 ${d.tool.dmg} · 공격 속도 ${d.tool.as}</small>` : ''}${d.armor ? `<small class="g">방어 +${d.armor.pts}</small>` : ''}${d.food ? `<small class="g">허기 +${d.food[0]}</small>` : ''}`; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 26) + 'px'; }
  else tip.hidden = true;
  if (GUI.drag && INV.cursor && el && el.dataset.i != null && !GUI.drag.list.includes(+el.dataset.i)) {
    const sl = GUI.slots[+el.dataset.i]; const s2 = sl.get();
    if (!sl.output && !sl.takeOnly && (!s2 || same(s2, INV.cursor)) && (!sl.accepts || sl.accepts(INV.cursor)) && GUI.drag.list.length < INV.cursor.n) { GUI.drag.list.push(+el.dataset.i); markDrag(); }
  }
  // shift + drag: quick-move every stack the pointer sweeps over (Java "드르륵")
  if (GUI.shiftDrag && el && el.dataset.i != null && !GUI.shiftDrag.has(+el.dataset.i)) {
    GUI.shiftDrag.add(+el.dataset.i); const sl = GUI.slots[+el.dataset.i];
    if (sl && sl.get() && !sl.output) { quickMove(+el.dataset.i); afterClick(); }
  }
}
// preview of a drag split: highlight slots and show how many each will get
function markDrag() {
  const d = GUI.drag, c = INV.cursor; if (!d || !c) return;
  const per = d.btn === 0 ? Math.floor(c.n / d.list.length) : 1;
  document.querySelectorAll('#screen .sl.dragsel').forEach(x => x.classList.remove('dragsel'));
  for (const i of d.list) { const el = document.querySelector(`#screen .sl[data-i="${i}"]`); if (!el) continue; el.classList.add('dragsel'); el.dataset.prev = d.list.length > 1 ? '+' + per : ''; }
}
function screenDown(e) {
  e.preventDefault();
  const el = e.target.closest('.sl');
  if (!el) { if (!e.target.closest('.panel') && INV.cursor) { const c = INV.cursor; if (e.button === 2) { dropItem(PL.x, PL.y + 1.3, PL.z, c.id, 1, lookDir().map(v => v * 0.3), 40, c.d); c.n--; if (!c.n) INV.cursor = null; } else { dropStack(PL.x, PL.y + 1.3, PL.z, c, lookDir().map(v => v * 0.3), 40); INV.cursor = null; } UI.renderScreen(); } return; }
  if (el.dataset.trash) { INV.cursor = null; UI.renderScreen(); return; }
  if (el.dataset.c) { const id = +el.dataset.c; if (INV.cursor) INV.cursor = null; else if (e.shiftKey) { const k = INV.slots.findIndex((s, i) => i < 9 && !s); INV.slots[k >= 0 ? k : INV.sel] = { id, n: maxStack(id) }; } else INV.cursor = { id, n: e.button === 2 ? 1 : maxStack(id) }; UI.hudDirty = true; UI.renderScreen(); return; }
  const i = +el.dataset.i, now = performance.now();
  if (e.button === 0 && !e.shiftKey && now - GUI.lastClick.t < 300 && GUI.lastClick.i === i && INV.cursor) { collectToCursor(); GUI.lastClick.t = 0; afterClick(); return; }
  GUI.lastClick = { t: now, i };
  const sl = GUI.slots[i];
  if (INV.cursor && !e.shiftKey && !sl.output && !sl.takeOnly && (e.button === 0 || e.button === 2)) { GUI.drag = { btn: e.button, list: [i], start: i }; markDrag(); return; }
  if (e.shiftKey && e.button === 0 && !INV.cursor) GUI.shiftDrag = new Set([i]);
  clickSlot(i, e.button, e.shiftKey);
}
function screenUp(e) {
  GUI.shiftDrag = null;
  const d = GUI.drag; if (!d) return; GUI.drag = null;
  if (d.list.length <= 1) { clickSlot(d.start, d.btn, false); return; }
  const c = INV.cursor; if (!c) return;
  if (d.btn === 0) { const per = Math.floor(c.n / d.list.length); if (per < 1) { clickSlot(d.start, 0, false); return; } for (const i of d.list) { const sl = GUI.slots[i], s = sl.get(); const room = maxStack(c.id) - (s ? s.n : 0), m = Math.min(per, room); if (m <= 0) continue; if (s) s.n += m; else sl.set({ ...c, n: m }); c.n -= m; } }
  else for (const i of d.list) { if (c.n <= 0) break; const sl = GUI.slots[i], s = sl.get(); if (s && s.n >= maxStack(c.id)) continue; if (s) s.n++; else sl.set({ ...c, n: 1 }); c.n--; }
  if (c.n <= 0) INV.cursor = null;
  afterClick();
}
// pointermove, not mousemove: preventDefault() on pointerdown suppresses compatibility mouse events,
// which is what broke drag-splitting across crafting slots
$('screen').addEventListener('pointermove', screenMouse);
$('screen').addEventListener('pointerdown', e => { screenMouse(e); screenDown(e); });
addEventListener('pointerup', e => { if (UI.screen) screenUp(e); });
$('screen').addEventListener('contextmenu', e => e.preventDefault());
setInterval(() => { if (UI.screen === 'furnace' || UI.screen === 'hopper' || UI.screen === 'brewing') UI.renderScreen(); }, 250);

// ---------- menus ----------
const SPLASHES = ['동굴과 절벽!', '구리도 산화돼요!', '자수정 정동 발견!', '100% 순수 자바스크립트!', '크롬북에서도 쌩쌩!', '염소가 들이받아요!', '망원경으로 멀리!', '크리퍼 조심!', '다이아몬드!', '블록 위의 블록!', '오프라인에서도 OK!', '눈가루에 빠지지 마세요!'];
function btn(label, act, cls = '') { return `<button class="mb ${cls}" data-act="${act}">${label}</button>`; }
function showMenu(name, data) {
  UI.menu = name; const m = $('menu'); m.hidden = !name; m.className = name ? 'm-' + name : '';
  if (!name) { return; }
  releaseLock();
  let h = '';
  if (name === 'title') {
    h = `<div class="logo"><span>네모 대륙</span><em>JAVA EDITION 1.17 스타일</em><i class="splash">${SPLASHES[Math.floor(Math.random() * SPLASHES.length)]}</i></div><div class="btncol">${btn('싱글플레이', 'worlds')}${btn('설정...', 'options')}${btn('조작법', 'controls')}</div><div class="foot l">네모 대륙 1.17 · Caves &amp; Cliffs</div><div class="foot r">Mojang 비공식 팬 프로젝트</div>`;
  } else if (name === 'worlds') {
    h = `<h2>세계 선택</h2><div class="wlist" id="wlist"><p class="muted">불러오는 중...</p></div><div class="btngrid">${btn('선택한 세계 플레이', 'playSel')}${btn('새로운 세계 만들기', 'create')}${btn('삭제', 'delSel')}${btn('취소', 'title')}</div>`;
    listWorlds().then(ws => {
      ws = (ws || []).sort((a, b) => b.last - a.last); UI.worldList = ws; UI.selWorld = ws[0] ? ws[0].id : null;
      const el = $('wlist'); if (!el) return;
      el.innerHTML = ws.length ? ws.map(w => `<div class="wi ${w.id === UI.selWorld ? 'on' : ''}" data-w="${w.id}"><b>${esc(w.name)}</b><span>${new Date(w.last).toLocaleString()} · ${MODE_NAME[w.mode] || w.mode}${w.hardcore ? ' · 하드코어' : ''}</span></div>`).join('') : '<p class="muted">아직 세계가 없어요. 새로운 세계를 만들어 보세요!</p>';
    });
  } else if (name === 'create') {
    UI.cw = UI.cw || { name: '새로운 세계', mode: 'survival', diff: 2, seed: '', cheats: true };
    const c = UI.cw;
    h = `<h2>새로운 세계 만들기</h2><div class="form"><label>세계 이름<input id="wname" value="${esc(c.name)}" maxlength="32"></label>${btn('게임 모드: ' + MODE_NAME[c.mode], 'cmode')}<p class="muted">${MODE_DESC[c.mode]}</p>${btn('난이도: ' + DIFF_NAME[c.diff], 'cdiff', c.mode === 'hardcore' ? 'dis' : '')}${btn('명령어 허용: ' + (c.cheats ? '켜짐' : '꺼짐'), 'ccheat')}<label>세계 생성 시드<input id="wseed" value="${esc(c.seed)}" placeholder="비워 두면 무작위"></label></div><div class="btngrid">${btn('새로운 세계 만들기', 'doCreate')}${btn('취소', 'worlds')}</div>`;
  } else if (name === 'options') {
    const sl = (k, label, min, max, step, fmt) => `<label class="slider"><span>${label}: <b id="v_${k}">${fmt(OPT[k])}</b></span><input type="range" data-opt="${k}" min="${min}" max="${max}" step="${step}" value="${OPT[k]}"></label>`;
    const tg = (k, label, on = '켜짐', off = '꺼짐') => btn(`${label}: ${OPT[k] ? on : off}`, 'tog_' + k);
    h = `<h2>설정</h2><div class="optgrid">${sl('fov', '시야', 30, 110, 1, v => v == 70 ? '보통' : v == 110 ? 'Quake 프로' : v)}${sl('rd', '렌더 거리', 2, 12, 1, v => v + ' 청크')}${sl('sens', '마우스 감도', 10, 200, 5, v => v + '%')}${sl('gamma', '밝기', 0, 100, 5, v => v == 0 ? '어둡게' : v == 100 ? '밝게' : v + '%')}${sl('vol', '음량', 0, 100, 5, v => v + '%')}${sl('gui', 'GUI 크기', 0, 4, 1, v => v == 0 ? '자동' : v)}${tg('fancy', '그래픽', '화려하게', '빠르게')}${tg('smooth', '부드러운 조명')}${tg('clouds', '구름')}${tg('bob', '화면 흔들림')}${tg('autoRes', '자동 해상도 (끊김 방지)')}${tg('showFps', 'FPS 표시')}${tg('invertY', '마우스 반전')}${tg('fullscreen', '전체 화면 + 키 잠금')}</div><p class="muted">크롬북 권장: 렌더 거리 4~6, 그래픽 빠르게, 자동 해상도 켜짐</p><div class="btncol">${btn('완료', 'optDone')}</div>`;
  } else if (name === 'controls') {
    h = `<h2>조작법</h2><ul class="keys"><li><kbd>W A S D</kbd> 이동 · <kbd>W</kbd> 두 번 / <kbd>R</kbd> / <kbd>Ctrl</kbd> 달리기</li><li><kbd>Space</kbd> 점프 · 수영 · (크리에이티브) 두 번 눌러 비행</li><li><kbd>Shift</kbd> 웅크리기 (모서리에서 안 떨어짐) · 비행 중 하강</li><li><kbd>좌클릭</kbd> 블록 캐기 · 공격 (공격 쿨다운 1.9 전투)</li><li><kbd>우클릭</kbd> 블록 놓기 · 사용 · 먹기 · 활 당기기 · 망원경</li><li><kbd>휠 클릭</kbd> 블록 고르기 · <kbd>휠</kbd> / <kbd>1-9</kbd> 단축바</li><li><kbd>E</kbd> 인벤토리 · <kbd>Q</kbd> 버리기 (<kbd>Ctrl+Q</kbd> 묶음)</li><li><kbd>T</kbd> 채팅 · <kbd>/</kbd> 명령어 (/help)</li><li><kbd>F1</kbd>/<kbd>H</kbd> HUD 숨기기 · <kbd>F3</kbd>/<kbd>&#96;</kbd> 디버그 · <kbd>F5</kbd>/<kbd>V</kbd> 시점 전환</li><li>크롬북: <kbd>Ctrl</kbd>+<kbd>W</kbd>는 탭을 닫으니 <kbd>W</kbd> 두 번이나 <kbd>R</kbd>로 달리세요 (설정에서 전체 화면 + 키 잠금을 켜면 안전)</li><li>인벤토리: Shift+클릭 빠른 이동 · 우클릭 절반 · 드래그 나누기 · 숫자키 교체 · 더블클릭 모으기</li></ul><div class="btncol">${btn('완료', UI.paused ? 'pause' : 'title')}</div>`;
  } else if (name === 'pause') {
    h = `<h2>게임 메뉴</h2><div class="btncol">${btn('게임으로 돌아가기', 'resume')}${btn('설정...', 'options')}${btn('조작법', 'controls')}${btn('저장하고 타이틀로', 'quit')}</div>`;
  } else if (name === 'death') {
    h = `<div class="death"><h1>${PL.hardcore ? '게임 오버!' : '사망했습니다!'}</h1><p>${esc(data || '')}</p><p>점수: <b>${PL.xpTotal}</b></p><div class="btncol">${PL.hardcore ? btn('관전하기', 'spectate') : btn('리스폰', 'respawn')}${btn('타이틀 화면', 'quit')}</div></div>`;
  } else if (name === 'loading') {
    h = `<div class="loading"><h2>${data || '지형 생성 중'}</h2><div class="bar"><i id="loadbar"></i></div><p class="muted" id="loadtxt"></p></div>`;
  }
  m.innerHTML = h;
  m.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { const k = r.dataset.opt; OPT[k] = +r.value; const fmt = { fov: v => v == 70 ? '보통' : v == 110 ? 'Quake 프로' : v, rd: v => v + ' 청크', sens: v => v + '%', gamma: v => v == 0 ? '어둡게' : v == 100 ? '밝게' : v + '%', vol: v => v + '%', gui: v => v == 0 ? '자동' : v }[k]; $('v_' + k).textContent = fmt(+r.value); saveOpt(); });
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const MODE_NAME = { survival: '서바이벌', creative: '크리에이티브', hardcore: '하드코어', spectator: '관전자' };
const MODE_DESC = { survival: '자원을 모으고, 제작하고, 레벨을 올리며 체력과 허기를 관리하세요.', creative: '무한한 자원, 자유로운 비행, 즉시 파괴. 마음껏 건축하세요.', hardcore: '서바이벌과 같지만 가장 어려운 난이도로 고정되며, 목숨은 하나뿐입니다.', spectator: '' };
const DIFF_NAME = ['평화로움', '쉬움', '보통', '어려움'];
$('menu').addEventListener('click', async e => {
  const wi = e.target.closest('.wi'); if (wi) { UI.selWorld = wi.dataset.w; document.querySelectorAll('.wi').forEach(x => x.classList.toggle('on', x === wi)); if (e.detail === 2) startWorld(UI.selWorld); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  audioInit(); play('click');
  const a = b.dataset.act;
  if (a === 'worlds' || a === 'title' || a === 'options' || a === 'create' || a === 'controls' || a === 'pause') { if (a === 'options') UI.optBack = UI.menu === 'pause' || UI.paused ? 'pause' : 'title'; showMenu(a); }
  else if (a === 'optDone') showMenu(UI.paused ? 'pause' : 'title');
  else if (a.startsWith('tog_')) { const k = a.slice(4); OPT[k] = !OPT[k]; saveOpt(); showMenu('options'); if (k === 'fancy' || k === 'smooth') for (const c of W.chunks.values()) c.dirty = true; }
  else if (a === 'cmode') { const order = ['survival', 'creative', 'hardcore']; UI.cw.name = $('wname').value; UI.cw.seed = $('wseed').value; UI.cw.mode = order[(order.indexOf(UI.cw.mode) + 1) % 3]; showMenu('create'); }
  else if (a === 'cdiff') { if (UI.cw.mode === 'hardcore') return; UI.cw.name = $('wname').value; UI.cw.seed = $('wseed').value; UI.cw.diff = (UI.cw.diff + 1) % 4; showMenu('create'); }
  else if (a === 'ccheat') { UI.cw.name = $('wname').value; UI.cw.seed = $('wseed').value; UI.cw.cheats = !UI.cw.cheats; showMenu('create'); }
  else if (a === 'doCreate') { const c = UI.cw; c.name = $('wname').value || '새로운 세계'; c.seed = $('wseed').value; await createWorld(c); UI.cw = null; }
  else if (a === 'playSel') { if (UI.selWorld) startWorld(UI.selWorld); }
  else if (a === 'delSel') { if (!UI.selWorld) return; const w = UI.worldList.find(x => x.id === UI.selWorld); if (confirm(`'${w.name}' 세계를 삭제할까요? 되돌릴 수 없습니다.`)) { await deleteWorld(UI.selWorld); showMenu('worlds'); } }
  else if (a === 'resume') resumeGame();
  else if (a === 'quit') quitToTitle();
  else if (a === 'respawn') { respawn(); showMenu(null); resumeGame(); }
  else if (a === 'spectate') { PL.mode = 'spectator'; respawn(); showMenu(null); resumeGame(); }
});
UI.showDeath = msg => { UI.paused = true; showMenu('death', msg); chatMsg(msg, '#ffffff'); if (PL.hardcore) saveWorldMeta(); };

// ---------- chat & commands ----------
function openChat(prefix = '') { UI.chatOpen = true; releaseLock(); clearInput(); const c = $('chat'); c.hidden = false; const i = $('chatIn'); i.value = prefix; setTimeout(() => i.focus(), 0); renderChat(); }
function closeChat() { UI.chatOpen = false; $('chat').hidden = true; $('chatIn').blur(); renderChat(); grabLock(); }
$('chatIn').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape') { closeChat(); e.preventDefault(); }
  if (e.key === 'Enter') { const v = $('chatIn').value.trim(); closeChat(); if (v) { if (v[0] === '/') runCommand(v.slice(1)); else chatMsg('<플레이어> ' + v); } }
});
function runCommand(cmd) {
  const [c, ...a] = cmd.split(/\s+/);
  const err = t => chatMsg(t, '#ff5555'), ok = t => chatMsg(t, '#aaaaaa');
  if (!W.cheats && c !== 'help' && c !== 'seed') return err('이 세계에서는 명령어가 허용되지 않습니다');
  const num = (v, base) => v && v[0] === '~' ? base + (+(v.slice(1)) || 0) : +v;
  switch (c) {
    case 'help': ok('/gamemode <survival|creative|spectator> · /time set <day|noon|night|midnight|숫자> · /weather <clear|rain|thunder> · /give <아이템> [개수] · /tp <x> <y> <z> · /summon <몹> · /kill · /seed · /difficulty <0-3> · /xp <양> · /spawnpoint · /clear · /keepinventory · /locate <village|stronghold|fortress|end_city>'); break;
    case 'gamemode': { const m = { survival: 'survival', s: 'survival', 0: 'survival', creative: 'creative', c: 'creative', 1: 'creative', spectator: 'spectator', sp: 'spectator', 3: 'spectator' }[a[0]]; if (!m) return err('알 수 없는 게임 모드'); PL.mode = m; if (m !== 'creative' && m !== 'spectator') PL.flying = false; if (m === 'spectator') PL.flying = true; UI.hudDirty = true; ok('게임 모드를 ' + MODE_NAME[m] + '(으)로 변경했습니다'); break; }
    case 'time': { const v = a[1]; const t = { day: 1000, noon: 6000, night: 13000, midnight: 18000, sunrise: 23000, sunset: 12000 }[v] ?? +v; if (isNaN(t)) return err('시간 값이 잘못되었습니다'); if (a[0] === 'add') W.time += t; else W.time = Math.floor(W.time / 24000) * 24000 + t; ok('시간을 ' + t + '(으)로 설정했습니다'); break; }
    case 'weather': W.rainTarget = a[0] === 'rain' || a[0] === 'thunder' ? 1 : 0; W.thunderOn = a[0] === 'thunder'; W.rainTimer = W.thunderTimer = 6000 + Math.random() * 12000; ok(a[0] === 'thunder' ? '날씨를 뇌우로 변경했습니다' : '날씨를 변경했습니다'); break;
    case 'give': { const k = (a[0] || '').replace('minecraft:', ''); const id = IID[k] != null ? IID[k] : ITEMS.findIndex(d => d && d.name === a[0]); if (id == null || id < 0 || !ITEMS[id]) return err('알 수 없는 아이템: ' + a[0]); const n = Math.max(1, Math.min(6400, +a[1] || 1)); let left = n; while (left > 0) { const m = Math.min(left, maxStack(id)); INV.giveOrDrop({ id, n: m }); left -= m; } ok(`[${itemName(id)}] ${n}개를 주었습니다`); break; }
    case 'tp': { const x = num(a[0], PL.x), y = num(a[1], PL.y), z = num(a[2], PL.z); if ([x, y, z].some(isNaN)) return err('좌표가 잘못되었습니다'); PL.x = PL.px = x; PL.y = PL.py = y; PL.z = PL.pz = z; PL.vx = PL.vy = PL.vz = 0; PL.fallDist = 0; ok(`${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}(으)로 순간이동했습니다`); break; }
    case 'summon': { const t = (a[0] || '').replace('minecraft:', ''); if (!MOBDEF[t] || t === 'player') return err('알 수 없는 몹: ' + a[0]); const [dx, , dz] = lookDir(); spawnMob(t, PL.x + dx * 3, PL.y, PL.z + dz * 3); ok(t + ' 소환'); break; }
    case 'locate': { // nearest structure, like Java's /locate
      const k = (a[0] || '').replace('minecraft:', ''); let best = null;
      const near = (x, z) => { const d = Math.hypot(x - PL.x, z - PL.z); if (!best || d < best[2]) best = [x, z, d]; };
      if (k === 'village' && W.dim === 0) { const G = S.makeGen(W.seed), rx = Math.floor((PL.x >> 4) / S.VREG), rz = Math.floor((PL.z >> 4) / S.VREG); for (let i = rx - 6; i <= rx + 6; i++) for (let j = rz - 6; j <= rz + 6; j++) { const v = S.villageAt(W.seed, G, i, j); if (v) near(v.x, v.z); } }
      else if (k === 'stronghold' && W.dim === 0) for (const p of S.strongholdsOf(W.seed)) near(p[0], p[2]);
      else if ((k === 'fortress' || k === 'nether_fortress') && W.dim === -1) { const rx = Math.floor((PL.x >> 4) / S.FREG), rz = Math.floor((PL.z >> 4) / S.FREG); for (let i = rx - 4; i <= rx + 4; i++) for (let j = rz - 4; j <= rz + 4; j++) { const f = S.fortressAt(W.seed, i, j); if (f) near(f.x, f.z); } }
      else if (k === 'end_city' && W.dim === 1) { const nA = S.makeNoise(W.seed + 201), nB = S.makeNoise(W.seed + 202), rx = Math.floor((PL.x >> 4) / 20), rz = Math.floor((PL.z >> 4) / 20); for (let i = rx - 5; i <= rx + 5; i++) for (let j = rz - 5; j <= rz + 5; j++) { const c = S.endCityAt(W.seed, i, j, nA, nB); if (c) near(c.x, c.z); } }
      else return err('village, stronghold (오버월드), fortress (네더), end_city (엔드) 중 하나를 입력하세요');
      if (!best) return err('가까운 구조물을 찾지 못했습니다');
      ok(`가장 가까운 ${k}: ${best[0]}, ~, ${best[1]} (${Math.round(best[2])}블록 거리)`); break;
    }
    case 'kill': hurtPlayer(1000, 'kill'); break;
    case 'seed': ok('시드: ' + W.seed); break;
    case 'difficulty': { const d = { peaceful: 0, easy: 1, normal: 2, hard: 3 }[a[0]] ?? +a[0]; if (!(d >= 0 && d <= 3)) return err('0-3 사이로 입력하세요'); PL.difficulty = d; if (d === 0) for (const e of ENT) if (e.kind === 'mob' && e.def.hostile) removeEnt(e); ok('난이도: ' + DIFF_NAME[d]); break; }
    case 'xp': addXP(Math.max(0, +a[0] || 0)); break;
    case 'spawnpoint': PL.spawn = [Math.floor(PL.x), Math.floor(PL.y), Math.floor(PL.z)]; ok('스폰 지점을 설정했습니다'); break;
    case 'clear': INV.slots.fill(null); INV.armor.fill(null); UI.hudDirty = true; ok('인벤토리를 비웠습니다'); break;
    case 'keepinventory': W.keepInv = !W.keepInv; ok('인벤토리 보존: ' + (W.keepInv ? '켜짐' : '꺼짐')); break;
    default: err('알 수 없는 명령어입니다. /help 를 입력하세요');
  }
}

// ---------- advancements (subset of 1.17) ----------
const ADV = [
  ['root', 'Minecraft', '제작대를 얻으세요', 'crafting_table', { item: 'crafting_table' }],
  ['stone', '석기 시대', '새 곡괭이로 돌을 캐세요', 'wooden_pickaxe', { item: 'cobblestone' }],
  ['upgrade', '더 좋은 도구', '더 좋은 곡괭이를 만드세요', 'stone_pickaxe', { item: 'stone_pickaxe' }],
  ['iron', '철 획득', '철 주괴를 제련하세요', 'iron_ingot', { item: 'iron_ingot' }],
  ['armor', '갑옷을 입어라', '철 갑옷으로 몸을 보호하세요', 'iron_chestplate', { armor: 'iron' }],
  ['lava', '화끈한 것', '양동이에 용암을 담으세요', 'lava_bucket', { item: 'lava_bucket' }],
  ['ironpick', '철 곡괭이가 최고야', '곡괭이를 업그레이드하세요', 'iron_pickaxe', { item: 'iron_pickaxe' }],
  ['diamond', '다이아몬드!', '다이아몬드를 얻으세요', 'diamond', { item: 'diamond' }],
  ['obsidian', '아이스 버킷 챌린지', '흑요석을 얻으세요', 'obsidian', { item: 'obsidian' }],
  ['copper', '구리 시대', '구리 주괴를 제련하세요', 'copper_ingot', { item: 'copper_ingot' }],
  ['amethyst', '반짝이는 수정', '자수정 조각을 얻으세요', 'amethyst_shard', { item: 'amethyst_shard' }],
  ['spyglass', '저게 새인가?', '망원경으로 멀리 보세요', 'spyglass', {}],
  ['snow', '토끼처럼 가볍게', '가죽 부츠를 신고 가루눈 위를 걸으세요', 'leather_boots', {}],
  ['seed', '씨앗을 심는 곳', '씨앗을 심어 보세요', 'wheat_seeds', {}],
  ['breed', '둘이 함께', '두 동물을 번식시키세요', 'wheat', {}],
  ['hunter', '몬스터 사냥꾼', '적대적 몬스터를 처치하세요', 'iron_sword', {}],
  ['sleep', '달콤한 꿈', '침대에서 자세요', 'red_bed', {}],
  ['glow', '빛나는 먹물', '발광 먹물 주머니를 얻으세요', 'glow_ink_sac', { item: 'glow_ink_sac' }],
  ['enchant', '마법 부여사', '마법 부여대로 아이템에 마법을 부여하세요', 'enchanting_table', {}],
  ['portal', '더 깊은 곳으로', '네더 차원문을 만들고 불을 붙이세요', 'flint_and_steel', {}],
  ['nether', '네더', '네더에 들어가세요', 'netherrack', {}],
  ['blaze', '불 속으로', '블레이즈 막대를 얻으세요', 'blaze_rod', { item: 'blaze_rod' }],
  ['debris', '잔해 속에 숨겨진 것', '고대 잔해를 얻으세요', 'ancient_debris', { item: 'ancient_debris' }],
  ['netherite', '파편으로 덮어주세요', '네더라이트 갑옷을 입으세요', 'netherite_chestplate', { armor: 'netherite' }],
  ['eye', '눈길을 따라서', '엔더의 눈을 던지세요', 'ender_eye', {}],
  ['end', '끝?', '엔드에 들어가세요', 'end_stone', {}],
  ['dragon', '엔드 해방', '엔더 드래곤을 물리치세요', 'dragon_egg', {}],
  ['trade', '좋은 거래!', '주민과 거래하세요', 'emerald', {}],
  ['wolf', '최고의 친구', '늑대를 길들이세요', 'bone', {}],
  ['elytra', '하늘은 무한대', '겉날개를 얻으세요', 'elytra', { item: 'elytra' }],
];
const advQueue = [];
UI.advance = key => {
  if (!W.meta || PL.mode === 'creative' || PL.mode === 'spectator') return;
  W.meta.adv = W.meta.adv || {};
  if (W.meta.adv[key]) return;
  const a = ADV.find(x => x[0] === key); if (!a) return;
  W.meta.adv[key] = Date.now();
  chatMsg(`플레이어가 도전 과제 [${a[1]}]을(를) 달성했습니다`, '#55ff55');
  advQueue.push(a); if (advQueue.length === 1) showAdv();
};
function showAdv() {
  const a = advQueue[0]; if (!a) return;
  const el = $('adv'); el.innerHTML = `<i class="ic" style="${iconStyle(IID[a[3]], 16 * (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 2))}"></i><div><b>도전 과제 달성!</b><span>${a[1]}</span></div>`;
  el.classList.add('show'); play('levelup', { vol: 0.6 });
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => { advQueue.shift(); showAdv(); }, 400); }, 4000);
}
function advScan() {
  if (!W.meta) return;
  const have = new Set(); for (const s of INV.slots) if (s) have.add(s.id); if (INV.cursor) have.add(INV.cursor.id);
  for (const a of ADV) { const t = a[4]; if (t.item && have.has(IID[t.item])) UI.advance(a[0]); if (t.armor && INV.armor.some(s => s && ITEMS[s.id].armor.mat === t.armor)) UI.advance(a[0]); }
}

// ---------- enchanting table ----------
function bookshelves(c) {
  let n = 0;
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 0; dy <= 1; dy++) {
    if (Math.abs(dx) < 2 && Math.abs(dz) < 2) continue;
    if (getBlock(c.x + dx, c.y + dy, c.z + dz) === BID.bookshelf && getBlock(c.x + Math.sign(dx), c.y + dy, c.z + Math.sign(dz)) === 0) n++;
  }
  return Math.min(15, n);
}
function enchantOptions() {
  const c = GUI.ctx, st = c.items[0], shelves = bookshelves(c), list = [];
  if (!st) return { shelves, list };
  PL.enchSeed = PL.enchSeed || ((Math.random() * 2 ** 31) | 0);
  const r = S.rng(PL.enchSeed), b = shelves;
  const base = 1 + r.int(8) + Math.floor(b / 2) + r.int(b + 1);
  const costs = [Math.max(Math.floor(base / 3), 1), Math.floor(base * 2 / 3) + 1, Math.max(base, b * 2)];
  const lapis = c.items[1] ? c.items[1].n : 0;
  costs.forEach((cost, i) => {
    const e = rollEnchant(st.id, cost, PL.enchSeed + i * 7919), first = Object.keys(e)[0];
    list.push({ cost, e, text: first ? ENCH[first][0] + (ENCH[first][1] > 1 ? ' ' + ROMAN[e[first]] : '') + ' . . . ?' : '?', ok: creative() || (PL.level >= cost && lapis >= i + 1) });
  });
  return { shelves, list };
}
$('screen').addEventListener('click', e => { const b = e.target.closest('[data-trade]'); if (b && UI.screen === 'trade') selectTrade(+b.dataset.trade); });
$('screen').addEventListener('click', e => { const b = e.target.closest('[data-loom]'); if (b && UI.screen === 'loom') { GUI.ctx.pat = b.dataset.loom; UI.renderScreen(); } });
$('screen').addEventListener('click', e => { const b = e.target.closest('[data-beacon]'); if (!b || UI.screen !== 'beacon') return; const [slot, k] = b.dataset.beacon.split(':'); if (slot === 'ok') beaconConfirm(); else beaconPick(slot, k); });
$('screen').addEventListener('click', e => {
  const b = e.target.closest('[data-ench]'); if (!b || UI.screen !== 'enchant') return;
  const i = +b.dataset.ench, o = enchantOptions().list[i]; if (!o || !o.ok) return;
  const c = GUI.ctx, st = c.items[0];
  st.e = o.e;
  if (!creative()) { PL.level = Math.max(0, PL.level - (i + 1)); c.items[1].n -= i + 1; if (c.items[1].n <= 0) c.items[1] = null; }
  PL.enchSeed = (Math.random() * 2 ** 31) | 0;
  play('levelup', { vol: 0.5 }); UI.advance('enchant'); UI.hudDirty = true; UI.renderScreen();
});
