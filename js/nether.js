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
