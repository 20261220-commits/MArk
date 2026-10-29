// Client-side ambience (Java's animateTick): random blocks near the player drip, puff spores and so on.
function displayTick() {
  if (UI.paused || PL.dead) return;
  const px = Math.floor(PL.x), py = Math.floor(PL.y), pz = Math.floor(PL.z);
  for (let i = 0; i < 300; i++) {
    const x = px + ((Math.random() * 21) | 0) - 10, y = py + ((Math.random() * 21) | 0) - 10, z = pz + ((Math.random() * 21) | 0) - 10;
    const b = getBlock(x, y, z); if (!b) { if (W.dim === -1) netherAir(x, y, z); continue; }
    if (b === BID.spore_blossom) lushDisplay(x, y, z, b);
    else if (b === BID.pointed_dripstone && Math.random() < 0.3 && isTip(x, y, z)) { // dripstone: a drop of the fluid above falls from the tip
      const src = dripSource(x, y, z);
      if (src) R.simpleParticle(x + .5, y + 0.05, z + .5, src[0] === 28 ? [1, 0.45, 0.1] : [0.25, 0.45, 0.95], { size: 0.06, vx: 1e-4, vy: 0, vz: 1e-4, grav: 1, life: 1.2 });
    }
  }
}
// the Nether biomes' drifting particles (Java's BiomeParticleConfig): crimson spores, warped spores, soul sand valley's
// ash and the basalt deltas' white ash
const NETHER_AIR = { 14: [0.025, [0.55, 0.12, 0.12], 0], 15: [0.014, [0.3, 0.85, 0.8], 0], 16: [0.00625, [0.35, 0.33, 0.3], 1], 17: [0.118, [0.85, 0.85, 0.85], 1] };
function netherAir(x, y, z) {
  const c = NETHER_AIR[biomeAt(x, z)]; if (!c || Math.random() > c[0]) return;
  R.simpleParticle(x + Math.random(), y + Math.random(), z + Math.random(), c[1], c[2] ? { size: 0.05, vx: (Math.random() - .5) * 0.2, vy: -0.15, vz: (Math.random() - .5) * 0.2, grav: 0, life: 3 } : { size: 0.05, vx: (Math.random() - .5) * 0.1, vy: 0.08, vz: (Math.random() - .5) * 0.1, grav: 0, life: 4 });
}
