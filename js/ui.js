// UI: menus, HUD, chat/commands, container screens.
const $ = id => document.getElementById(id);
const UI = { screen: null, menu: 'title', hudDirty: true, chatOpen: false, debug: false, hideHud: false, msgs: [] };
const OPT_KEY = 'nemo-mc-117-options';
const OPT = { fov: 70, rd: 6, sens: 100, gamma: 50, vol: 60, fancy: false, smooth: true, clouds: true, bob: true, dynLight: true, gui: 0, autoRes: true, showFps: false, coords: true, invertY: false, fullscreen: false, toggleSprint: false, toggleSneak: false, pauseOnBlur: true, skin: 'steve', mainHand: 'right' };
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
SPR_HUD.poison = mkHeart(1, 1, '#94841c', '#c8c060'); SPR_HUD.poisonHalf = mkHeart(1, 0, '#94841c', '#c8c060');
SPR_HUD.wither = mkHeart(1, 1, '#2a2a2a', '#6a6a6a'); SPR_HUD.witherHalf = mkHeart(1, 0, '#2a2a2a', '#6a6a6a');
SPR_HUD.frozen = mkHeart(1, 1, '#6ac8e8', '#e0f8ff'); SPR_HUD.frozenHalf = mkHeart(1, 0, '#6ac8e8', '#e0f8ff');
SPR_HUD.hardHalf = mkHeart(1, 0, '#b01010', '#ffd0d0'); SPR_HUD.goldHalf = mkHeart(1, 0, '#e8c020', '#fff2a0');
SPR_HUD.hunger = SPR_HUD.food; SPR_HUD.hungerHalf = SPR_HUD.foodHalf; SPR_HUD.hungerEmpty = SPR_HUD.foodEmpty; SPR_HUD.pop = SPR_HUD.bubble;
// a loaded client.jar / pack: the HUD from its gui/icons.png and gui/widgets.png (hearts are a container plus a fill, as in Java)
function applyGuiPack() {
  const crop = (key, x, y, w, h, base, under) => { const e = PACKPX.ent[key]; if (!e) return null; const k = e.w / base, c = document.createElement('canvas'); c.width = w * k; c.height = h * k; const g = c.getContext('2d');
    const src = document.createElement('canvas'); src.width = e.w; src.height = e.h; src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(e.px), e.w, e.h), 0, 0);
    for (const [ux, uy] of under || []) g.drawImage(src, ux * k, uy * k, w * k, h * k, 0, 0, w * k, h * k);
    if (x != null) g.drawImage(src, x * k, y * k, w * k, h * k, 0, 0, w * k, h * k); return c; };
  const css = document.documentElement.style;
  if (PACKPX.ent.gui_icons) {
    const ic = (x, y, bg) => crop('gui_icons', x, y, 9, 9, 256, bg ? [bg] : null).toDataURL(), H = [16, 0], HH = [16, 45], F = [16, 27];
    Object.assign(SPR_HUD, { heart: ic(52, 0, H), half: ic(61, 0, H), empty: ic(null, null, H), gold: ic(160, 0, H), goldHalf: ic(169, 0, H), hard: ic(52, 45, HH), hardHalf: ic(61, 45, HH),
      poison: ic(88, 0, H), poisonHalf: ic(97, 0, H), wither: ic(124, 0, H), witherHalf: ic(133, 0, H), frozen: ic(178, 0, H), frozenHalf: ic(187, 0, H),
      food: ic(52, 27, F), foodHalf: ic(61, 27, F), foodEmpty: ic(null, null, F), hunger: ic(88, 27, [133, 27]), hungerHalf: ic(97, 27, [133, 27]), hungerEmpty: ic(null, null, [133, 27]),
      armor: ic(34, 9), armorHalf: ic(25, 9), armorEmpty: ic(16, 9), bubble: ic(16, 18), pop: ic(25, 18) });
    css.setProperty('--g-cross', `url(${crop('gui_icons', 0, 0, 15, 15, 256).toDataURL()})`);
    css.setProperty('--g-xpbg', `url(${crop('gui_icons', 0, 64, 182, 5, 256).toDataURL()})`); css.setProperty('--g-xp', `url(${crop('gui_icons', 0, 69, 182, 5, 256).toDataURL()})`);
    document.body.classList.add('vicons');
  }
  if (PACKPX.ent.gui_widgets) {
    css.setProperty('--g-hotbar', `url(${crop('gui_widgets', 0, 0, 182, 22, 256).toDataURL()})`); css.setProperty('--g-sel', `url(${crop('gui_widgets', 0, 22, 24, 22, 256).toDataURL()})`);
    css.setProperty('--g-offl', `url(${crop('gui_widgets', 24, 22, 29, 24, 256).toDataURL()})`); css.setProperty('--g-offr', `url(${crop('gui_widgets', 53, 22, 29, 24, 256).toDataURL()})`);
    document.body.classList.add('vwidgets');
  }
  if (PACKPX.ent.gui_inv) { // container screens: the panel's rounded bevel and the slot frame from gui/container/inventory.png
    css.setProperty('--g-panel', `url(${crop('gui_inv', 0, 0, 176, 166, 256).toDataURL()})`); css.setProperty('--g-slot', `url(${crop('gui_inv', 7, 83, 18, 18, 256).toDataURL()})`);
    document.body.classList.add('vgui');
  }
  if (PACKPX.ent.gui_furnace) { // progress arrow and flame, empty and full
    for (const [k, x, y, w, h] of [['arrow0', 79, 34, 24, 17], ['arrow1', 176, 14, 24, 17], ['flame0', 56, 36, 14, 14], ['flame1', 176, 0, 14, 14]]) css.setProperty('--g-' + k, `url(${crop('gui_furnace', x, y, w, h, 256).toDataURL()})`);
    document.body.classList.add('vfurn');
  }
}
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
    const kind = effLv(PL, 'poison') ? 'poison' : effLv(PL, 'wither') ? 'wither' : PL.frozen >= 140 ? 'frozen' : hard ? 'hard' : 'heart'; // Java's heart types
    const full = SPR_HUD[kind], halfS = kind === 'heart' ? SPR_HUD.half : SPR_HUD[kind + 'Half'];
    for (let i = 0; i < plMaxHp() / 2; i++) { const v = hp - i * 2; hearts.push(`<img src="${v >= 2 ? full : v === 1 ? halfS : SPR_HUD.empty}" class="${PL.health <= 4 ? 'shake' : ''}" style="--d:${(i * 37) % 7}">`); }
    if (PL.absorb > 0) { const ab = Math.ceil(PL.absorb); for (let i = 0; i < Math.ceil(ab / 2); i++) hearts.push(`<img src="${ab - i * 2 >= 2 ? SPR_HUD.gold : SPR_HUD.goldHalf}">`); }
    $('hearts').innerHTML = hearts.join('');
    const hu = effLv(PL, 'hunger') ? 'hunger' : 'food';
    const fd = []; for (let i = 0; i < 10; i++) { const v = PL.food - i * 2; fd.push(`<img src="${v >= 2 ? SPR_HUD[hu] : v === 1 ? SPR_HUD[hu + 'Half'] : SPR_HUD[hu + 'Empty']}" class="${PL.sat <= 0 && PL.food < 20 && W.tickN % 2 ? 'jit' : ''}">`); }
    $('food').innerHTML = fd.join('');
    const [ap] = armorPoints(); const ar = [];
    if (ap > 0) for (let i = 0; i < 10; i++) { const v = ap - i * 2; ar.push(`<img src="${v >= 2 ? SPR_HUD.armor : v === 1 ? SPR_HUD.armorHalf : SPR_HUD.armorEmpty}">`); }
    $('armorbar').innerHTML = ar.join('');
    const air = []; if (PL.air < 300) { const full = Math.floor(Math.max(0, PL.air) * 10 / 300), pop = Math.ceil(Math.max(0, PL.air) * 10 / 300) - full; for (let i = 0; i < full; i++) air.push(`<img src="${SPR_HUD.bubble}">`); if (pop) air.push(`<img src="${SPR_HUD.pop}">`); }
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
  el.hidden = !UI.debug && !OPT.showFps && !OPT.coords;
  if (el.hidden || (dbgT -= dt) > 0) return; dbgT = 0.1;
  if (!UI.debug) { // the short line: frame rate and where you are (Bedrock's "show coordinates")
    const dir = ['북', '서', '남', '동'][((Math.round((((PL.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4) + 4) % 4];
    el.textContent = [OPT.showFps ? fps + ' fps' : '', OPT.coords ? `위치: ${Math.floor(PL.x)}, ${Math.floor(PL.y)}, ${Math.floor(PL.z)} · ${dir}쪽` : ''].filter(Boolean).join('\n'); return; }
  const bx = Math.floor(PL.x), by = Math.floor(PL.y), bz = Math.floor(PL.z), l = getLight(bx, by, bz);
  const facing = ['북쪽 (-Z)', '서쪽 (-X)', '남쪽 (+Z)', '동쪽 (+X)'][[0, 1, 2, 3][((Math.round((((PL.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4) + 4) % 4]];
  let meshed = 0; for (const c of W.chunks.values()) if (c.mesh) meshed++;
  const t = TARGET && TARGET.type === 'block' ? `\n대상 블록: ${TARGET.x} ${TARGET.y} ${TARGET.z}\n${BLOCKS[TARGET.id].key} [${TARGET.m}]` : '';
  const P = typeof PERF !== 'undefined' ? PERF : null, ms = k => P && P.n ? (P[k] / P.n).toFixed(1) : '-';
  const perf = `틱 ${ms('tick')}ms · 청크 ${ms('stream')}+${ms('inbox')}ms · 렌더 ${ms('render')}ms`;
  if (P) { for (const k in P) P[k] = 0; }
  el.textContent = `네모 대륙 1.18 (Java Edition 스타일)\n${fps} fps · ${perf} · 해상도 ${Math.round(R.pixelScale * 100)}% · 렌더 거리 ${R.rd}\n청크: ${W.chunks.size} 로드 · ${meshed} 렌더 · 대기 ${W.pending.size}\n엔티티: ${ENT.length} · 파티클 ${R.particles.length}\n\nXYZ: ${PL.x.toFixed(3)} / ${PL.y.toFixed(5)} / ${PL.z.toFixed(3)}\n블록: ${bx} ${by} ${bz}\n청크: ${bx & 15} ${by} ${bz & 15} in ${bx >> 4} ${bz >> 4}\n방향: ${facing} (${(((-PL.yaw * 180 / Math.PI) % 360 + 540) % 360 - 180).toFixed(1)} / ${(-PL.pitch * 180 / Math.PI).toFixed(1)})\n바이옴: ${(() => { const cb = W.dim === 0 ? S.caveBiomeAt(W.seed, bx, Math.floor(PL.y), bz, topY(bx, bz), W.exp) : -1; const b = cb >= 0 ? cb : biomeAt(bx, bz); return S.BIOMES[b][0] + ' (minecraft:' + S.BIOMES[b][8] + ')'; })()}\n밝기: ${Math.max(l & 15, (l >> 4) - skyDarken())} (하늘 ${l >> 4}, 블록 ${l & 15})\n시간: ${Math.floor(((W.time % 24000) + 24000) % 24000)} (${Math.floor(W.time / 24000)}일차)${W.rain > 0.5 ? ' · 비' : ''}${t}`;
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
  if (UI.screen === 'chest') { play('door', { vol: 0.5 }); const c = GUI.ctx; if (c && c.x != null && getBlock(c.x, c.y, c.z) === BID.trapped_chest) { setMeta(c.x, c.y, c.z, getMeta(c.x, c.y, c.z) & ~32); rsNotify(c.x, c.y, c.z); rsNotify(c.x, c.y - 1, c.z); } }
  closeScreenItems(); UI.screen = null; $('screen').hidden = true; $('tooltip').hidden = true; UI.hudDirty = true; grabLock();
};
// creative list: colour/material variants sit right after their base block
const ALL_ITEMS = () => ITEMS.filter(d => d && d.key !== 'name_tag' && d.key !== 'saddle').map(d => [d.id, d.block && d.place != null ? d.place * 32 + (d.vi || 0) : 1e6 + d.id]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
UI.renderScreen = () => {
  if (!UI.screen) return;
  const T = UI.screen, el = $('screen');
  let h = '';
  if (T === 'inv') {
    h = `<div class="panel inv"><div class="row top"><div class="col">${[4, 5, 6, 7].map(i => slotHtml(i + 1, 'armor a' + (i - 4))).join('')}</div><div class="doll"><div class="dollIn">${dollHtml()}</div></div><div class="col offc">${slotHtml(GUI.slots.length - 1, 'armor aoff')}</div><div class="cr"><div class="cap">제작</div><div class="g2">${[0, 1, 2, 3].map(i => slotHtml(i)).join('')}</div></div><div class="arrow"></div>${slotHtml(4, 'big')}</div><div class="cap">인벤토리</div>${invRows(9)}</div>`;
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
  } else if (T === 'adv') { h = advScreenHtml();
  } else if (T === 'stonecutter') { h = stonecutHtml();
  } else if (T === 'cartography') { h = cartoHtml();
  } else if (T === 'grindstone') { h = grindHtml();
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
function dollHtml() { return ''; } // the 3D figure is drawn into .doll every frame (playermodel.js)
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
  if (id && !INV.cursor) { const d = ITEMS[id]; tip.hidden = false; tip.innerHTML = `<span${st && st.e ? ' class="ench"' : ''}>${st && st.name ? '<i>' + st.name.replace(/</g, '&lt;') + '</i>' : d.name}</span>${enchText(st).map(t => `<small>${t}</small>`).join('')}${(d.lore || []).map(t => `<small class="lore">${t}</small>`).join('')}${st && st.ch ? `<small>장전됨: ${ITEMS[st.ch].name}</small>` : ''}${d.dur && UI.advTips ? `<small>내구도: ${d.dur - (st && st.d || 0)} / ${d.dur}</small>` : ''}${d.tool ? `<small class="g">공격 피해 ${d.tool.dmg} · 공격 속도 ${d.tool.as}</small>` : ''}${d.armor ? `<small class="g">방어 +${d.armor.pts}</small>` : ''}${d.food ? `<small class="g">허기 +${d.food[0]}</small>` : ''}${UI.advTips ? `<small class="lore">minecraft:${d.key}</small>` : ''}`; tip.style.left = (e.clientX + 14) + 'px'; tip.style.top = (e.clientY - 26) + 'px'; }
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
    h = `<div class="logo"><span>네모 대륙</span><em>JAVA EDITION 1.18 스타일</em><i class="splash">${SPLASHES[Math.floor(Math.random() * SPLASHES.length)]}</i></div><div class="btncol">${btn('싱글플레이', 'worlds')}${btn('멀티플레이', 'mp_join')}${btn('발전 과제', 'advs')}${btn('통계', 'stats')}${btn('설정...', 'options')}${btn('조작법', 'controls')}</div><div class="titleSide" style="position:absolute;right:max(8px,4vw);top:50%;transform:translateY(-50%)"><div class="titleDoll" title="스킨 바꾸기" data-act="skins"></div>${ACC.user ? `<div class="acc">${ACC.user.picture ? `<img src="${ACC.user.picture.replace(/"/g, '')}" referrerpolicy="no-referrer" alt="">` : ''}<span>${ACC.user.name.replace(/</g, '&lt;')}</span></div>` : ''}${btn(ACC.user ? '로그아웃' : 'Google 로그인', ACC.user ? 'accout' : 'account')}${btn('스킨 바꾸기', 'skins')}</div><div class="foot l">네모 대륙 1.17 · Caves &amp; Cliffs</div><div class="foot r">Mojang 비공식 팬 프로젝트</div>`;
  } else if (name === 'worlds') {
    h = `<h2>세계 선택</h2><div class="wlist" id="wlist"><p class="muted">불러오는 중...</p></div><div class="btngrid">${btn('선택한 세계 플레이', 'playSel')}${btn('새로운 세계 만들기', 'create')}${btn('삭제', 'delSel')}${btn('취소', 'title')}</div>`;
    listWorlds().then(ws => {
      ws = (ws || []).sort((a, b) => b.last - a.last); UI.worldList = ws; UI.selWorld = ws[0] ? ws[0].id : null;
      const el = $('wlist'); if (!el) return;
      el.innerHTML = ws.length ? ws.map(w => `<div class="wi ${w.id === UI.selWorld ? 'on' : ''}" data-w="${w.id}"><b>${esc(w.name)}</b><span>${new Date(w.last).toLocaleString()} · ${MODE_NAME[w.mode] || w.mode}${w.hardcore ? ' · 하드코어' : ''}</span></div>`).join('') : '<p class="muted">아직 세계가 없어요. 새로운 세계를 만들어 보세요!</p>';
    });
  } else if (name === 'create') {
    UI.cw = UI.cw || { name: '새로운 세계', mode: 'survival', diff: 2, seed: '', cheats: true, exp: false };
    const c = UI.cw;
    h = `<h2>새로운 세계 만들기</h2><div class="form"><label>세계 이름<input id="wname" value="${esc(c.name)}" maxlength="32"></label>${btn('게임 모드: ' + MODE_NAME[c.mode], 'cmode')}<p class="muted">${MODE_DESC[c.mode]}</p>${btn('난이도: ' + DIFF_NAME[c.diff], 'cdiff', c.mode === 'hardcore' ? 'dis' : '')}${btn('명령어 허용: ' + (c.cheats ? '켜짐' : '꺼짐'), 'ccheat')}${btn('실험 기능(동굴과 절벽): ' + (c.exp ? '켜짐' : '꺼짐'), 'cexp')}<p class="muted">켜면 무성한 동굴이 생성됩니다 (1.17 실험용 데이터 팩)</p><label>세계 생성 시드<input id="wseed" value="${esc(c.seed)}" placeholder="비워 두면 무작위"></label></div><div class="btngrid">${btn('새로운 세계 만들기', 'doCreate')}${btn('취소', 'worlds')}</div>`;
  } else if (name === 'account') {
    h = `<h2>Google 로그인</h2><p class="muted">로그인하면 이름이 Google 계정 이름이 되고, 로그인을 확인하는 서버에서는 인벤토리와 위치가 계정에 저장되어 다른 사람이 같은 이름으로 들어올 수 없습니다.</p><div id="gsiBtn"></div><p class="muted" id="accStatus"></p><div class="btncol">${btn('돌아가기', 'title')}</div>`;
  } else if (name === 'skins') {
    const cur = { steve: '스티브', alex: '알렉스', custom: '내 스킨' }[OPT.skin] || '스티브';
    h = `<h2>스킨 바꾸기</h2><div class="skinRow"><div class="titleDoll"></div><div class="btncol">${btn((OPT.skin === 'steve' ? '▶ ' : '') + '스티브', 'skinset_steve')}${btn((OPT.skin === 'alex' ? '▶ ' : '') + '알렉스', 'skinset_alex')}${localStorage.getItem(SKIN_KEY) ? btn((OPT.skin === 'custom' ? '▶ ' : '') + '내 스킨', 'skinset_custom') : ''}${btn('스킨 파일 고르기 (PNG)...', 'skinfile')}<div class="form"><input id="skinNick" placeholder="자바 에디션 닉네임으로 가져오기" maxlength="16" autocomplete="off"></div>${btn('닉네임 스킨 가져오기', 'skinnick')}${btn('완료', 'title')}</div></div><p class="muted">지금 스킨: ${cur} · 멀티플레이에서 다른 플레이어에게도 이 스킨이 보입니다</p>`;
  } else if (name === 'options') {
    const sl = (k, label, min, max, step, fmt) => `<label class="slider"><span>${label}: <b id="v_${k}">${fmt(OPT[k])}</b></span><input type="range" data-opt="${k}" min="${min}" max="${max}" step="${step}" value="${OPT[k]}"></label>`;
    const tg = (k, label, on = '켜짐', off = '꺼짐') => btn(`${label}: ${OPT[k] ? on : off}`, 'tog_' + k);
    h = `<h2>설정</h2><div class="optgrid">${sl('fov', '시야', 30, 110, 1, v => v == 70 ? '보통' : v == 110 ? 'Quake 프로' : v)}${sl('rd', '렌더 거리', 2, 12, 1, v => v + ' 청크')}${sl('sens', '마우스 감도', 10, 200, 5, v => v + '%')}${sl('gamma', '밝기', 0, 100, 5, v => v == 0 ? '어둡게' : v == 100 ? '밝게' : v + '%')}${sl('vol', '음량', 0, 100, 5, v => v + '%')}${sl('gui', 'GUI 크기', 0, 4, 1, v => v == 0 ? '자동' : v)}${tg('fancy', '그래픽', '화려하게', '빠르게')}${tg('smooth', '부드러운 조명')}${tg('clouds', '구름')}${tg('bob', '화면 흔들림')}${tg('dynLight', '손에 든 광원 빛')}${tg('autoRes', '자동 해상도 (끊김 방지)')}${tg('coords', '좌표 표시')}${tg('showFps', 'FPS 표시')}${tg('invertY', '마우스 반전')}${tg('fullscreen', '전체 화면 + 키 잠금')}${tg('toggleSprint', '달리기', '전환', '누르기')}${tg('toggleSneak', '웅크리기', '전환', '누르기')}</div><p class="muted">크롬북 권장: 렌더 거리 4~6, 그래픽 빠르게, 자동 해상도 켜짐 · Ctrl로 달릴 때 Ctrl+W로 탭이 닫히지 않게 하려면 \"전체 화면 + 키 잠금\"을 켜세요</p><div class="btncol">${btn('스킨: ' + ({ steve: '스티브', alex: '알렉스', custom: '내 스킨' }[OPT.skin] || '스티브'), 'skin')}${btn('스킨 파일 고르기...', 'skinfile')}${btn('주로 쓰는 손: ' + (OPT.mainHand === 'left' ? '왼손' : '오른손'), 'mainhand')}${btn('리소스 팩...', 'packs')}${btn('완료', 'optDone')}</div>`;
  } else if (name === 'packs') {
    h = `<h2>리소스 팩</h2>${UPACK.stale ? '<p style="color:#ff5">이 팩은 예전 버전으로 불러온 것입니다. 같은 파일을 다시 불러오면 HUD·하늘·파티클·그림·엔드 시티 등이 원작 그대로 적용됩니다.</p>' : ''}<p>지금 쓰는 텍스처: <b>${UPACK.name ? esc(UPACK.name) + ' (+ 없는 것은 기본 팩)' : '기본 (Pixel Perfection CE)'}</b></p><p>구조물: <b>${UPACK.structs ? 'client.jar의 원작 구조물 조각·전리품 표' : '내장 근사 구조물'}</b></p><p class="muted">내 기기에 있는 리소스 팩 .zip 이나 마인크래프트 client.jar 를 고르면 그 텍스처로 바꿉니다. client.jar 를 고르면 마을·전초기지·보루 잔해·이글루·난파선·해저 유적·폐허가 된 포탈·화석도 원작 구조물 파일로 만들어집니다(새로 생성되는 청크부터). 파일은 이 브라우저 안에서만 변환·저장되고 어디에도 올라가지 않습니다.</p><p id="packStatus" class="muted"></p><div class="btncol">${btn('파일에서 불러오기 (.zip / .jar)', 'packLoad')}${UPACK.name ? btn('기본 텍스처로 되돌리기', 'packReset') : ''}${btn('뒤로', 'options')}</div>`;
  } else if (name === 'controls') {
    const K = t => t.split('+').map(k => `<kbd>${k}</kbd>`).join('+');
    const rows = [['이동', 'W A S D', 'W A S D'], ['달리기', 'Ctrl · W 두 번', 'Ctrl · W 두 번 · R'], ['점프 · 수영 · (크리에이티브) 두 번 눌러 비행', 'Space', 'Space'], ['웅크리기 · 비행 중 하강', 'Shift', 'Shift'],
      ['캐기 · 공격', '좌클릭', '터치패드 누르기'], ['놓기 · 사용', '우클릭', '두 손가락 탭 · Alt+누르기'], ['블록 고르기', '휠 클릭', 'G'], ['단축바', '1-9 · 휠', '1-9 · 두 손가락 스크롤'],
      ['인벤토리', 'E', 'E'], ['버리기 (묶음)', 'Q (Ctrl+Q)', 'Q (Ctrl+Q)'], ['보조 손과 바꾸기', 'F', 'F'], ['채팅 · 명령어', 'T · /', 'T · /'],
      ['HUD 숨기기', 'F1', '← (뒤로) · H'], ['스크린샷', 'F2', '→ (앞으로) · 화면 캡처 키'], ['디버그 화면 · F3 조합', 'F3', '↻ (새로고침) · `'], ['시점 전환', 'F5', '창 보기 키 · V'], ['전체 화면', 'F11', '전체 화면 키'],
      ['일시 정지', 'Esc', 'Esc']];
    h = `<h2>조작법</h2><table class="keytab"><tr><th>동작</th><th>PC 키보드</th><th>크롬북 키보드</th></tr>${rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b.split(' · ').map(K).join(' · ')}</td><td>${c.split(' · ').map(K).join(' · ')}</td></tr>`).join('')}</table>
      <ul class="keys"><li>크롬북 윗줄 키는 같은 자리의 PC F키로 동작합니다 (검색 키 + 윗줄 키, 또는 크롬북 설정의 "윗줄 키를 기능 키로 사용"으로 보내는 진짜 F키도 그대로 됩니다)</li>
      <li>F3 조합: F3(크롬북 ↻)을 누른 채로 A 청크 다시 불러오기 · B 히트박스 · C 위치 복사 · D 채팅 지우기 · G 청크 경계 · H 고급 툴팁 · N 관전 모드 전환 · P 포커스 잃으면 일시 정지 · Q 도움말</li>
      <li>크롬북에서 <kbd>Ctrl</kbd>+<kbd>W</kbd>는 탭을 닫습니다. Ctrl로 달리려면 설정에서 <b>전체 화면 + 키 잠금</b>을 켜세요 (켜지 않으면 <kbd>R</kbd>이나 <kbd>W</kbd> 두 번으로 달리기). 실수로 탭을 닫으려 하면 나가기 전에 확인 창이 뜹니다</li>
      <li>인벤토리: Shift+클릭 빠른 이동 · 우클릭 절반 · 드래그 나누기 · 숫자키 교체 · 더블클릭 모으기 · F 보조 손</li></ul><div class="btncol">${btn('완료', UI.paused ? 'pause' : 'title')}</div>`;
  } else if (name === 'stats') { h = statsHtml();
  } else if (name === 'pause') {
    h = `<h2>게임 메뉴</h2><div class="btncol">${btn('게임으로 돌아가기', 'resume')}${btn(MP.on ? '멀티플레이 (' + (MP.peers.size + 1) + '명' + (MP.roomCode ? ' · 방 ' + MP.roomCode : '') + ')' : '멀티플레이 열기', 'mp_host')}${btn('설정...', 'options')}${btn('조작법', 'controls')}${btn('저장하고 타이틀로', 'quit')}</div>`;
  } else if (name === 'death') {
    h = `<div class="death"><h1>${PL.hardcore ? '게임 오버!' : '사망했습니다!'}</h1><p>${esc(data || '')}</p><p>점수: <b>${PL.xpTotal}</b></p><div class="btncol">${PL.hardcore ? btn('관전하기', 'spectate') : btn('리스폰', 'respawn')}${btn('타이틀 화면', 'quit')}</div></div>`;
  } else if (name === 'advworlds') { ADVUI.view = null; h = advWorldsHtml();
  } else if (name === 'advview') { h = `<div class="advmenu">${advScreenHtml()}</div><div class="btncol">${btn('완료', 'advworlds')}</div>`;
  } else if (name.startsWith('mp_')) {
    h = mpMenu(name, data);
  } else if (name === 'loading') {
    h = `<div class="loading"><h2>${data || '지형 생성 중'}</h2><div class="bar"><i id="loadbar"></i></div><p class="muted" id="loadtxt"></p></div>`;
  }
  m.innerHTML = h;
  m.querySelectorAll('input[type=range]').forEach(r => r.oninput = () => { const k = r.dataset.opt; OPT[k] = +r.value; const fmt = { fov: v => v == 70 ? '보통' : v == 110 ? 'Quake 프로' : v, rd: v => v + ' 청크', sens: v => v + '%', gamma: v => v == 0 ? '어둡게' : v == 100 ? '밝게' : v + '%', vol: v => v + '%', gui: v => v == 0 ? '자동' : v }[k]; $('v_' + k).textContent = fmt(+r.value); saveOpt(); });
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const MODE_NAME = { survival: '서바이벌', creative: '크리에이티브', hardcore: '하드코어', spectator: '관전자', adventure: '모험' };
const MODE_DESC = { survival: '자원을 모으고, 제작하고, 레벨을 올리며 체력과 허기를 관리하세요.', creative: '무한한 자원, 자유로운 비행, 즉시 파괴. 마음껏 건축하세요.', hardcore: '서바이벌과 같지만 가장 어려운 난이도로 고정되며, 목숨은 하나뿐입니다.', spectator: '' };
const DIFF_NAME = ['평화로움', '쉬움', '보통', '어려움'];
$('menu').addEventListener('click', async e => {
  const wi = e.target.closest('.wi'); if (wi) { UI.selWorld = wi.dataset.w; document.querySelectorAll('.wi').forEach(x => x.classList.toggle('on', x === wi)); if (e.detail === 2) startWorld(UI.selWorld); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  audioInit(); play('click');
  const a = b.dataset.act;
  if (a === 'worlds' || a === 'title' || a === 'options' || a === 'create' || a === 'controls' || a === 'pause') { if (a === 'options') UI.optBack = W.active && (UI.menu === 'pause' || UI.paused) ? 'pause' : 'title'; showMenu(a); }
  else if (a.startsWith('mp')) mpAction(a, b);
  else if (a === 'packs') showMenu('packs');
  else if (a === 'stats') showMenu('stats');
  else if (a.startsWith('stat_')) { STATUI.tab = a.slice(5); showMenu('stats'); }
  else if (a === 'advs') showMenu('advworlds');
  else if (a === 'advworlds') showMenu('advworlds');
  else if (a.startsWith('advw_')) { const w = (UI.advWorlds || []).find(q => String(q.id) === a.slice(5)); if (w) { ADVUI.view = w; ADVUI.tab = 'story'; ADVUI.px = ADVUI.py = 0; showMenu('advview'); } }
  else if (a === 'skin') { const L = ['steve', 'alex']; if (localStorage.getItem(SKIN_KEY)) L.push('custom'); OPT.skin = L[(L.indexOf(OPT.skin) + 1) % L.length]; saveOpt(); const go = () => { rebuildPlayer(); showMenu('options'); }; if (OPT.skin === 'custom') loadCustomSkin(go); else go(); }
  else if (a === 'skinfile') pickSkinFile();
  else if (a === 'skins') showMenu('skins');
  else if (a === 'account') { showMenu('account'); accShowButton(); }
  else if (a === 'accout') accLogout();
  else if (a.startsWith('skinset_')) { OPT.skin = a.slice(8); saveOpt(); const go = () => { rebuildPlayer(); showMenu('skins'); }; if (OPT.skin === 'custom') loadCustomSkin(go); else go(); }
  else if (a === 'skinnick') { const n = ($('skinNick') && $('skinNick').value || '').trim(); if (!/^\w{3,16}$/.test(n)) UI.flash('닉네임은 영문·숫자·_ 3~16자예요'); else skinFromUrl('https://mc-heads.net/skin/' + encodeURIComponent(n), n); }
  else if (a === 'mainhand') { OPT.mainHand = OPT.mainHand === 'left' ? 'right' : 'left'; saveOpt(); R.setHandSkin(); showMenu('options'); }
  else if (a === 'packLoad') pickPackFile();
  else if (a === 'packReset') resetPack();
  else if (a === 'optDone') showMenu(W.active && UI.optBack === 'pause' ? 'pause' : 'title'); // from the title screen, back to it (no world to return to)
  else if (a.startsWith('tog_')) { const k = a.slice(4); OPT[k] = !OPT[k]; saveOpt(); showMenu('options'); if (k === 'fancy' || k === 'smooth') for (const c of W.chunks.values()) c.dirty = true; }
  else if (a === 'cmode') { const order = ['survival', 'creative', 'hardcore']; UI.cw.name = $('wname').value; UI.cw.seed = $('wseed').value; UI.cw.mode = order[(order.indexOf(UI.cw.mode) + 1) % 3]; showMenu('create'); }
  else if (a === 'cdiff') { if (UI.cw.mode === 'hardcore') return; UI.cw.name = $('wname').value; UI.cw.seed = $('wseed').value; UI.cw.diff = (UI.cw.diff + 1) % 4; showMenu('create'); }
  else if (a === 'ccheat') { UI.cw.name = $('wname').value; UI.cw.seed = $('wseed').value; UI.cw.cheats = !UI.cw.cheats; showMenu('create'); }
  else if (a === 'cexp') { UI.cw.name = $('wname').value; UI.cw.seed = $('wseed').value; UI.cw.exp = !UI.cw.exp; showMenu('create'); }
  else if (a === 'doCreate') { const c = UI.cw; c.name = $('wname').value || '새로운 세계'; c.seed = $('wseed').value; await createWorld(c); UI.cw = null; }
  else if (a === 'playSel') { if (UI.selWorld) startWorld(UI.selWorld); }
  else if (a === 'delSel') { if (!UI.selWorld) return; const w = UI.worldList.find(x => x.id === UI.selWorld); if (confirm(`'${w.name}' 세계를 삭제할까요? 되돌릴 수 없습니다.`)) { await deleteWorld(UI.selWorld); showMenu('worlds'); } }
  else if (a === 'resume') resumeGame();
  else if (a === 'quit') quitToTitle();
  else if (a === 'respawn') { respawn(); showMenu(null); resumeGame(); }
  else if (a === 'spectate') { PL.mode = 'spectator'; respawn(); showMenu(null); resumeGame(); }
});
UI.showDeath = msg => { if (gr('showDeathMessages')) chatMsg(msg, '#ffffff'); if (gr('doImmediateRespawn') && !PL.hardcore) { respawn(); return; } UI.paused = true; showMenu('death', msg); if (PL.hardcore) saveWorldMeta(); };

// ---------- chat & commands ----------
function openChat(prefix = '') { UI.chatOpen = true; releaseLock(); clearInput(); const c = $('chat'); c.hidden = false; const i = $('chatIn'); i.value = prefix; setTimeout(() => i.focus(), 0); renderChat(); }
function closeChat() { UI.chatOpen = false; $('chat').hidden = true; $('chatIn').blur(); renderChat(); grabLock(); }
$('chatIn').addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape') { closeChat(); e.preventDefault(); }
  if (e.key === 'Enter') { const v = $('chatIn').value.trim(); closeChat(); if (v) { if (v[0] === '/') runCommand(v.slice(1)); else { chatMsg('<' + (MP.on ? MP.name : '플레이어') + '> ' + v); if (MP.on) mpSend({ t: 'chat', name: MP.name, text: v }); } } }
});
function runCommand(cmd) {
  let [c, ...a] = cmd.split(/\s+/);
  const isTarget = v => v && (v[0] === '@' || v === '플레이어' || (typeof MP !== 'undefined' && v === MP.name));
  if ((c === 'give' || c === 'clear' || c === 'tp' || c === 'teleport') && isTarget(a[0]) && (c !== 'tp' && c !== 'teleport' || a.length >= 4)) a = a.slice(1); // Java's "<target>" first: this game has one player
  const err = t => chatMsg(t, '#ff5555'), ok = t => chatMsg(t, '#aaaaaa');
  if (!W.cheats && c !== 'help' && c !== 'seed') return err('이 세계에서는 명령어가 허용되지 않습니다');
  const num = (v, base) => v && v[0] === '~' ? base + (+(v.slice(1)) || 0) : +v;
  switch (c) {
    case 'help': ok('/gamemode · /time set|add|query · /weather · /give · /tp · /summon · /kill [@e[type=..]] · /seed · /difficulty · /xp <양>[L] · /spawnpoint · /setworldspawn · /clear · /gamerule <규칙> <값> · /effect give|clear · /enchant · /setblock · /fill · /locate <구조물> · /say · /me · /title · /list'); break;
    case 'gamemode': { const m = { survival: 'survival', s: 'survival', 0: 'survival', creative: 'creative', c: 'creative', 1: 'creative', spectator: 'spectator', sp: 'spectator', 3: 'spectator', adventure: 'adventure', a: 'adventure', 2: 'adventure' }[a[0]]; if (!m) return err('알 수 없는 게임 모드'); PL.mode = m; if (m !== 'creative' && m !== 'spectator') PL.flying = false; if (m === 'spectator') PL.flying = true; UI.hudDirty = true; ok('게임 모드를 ' + MODE_NAME[m] + '(으)로 변경했습니다'); break; }
    case 'time': { if (a[0] === 'query') { const q = a[1] === 'daytime' ? ((W.time % 24000) + 24000) % 24000 : a[1] === 'day' ? Math.floor(W.time / 24000) : W.tickN; ok('시간: ' + q); break; } const v = a[1]; const t = { day: 1000, noon: 6000, night: 13000, midnight: 18000, sunrise: 23000, sunset: 12000 }[v] ?? +v; if (isNaN(t)) return err('시간 값이 잘못되었습니다'); if (a[0] === 'add') W.time += t; else W.time = Math.floor(W.time / 24000) * 24000 + t; ok('시간을 ' + (((W.time % 24000) + 24000) % 24000) + '(으)로 설정했습니다'); break; }
    case 'weather': W.rainTarget = a[0] === 'rain' || a[0] === 'thunder' ? 1 : 0; W.thunderOn = a[0] === 'thunder'; W.rainTimer = W.thunderTimer = 6000 + Math.random() * 12000; ok(a[0] === 'thunder' ? '날씨를 뇌우로 변경했습니다' : '날씨를 변경했습니다'); break;
    case 'give': { const k = (a[0] || '').replace('minecraft:', ''); const id = IID[k] != null ? IID[k] : ITEMS.findIndex(d => d && d.name === a[0]); if (id == null || id < 0 || !ITEMS[id]) return err('알 수 없는 아이템: ' + a[0]); const n = Math.max(1, Math.min(6400, +a[1] || 1)); let left = n; while (left > 0) { const m = Math.min(left, maxStack(id)); INV.giveOrDrop({ id, n: m }); left -= m; } ok(`[${itemName(id)}] ${n}개를 주었습니다`); break; }
    case 'teleport': case 'tp': { if (a[0] && a[0].startsWith('@')) a.shift(); const x = num(a[0], PL.x), y = num(a[1], PL.y), z = num(a[2], PL.z); if ([x, y, z].some(isNaN)) return err('좌표가 잘못되었습니다'); PL.x = PL.px = x; PL.y = PL.py = y; PL.z = PL.pz = z; PL.vx = PL.vy = PL.vz = 0; PL.fallDist = 0; ok(`${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}(으)로 순간이동했습니다`); break; }
    case 'summon': { const t = (a[0] || '').replace('minecraft:', ''); if (!MOBDEF[t] || t === 'player') return err('알 수 없는 몹: ' + a[0]); const [dx, , dz] = lookDir(); spawnMob(t, PL.x + dx * 3, PL.y, PL.z + dz * 3); ok(t + ' 소환'); break; }
    case 'locate': { // nearest structure, like Java's /locate
      const k = (a[0] || '').replace('minecraft:', ''); let best = null;
      const near = o => { if (!o) return; const d = Math.hypot(o.x - PL.x, o.z - PL.z); if (!best || d < best[2]) best = [o.x, o.z, d]; };
      const G = S.makeGen(W.seed), scan = (reg, f, n = 6) => { const rx = Math.floor((PL.x >> 4) / reg), rz = Math.floor((PL.z >> 4) / reg); for (let i = rx - n; i <= rx + n; i++) for (let j = rz - n; j <= rz + n; j++) near(f(i, j)); };
      const T = (kind) => { const [reg] = S.TP_KIND[kind]; scan(reg, (i, j) => S.templeAt(W.seed, G, kind, i, j)); };
      const L = { // structure: [dimension, search]
        village: [0, () => scan(S.VREG, (i, j) => S.villageAt(W.seed, G, i, j))], stronghold: [0, () => S.strongholdsOf(W.seed).forEach(p => near({ x: p[0], z: p[2] }))],
        desert_pyramid: [0, () => T('pyramid')], jungle_pyramid: [0, () => T('jungle')], swamp_hut: [0, () => T('hut')], igloo: [0, () => T('igloo')],
        mansion: [0, () => scan(S.MREG, (i, j) => S.mansionAt(W.seed, G, i, j), 4)], monument: [0, () => scan(32, (i, j) => S.monumentAt(W.seed, G, i, j), 4)],
        shipwreck: [0, () => scan(S.OCREG, (i, j) => S.oceanSite(W.seed, G, 's', i, j))], ocean_ruin: [0, () => scan(20, (i, j) => S.oceanSite(W.seed, G, 'r', i, j))],
        pillager_outpost: [0, () => scan(S.OREG, (i, j) => S.outpostAt(W.seed, G, i, j))], ruined_portal: [W.dim === -1 ? -1 : 0, () => scan(S.RPREG, (i, j) => S.ruinedPortalAt(W.seed, G, i, j, W.dim === -1))],
        buried_treasure: [0, () => { const cx = PL.x >> 4, cz = PL.z >> 4; for (let i = cx - 40; i <= cx + 40; i++) for (let j = cz - 40; j <= cz + 40; j++) { const t = S.treasureAt(W.seed, G, i, j); if (t) near({ x: t[0], z: t[2] }); } }],
        fortress: [-1, () => scan(S.FREG, (i, j) => S.fortressAt(W.seed, i, j), 4)], bastion_remnant: [-1, () => scan(S.BREG, (i, j) => S.bastionAt(W.seed, i, j), 4)],
        end_city: [1, () => { const nA = S.makeNoise(W.seed + 201), nB = S.makeNoise(W.seed + 202); scan(20, (i, j) => S.endCityAt(W.seed, i, j, nA, nB), 5); }],
      };
      L.nether_fortress = L.fortress; L.woodland_mansion = L.mansion; L.ocean_monument = L.monument; L.temple = L.desert_pyramid;
      const e = L[k]; if (!e) return err('구조물: ' + Object.keys(L).join(', '));
      if (e[0] !== W.dim) return err('이 차원에는 ' + k + '이(가) 없습니다');
      e[1]();
      if (!best) return err('가까운 구조물을 찾지 못했습니다');
      ok(`가장 가까운 ${k}: ${best[0]}, ~, ${best[1]} (${Math.round(best[2])}블록 거리)`); break;
    }
    case 'gamerule': {
      if (!a[0]) return ok(Object.keys(GAMERULES).map(k => k + '=' + gr(k)).join(' · '));
      if (a[1] == null) return ok(a[0] + ' = ' + gr(a[0]));
      if (!setGamerule(a[0], a[1])) return err('알 수 없는 규칙이나 값: ' + a.join(' '));
      ok(`게임 규칙 ${a[0]}이(가) ${gr(a[0])}(으)로 설정되었습니다`); break;
    }
    case 'effect': { // /effect give <대상> <효과> [초] [증폭] [hideParticles] · /effect clear [대상] [효과]
      const sub = a[0]; let rest = a.slice(1); if (rest[0] && rest[0].startsWith('@')) rest = rest.slice(1);
      if (sub === 'clear') { if (rest[0]) { const k = rest[0].replace('minecraft:', ''); if (PL.eff) delete PL.eff[k]; } else clearEffects(PL); renderEffects(); ok('효과를 없앴습니다'); break; }
      if (sub !== 'give') return err('/effect give <대상> <효과> [초] [증폭] · /effect clear');
      const k = (rest[0] || '').replace('minecraft:', ''); if (!EFF[k]) return err('알 수 없는 효과: ' + rest[0]);
      const sec = rest[1] != null ? Math.max(0, +rest[1]) : 30, amp = Math.max(0, Math.min(255, +rest[2] || 0));
      if (sec === 0) { if (PL.eff) delete PL.eff[k]; } else addEffect(PL, k, Math.round(sec * 20), amp);
      renderEffects(); ok(`${EFF[k][0]} ${amp + 1} 효과를 ${sec}초 동안 주었습니다`); break;
    }
    case 'enchant': { // /enchant <대상> <마법> [레벨]
      const r = a[0] && a[0].startsWith('@') ? a.slice(1) : a, k = (r[0] || '').replace('minecraft:', ''), h = PL.held();
      if (!ENCH[k]) return err('알 수 없는 마법: ' + r[0]); if (!h) return err('손에 아이템을 드세요');
      const lv = Math.max(1, Math.min(ENCH[k][1], +r[1] || 1)); h.e = { ...(h.e || {}), [k]: lv }; UI.hudDirty = true; ok(`${itemName(h.id)}에 ${ENCH[k][0]} ${lv} 마법을 부여했습니다`); break;
    }
    case 'setblock': case 'fill': {
      const n = c === 'fill' ? 6 : 3, p = a.slice(0, n).map((v, i) => Math.floor(num(v, [PL.x, PL.y, PL.z][i % 3]))); if (p.some(isNaN)) return err('좌표가 잘못되었습니다');
      const key = (a[n] || '').replace('minecraft:', ''), vk = typeof VKEY !== 'undefined' && VKEY[key]; const id = vk ? vk[0] : BID[key] != null ? BID[key] : key === 'air' ? 0 : null, m = vk ? vk[1] : 0;
      if (id == null) return err('알 수 없는 블록: ' + a[n]);
      const [x0, y0, z0, x1 = x0, y1 = y0, z1 = z0] = p; const vol = (Math.abs(x1 - x0) + 1) * (Math.abs(y1 - y0) + 1) * (Math.abs(z1 - z0) + 1); if (vol > 32768) return err('영역이 너무 큽니다 (최대 32768 블록)');
      let cnt = 0; for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let y = Math.max(MINY, Math.min(y0, y1)); y <= Math.min(MAXY - 1, Math.max(y0, y1)); y++) for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) { if (a[n + 1] === 'keep' && getBlock(x, y, z)) continue; setBlock(x, y, z, id, m); cnt++; }
      ok(c === 'fill' ? cnt + '개 블록을 채웠습니다' : '블록을 바꿨습니다'); break;
    }
    case 'say': case 'me': chatMsg((c === 'me' ? '* 플레이어 ' : '[플레이어] ') + a.join(' '), '#ffffff'); break;
    case 'title': { const t = a[0] && a[0].startsWith('@') ? a.slice(1) : a; if (t[0] === 'title' || t[0] === 'subtitle' || t[0] === 'actionbar') UI.flash(t.slice(1).join(' ').replace(/^"|"$/g, '')); break; }
    case 'setworldspawn': W.meta.worldSpawn = [Math.floor(PL.x), Math.floor(PL.y), Math.floor(PL.z)]; ok('세계 스폰 지점을 설정했습니다'); break;
    case 'defaultgamemode': W.meta.mode = { survival: 'survival', creative: 'creative', adventure: 'adventure', spectator: 'spectator' }[a[0]] || W.meta.mode; ok('기본 게임 모드: ' + W.meta.mode); break;
    case 'list': ok('접속한 플레이어 1명: 플레이어'); break;
    case 'kill': { const t = a[0] || '@s'; if (t.startsWith('@e')) { const m = t.match(/type=(?:minecraft:)?([a-z_]+)/); let n = 0; for (const e of [...ENT]) if (e.kind === 'mob' && !e.dead && (!m || e.type === m[1])) { removeEnt(e); n++; } ok(n + '마리를 없앴습니다'); } else hurtPlayer(1000, 'kill'); break; }
    case 'seed': ok('시드: ' + W.seed); break;
    case 'difficulty': { const d = { peaceful: 0, easy: 1, normal: 2, hard: 3 }[a[0]] ?? +a[0]; if (!(d >= 0 && d <= 3)) return err('0-3 사이로 입력하세요'); PL.difficulty = d; if (d === 0) for (const e of ENT) if (e.kind === 'mob' && e.def.hostile) removeEnt(e); ok('난이도: ' + DIFF_NAME[d]); break; }
    case 'xp': case 'experience': { const r = a[0] === 'add' || a[0] === 'give' ? a.slice(1).filter(v => !v.startsWith('@')) : a; const v = Math.max(0, parseInt(r[0]) || 0); if (/l$/i.test(r[0] || '') || r[1] === 'levels') { PL.level += v; UI.hudDirty = true; ok('레벨 ' + v + ' 추가'); } else { addXP(v); ok('경험치 ' + v + ' 추가'); } break; }
    case 'spawnpoint': PL.spawn = [Math.floor(PL.x), Math.floor(PL.y), Math.floor(PL.z)]; ok('스폰 지점을 설정했습니다'); break;
    case 'clear': INV.slots.fill(null); INV.armor.fill(null); UI.hudDirty = true; ok('인벤토리를 비웠습니다'); break;
    case 'keepinventory': W.keepInv = !W.keepInv; ok('인벤토리 보존: ' + (W.keepInv ? '켜짐' : '꺼짐')); break;
    default: err('알 수 없는 명령어입니다. /help 를 입력하세요');
  }
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
$('screen').addEventListener('click', e => { const sc = e.target.closest('[data-sc]'); if (sc && UI.screen === 'stonecutter') { GUI.ctx.sel = +sc.dataset.sc; play('click', { vol: 0.3 }); UI.renderScreen(); } });
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
  play('levelup', { vol: 0.5 }); UI.advance('enchant'); stat('enchant_item'); UI.hudDirty = true; UI.renderScreen();
});
