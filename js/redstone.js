// Redstone: wire networks, power sources, torches, repeaters, lamps, pistons, doors and TNT.
// Follows Java rules closely enough for ordinary circuits: strong/weak block power, wire
// decay of 1 per block, torch inversion with a 1-tick (2 game tick) delay, repeater delays
// of 1-4 ticks, and pistons that push up to 12 blocks.
const RS = { dirty: new Set(), sched: new Map(), busy: false, obs: new Set() };
const RSB = { wire: BID.redstone_wire, torch: BID.redstone_torch, torchOff: BID.unlit_redstone_torch, lamp: BID.redstone_lamp, lampOn: BID.lit_redstone_lamp,
  lever: BID.lever, button: BID.stone_button, plate: BID.stone_pressure_plate, rep: BID.repeater, piston: BID.piston, sticky: BID.sticky_piston, head: BID.piston_head, block: BID.redstone_block };
const rkey = (x, y, z) => x + ',' + y + ',' + z;
// the block a torch/lever/button hangs on
function torchAttach(x, y, z, m) { if (m >= 1 && m <= 4) { const d = DIRS[m - 1]; return [x + d[0], y, z + d[2]]; } return [x, y - 1, z]; }
function switchAttach(x, y, z, m) { const d = S.DIR6[m & 7]; return [x + d[0], y + d[1], z + d[2]]; }
const isConductor = b => OPQ[b] && SOLID[b] && b !== RSB.piston && b !== RSB.sticky && b !== BID.redstone_block && b !== BID.observer && b !== BID.target && b !== BID.daylight_detector;
// strong power a solid block receives from sources pointing into it
function strongPower(x, y, z) {
  for (let k = 0; k < 6; k++) {
    const [dx, dy, dz] = S.DIR6[k], nx = x + dx, ny = y + dy, nz = z + dz, b = getBlock(nx, ny, nz);
    if (b === RSB.lever || b === RSB.button) { const m = getMeta(nx, ny, nz); if (m & 8) { const a = switchAttach(nx, ny, nz, m); if (a[0] === x && a[1] === y && a[2] === z) return 15; } }
    else if (b === RSB.plate) { if (dy === 1) { const l = plateLevel(nx, ny, nz, getMeta(nx, ny, nz)); if (l) return l; } }
    else if (b === BID.trapped_chest) { if (dy === 1 && getMeta(nx, ny, nz) & 32) return 1; }
    else if (b === RSB.torch) { if (dy === -1) return 15; } // a torch strongly powers the block above it
    else if (b === RSB.rep) { const m = getMeta(nx, ny, nz); if ((m & 16) && dy === 0) { const d = DIRS[m & 3]; if (nx + d[0] === x && nz + d[2] === z) return 15; } }
    else if (b === BID.comparator) { const m = getMeta(nx, ny, nz); if (dy === 0) { const d = DIRS[m & 3]; if (nx + d[0] === x && nz + d[2] === z) return compOut(nx, ny, nz); } }
    else if (b === BID.observer) { const m = getMeta(nx, ny, nz); if (m & 8) { const d = S.DIR6[m & 7]; if (nx - d[0] === x && ny - d[1] === y && nz - d[2] === z) return 15; } }
    else if (b === BID.tripwire_hook_block) { const m = getMeta(nx, ny, nz); if (m & 8) { const d = DIRS[m & 3]; if (nx - d[0] === x && ny === y && nz - d[2] === z) return 15; } } // a tripped hook strongly powers its wall
    else if (b === BID.detector_rail) { if (dy === 1 && (getMeta(nx, ny, nz) & 8)) return 15; } // like a pressure plate
    else if (b === BID.sculk_sensor && dy === 1) { const m = getMeta(nx, ny, nz); if ((m & 3) === 1) return m >> 4; } // an active sensor strongly powers the block it sits on
    else if (b === BID.chain) { const m = getMeta(nx, ny, nz); if (S.isRod(b, m) && (m & 128)) { const d = S.DIR6[m & 7]; if (nx - d[0] === x && ny - d[1] === y && nz - d[2] === z) return 15; } } // a struck lightning rod strongly powers what it stands on
  }
  return 0;
}
// weak power from dust lying on or pointing into a solid block
function weakPower(x, y, z) {
  let p = 0;
  if (getBlock(x, y + 1, z) === RSB.wire) p = getMeta(x, y + 1, z) & 15;
  for (const d of DIRS) { if (getBlock(x + d[0], y, z + d[2]) === RSB.wire) { const l = getMeta(x + d[0], y, z + d[2]) & 15; if (l > p && wirePointsAt(x + d[0], y, z + d[2], x, z)) p = l; } }
  return p;
}
function wireConn(x, y, z) { // horizontal directions the dust visually connects to
  const c = [0, 0, 0, 0], above = OPQ[getBlock(x, y + 1, z)];
  DIRS.forEach(([dx, , dz], d) => {
    const n = getBlock(x + dx, y, z + dz), nd = BLOCKS[n];
    if (nd && nd.rs && nd.rs !== 'trip' && (nd.rs !== 'rail' || n === BID.detector_rail) && nd.rs !== 'lamp' && nd.rs !== 'piston' && nd.rs !== 'head' && nd.rs !== 'hopper' && nd.rs !== 'dispenser' && nd.rs !== 'dropper' && nd.rs !== 'note' && nd.rs !== 'observer' && ((n !== RSB.rep && n !== BID.comparator) || ((getMeta(x + dx, y, z + dz) & 3) & 1) === (d & 1))) c[d] = 1;
    else if (n === BID.redstone_block) c[d] = 1;
    else if (!OPQ[n] && getBlock(x + dx, y - 1, z + dz) === RSB.wire) c[d] = 1;
    else if (!above && getBlock(x + dx, y + 1, z + dz) === RSB.wire) c[d] = 1;
  });
  return c;
}
function wirePointsAt(wx, wy, wz, tx, tz) {
  const c = wireConn(wx, wy, wz), n = c[0] + c[1] + c[2] + c[3];
  const d = DIRS.findIndex(v => wx + v[0] === tx && wz + v[2] === tz); if (d < 0) return false;
  if (n === 0) return true; // a lone dot powers all four sides
  if (c[d]) return true;
  return n === 1 && c[(d + 2) & 3]; // a straight line powers what it points into
}
// power a block at (x,y,z) emits toward its neighbour at offset (dx,dy,dz); forWire excludes weak block power
function emitted(x, y, z, dx, dy, dz, forWire) {
  const b = getBlock(x, y, z); if (!b) return 0;
  const m = getMeta(x, y, z);
  switch (b) {
    case RSB.lever: case RSB.button: return m & 8 ? 15 : 0;
    case RSB.plate: return plateLevel(x, y, z, m);
    case BID.trapped_chest: return m & 32 ? 1 : 0;
    case BID.redstone_block: return 15;
    case RSB.torch: { const a = torchAttach(x, y, z, m); return a[0] === x + dx && a[1] === y + dy && a[2] === z + dz ? 0 : 15; }
    case RSB.rep: { if (!(m & 16) || dy) return 0; const d = DIRS[m & 3]; return d[0] === dx && d[2] === dz ? 15 : 0; }
    case BID.comparator: { if (dy) return 0; const d = DIRS[m & 3]; return d[0] === dx && d[2] === dz ? compOut(x, y, z) : 0; }
    case BID.observer: { if (!(m & 8)) return 0; const d = S.DIR6[m & 7]; return d[0] === -dx && d[1] === -dy && d[2] === -dz ? 15 : 0; }
    case BID.daylight_detector: case BID.target: return m & 15;
    case BID.chain: return S.isRod(b, m) && (m & 128) ? 15 : 0;
    case BID.sculk_sensor: return (m & 3) === 1 ? m >> 4 : 0;
    case BID.detector_rail: return m & 8 ? 15 : 0;
    case BID.tripwire_hook_block: return m & 8 ? 15 : 0;
    case BID.lectern: return m & 8 ? 15 : 0; // a page turn gives a short pulse
    case RSB.wire: if (forWire || dy === 1) return 0; if (dy === -1) return m & 15; return wirePointsAt(x, y, z, x + dx, z + dz) ? m & 15 : 0;
  }
  if (isConductor(b)) { const s = strongPower(x, y, z); return forWire ? s : Math.max(s, weakPower(x, y, z)); }
  return 0;
}
// power arriving at (x,y,z) from all sides (or from all sides except `skip`)
function powerAt(x, y, z, skip) {
  let p = 0;
  for (let k = 0; k < 6; k++) { if (k === skip) continue; const [dx, dy, dz] = S.DIR6[k]; const e = emitted(x + dx, y + dy, z + dz, -dx, -dy, -dz, false); if (e > p) { p = e; if (p >= 15) break; } }
  return p;
}
// ---------- dust networks ----------
function wireNeighbours(x, y, z, out) {
  const upOpen = !OPQ[getBlock(x, y + 1, z)];
  for (const [dx, , dz] of DIRS) {
    const nx = x + dx, nz = z + dz, n = getBlock(nx, y, nz);
    if (n === RSB.wire) out.push(nx, y, nz);
    else if (!OPQ[n]) { if (getBlock(nx, y - 1, nz) === RSB.wire) out.push(nx, y - 1, nz); }
    if (upOpen && OPQ[n] && getBlock(nx, y + 1, nz) === RSB.wire) out.push(nx, y + 1, nz);
  }
}
function updateNetwork(x, y, z, changed) {
  const seen = new Map(), list = [], q = [x, y, z], tmp = [];
  while (q.length && list.length < 3000) {
    const qz = q.pop(), qy = q.pop(), qx = q.pop(), k = rkey(qx, qy, qz);
    if (seen.has(k) || getBlock(qx, qy, qz) !== RSB.wire) continue;
    const node = { x: qx, y: qy, z: qz, lv: 0, nb: [] }; seen.set(k, node); list.push(node);
    tmp.length = 0; wireNeighbours(qx, qy, qz, tmp); for (let i = 0; i < tmp.length; i += 3) { q.push(tmp[i], tmp[i + 1], tmp[i + 2]); node.nb.push(rkey(tmp[i], tmp[i + 1], tmp[i + 2])); }
  }
  // sources: every non-dust neighbour's output into the dust
  const buckets = Array.from({ length: 16 }, () => []);
  for (const n of list) {
    let s = 0;
    for (let k = 0; k < 6 && s < 15; k++) { const [dx, dy, dz] = S.DIR6[k]; const b = getBlock(n.x + dx, n.y + dy, n.z + dz); if (b === RSB.wire) continue; s = Math.max(s, emitted(n.x + dx, n.y + dy, n.z + dz, -dx, -dy, -dz, true)); }
    n.lv = s; if (s) buckets[s].push(n);
  }
  for (let l = 15; l > 1; l--) for (const n of buckets[l]) { if (n.lv !== l) continue; for (const k of n.nb) { const o = seen.get(k); if (o && o.lv < l - 1) { o.lv = l - 1; buckets[l - 1].push(o); } } }
  for (const n of list) { const m = getMeta(n.x, n.y, n.z); if ((m & 15) !== n.lv) { setMeta(n.x, n.y, n.z, (m & ~15) | n.lv); changed.push(n.x, n.y, n.z); } }
  return seen;
}
// ---------- update queue ----------
function rsMark(x, y, z) { RS.dirty.add(rkey(x, y, z)); }
// a source changed: wake everything within two blocks (power travels through one solid block)
function rsNotify(x, y, z) {
  rsMark(x, y, z);
  for (const [dx, dy, dz] of S.DIR6) { rsMark(x + dx, y + dy, z + dz); for (const [ex, ey, ez] of S.DIR6) rsMark(x + dx + ex, y + dy + ey, z + dz + ez); }
}
function rsLater(x, y, z, delay) { const k = rkey(x, y, z), t = W.tickN + delay; const c = RS.sched.get(k); if (c == null || c > t) RS.sched.set(k, t); }
function rsTick() {
  if (RS.sched.size) for (const [k, t] of RS.sched) { if (t > W.tickN) continue; RS.sched.delete(k); const [x, y, z] = k.split(',').map(Number); if (isLoaded(x, z)) rsDelayed(x, y, z); }
  let guard = 0;
  while (RS.dirty.size && guard++ < 8) {
    const keys = [...RS.dirty]; RS.dirty.clear();
    const done = new Set();
    for (const k of keys) {
      if (done.has(k)) continue;
      const [x, y, z] = k.split(',').map(Number); if (!isLoaded(x, z) || y < MINY || y >= MAXY) continue;
      const b = getBlock(x, y, z);
      if (b === RSB.wire) { const ch = []; const net = updateNetwork(x, y, z, ch); for (const nk of net.keys()) done.add(nk); for (let i = 0; i < ch.length; i += 3) rsNotify(ch[i], ch[i + 1], ch[i + 2]); }
      else rsComponent(x, y, z, b);
    }
  }
}
// immediate checks: decide whether a component needs to change, and schedule it
function rsComponent(x, y, z, b) {
  const m = getMeta(x, y, z);
  if (b === BID.bell) { bellPower(x, y, z, m); return; }
  if (b === BID.powered_rail || b === BID.activator_rail) { railPower(x, y, z, b, m); return; }
  if (b === RSB.torch || b === RSB.torchOff) {
    const a = torchAttach(x, y, z, m), pw = isConductor(getBlock(a[0], a[1], a[2])) ? Math.max(strongPower(a[0], a[1], a[2]), weakPower(a[0], a[1], a[2])) : 0;
    if ((b === RSB.torch) === (pw > 0)) rsLater(x, y, z, 2);
  } else if (b === RSB.lamp || b === RSB.lampOn) {
    const p = powerAt(x, y, z) > 0;
    if (p && b === RSB.lamp) { setBlock(x, y, z, RSB.lampOn, 0, { noUpdate: true }); rsNotify(x, y, z); }
    else if (!p && b === RSB.lampOn) rsLater(x, y, z, 4);
  } else if (b === RSB.rep) {
    const d = DIRS[m & 3], inp = emitted(x - d[0], y, z - d[2], d[0], 0, d[2], false) > 0;
    if (inp !== !!(m & 16)) rsLater(x, y, z, (((m >> 2) & 3) + 1) * 2);
  } else if (b === RSB.piston || b === RSB.sticky) {
    const p = powerAt(x, y, z, m & 7) > 0 || powerAt(x, y + 1, z, 0) > 0; // quasi-connectivity, as in Java
    if (p !== !!(m & 8)) rsLater(x, y, z, p ? 0 : 1);
  } else if (S.DOOR[b]) {
    const lo = m & 8 ? y - 1 : y, p = powerAt(x, lo, z) > 0 || powerAt(x, lo + 1, z) > 0, lm = getMeta(x, lo, z);
    const powered = !!(lm & 16);
    if (p !== powered) { const open = p; const nm = (lm & ~20) | (open ? 4 : 0) | (p ? 16 : 0); setMeta(x, lo, z, nm); if (getBlock(x, lo + 1, z) === b) setMeta(x, lo + 1, z, (getMeta(x, lo + 1, z) & ~4) | (open ? 4 : 0)); play('door'); }
  } else if (b === BID.oak_trapdoor) {
    const p = powerAt(x, y, z) > 0; if (p !== !!(m & 16)) { setMeta(x, y, z, (m & ~20) | (p ? 20 : 0)); play('door', { vol: 0.5 }); }
  } else if (b === BID.comparator) {
    if (compute(x, y, z) !== compOut(x, y, z)) rsLater(x, y, z, 2);
  } else if (b === BID.dispenser || b === BID.dropper || b === BID.note_block) {
    const p = powerAt(x, y, z) > 0 || (b !== BID.note_block && powerAt(x, y + 1, z) > 0), bit = b === BID.note_block ? 1 : 8;
    if (p && !(m & bit)) { setMeta(x, y, z, m | bit); if (b === BID.note_block) { const t = getTile(x, y, z); playNote(x, y, z, t ? t.n || 0 : 0); } else rsLater(x, y, z, 4); }
    else if (!p && (m & bit)) setMeta(x, y, z, m & ~bit);
  } else if (b === BID.hopper) {
    const p = powerAt(x, y, z) > 0; if (p !== !!(m & 8)) setMeta(x, y, z, p ? m | 8 : m & ~8); // powered hoppers are locked
  } else if (b === BID.tnt) {
    if (powerAt(x, y, z) > 0) { setBlock(x, y, z, 0); primeTNT(x, y, z); }
  }
}
function rsDelayed(x, y, z) {
  const b = getBlock(x, y, z), m = getMeta(x, y, z);
  if (b === BID.lectern) { if (m & 8) { setMeta(x, y, z, m & ~8); rsNotify(x, y, z); } return; }
  if (b === RSB.torch || b === RSB.torchOff) {
    const a = torchAttach(x, y, z, m), ab = getBlock(a[0], a[1], a[2]);
    const pw = isConductor(ab) ? Math.max(strongPower(a[0], a[1], a[2]), weakPower(a[0], a[1], a[2])) : 0;
    const want = pw > 0 ? RSB.torchOff : RSB.torch;
    if (want !== b) { setBlock(x, y, z, want, m, { noUpdate: true }); rsNotify(x, y, z); }
  } else if (b === RSB.lampOn) { if (!(powerAt(x, y, z) > 0)) { setBlock(x, y, z, RSB.lamp, 0, { noUpdate: true }); rsNotify(x, y, z); } }
  else if (b === RSB.rep) {
    const d = DIRS[m & 3], inp = emitted(x - d[0], y, z - d[2], d[0], 0, d[2], false) > 0;
    if (inp !== !!(m & 16)) { setMeta(x, y, z, inp ? m | 16 : m & ~16); rsNotify(x + d[0], y, z + d[2]); rsNotify(x, y, z); }
  } else if (b === RSB.piston || b === RSB.sticky) {
    const p = powerAt(x, y, z, m & 7) > 0 || powerAt(x, y + 1, z, 0) > 0;
    if (p && !(m & 8)) pistonExtend(x, y, z, b, m); else if (!p && (m & 8)) pistonRetract(x, y, z, b, m);
  } else if (b === BID.comparator) {
    const v = compute(x, y, z), t = getTile(x, y, z) || { type: 'comp', out: 0 };
    if (v !== t.out) { t.out = v; setTile(x, y, z, t); setMeta(x, y, z, v > 0 ? m | 8 : m & ~8); const d = DIRS[m & 3]; rsNotify(x + d[0], y, z + d[2]); rsNotify(x, y, z); }
  } else if (b === BID.observer) {
    if (RS.obs.has(rkey(x, y, z))) { RS.obs.delete(rkey(x, y, z)); setMeta(x, y, z, m | 8); rsLater(x, y, z, 2); }
    else if (m & 8) setMeta(x, y, z, m & ~8);
    const d = S.DIR6[m & 7]; rsNotify(x - d[0], y - d[1], z - d[2]); rsMark(x, y, z);
  } else if (b === BID.dispenser || b === BID.dropper) { dispense(x, y, z, b, m); }
  else if (b === BID.target && (m & 15)) { setMeta(x, y, z, m & ~15); rsNotify(x, y, z); }
  else if (S.isRod(b, m) && (m & 128)) { setMeta(x, y, z, m & ~128); rsNotify(x, y, z); }
  else if (b === RSB.button && (m & 8)) { setMeta(x, y, z, m & ~8); play('click'); const a = switchAttach(x, y, z, m); rsNotify(x, y, z); rsNotify(a[0], a[1], a[2]); }
  else if (b === BID.detector_rail && (m & 8)) detectorCheck(x, y, z, m);
  else if (b === BID.tripwire_hook_block && (m & 8)) hookDelayed(x, y, z, m);
  else if (b === RSB.plate && (m & 1)) {
    if (plateOccupied(x, y, z)) rsLater(x, y, z, 10);
    else { setMeta(x, y, z, m & ~1); play('click'); rsNotify(x, y, z); rsNotify(x, y - 1, z); }
  }
}
// ---------- pistons ----------
const immovable = b => { const d = BLOCKS[b]; return !d || d.hard < 0 || b === BID.obsidian || b === BID.crying_obsidian || b === BID.furnace || b === BID.lit_furnace || b === BID.chest || b === BID.enchanting_table || b === BID.spawner || b === RSB.head || b === BID.anvil || b === BID.end_portal_frame || b === BID.red_bed || b === BID.oak_door; };
const breaksOnPush = b => REPL[b] || FLUID[b] || RTYPE[b] === RT.CROSS || RTYPE[b] === RT.TORCH || RTYPE[b] === RT.CROP || b === RSB.wire || b === RSB.lever || b === RSB.button || b === RSB.plate || b === RSB.rep || b === BID.ladder || b === BID.lantern || b === BID.cobweb || b === BID.cactus || b === BID.sugar_cane || BLOCKS[b].leaves && false;
// which blocks move (Java's structure resolver): the line in front of the piston, plus everything slime and honey
// blocks stick to (they do not stick to each other), at most 12; anything fragile in the way is broken
const isStickyBlock = b => b === BID.slime_block || b === BID.honey_block;
const sticksTo = (a, b) => !((a === BID.slime_block && b === BID.honey_block) || (a === BID.honey_block && b === BID.slime_block));
function resolveMove(sx, sy, sz, dx, dy, dz, skip) {
  const moving = new Map(), breaks = new Map(), K = (x, y, z) => x + ',' + y + ',' + z;
  const visit = (x, y, z, pushed) => {
    const k = K(x, y, z); if (moving.has(k) || skip.has(k)) return true;
    if (y < MINY || y >= MAXY || !isLoaded(x, z)) return !pushed;
    const id = getBlock(x, y, z);
    if (!id) return true;
    if (breaksOnPush(id)) { if (pushed) breaks.set(k, [x, y, z]); return true; }
    if (immovable(id)) return !pushed; // a sticky block simply lets go of what cannot move
    if (moving.size >= 12) return false;
    moving.set(k, [x, y, z, id, getMeta(x, y, z), getTile(x, y, z)]);
    if (!visit(x + dx, y + dy, z + dz, true)) return false;
    if (isStickyBlock(id)) for (const [ex, ey, ez] of S.DIR6) {
      if (ex === dx && ey === dy && ez === dz) continue;
      const nx = x + ex, ny = y + ey, nz = z + ez, nb = getBlock(nx, ny, nz);
      if (!nb || breaksOnPush(nb) || immovable(nb) || !sticksTo(id, nb)) continue;
      if (!visit(nx, ny, nz, false)) return false;
    }
    return true;
  };
  if (!visit(sx, sy, sz, true)) return null;
  // cells the moved blocks land in that hold something fragile
  for (const [x, y, z] of moving.values()) { const k = K(x + dx, y + dy, z + dz), t = getBlock(x + dx, y + dy, z + dz); if (!moving.has(k) && !skip.has(k) && t && breaksOnPush(t)) breaks.set(k, [x + dx, y + dy, z + dz]); }
  return { moving: [...moving.values()], breaks: [...breaks.values()] };
}
function applyMove(r, dx, dy, dz) {
  for (const [x, y, z] of r.breaks) { const id = getBlock(x, y, z); if (!id) continue; if (!FLUID[id] && W.onDrop) W.onDrop(x, y, z, blockDrops(id, getMeta(x, y, z), null).items, 0); setBlock(x, y, z, 0, 0, { noUpdate: true }); }
  for (const [x, y, z] of r.moving) setBlock(x, y, z, 0, 0, { noUpdate: true, keepTile: false, dry: true });
  for (const [x, y, z, id, mm, t] of r.moving) { setBlock(x + dx, y + dy, z + dz, id, mm, { noUpdate: true }); if (t) setTile(x + dx, y + dy, z + dz, t); }
  for (const [x, y, z] of r.moving) { neighborUpdate(x, y, z); neighborUpdate(x + dx, y + dy, z + dz); rsNotify(x, y, z); rsNotify(x + dx, y + dy, z + dz); }
  pushEntitiesAt(r.moving.map(([x, y, z]) => [x + dx, y + dy, z + dz]), dx, dy, dz);
}
function pistonExtend(x, y, z, b, m) {
  const f = m & 7, [dx, dy, dz] = S.DIR6[f];
  const r = resolveMove(x + dx, y + dy, z + dz, dx, dy, dz, new Set([x + ',' + y + ',' + z]));
  if (!r) return;
  applyMove(r, dx, dy, dz);
  setMeta(x, y, z, m | 8);
  const hx = x + dx, hy = y + dy, hz = z + dz; if (getBlock(hx, hy, hz) && breaksOnPush(getBlock(hx, hy, hz))) setBlock(hx, hy, hz, 0, 0, { noUpdate: true });
  setBlock(hx, hy, hz, RSB.head, f | (b === RSB.sticky ? 8 : 0));
  markDirty(x, z);
  pushEntitiesAt([[hx, hy, hz]], dx, dy, dz);
  play('piston', { vol: 0.6 });
}
function pistonRetract(x, y, z, b, m) {
  const f = m & 7, [dx, dy, dz] = S.DIR6[f];
  setMeta(x, y, z, m & ~8);
  if (getBlock(x + dx, y + dy, z + dz) === RSB.head) setBlock(x + dx, y + dy, z + dz, 0, 0);
  if (b === RSB.sticky) { // pull what is in front of the head back by one, with everything stuck to it
    const px = x + dx * 2, py = y + dy * 2, pz = z + dz * 2, id = getBlock(px, py, pz);
    if (id && !immovable(id) && !breaksOnPush(id)) { const r = resolveMove(px, py, pz, -dx, -dy, -dz, new Set([x + ',' + y + ',' + z])); if (r) applyMove(r, -dx, -dy, -dz); }
  }
  markDirty(x, z); rsNotify(x + dx, y + dy, z + dz);
  play('piston', { vol: 0.5, pitch: 0.8 });
}
// entities standing in or on moved blocks go with them
function pushEntitiesAt(cells, dx, dy, dz) {
  const hit = (e, w, h) => cells.some(([bx, by, bz]) => e.x + w > bx && e.x - w < bx + 1 && e.z + w > bz && e.z - w < bz + 1 && e.y + h > by && e.y < by + 1.05);
  if (!spectator() && hit(PL, PL.w, PL.h)) { PL.x += dx; PL.y += dy * 1.01; PL.z += dz; if (dy > 0) PL.vy = Math.max(PL.vy, 0); }
  for (const e of ENT) if (!e.dead && hit(e, e.w || 0.2, e.h || 0.2)) { e.x += dx; e.y += dy * 1.01; e.z += dz; }
}
// ---------- pressure plates & player interaction ----------
const plateKind = m => (m >> 4) & 15, plateAll = k => k >= 1 && k <= 8 || k >= 10;
function plateCount(x, y, z, m) {
  const inside = (e, w) => e.x + w > x && e.x - w < x + 1 && e.z + w > z && e.z - w < z + 1 && e.y >= y - 0.01 && e.y < y + 0.5, all = plateAll(plateKind(m));
  let n = !spectator() && !PL.dead && inside(PL, PL.w) ? 1 : 0;
  for (const e of ENT) if (!e.dead && (e.kind === 'mob' || e.kind === 'boat' || e.kind === 'minecart' || (all && (e.kind === 'item' || e.kind === 'arrow'))) && inside(e, e.w || 0.125)) n += e.kind === 'item' ? e.stack.n : 1;
  return n;
}
const plateOccupied = (x, y, z) => plateCount(x, y, z, getMeta(x, y, z)) > 0;
function plateLevel(x, y, z, m) {
  if (!(m & 1)) return 0;
  const k = plateKind(m); if (k < 10) return 15;
  const n = plateCount(x, y, z, m); return Math.min(15, k === 10 ? n : Math.ceil(n / 10));
}
function plateCheck(e, w) {
  const x = Math.floor(e.x), y = Math.floor(e.y + 0.01), z = Math.floor(e.z);
  if (getBlock(x, y, z) !== RSB.plate) return;
  const m = getMeta(x, y, z); if (m & 1) return;
  if (e.kind === 'item' && !plateAll(plateKind(m))) return;
  setMeta(x, y, z, m | 1); play('click'); rsNotify(x, y, z); rsNotify(x, y - 1, z); rsLater(x, y, z, 20);
}
function useSwitch(x, y, z, b, m) {
  if (b === RSB.lever) { setMeta(x, y, z, m ^ 8); play('click', { pitch: m & 8 ? 0.5 : 0.6 }); }
  else if (b === RSB.button) { if (m & 8) return; setMeta(x, y, z, m | 8); play('click'); const k = (m >> 4) & 15; rsLater(x, y, z, k >= 1 && k <= 8 ? 30 : 20); }
  else if (b === RSB.rep) { setMeta(x, y, z, (m & ~12) | ((((m >> 2) & 3) + 1) & 3) << 2); play('click'); return; }
  const a = switchAttach(x, y, z, m); rsNotify(x, y, z); rsNotify(a[0], a[1], a[2]);
}

// ---------- observers, comparators, dispensers, hoppers, daylight sensors, targets ----------
function observerFire(x, y, z) { const k = rkey(x, y, z); if (RS.obs.has(k) || (getMeta(x, y, z) & 8)) return; RS.obs.add(k); rsLater(x, y, z, 2); }
const compOut = (x, y, z) => { const t = getTile(x, y, z); return t && t.out || 0; };
// comparator: rear signal (or how full the container behind is) minus/compared with the strongest side signal
function containerSignal(x, y, z) {
  const b = getBlock(x, y, z);
  if (b === BID.composter) return Math.min(15, (getMeta(x, y, z) & 15) * 2 - (getMeta(x, y, z) >= 8 ? 1 : 0));
  if (b === BID.cauldron) return getMeta(x, y, z) & 3;
  if (b === BID.detector_rail) { const c = cartsAt(x, y, z).find(e => e.items); if (c) { let f = 0; for (const st of c.items) if (st) f += st.n / maxStack(st.id); return f ? Math.floor(1 + f / c.items.length * 14) : 0; } return -1; } // reads a chest or hopper minecart on it
  if (b === BID.jukebox) { const t = getTile(x, y, z), st = t && t.items && t.items[0]; return st ? ITEMS[st.id].disc : 0; } // the disc number
  const fr = typeof frameAt === 'function' && frameAt(x, y, z); if (fr) return fr.item ? fr.rot + 1 : 0; // item frame: its rotation
  const t = getTile(x, y, z); if (!t || !t.items) return -1;
  let f = 0, any = false; for (const st of t.items) if (st) { f += st.n / maxStack(st.id); any = true; }
  return any ? Math.floor(1 + f / t.items.length * 14) : 0;
}
function compute(x, y, z) {
  const m = getMeta(x, y, z), d = DIRS[m & 3], bx = x - d[0], bz = z - d[2];
  let rear = containerSignal(bx, y, bz); if (rear < 0) rear = emitted(bx, y, bz, d[0], 0, d[2], false);
  let side = 0;
  for (const s of [DIRS[(m + 1) & 3], DIRS[(m + 3) & 3]]) { const sb = getBlock(x + s[0], y, z + s[2]); if (sb === RSB.wire || sb === RSB.rep || sb === BID.comparator || sb === BID.redstone_block) side = Math.max(side, emitted(x + s[0], y, z + s[2], -s[0], 0, -s[2], false)); }
  return m & 4 ? Math.max(0, rear - side) : rear >= side ? rear : 0;
}
function dispense(x, y, z, b, m) {
  const t = getTile(x, y, z); if (!t || !t.items) return;
  const full = t.items.map((s, i) => s ? i : -1).filter(i => i >= 0); if (!full.length) { play('click', { pitch: 1.2 }); return; }
  const i = full[Math.floor(Math.random() * full.length)], st = t.items[i], d = S.DIR6[m & 7], fx = x + d[0], fy = y + d[1], fz = z + d[2], id = st.id;
  const take = () => { st.n--; if (st.n <= 0) t.items[i] = null; };
  const cx = fx + .5, cy = fy + .5, cz = fz + .5;
  if (b === BID.dropper) { const tt = getTile(fx, fy, fz); if (tt && tt.items && insertItem(tt, { id, n: 1, d: st.d, e: st.e })) take(); else { take(); dropItem(cx, cy - 0.2, cz, id, 1, [d[0] * 0.25, d[1] * 0.25 + 0.05, d[2] * 0.25], 5, st.d); } play('click'); return; }
  const fb = getBlock(fx, fy, fz);
  if (isArrow(id)) { const a = shootArrow(cx, cy, cz, d[0] * 1.1, d[1] * 1.1 + 0.1, d[2] * 1.1, null, 2); if (ITEMS[id].tipped != null) { a.potion = ITEMS[id].tipped; a.item = id; } take(); }
  else if (ITEMS[id].splash || ITEMS[id].lingering) { const e = shootArrow(cx, cy, cz, d[0] * 0.6, d[1] * 0.6 + 0.1, d[2] * 0.6, null, 0); e.thrown = id; scene.remove(e.mesh); e.mesh = R.itemMesh(id); e.mesh.scale.setScalar(0.3); scene.add(e.mesh); take(); }
  else if (id === IID.fire_charge) { spawnFireball(cx, cy, cz, d[0], d[1], d[2], null, true); take(); }
  else if (id === IID.snowball || id === IID.egg) { const e = shootArrow(cx, cy, cz, d[0] * 1.1, d[1] * 1.1 + 0.1, d[2] * 1.1, null, 0); e.thrown = id; scene.remove(e.mesh); e.mesh = R.itemMesh(id); e.mesh.scale.setScalar(0.3); scene.add(e.mesh); take(); }
  else if ((id === IID.water_bucket || id === IID.lava_bucket) && (!fb || REPL[fb])) { setBlock(fx, fy, fz, id === IID.water_bucket ? 27 : 28, 0); schedule(fx, fy, fz, 1); t.items[i] = { id: IID.bucket, n: 1 }; }
  else if (id === IID.bucket && FLUID[fb] && getMeta(fx, fy, fz) === 0) { setBlock(fx, fy, fz, 0); t.items[i] = { id: fb === 27 ? IID.water_bucket : IID.lava_bucket, n: 1 }; }
  else if (id === BID.tnt) { primeTNT(fx, fy, fz); take(); }
  else if (id === IID.flint_and_steel) { if (!fb && SOLID[getBlock(fx, fy - 1, fz)]) setBlock(fx, fy, fz, BID.fire); }
  else if (id === IID.bone_meal) { if (boneMeal(fx, fy, fz, fb)) take(); }
  else { take(); dropItem(cx, cy - 0.2, cz, id, 1, [d[0] * 0.25, d[1] * 0.25 + 0.05, d[2] * 0.25], 5, st.d); }
  play('click');
}
// put a stack into a container tile (furnace: input slot only); returns true when it fit completely
function insertItem(t, st, slots) {
  const list = slots || (t.type === 'furnace' ? [ITEMS[st.id].fuel && !SMELT[st.id] ? 1 : 0] : t.items.map((_, i) => i));
  for (const i of list) { const s = t.items[i]; if (s && s.id === st.id && !s.e && !st.e && (s.d || 0) === (st.d || 0) && s.n < maxStack(st.id)) { const k = Math.min(st.n, maxStack(st.id) - s.n); s.n += k; st.n -= k; if (!st.n) return true; } }
  for (const i of list) if (!t.items[i]) { t.items[i] = { ...st }; st.n = 0; return true; }
  return false;
}
// hoppers move one item every 8 ticks: pull from above (container or dropped items), push into the container below
function hopperTick(c, i, t) {
  if (--t.cd > 0) return; t.cd = 8;
  const x = c.cx * 16 + (i & 15), y = i >> 8, z = c.cz * 16 + ((i >> 4) & 15);
  if (c.meta[i] & 8) return;
  let moved = false;
  const below = getTile(x, y - 1, z) || cartsAt(x, y - 1, z).find(e => e.items);
  if (below && below.items) { const k = t.items.findIndex(s => s); if (k >= 0) { const s = t.items[k], one = { id: s.id, n: 1, d: s.d, e: s.e }; if (insertItem(below, one, below.type === 'furnace' ? [ITEMS[s.id].fuel && !SMELT[s.id] ? 1 : 0] : null)) { s.n--; if (!s.n) t.items[k] = null; moved = true; rsNotify(x, y - 1, z); } } }
  const above = getTile(x, y + 1, z) || cartsAt(x, y + 1, z).find(e => e.items);
  if (above && above.items) { if (above.loot) cartFillLoot(above); const slots = above.type === 'furnace' ? [2] : above.items.map((_, k) => k); for (const k of slots) { const s = above.items[k]; if (!s) continue; const one = { id: s.id, n: 1, d: s.d, e: s.e }; if (insertItem(t, one)) { s.n--; if (!s.n) above.items[k] = null; moved = true; rsNotify(x, y + 1, z); } break; } }
  else for (const e of ENT) if (e.kind === 'item' && !e.dead && Math.abs(e.x - x - .5) < 0.7 && Math.abs(e.z - z - .5) < 0.7 && e.y >= y + 0.5 && e.y < y + 2) { if (insertItem(t, e.stack)) removeEnt(e); moved = true; break; }
  if (moved) { c.modified = c.edited = true; rsNotify(x, y, z); if (UI.screen) UI.renderScreen(); }
}
// generic per-tick work for tile entities that need it (hoppers, daylight sensors)
function tileTick() {
  const day = W.tickN % 20 === 0;
  for (const c of W.chunks.values()) {
    if (!c.tiles.size || c.noTicking) continue;
    let any = false;
    for (const [i, t] of c.tiles) {
      if (t.type === 'hopper') { any = true; hopperTick(c, i, t); }
      else if (t.type === 'daylight') { any = true; if (day) { const x = c.cx * 16 + (i & 15), y = i >> 8, z = c.cz * 16 + ((i >> 4) & 15), m = c.meta[i], sky = getLight(x, y + 1, z) >> 4, f = W.dim ? 0 : Math.max(0, Math.cos(celestial() * Math.PI * 2)) * (1 - W.rain * 0.4); let v = Math.round(sky * Math.min(1, f * 1.4)); if (m & 16) v = 15 - v; if ((m & 15) !== v) { setMeta(x, y, z, (m & 16) | v); rsNotify(x, y, z); } } }
    }
    if (!any) c.noTicking = true; // re-armed by setTile
  }
}
// arrows hitting a target block: signal by how close to the centre they land
function targetHit(x, y, z, hx, hy, hz) {
  const dx = hx - x - .5, dy = hy - y - .5, dz = hz - z - .5, d = Math.min(1, Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) * 2 > 0.999 ? Math.hypot(dx, dy, dz) : Math.hypot(dx, dy, dz));
  const v = Math.max(1, Math.round(15 - d * 15 * 1.2));
  setMeta(x, y, z, (getMeta(x, y, z) & ~15) | v); rsNotify(x, y, z); rsLater(x, y, z, 20);
  return v;
}
