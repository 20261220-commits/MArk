// Redstone: wire networks, power sources, torches, repeaters, lamps, pistons, doors and TNT.
// Follows Java rules closely enough for ordinary circuits: strong/weak block power, wire
// decay of 1 per block, torch inversion with a 1-tick (2 game tick) delay, repeater delays
// of 1-4 ticks, and pistons that push up to 12 blocks.
const RS = { dirty: new Set(), sched: new Map(), busy: false };
const RSB = { wire: BID.redstone_wire, torch: BID.redstone_torch, torchOff: BID.unlit_redstone_torch, lamp: BID.redstone_lamp, lampOn: BID.lit_redstone_lamp,
  lever: BID.lever, button: BID.stone_button, plate: BID.stone_pressure_plate, rep: BID.repeater, piston: BID.piston, sticky: BID.sticky_piston, head: BID.piston_head, block: BID.redstone_block };
const rkey = (x, y, z) => x + ',' + y + ',' + z;
// the block a torch/lever/button hangs on
function torchAttach(x, y, z, m) { if (m >= 1 && m <= 4) { const d = DIRS[m - 1]; return [x + d[0], y, z + d[2]]; } return [x, y - 1, z]; }
function switchAttach(x, y, z, m) { const d = S.DIR6[m & 7]; return [x + d[0], y + d[1], z + d[2]]; }
const isConductor = b => OPQ[b] && SOLID[b] && b !== RSB.piston && b !== RSB.sticky && b !== BID.redstone_block;
// strong power a solid block receives from sources pointing into it
function strongPower(x, y, z) {
  for (let k = 0; k < 6; k++) {
    const [dx, dy, dz] = S.DIR6[k], nx = x + dx, ny = y + dy, nz = z + dz, b = getBlock(nx, ny, nz);
    if (b === RSB.lever || b === RSB.button) { const m = getMeta(nx, ny, nz); if (m & 8) { const a = switchAttach(nx, ny, nz, m); if (a[0] === x && a[1] === y && a[2] === z) return 15; } }
    else if (b === RSB.plate) { if (dy === 1 && getMeta(nx, ny, nz) & 1) return 15; }
    else if (b === RSB.torch) { if (dy === -1) return 15; } // a torch strongly powers the block above it
    else if (b === RSB.rep) { const m = getMeta(nx, ny, nz); if ((m & 16) && dy === 0) { const d = DIRS[m & 3]; if (nx + d[0] === x && nz + d[2] === z) return 15; } }
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
    if (nd && nd.rs && nd.rs !== 'lamp' && nd.rs !== 'piston' && nd.rs !== 'head' && (n !== RSB.rep || ((getMeta(x + dx, y, z + dz) & 3) & 1) === (d & 1))) c[d] = 1;
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
    case RSB.plate: return m & 1 ? 15 : 0;
    case BID.redstone_block: return 15;
    case RSB.torch: { const a = torchAttach(x, y, z, m); return a[0] === x + dx && a[1] === y + dy && a[2] === z + dz ? 0 : 15; }
    case RSB.rep: { if (!(m & 16) || dy) return 0; const d = DIRS[m & 3]; return d[0] === dx && d[2] === dz ? 15 : 0; }
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
      const [x, y, z] = k.split(',').map(Number); if (!isLoaded(x, z) || y < 0 || y >= CH) continue;
      const b = getBlock(x, y, z);
      if (b === RSB.wire) { const ch = []; const net = updateNetwork(x, y, z, ch); for (const nk of net.keys()) done.add(nk); for (let i = 0; i < ch.length; i += 3) rsNotify(ch[i], ch[i + 1], ch[i + 2]); }
      else rsComponent(x, y, z, b);
    }
  }
}
// immediate checks: decide whether a component needs to change, and schedule it
function rsComponent(x, y, z, b) {
  const m = getMeta(x, y, z);
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
  } else if (b === BID.oak_door) {
    const lo = m & 8 ? y - 1 : y, p = powerAt(x, lo, z) > 0 || powerAt(x, lo + 1, z) > 0, lm = getMeta(x, lo, z);
    const powered = !!(lm & 16);
    if (p !== powered) { const open = p; const nm = (lm & ~20) | (open ? 4 : 0) | (p ? 16 : 0); setMeta(x, lo, z, nm); if (getBlock(x, lo + 1, z) === b) setMeta(x, lo + 1, z, (getMeta(x, lo + 1, z) & ~4) | (open ? 4 : 0)); play('door'); }
  } else if (b === BID.tnt) {
    if (powerAt(x, y, z) > 0) { setBlock(x, y, z, 0); primeTNT(x, y, z); }
  }
}
function rsDelayed(x, y, z) {
  const b = getBlock(x, y, z), m = getMeta(x, y, z);
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
  } else if (b === RSB.button && (m & 8)) { setMeta(x, y, z, m & ~8); play('click'); const a = switchAttach(x, y, z, m); rsNotify(x, y, z); rsNotify(a[0], a[1], a[2]); }
  else if (b === RSB.plate && (m & 1)) {
    if (plateOccupied(x, y, z)) rsLater(x, y, z, 10);
    else { setMeta(x, y, z, 0); play('click'); rsNotify(x, y, z); rsNotify(x, y - 1, z); }
  }
}
// ---------- pistons ----------
const immovable = b => { const d = BLOCKS[b]; return !d || d.hard < 0 || b === BID.obsidian || b === BID.crying_obsidian || b === BID.furnace || b === BID.lit_furnace || b === BID.chest || b === BID.enchanting_table || b === BID.spawner || b === RSB.head || b === BID.anvil || b === BID.end_portal_frame || b === BID.red_bed || b === BID.oak_door; };
const breaksOnPush = b => REPL[b] || FLUID[b] || RTYPE[b] === RT.CROSS || RTYPE[b] === RT.TORCH || RTYPE[b] === RT.CROP || b === RSB.wire || b === RSB.lever || b === RSB.button || b === RSB.plate || b === RSB.rep || b === BID.ladder || b === BID.lantern || b === BID.cobweb || b === BID.cactus || b === BID.sugar_cane || BLOCKS[b].leaves && false;
function pistonExtend(x, y, z, b, m) {
  const f = m & 7, [dx, dy, dz] = S.DIR6[f], line = [];
  let cx = x + dx, cy = y + dy, cz = z + dz;
  for (;;) {
    if (cy < 0 || cy >= CH || !isLoaded(cx, cz)) return;
    const id = getBlock(cx, cy, cz);
    if (!id || breaksOnPush(id)) break;
    if (immovable(id) || line.length >= 12) return;
    line.push([cx, cy, cz, id, getMeta(cx, cy, cz), getTile(cx, cy, cz)]);
    cx += dx; cy += dy; cz += dz;
  }
  const end = getBlock(cx, cy, cz);
  if (end && end !== 0) { const dr = blockDrops(end, getMeta(cx, cy, cz), null); if (W.onDrop && !FLUID[end]) W.onDrop(cx, cy, cz, dr.items, 0); }
  for (let i = line.length - 1; i >= 0; i--) { const [px, py, pz, id, mm, t] = line[i]; setBlock(px + dx, py + dy, pz + dz, id, mm, { noUpdate: true }); if (t) setTile(px + dx, py + dy, pz + dz, t); }
  setMeta(x, y, z, m | 8);
  setBlock(x + dx, y + dy, z + dz, RSB.head, f | (b === RSB.sticky ? 8 : 0));
  markDirty(x, z);
  for (const [px, py, pz] of line) { neighborUpdate(px + dx, py + dy, pz + dz); rsNotify(px + dx, py + dy, pz + dz); }
  rsNotify(cx, cy, cz);
  pushEntities(x + dx, y + dy, z + dz, line.length + 1, dx, dy, dz);
  play('piston', { vol: 0.6 });
}
function pistonRetract(x, y, z, b, m) {
  const f = m & 7, [dx, dy, dz] = S.DIR6[f];
  setMeta(x, y, z, m & ~8);
  if (getBlock(x + dx, y + dy, z + dz) === RSB.head) setBlock(x + dx, y + dy, z + dz, 0, 0);
  if (b === RSB.sticky) {
    const px = x + dx * 2, py = y + dy * 2, pz = z + dz * 2, id = getBlock(px, py, pz);
    if (id && !immovable(id) && !breaksOnPush(id)) { const mm = getMeta(px, py, pz), t = getTile(px, py, pz); setBlock(px, py, pz, 0, 0, { noUpdate: true }); setBlock(x + dx, y + dy, z + dz, id, mm); if (t) setTile(x + dx, y + dy, z + dz, t); rsNotify(px, py, pz); }
  }
  markDirty(x, z); rsNotify(x + dx, y + dy, z + dz);
  play('piston', { vol: 0.5, pitch: 0.8 });
}
function pushEntities(x, y, z, n, dx, dy, dz) {
  const hit = (e, w, h) => { for (let i = 0; i < n; i++) { const bx = x + dx * i, by = y + dy * i, bz = z + dz * i; if (e.x + w > bx && e.x - w < bx + 1 && e.y + h > by && e.y < by + 1 && e.z + w > bz && e.z - w < bz + 1) return true; } return false; };
  if (hit(PL, PL.w, PL.h)) { PL.x += dx; PL.y += dy * 1.01; PL.z += dz; if (dy > 0) PL.vy = Math.max(PL.vy, 0); }
  for (const e of ENT) if (!e.dead && hit(e, e.w, e.h)) { e.x += dx; e.y += dy * 1.01; e.z += dz; }
}
// ---------- pressure plates & player interaction ----------
function plateOccupied(x, y, z) {
  const inside = (e, w) => e.x + w > x && e.x - w < x + 1 && e.z + w > z && e.z - w < z + 1 && e.y >= y - 0.01 && e.y < y + 0.5;
  if (!spectator() && !PL.dead && inside(PL, PL.w)) return true;
  for (const e of ENT) if (!e.dead && (e.kind === 'mob' || e.kind === 'boat') && inside(e, e.w)) return true;
  return false;
}
function plateCheck(e, w) {
  const x = Math.floor(e.x), y = Math.floor(e.y + 0.01), z = Math.floor(e.z);
  if (getBlock(x, y, z) !== RSB.plate) return;
  const m = getMeta(x, y, z); if (m & 1) return;
  setMeta(x, y, z, 1); play('click'); rsNotify(x, y, z); rsNotify(x, y - 1, z); rsLater(x, y, z, 20);
}
function useSwitch(x, y, z, b, m) {
  if (b === RSB.lever) { setMeta(x, y, z, m ^ 8); play('click', { pitch: m & 8 ? 0.5 : 0.6 }); }
  else if (b === RSB.button) { if (m & 8) return; setMeta(x, y, z, m | 8); play('click'); rsLater(x, y, z, 20); }
  else if (b === RSB.rep) { setMeta(x, y, z, (m & ~12) | ((((m >> 2) & 3) + 1) & 3) << 2); play('click'); return; }
  const a = switchAttach(x, y, z, m); rsNotify(x, y, z); rsNotify(a[0], a[1], a[2]);
}
