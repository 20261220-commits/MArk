// Thunderstorms (1.17): a thunder flag on top of rain, lightning strikes around the player,
// lightning rods that attract them, power redstone and clean the copper they stand on.
W.thunder = 0; W.thunderOn = false; W.thunderTimer = 12000 + Math.random() * 168000; W.flash = 0;

// ---------- lightning rod registry (rods only exist where players built them) ----------
const RODS = new Set();
function rodTrack(x, y, z, on) { const k = x + ',' + y + ',' + z; if (on) RODS.add(k); else RODS.delete(k); }
function rodScan(c) {
  const b = c.blocks, m = c.meta;
  for (let i = 0; i < b.length; i++) if (b[i] === BID.chain && S.isRod(b[i], m[i])) RODS.add((c.cx * 16 + (i & 15)) + ',' + (i >> 8) + ',' + (c.cz * 16 + ((i >> 4) & 15)));
}
function rodUnload(c) { for (const k of RODS) { const [x, , z] = k.split(',').map(Number); if (x >> 4 === c.cx && z >> 4 === c.cz) RODS.delete(k); } }
// the closest rod open to the sky within 128 blocks takes the strike (Java's lightning rod search radius)
function rodNear(x, z) {
  let best = null, bd = 128 * 128;
  for (const k of RODS) {
    const [rx, ry, rz] = k.split(',').map(Number), d = (rx - x) ** 2 + (rz - z) ** 2;
    if (d < bd && (getLight(rx, ry + 1, rz) >> 4) === 15) { bd = d; best = [rx, ry, rz]; }
  }
  return best;
}
const rainsAt = (x, z) => { const b = biomeAt(x, z), t = S.BIOMES[b][4]; return t > 0.15 && t < 1 && b !== S.BIO.DESERT && b !== S.BIO.BADLANDS && b !== S.BIO.SAVANNA; };

function weatherTick() {
  if (--W.thunderTimer <= 0) { W.thunderOn = !W.thunderOn; W.thunderTimer = W.thunderOn ? 3600 + Math.random() * 12000 : 12000 + Math.random() * 168000; }
  const tgt = W.thunderOn && W.rainTarget > 0 ? 1 : 0;
  W.thunder += Math.sign(tgt - W.thunder) * Math.min(Math.abs(tgt - W.thunder), 0.01);
  if (W.flash > 0) W.flash = Math.max(0, W.flash - 0.12);
  if (BOLTS.length) boltTick();
  if (W.dim !== 0 || W.thunder < 0.9 || W.rain < 0.9) return;
  // Java: every loaded chunk has a 1 in 100000 chance per tick
  if (Math.random() * 100000 >= W.chunks.size) return;
  const cs = [...W.chunks.values()], c = cs[(Math.random() * cs.length) | 0];
  const x = c.cx * 16 + ((Math.random() * 16) | 0), z = c.cz * 16 + ((Math.random() * 16) | 0);
  const rod = rodNear(x, z);
  if (rod) { strikeLightning(rod[0], rod[1] + 1, rod[2], true); return; }
  if (!rainsAt(x, z)) return;
  strikeLightning(x, topY(x, z) + 1, z, false);
}

// copper (1.17): a strike clears the oxidation of the copper it lands on, then wanders off cleaning neighbours one stage at a time
const weathered = (b, m) => BLOCKS[b] && BLOCKS[b].wax && BLOCKS[b].scrape && !(m & BLOCKS[b].wax); // oxidised and not waxed
function cleanCopper(x, y, z) {
  const b = getBlock(x, y, z), m = getMeta(x, y, z);
  if (!weathered(b, m)) return;
  let c = b; while (BLOCKS[c].scrape) c = BLOCKS[c].scrape;
  setBlock(x, y, z, c, m);
  const walks = 3 + ((Math.random() * 3) | 0);
  for (let w = 0; w < walks; w++) {
    let px = x, py = y, pz = z;
    for (let s = 0, len = 1 + ((Math.random() * 8) | 0); s < len; s++) {
      const opts = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const nb = getBlock(px + dx, py + dy, pz + dz); if ((dx || dy || dz) && weathered(nb, getMeta(px + dx, py + dy, pz + dz))) opts.push([px + dx, py + dy, pz + dz, nb]);
      }
      if (!opts.length) break;
      const [nx, ny, nz, nb] = opts[(Math.random() * opts.length) | 0];
      setBlock(nx, ny, nz, BLOCKS[nb].scrape, getMeta(nx, ny, nz));
      px = nx; py = ny; pz = nz;
    }
  }
}

function strikeLightning(x, y, z, viaRod) {
  W.flash = 1;
  boltMesh(x + .5, y, z + .5);
  const dist = Math.hypot(PL.x - x - .5, PL.z - z - .5);
  play('thunder', { vol: Math.max(0.15, 1 - dist / 160) });
  if (dist < 24) play('explode', { vol: 0.5 * (1 - dist / 24) });
  // 5 damage and 8 seconds of fire to everything nearby; pigs turn into zombified piglins
  const inBolt = (ex, ey, ez) => Math.abs(ex - x - .5) < 3 && Math.abs(ez - z - .5) < 3 && ey > y - 3 && ey < y + 6;
  for (const e of [...ENT]) {
    if (e.kind !== 'mob' || e.dead || !inBolt(e.x, e.y, e.z)) continue;
    if (e.type === 'pig') { removeEnt(e); spawnMob('zombified_piglin', e.x, e.y, e.z); continue; }
    e.fire = Math.max(e.fire || 0, 160); hurtMob(e, 5, null, 0, 0, 'lightning');
  }
  if (!PL.dead && inBolt(PL.x, PL.y, PL.z) && !creative()) { PL.fire = Math.max(PL.fire, 160); hurtPlayer(5, 'lightning'); }
  if (viaRod) { // the rod itself is at y - 1: it glows with redstone power for 8 ticks and cleans the copper it is mounted on
    const rx = x, ry = y - 1, rz = z, m = getMeta(rx, ry, rz), d = S.DIR6[m & 7];
    setMeta(rx, ry, rz, m | 128); rsNotify(rx, ry, rz); rsLater(rx, ry, rz, 8);
    cleanCopper(rx - d[0], ry - d[1], rz - d[2]);
    return;
  }
  cleanCopper(x, y - 1, z);
  // fire on normal and hard difficulty: at the strike and up to four spots around it
  if (PL.difficulty < 2) return;
  const fire = (fx, fy, fz) => { const b = getBlock(fx, fy, fz); if ((b === 0 || (REPL[b] && !FLUID[b])) && SOLID[getBlock(fx, fy - 1, fz)]) setBlock(fx, fy, fz, BID.fire); };
  fire(x, y, z);
  for (let i = 0; i < 4; i++) fire(x + ((Math.random() * 3) | 0) - 1, y + ((Math.random() * 3) | 0) - 1, z + ((Math.random() * 3) | 0) - 1);
}

// ---------- bolt visual: a jagged white line from the strike point up into the clouds, gone after a few frames ----------
const boltMat = new THREE.LineBasicMaterial({ color: 0xf0f4ff, transparent: true, opacity: 0.95, fog: false });
const BOLTS = [];
function boltMesh(x, y, z) {
  const pts = []; let px = x, pz = z;
  for (let h = y; h < y + 130; h += 2 + Math.random() * 4) { pts.push(new THREE.Vector3(px, h, pz)); px += (Math.random() - .5) * 2.4; pz += (Math.random() - .5) * 2.4; }
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), boltMat); line.frustumCulled = false;
  scene.add(line); BOLTS.push({ line, life: 7 });
}
function boltTick() { // lives a few ticks and flickers once, like the Java bolt
  for (let i = BOLTS.length - 1; i >= 0; i--) {
    const b = BOLTS[i]; b.life--; b.line.visible = b.life !== 4;
    if (b.life <= 0) { scene.remove(b.line); b.line.geometry.dispose(); BOLTS.splice(i, 1); }
  }
}
