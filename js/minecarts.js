// Rails and minecarts (Java Edition 1.17). Rails join their neighbours when placed (plain rails also curve), climb one
// block, and powered / detector / activator rails take part in redstone. Minecarts follow the track: plain ones carry
// the player or a mob, chest and hopper minecarts hold items, TNT minecarts blow up, furnace minecarts push themselves.
const RAIL_ENDS = S.RAIL_ENDS;
const railAt = (x, y, z) => S.isRail(getBlock(x, y, z));
const shapeAt = (x, y, z) => S.railShape(getBlock(x, y, z), getMeta(x, y, z));
// the rail an end [dx, dy, dz] of the rail at (x,y,z) leads to: its y, or null (a flat end also meets a rail one lower)
function endRail(x, y, z, e) { for (const ny of e[1] ? [y + 1] : [y, y - 1]) if (railAt(x + e[0], ny, z + e[2])) return ny; return null; }
// does the rail at (x,y,z) have an end leading to (nx,ny,nz)?
function railLinks(x, y, z, nx, ny, nz) {
  for (const e of RAIL_ENDS[shapeAt(x, y, z)]) if (x + e[0] === nx && z + e[2] === nz && (ny === y + e[1] || (!e[1] && ny === y - 1))) return true;
  return false;
}
function railNear(x, y, z, dx, dz) { for (const dy of [0, 1, -1]) if (railAt(x + dx, y + dy, z + dz)) return y + dy; return null; }
// ends of a rail that lead to a rail leading back (not counting the rail at column skipX, skipZ)
function railLinkCount(x, y, z, skipX, skipZ) {
  let n = 0;
  for (const e of RAIL_ENDS[shapeAt(x, y, z)]) { if (x + e[0] === skipX && z + e[2] === skipZ) continue; const ny = endRail(x, y, z, e); if (ny != null && railLinks(x + e[0], ny, z + e[2], x, y, z)) n++; }
  return n;
}
const RAIL_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
function chooseRailShape(x, y, z, id, fallback) {
  // neighbours that already lead here or still have a free end; value: their height relative to this rail
  const c = RAIL_DIRS.map(([dx, dz]) => { const ny = railNear(x, y, z, dx, dz); if (ny == null) return null; return railLinks(x + dx, ny, z + dz, x, y, z) || railLinkCount(x + dx, ny, z + dz, x, z) < 2 ? ny - y : null; });
  const n = c[0] != null, e = c[1] != null, s = c[2] != null, w = c[3] != null;
  if (id === BID.rail && n !== s && e !== w) return s ? (e ? 6 : 7) : (w ? 8 : 9);
  if ((n || s) && (!(e || w) || (n && s) || id !== BID.rail)) return c[0] === 1 ? 4 : c[2] === 1 ? 5 : 0;
  if (e || w) return c[1] === 1 ? 2 : c[3] === 1 ? 3 : 1;
  return fallback;
}
function setRailShape(x, y, z, sh) { const id = getBlock(x, y, z), m = getMeta(x, y, z); setMeta(x, y, z, id === BID.rail ? sh : (m & 8) | sh); }
// a rail was just placed: shape it, then turn neighbours with a free end toward it
function railPlaced(x, y, z, fd) {
  const id = getBlock(x, y, z);
  setRailShape(x, y, z, chooseRailShape(x, y, z, id, fd & 1));
  for (const e of RAIL_ENDS[shapeAt(x, y, z)]) {
    const ny = endRail(x, y, z, e); if (ny == null) continue;
    const nx = x + e[0], nz = z + e[2];
    if (railLinks(nx, ny, nz, x, y, z) || railLinkCount(nx, ny, nz, x, z) >= 2) continue;
    setRailShape(nx, ny, nz, chooseRailShape(nx, ny, nz, getBlock(nx, ny, nz), shapeAt(nx, ny, nz)));
  }
  if (BLOCKS[id].rs) rsNotify(x, y, z);
}
// powered and activator rails: on when powered directly or through up to 8 rails of the same kind in a line
function railLine(x, y, z, b) {
  for (const e0 of RAIL_ENDS[shapeAt(x, y, z)]) {
    let cx = x, cy = y, cz = z, e = e0;
    for (let k = 0; k < 8; k++) {
      const ny = endRail(cx, cy, cz, e); if (ny == null) break;
      const nx = cx + e[0], nz = cz + e[2];
      if (getBlock(nx, ny, nz) !== b || !railLinks(nx, ny, nz, cx, cy, cz)) break;
      if (powerAt(nx, ny, nz) > 0) return true;
      const ends = RAIL_ENDS[shapeAt(nx, ny, nz)], back = ends.find(f => nx + f[0] === cx && nz + f[2] === cz);
      e = ends.find(f => f !== back); if (!e) break;
      cx = nx; cy = ny; cz = nz;
    }
  }
  return false;
}
function railPower(x, y, z, b, m) {
  const p = powerAt(x, y, z) > 0 || railLine(x, y, z, b);
  if (p === !!(m & 8)) return;
  setMeta(x, y, z, m ^ 8);
  for (const [dx, dz] of RAIL_DIRS) for (let dy = -1; dy <= 1; dy++) if (getBlock(x + dx, y + dy, z + dz) === b) rsMark(x + dx, y + dy, z + dz);
}
// detector rails stay on while a minecart is on them
const cartsAt = (x, y, z) => ENT.filter(e => e.kind === 'minecart' && !e.dead && Math.floor(e.x) === x && Math.floor(e.z) === z && e.ry === y);
function detectorCheck(x, y, z, m) {
  if (cartsAt(x, y, z).length) { rsLater(x, y, z, 20); return; }
  setMeta(x, y, z, m & ~8); rsNotify(x, y, z); rsNotify(x, y - 1, z);
}

// ---------- minecart entity ----------
const CART_LOAD = { chest: BID.chest, hopper: BID.hopper, tnt: BID.tnt, furnace: BID.furnace };
const CART_ITEM = { minecart: 'minecart', chest: 'chest_minecart', hopper: 'hopper_minecart', tnt: 'tnt_minecart', furnace: 'furnace_minecart' };
let cartTex = null;
function cartTexture() {
  if (cartTex) return cartTex;
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'), r = trng(57);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15, v = (edge ? 0x5a : 0x82) * (1 + (r() - .5) * 0.18) | 0; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(x, y, 1, 1); }
  cartTex = new THREE.CanvasTexture(c); cartTex.magFilter = cartTex.minFilter = THREE.NearestFilter; cartTex.generateMipmaps = false; return cartTex;
}
function cartMesh(e) {
  const tex = packTexture('minecart_ent');
  if (tex) { // MinecartEntityModel with the jar's minecart.png
    const g = new THREE.Group(), m = buildMCModel('minecart', MCMODELS.minecart, tex); m.rotation.y = Math.PI / 2; g.add(m);
    const load = CART_LOAD[e.ctype]; if (load) { const im = R.itemMesh(load); im.scale.setScalar(0.75); im.position.y = 0.62; g.add(im); g.userData.load = im; }
    g.userData.mats = [m.userData.mat, new THREE.MeshBasicMaterial()]; return g;
  }
  const g = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ map: cartTexture() }), dark = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  const box = (w, h, d, x, y, z, m) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.position.set(x, y, z); g.add(me); };
  // a tub 1 block long (local z) and 0.8 wide, floor 3 px up, walls 8 px high; wheels below
  box(0.8, 0.0625, 1.0, 0, 0.22, 0, mat);
  box(0.0625, 0.5, 1.0, -0.37, 0.5, 0, mat); box(0.0625, 0.5, 1.0, 0.37, 0.5, 0, mat);
  box(0.8, 0.5, 0.0625, 0, 0.5, -0.47, mat); box(0.8, 0.5, 0.0625, 0, 0.5, 0.47, mat);
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) box(0.06, 0.16, 0.16, x * 1.15, 0.12, z, dark);
  const load = CART_LOAD[e.ctype];
  if (load) { const im = R.itemMesh(load); im.scale.setScalar(0.75); im.position.y = 0.62; g.add(im); g.userData.load = im; }
  g.userData.mats = [mat, dark];
  return g;
}
function spawnMinecart(x, y, z, ctype, o = {}) {
  const e = Ent('minecart', x, y, z); e.kind = 'minecart'; e.ctype = ctype || 'minecart'; e.hittable = true; e.w = 0.49; e.h = 0.7;
  e.hp = 3; e.hurt = 0; e.yaw = o.yaw || 0; e.pitch = 0; e.rideY = 0.12; e.ry = Math.floor(y);
  e.vx = o.vx || 0; e.vz = o.vz || 0;
  if (ctype === 'chest' || ctype === 'hopper') e.items = o.items || new Array(ctype === 'chest' ? 27 : 5).fill(null);
  if (o.loot) e.loot = o.loot; // mineshaft chest minecarts fill when first opened
  if (ctype === 'furnace') { e.fuel = o.fuel || 0; e.pushX = o.pushX || 0; e.pushZ = o.pushZ || 0; }
  e.mesh = cartMesh(e); e.tick = cartTick; e.render = cartRender; e.onHit = cartHit;
  return addEnt(e);
}
function cartSave(e) { return { ctype: e.ctype, yaw: e.yaw, vx: e.vx, vz: e.vz, items: e.items || null, loot: e.loot || null, fuel: e.fuel || 0, pushX: e.pushX || 0, pushZ: e.pushZ || 0 }; }
function cartFillLoot(e) {
  if (!e.loot) return; for (const [slot, key, n] of e.loot) if (IID[key] != null) e.items[slot] = { id: IID[key], n };
  e.loot = null;
}
function cartBreak(e, drop) {
  removeEnt(e); if (PL.riding === e) dismount(); if (UI.screen && GUI.ctx && GUI.ctx.cart === e) UI.closeScreen(); if (e.passenger) { e.passenger.cart = null; e.passenger = null; }
  if (!drop) return;
  cartFillLoot(e);
  dropItem(e.x, e.y + 0.5, e.z, IID.minecart, 1);
  if (CART_LOAD[e.ctype]) dropItem(e.x, e.y + 0.5, e.z, CART_LOAD[e.ctype], 1); // 1.17 drops the minecart and its load separately
  if (e.items) for (const st of e.items) if (st) dropStack(e.x, e.y + 0.5, e.z, st);
}
function cartHit(e) {
  if (creative()) { cartBreak(e, false); return; }
  e.hp--; e.hurt = 10; play('hit', { vol: 0.5, mat: 'metal' }); vibrate(e.x, e.y, e.z);
  if (e.hp <= 0) cartBreak(e, true);
}
function cartBlast(e, dmg) { // caught in an explosion
  if (e.ctype === 'tnt') { if (!(e.fuse > 0)) e.fuse = 1 + Math.floor(Math.random() * 5); return; }
  if (dmg > 4) cartBreak(e, true);
}
function tntCartExplode(e) {
  const sp = Math.min(5, Math.hypot(e.vx, e.vz) * 10);
  cartBreak(e, false); explode(e.x, e.y + 0.5, e.z, 4 + Math.random() * 1.5 * sp);
}
// use (right click) on a minecart
function cartUse(e, h) {
  if (e.ctype === 'minecart') { if (!PL.sneaking && !e.passenger) { mount(e); play('door', { vol: 0.3 }); } return; }
  if (e.ctype === 'chest') { cartFillLoot(e); UI.openScreen('chest', { cart: e, title: ITEMS[IID.chest_minecart].name }); return; }
  if (e.ctype === 'hopper') { UI.openScreen('hopper', { cart: e, title: ITEMS[IID.hopper_minecart].name }); return; }
  if (e.ctype === 'furnace' && h && (h.id === IID.coal || h.id === IID.charcoal)) {
    e.fuel = Math.min(32000, e.fuel + 3600); if (!creative()) consume();
    const dx = e.x - PL.x, dz = e.z - PL.z, l = Math.hypot(dx, dz) || 1; e.pushX = dx / l; e.pushZ = dz / l; swing(); return;
  }
  if (e.ctype === 'tnt' && h && h.id === IID.flint_and_steel && !(e.fuse > 0)) { e.fuse = 80; play('fuse'); damageItem(INV.slots, INV.sel, 1); swing(); }
}
// the rail under a minecart, as [x, y, z]
function cartRail(e) {
  const x = Math.floor(e.x), z = Math.floor(e.z), y = Math.floor(e.y + 0.01);
  if (railAt(x, y, z)) return [x, y, z]; if (railAt(x, y - 1, z)) return [x, y - 1, z]; return null;
}
const CART_MAX = 0.4; // blocks per tick (8 m/s)
function railMove(e, [bx, by, bz]) {
  const b = getBlock(bx, by, bz), m = getMeta(bx, by, bz), [e0, e1] = RAIL_ENDS[S.railShape(b, m)];
  // the track through the block runs between the middles of two edges (the second end is the high one on slopes)
  const ax = bx + .5 + e0[0] * .5, az = bz + .5 + e0[2] * .5, cx = bx + .5 + e1[0] * .5, cz = bz + .5 + e1[2] * .5, rise = e1[1];
  const len = Math.hypot(cx - ax, cz - az), dx = (cx - ax) / len, dz = (cz - az) / len;
  // keep the speed, steer it along the track
  const sp = Math.hypot(e.vx, e.vz), dot = e.vx * dx + e.vz * dz;
  let v = Math.abs(dot) < 1e-6 ? 0 : Math.sign(dot) * sp;
  if (rise) v -= 0.0078125; // slopes pull downhill
  if (b === BID.powered_rail) {
    if (m & 8) {
      if (Math.abs(v) > 0.01) v += Math.sign(v) * 0.06;
      else if (SOLID[getBlock(bx + e0[0], by, bz + e0[2])]) v = 0.02; // a standing cart is pushed away from a wall
      else if (SOLID[getBlock(bx + e1[0], by + e1[1], bz + e1[2])]) v = -0.02;
    } else { v *= 0.5; if (Math.abs(v) < 0.03) v = 0; }
  } else if (b === BID.detector_rail && !(m & 8)) { setMeta(bx, by, bz, m | 8); rsNotify(bx, by, bz); rsNotify(bx, by - 1, bz); rsLater(bx, by, bz, 20); }
  e.activated = b === BID.activator_rail && !!(m & 8);
  if (e.ctype === 'furnace' && e.fuel > 0) {
    const pd = e.pushX * dx + e.pushZ * dz;
    if (Math.abs(pd) > 0.1) { const s = Math.sign(pd); if (v * s < 0.2) v += s * 0.02; }
  }
  // drag: heavier with nothing aboard
  v *= e.rider || e.passenger || (e.ctype === 'furnace' && e.fuel > 0) ? 0.997 : 0.96;
  if (Math.abs(v) < 0.0005) v = 0;
  v = Math.max(-CART_MAX, Math.min(CART_MAX, v));
  // position along the track, then move
  let t = Math.max(0, Math.min(len, (e.x - ax) * dx + (e.z - az) * dz)) + v;
  let x, z, y;
  if (t >= 0 && t <= len) { x = ax + dx * t; z = az + dz * t; y = by + (rise ? t / len : 0); }
  else { // runs past the end of this block's track into the next block
    const over = t > len ? t - len : t, px = t > len ? cx : ax, pz = t > len ? cz : az;
    x = px + dx * over; z = pz + dz * over; y = by + (t > len ? rise : 0);
    const nb = getBlock(Math.floor(x), Math.floor(y + 0.3), Math.floor(z)), nb2 = getBlock(Math.floor(x), Math.floor(y + 0.6), Math.floor(z));
    if ((SOLID[nb] && !S.isRail(nb)) || SOLID[nb2]) { x = px; z = pz; y = by + (t > len ? rise : 0); v = 0; play('hit', { vol: 0.3 }); } // buffer stop
  }
  e.x = x; e.y = y; e.z = z; e.vx = dx * v; e.vz = dz * v; e.vy = 0; e.onGround = true; e.ry = by;
  if (Math.abs(v) > 0.001 || !e.yawSet) { e.yaw = Math.atan2(dx, dz); e.yawSet = true; }
  e.pitch = rise ? Math.atan2(1, len) * (dz > 0 || dx < 0 ? -1 : 1) : 0;
  if (e.ctype === 'furnace' && Math.abs(v) > 0.01 && e.fuel > 0) { e.pushX = dx * Math.sign(v); e.pushZ = dz * Math.sign(v); }
}
function freeMove(e) {
  const inW = fluidAt(e.x, e.y + 0.2, e.z) === 1;
  e.vy -= inW ? 0.01 : 0.04; physMove(e, e.vx, e.vy, e.vz);
  const fr = inW ? 0.8 : e.onGround ? 0.5 : 0.95; e.vx *= fr; e.vz *= fr; e.vy *= 0.98;
  e.ry = Math.floor(e.y + 0.01); e.pitch = 0; e.activated = false;
}
function cartTick(e) {
  if (e.hurt > 0) e.hurt--;
  if (e.ejectT > 0) e.ejectT--;
  if (e.rider === PL) {
    if (IN.sneak) dismount();
    else if (IN.f > 0 && Math.hypot(e.vx, e.vz) < 0.1) { e.vx += -Math.sin(PL.yaw) * 0.01; e.vz += -Math.cos(PL.yaw) * 0.01; } // lean forward to get going
  }
  const r = cartRail(e);
  if (r) railMove(e, r); else freeMove(e);
  // an activator rail: drops passengers, primes TNT, locks hoppers
  if (e.activated) {
    if (e.rider === PL) dismount();
    if (e.passenger) { e.passenger.cart = null; e.passenger = null; e.ejectT = 40; }
    if (e.ctype === 'tnt' && !(e.fuse > 0)) { e.fuse = 80; play('fuse'); }
  }
  cartCollide(e);
  if (e.passenger) { const p = e.passenger; if (p.dead || p.cart !== e) e.passenger = null; else { p.x = e.x; p.y = e.y + 0.1; p.z = e.z; p.vx = p.vy = p.vz = 0; } }
  if (e.rider === PL) { PL.x = e.x; PL.y = e.y + e.rideY; PL.z = e.z; PL.vx = e.vx; PL.vz = e.vz; PL.vy = 0; PL.fallDist = 0; PL.onGround = true; }
  // loads
  if (e.ctype === 'tnt' && e.fuse > 0) { if (--e.fuse <= 0) { tntCartExplode(e); return; } if (e.age % 2) R.simpleParticle(e.x, e.y + 1.1, e.z, [0.6, 0.6, 0.6], { kind: 'smoke', size: 0.12, vy: 0.4, grav: -0.02, life: 0.5 }); }
  if (e.ctype === 'furnace' && e.fuel > 0) { e.fuel--; if (e.age % 3 === 0) R.simpleParticle(e.x, e.y + 1.1, e.z, [0.3, 0.3, 0.3], { kind: 'smoke', kind: 'smoke', size: 0.25, vy: 0.5, grav: -0.04, life: 1 }); }
  if (e.ctype === 'hopper' && e.age % 4 === 0) cartTransfer(e);
  if (e.y < -40) removeEnt(e);
}
// hopper minecarts take items from above (hoppers under the track empty chest and hopper minecarts: see hopperTick)
function cartTransfer(e) {
  const x = Math.floor(e.x), y = e.ry, z = Math.floor(e.z);
  if (e.ctype === 'hopper' && !e.activated) {
    const above = getTile(x, y + 1, z);
    if (above && above.items) { const slots = above.type === 'furnace' ? [2] : above.items.map((_, k) => k); for (const k of slots) { const s = above.items[k]; if (!s) continue; const one = { id: s.id, n: 1, d: s.d, e: s.e }; if (insertItem(e, one)) { s.n--; if (!s.n) above.items[k] = null; const c = chunkAt(x >> 4, z >> 4); if (c) c.modified = c.edited = true; } break; } }
    for (const it of ENT) if (it.kind === 'item' && !it.dead && Math.abs(it.x - e.x) < 1 && Math.abs(it.z - e.z) < 1 && it.y >= e.y - 0.2 && it.y < e.y + 1.5) { if (insertItem(e, it.stack)) removeEnt(it); break; }
  }
  if (UI.screen && GUI.ctx && GUI.ctx.cart === e) UI.renderScreen();
}
function cartCollide(e) {
  // the player walking into a cart pushes it
  if (PL.riding !== e && !PL.dead && !spectator()) {
    const dx = e.x - PL.x, dz = e.z - PL.z, d = Math.hypot(dx, dz);
    if (d < e.w + PL.w + 0.1 && d > 1e-4 && PL.y < e.y + e.h && PL.y + PL.h > e.y) { e.vx += dx / d * 0.03; e.vz += dz / d * 0.03; }
  }
  for (const o of ENT) {
    if (o === e || o.dead || o === e.passenger) continue;
    const dx = o.x - e.x, dz = o.z - e.z, d = Math.hypot(dx, dz);
    if (o.kind === 'minecart') { // carts bump into each other and trade speed
      if (d >= 0.95 || d < 1e-4 || Math.abs(o.y - e.y) > 0.8 || o.id < e.id) continue;
      const nx = dx / d, nz = dz / d, rel = (e.vx - o.vx) * nx + (e.vz - o.vz) * nz;
      if (rel > 0) { e.vx -= rel * nx; e.vz -= rel * nz; o.vx += rel * nx; o.vz += rel * nz; }
      const push = (0.95 - d) * 0.25; e.vx -= nx * push; e.vz -= nz * push; o.vx += nx * push; o.vz += nz * push;
    } else if (o.kind === 'mob' && !o.deathT && d < e.w + o.w && o.y < e.y + e.h && o.y + o.h > e.y) {
      // an empty minecart rolling into a mob scoops it up
      if (e.ctype === 'minecart' && !e.rider && !e.passenger && !o.cart && !(e.ejectT > 0) && o.w <= 0.7 && !o.def.boss && !o.def.water && Math.hypot(e.vx, e.vz) > 0.03) { e.passenger = o; o.cart = e; continue; }
      if (d > 1e-4) { o.vx += dx / d * 0.05; o.vz += dz / d * 0.05; }
    }
  }
}
// mobs sitting in a minecart: held in place; returns true to skip their AI
function cartHold(e) {
  if (!e.cart) return false;
  if (e.cart.dead || e.cart.passenger !== e) { e.cart = null; return false; }
  e.x = e.cart.x; e.y = e.cart.y + 0.1; e.z = e.cart.z; e.vx = e.vy = e.vz = 0; e.walkAmt = 0;
  return true;
}
function cartRender(e, x, y, z, br) {
  e.mesh.position.set(x, y, z);
  const yaw = e.pyaw + (((e.yaw - e.pyaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  e.mesh.rotation.set(0, yaw, 0, 'YXZ'); e.mesh.rotateX(e.pitch || 0);
  if (e.hurt > 0) e.mesh.rotateZ(Math.sin(e.hurt * 1.5) * e.hurt / 40);
  const flash = e.fuse > 0 && Math.floor(e.fuse / 5) % 2 === 0;
  const [mat, dark] = e.mesh.userData.mats; mat.color.setScalar(br); dark.color.setScalar(br * 0.18);
  if (e.mesh.userData.load) R.setMeshLight(e.mesh.userData.load, flash ? 2 : br);
}
// place a minecart from the hand onto a rail
function placeMinecart(t, d) {
  const id = getBlock(t.x, t.y, t.z); if (!S.isRail(id)) return false;
  if (cartsAt(t.x, t.y, t.z).length) return false;
  const sh = S.railShape(id, getMeta(t.x, t.y, t.z)), yaw = sh === 1 ? Math.PI / 2 : 0;
  spawnMinecart(t.x + .5, t.y + (sh >= 2 && sh <= 5 ? 0.5 : 0), t.z + .5, d.cart, { yaw });
  consume(); swing(); play('place', { mat: 'metal' });
  return true;
}
