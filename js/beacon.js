// Beacons (Java Edition): a pyramid of iron/gold/emerald/diamond/netherite blocks (1-4 levels) under a beacon that
// sees the sky powers a beam; pay an ingot or gem to pick a primary effect (and at 4 levels a secondary one or level II).
const BEACONS = trackBlocks(BID.beacon);
const BEACON_BASE = new Set([BID.iron_block, BID.gold_block, BID.emerald_block, BID.diamond_block, BID.netherite_block]);
const BEACON_PAY = () => new Set([IID.iron_ingot, IID.gold_ingot, IID.emerald, IID.diamond, IID.netherite_ingot]);
const BEACON_TIERS = [['speed', 'haste'], ['resistance', 'jump_boost'], ['strength'], ['regeneration']]; // effects unlocked per level
function beaconLevels(x, y, z) {
  let lv = 0;
  for (let k = 1; k <= 4; k++) { for (let dx = -k; dx <= k; dx++) for (let dz = -k; dz <= k; dz++) if (!BEACON_BASE.has(getBlock(x + dx, y - k, z + dz))) return lv; lv = k; }
  return lv;
}
// the beam passes through glass and other see-through blocks; stained glass tints it
function beaconBeam(x, y, z) {
  let col = [1, 1, 1], tinted = false;
  for (let by = y + 1; by < CH; by++) {
    const b = getBlock(x, by, z); if (!b) continue;
    if (b === BID.stained_glass || b === BID.stained_glass_pane) { const c = DYE_RGB[getMeta(x, by, z) & 15]; col = tinted ? col.map((v, i) => (v + c[i]) / 2) : c; tinted = true; continue; }
    if (OPQ[b] && b !== BID.glass) return null;
  }
  return col;
}
const DYE_RGB = [[0.98, 1, 1], [0.98, 0.5, 0.11], [0.78, 0.31, 0.74], [0.23, 0.7, 0.85], [1, 0.85, 0.24], [0.5, 0.78, 0.12], [0.95, 0.55, 0.67], [0.28, 0.31, 0.32], [0.62, 0.62, 0.59], [0.09, 0.61, 0.61], [0.54, 0.2, 0.72], [0.24, 0.27, 0.67], [0.51, 0.33, 0.2], [0.37, 0.49, 0.09], [0.69, 0.18, 0.15], [0.11, 0.11, 0.13]];
const beamMeshes = new Map(), beamGeo = new THREE.BoxGeometry(0.4, 256, 0.4); beamGeo.translate(0, 128, 0);
function beaconTick() {
  for (const [k, m] of beamMeshes) if (!BEACONS.has(k)) { scene.remove(m); m.material.dispose(); beamMeshes.delete(k); }
  for (const k of BEACONS) {
    const [x, y, z] = k.split(',').map(Number), t = getTile(x, y, z) || {};
    const lv = beaconLevels(x, y, z), col = lv ? beaconBeam(x, y, z) : null;
    const was = t.levels || 0; t.levels = col ? lv : 0;
    // ConstructBeaconTrigger: when the beacon lights up or gains a level, for players within 10 blocks around it and 5 up / 9 down
    if (t.levels > was && Math.abs(PL.x - (x + .5)) <= 10.5 && Math.abs(PL.z - (z + .5)) <= 10.5 && PL.y >= y - 9 && PL.y <= y + 6) { advGrant('nether/create_beacon'); if (t.levels >= 4) advGrant('nether/create_full_beacon'); }
    let m = beamMeshes.get(k);
    if (col && !m) { m = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...col), transparent: true, opacity: 0.55, depthWrite: false, fog: false })); m.position.set(x + .5, y + 1, z + .5); scene.add(m); beamMeshes.set(k, m); }
    else if (!col && m) { scene.remove(m); m.material.dispose(); beamMeshes.delete(k); }
    else if (m) m.material.color.setRGB(...col);
    // every 4 seconds: effects for (9 + 2 * levels) seconds within 10 + 10 * levels blocks
    if (!col || !t.primary || W.tickN % 80) continue;
    const range = 10 + lv * 10, dur = (9 + lv * 2) * 20;
    if (Math.abs(PL.x - x - .5) > range || Math.abs(PL.z - z - .5) > range || PL.y < y - range || PL.dead) continue;
    const two = lv >= 4 && t.secondary === t.primary;
    addEffect(PL, t.primary, dur, two ? 1 : 0);
    if (lv >= 4 && t.secondary && t.secondary !== t.primary) addEffect(PL, t.secondary, dur, 0);
  }
}
// screen
function beaconAvailable(lv, k) { return BEACON_TIERS.slice(0, Math.min(3, lv)).some(tier => tier.includes(k)); }
function beaconPick(slot, k) {
  const c = GUI.ctx, t = c.tile, lv = t.levels || 0;
  if (slot === 'primary' ? !beaconAvailable(lv, k) : !(lv >= 4 && (k === 'regeneration' || k === c.pick.primary))) return;
  c.pick[slot] = k; UI.renderScreen();
}
function beaconConfirm() {
  const c = GUI.ctx, t = c.tile, pay = c.items[0];
  if (!pay || !c.pick.primary) return;
  t.primary = c.pick.primary; t.secondary = c.pick.secondary || null;
  pay.n--; if (!pay.n) c.items[0] = null; play('portal', { vol: 0.4 });
  const ch = chunkAt(c.x >> 4, c.z >> 4); if (ch) ch.modified = ch.edited = true;
  UI.renderScreen();
}
function beaconHtml() {
  const c = GUI.ctx, t = c.tile, lv = t.levels || 0;
  c.pick = c.pick || { primary: t.primary || null, secondary: t.secondary || null };
  const btn = (slot, k, ok) => `<button class="bpow ${c.pick[slot] === k ? 'on' : ''} ${ok ? '' : 'off'}" data-beacon="${slot}:${k}" title="${EFF[k][0]}"><i style="background:${EFF[k][1]}"></i>${EFF[k][0]}</button>`;
  const prim = BEACON_TIERS.slice(0, 3).map((tier, i) => `<div class="btier"><small>${i + 1}단계</small>${tier.map(k => btn('primary', k, lv > i)).join('')}</div>`).join('');
  const sec = `<div class="btier"><small>4단계</small>${btn('secondary', 'regeneration', lv >= 4)}${c.pick.primary ? btn('secondary', c.pick.primary, lv >= 4).replace(EFF[c.pick.primary][0] + '</button>', EFF[c.pick.primary][0] + ' II</button>') : ''}</div>`;
  return `<div class="panel"><div class="cap">신호기 (피라미드 ${lv}단계)</div><div class="row top beacon"><div class="col">${prim}</div><div class="col">${sec}<div class="row">${slotHtml(0)}<button class="bok" data-beacon="ok">확인</button></div><p class="tip">철 주괴·금 주괴·에메랄드·다이아몬드·네더라이트 주괴</p></div></div><div class="cap">인벤토리</div>${invRows(1)}</div>`;
}
