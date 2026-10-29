// Bastion remnants' residents: piglin brutes (always hostile, golden axe) and piglins that turn on players who open
// chests or break gold blocks in front of them, even when they wear gold.
MCMODELS.piglin_brute = { ...MCMODELS.piglin };
function bruteAI(e, dist) {
  if (!e.target && plTargetable() && dist < 16 && canSee(e.x, e.y + 1.6, e.z, PL.x, PL.y + 1.6, PL.z)) { e.target = PL; e.angry = true; }
  piglinAI(e, dist);
}
function bruteGear(e) {
  const P = e.mesh.userData.parts, arm = P.rarm || P.right_arm; if (!arm || P.heldItem) return;
  const m = R.itemMesh(IID.golden_axe); m.scale.setScalar(0.6); m.position.set(0, -0.6, -0.15); m.rotation.set(-Math.PI / 2, 0, Math.PI / 4); arm.add(m); P.heldItem = m;
}
function piglinAnger(x, y, z) {
  if (W.dim !== -1 || !plTargetable()) return;
  for (const e of ENT) if ((e.type === 'piglin' || e.type === 'piglin_brute') && !e.dead && Math.hypot(e.x - x, e.y - y, e.z - z) < 16) { e.target = PL; e.angry = true; }
}
Object.assign(MOBDEF, {
  piglin_brute: { ...MOBDEF.piglin, hp: 50, dmg: 13, xp: 20, neutral: 0, drops: [], extraDrop: [['golden_axe', 0.085]], ai: bruteAI, init: e => bruteGear(e) },
});
// outside the Nether, piglins and brutes turn into zombified piglins and hoglins into zoglins after 15 seconds; hoglins
// keep away from warped fungus (and nether portals and respawn anchors), as in Java
const ZOMBIFY = { piglin: 'zombified_piglin', piglin_brute: 'zombified_piglin', hoglin: 'zoglin' };
function netherMobTick(e) {
  const to = ZOMBIFY[e.type]; if (!to || e.remote) return;
  if (W.dim !== -1) {
    e.zomT = (e.zomT || 0) + 1; if (e.zomT % 4 === 0) e.yaw += (Math.random() - .5) * 0.2; // shaking
    if (e.zomT >= 300) { const z = spawnMob(to, e.x, e.y, e.z, { baby: e.baby }); if (z) { z.yaw = e.yaw; z.persistent = !!e.persistent; addEffect(z, 'nausea', 200, 0); } play('groan', { vol: 0.6 }); removeEnt(e); return; }
  } else e.zomT = 0;
  if (e.type === 'hoglin' && e.age % 20 === 0) { // repelled: run from the nearest warped fungus, portal or anchor within 8
    const x0 = Math.floor(e.x), y0 = Math.floor(e.y), z0 = Math.floor(e.z); let best = null, bd = 99;
    for (let dx = -8; dx <= 8; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -8; dz <= 8; dz++) { const b = getBlock(x0 + dx, y0 + dy, z0 + dz); if (b === BID.warped_fungus || b === BID.nether_portal || b === BID.respawn_anchor) { const d = dx * dx + dz * dz; if (d < bd) { bd = d; best = [dx, dz]; } } }
    e.repel = best ? 40 : 0; e.repelDir = best;
  }
  if (e.repel > 0) { e.repel--; const [dx, dz] = e.repelDir, l = Math.hypot(dx, dz) || 1; e.target = null; e.goal = [e.x - dx / l * 8, e.z - dz / l * 8]; }
}
{ const base = mobExtraTick; mobExtraTick = function (e, dist) { netherMobTick(e); if (!e.dead) base(e, dist); }; }
