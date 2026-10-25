// Blocks and creatures of the newer biomes: bamboo, tall flowers, carved pumpkins and golem building, mob heads,
// snow golems, charged creepers (whose explosions behead mobs).

// ---------- placing ----------
const BAMBOO_SOIL = new Set([BID.grass_block, BID.dirt, BID.sand, BID.gravel, BID.podzol, BID.mycelium, BID.coarse_dirt, BID.rooted_dirt, BID.moss_block]);
// called by placeBlock: returns the meta to place with, or false to refuse
function biomePlace(x, y, z, id, meta) {
  const below = getBlock(x, y - 1, z);
  if (id === BID.bamboo) return below === BID.bamboo || BAMBOO_SOIL.has(below) ? 0 : false;
  if (id === BID.tall_grass || id === BID.large_fern) { if (!(below === BID.grass_block || below === BID.dirt || below === BID.podzol || below === BID.coarse_dirt || below === BID.moss_block) || getBlock(x, y + 1, z)) return false; setBlock(x, y + 1, z, id, 8, { noUpdate: true }); return 0; }
  if (id === BID.tall_flower) { if (!(below === BID.grass_block || below === BID.dirt || below === BID.podzol) || getBlock(x, y + 1, z)) return false; setBlock(x, y + 1, z, BID.tall_flower, meta | 8, { noUpdate: true }); return meta; } // the top half first, so the bottom is supported
  return meta;
}
function biomePlaced(x, y, z, id, meta) {
  if (id === BID.carved_pumpkin || id === BID.jack_o_lantern) golemCheck(x, y, z);
}
// shears carve a pumpkin (dropping four seeds); a carved pumpkin with a torch makes a jack o'lantern (recipe)
function biomeUse(t, h, d) {
  if (h && h.id === IID.shears && t.id === BID.pumpkin) {
    setBlock(t.x, t.y, t.z, BID.carved_pumpkin, (facingDir() + 2) & 3); dropItem(t.x + .5 + t.nx * .6, t.y + .5 + t.ny * .6, t.z + .5 + t.nz * .6, IID.pumpkin_seeds, 4);
    damageItem(INV.slots, INV.sel, 1); play('break', { mat: 'wood', vol: 0.5 }); swing(); return true;
  }
  return false;
}
// ---------- golems: a pumpkin on two snow blocks (snow golem) or on a T of iron blocks (iron golem) ----------
function golemCheck(x, y, z) {
  if (getBlock(x, y - 1, z) === BID.snow_block && getBlock(x, y - 2, z) === BID.snow_block) {
    for (let k = 0; k < 3; k++) setBlock(x, y - k, z, 0);
    spawnMob('snow_golem', x + .5, y - 2, z + .5).persistent = true; play('place', { mat: 'snow' }); return;
  }
  if (getBlock(x, y - 1, z) === BID.iron_block && getBlock(x, y - 2, z) === BID.iron_block) for (const [ax, az] of [[1, 0], [0, 1]]) {
    if (getBlock(x + ax, y - 1, z + az) !== BID.iron_block || getBlock(x - ax, y - 1, z - az) !== BID.iron_block) continue;
    for (const c of [[0, 0, 0], [0, -1, 0], [0, -2, 0], [ax, -1, az], [-ax, -1, -az]]) setBlock(x + c[0], y + c[1], z + c[2], 0);
    const g = spawnMob('iron_golem', x + .5, y - 2, z + .5); g.persistent = true; g.playerMade = true; play('golem'); return;
  }
}
// ---------- bamboo ----------
RANDOM_TICK[BID.bamboo] = (x, y, z, b, m) => {
  if (getBlock(x, y + 1, z) || Math.random() > 0.33 || (getLight(x, y + 1, z) >> 4) < 9) return;
  let n = 1; while (getBlock(x, y - n, z) === BID.bamboo) n++;
  if (n >= 12 + ((x * 31 + z * 17) & 3)) return; // grows 12-16 tall
  setBlock(x, y + 1, z, BID.bamboo, 2);
  for (let k = 0; k < 4; k++) { const yy = y - k; if (getBlock(x, yy, z) !== BID.bamboo) break; setMeta(x, yy, z, k === 0 ? 2 : k === 1 ? 1 : 0); } // leaves near the top
};
// ---------- snow golems ----------
const SNOWG_M = autoModel(() => [
  ['body', [0, 0, 0], [-5, 0, -5, 10, 10, 10], 0xf4f8fa], ['mid', [0, 0, 0], [-4, 10, -4, 8, 8, 8], 0xf4f8fa],
  ['head', [0, 0, 0], [-4, 18, -4, 8, 8, 8], (k, x, y) => hex(k === 'top' ? 0xc8a020 : 0xe0901a), 0, { front: (g, x, y) => { px(g, x + 1, y + 2, '#3a2a10', 2, 2); px(g, x + 5, y + 2, '#3a2a10', 2, 2); px(g, x + 1, y + 5, '#3a2a10', 6, 1); } }],
  ['rarm', [4, 15, 0], [0, -1, -1, 9, 2, 2], 0x6a4a24], ['larm', [-4, 15, 0], [-9, -1, -1, 9, 2, 2], 0x6a4a24],
]);
function snowGolemAI(e) {
  const hot = S.BIOMES[biomeAt(Math.floor(e.x), Math.floor(e.z))][4] > 1;
  if (hot && e.age % 20 === 0) hurtMob(e, 1, null); // melts in deserts, the Nether
  if (e.age % 20 === 0 && !hot && e.onGround) { const bx = Math.floor(e.x), by = Math.floor(e.y), bz = Math.floor(e.z); if (!getBlock(bx, by, bz) && OPQ[getBlock(bx, by - 1, bz)]) setBlock(bx, by, bz, BID.snow, 0); } // a trail of snow
  if (e.target && (e.target.dead || Math.hypot(e.target.x - e.x, e.target.z - e.z) > 16)) e.target = null;
  if (!e.target && e.age % 20 === 0) { let best = null, bd = 10; for (const o of ENT) if (o.kind === 'mob' && !o.dead && o.def.hostile && !o.def.boss && o.type !== 'creeper') { const d = Math.hypot(o.x - e.x, o.z - e.z); if (d < bd) { bd = d; best = o; } } e.target = best; }
  let mx = 0, mz = 0;
  if (e.target) {
    const t = e.target, dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz) || 1; faceTo(e, t.x, t.z);
    if (d > 6) [mx, mz] = pathDir(e, t.x, t.y, t.z);
    if (e.attackCd <= 0 && d < 10) { e.attackCd = 20; const ty = t.y + t.h / 2 - (e.y + 1.4), v = 1.2; const s = shootArrow(e.x + dx / d * 0.5, e.y + 1.4, e.z + dz / d * 0.5, dx / d * v, ty / d * v + d * 0.02, dz / d * v, e, 0); s.thrown = IID.snowball; scene.remove(s.mesh); s.mesh = R.itemMesh(IID.snowball); s.mesh.scale.setScalar(0.3); scene.add(s.mesh); play('bow', { vol: 0.3 }); }
  } else {
    if (!e.goal && Math.random() < 1 / 100) e.goal = [e.x + (Math.random() - .5) * 10, e.z + (Math.random() - .5) * 10];
    if (e.goal) { const gx = e.goal[0] - e.x, gz = e.goal[1] - e.z, gl = Math.hypot(gx, gz); if (gl < 0.6) e.goal = null; else { mx = gx / gl; mz = gz / gl; e.yawTarget = Math.atan2(-gx, -gz); } }
  }
  walkPhysics(e, mx, mz, 0.06);
}
// shears take the pumpkin off
function snowGolemUse(e, h) { if (!h || h.id !== IID.shears || e.noPumpkin) return false; e.noPumpkin = true; if (!e.mesh.userData.mc) hidePart(e, 'head', false); dropItem(e.x, e.y + 1.8, e.z, BID.carved_pumpkin, 1); damageItem(INV.slots, INV.sel, 1); swing(); return true; }

// ---------- charged creepers and mob heads ----------
const HEAD_OF = { skeleton: 0, zombie: 1, creeper: 2, wither_skeleton: -1 };
function chargeCreeper(e) { e.charged = true; e.persistent = true; }
// set while a charged creeper explodes: mobs it kills drop their head (one per explosion)
const BLAST = { charged: false, headDone: false };
function headDrop(e) {
  if (!BLAST.charged || BLAST.headDone || !(e.type in HEAD_OF)) return;
  BLAST.headDone = true; const k = HEAD_OF[e.type];
  const it = dropItem(e.x, e.y + .5, e.z, k < 0 ? BID.wither_skeleton_skull : itemOfBlock(BID.mob_head, k << 2), 1); if (it) it.noBlast = true; // survives the blast that made it
}
function chargedExplode(e) { BLAST.charged = true; BLAST.headDone = false; explode(e.x, e.y + 0.8, e.z, 6); BLAST.charged = false; }
// pumpkins and heads can be worn
const isHeadwear = id => id === BID.pumpkin || id === BID.carved_pumpkin || id === BID.wither_skeleton_skull || (ITEMS[id] && ITEMS[id].place === BID.mob_head);

Object.assign(MOBDEF, {
  snow_golem: { hp: 4, w: 0.35, h: 1.9, speed: 0.06, xp: 0, snd: 'hmm', waterHurt: 1, drops: [['snowball', 0, 15]], parts: SNOWG_M.parts, tex: () => SNOWG_M.tex(0), ai: snowGolemAI, interact: (e, h) => snowGolemUse(e, h) },
});
