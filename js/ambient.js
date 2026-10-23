// Client-side ambience (Java's animateTick): random blocks near the player drip, puff spores and so on.
function displayTick() {
  if (UI.paused || PL.dead) return;
  const px = Math.floor(PL.x), py = Math.floor(PL.y), pz = Math.floor(PL.z);
  for (let i = 0; i < 300; i++) {
    const x = px + ((Math.random() * 21) | 0) - 10, y = py + ((Math.random() * 21) | 0) - 10, z = pz + ((Math.random() * 21) | 0) - 10;
    const b = getBlock(x, y, z); if (!b) continue;
    if (b === BID.pointed_dripstone && Math.random() < 0.3 && isTip(x, y, z)) { // dripstone: a drop of the fluid above falls from the tip
      const src = dripSource(x, y, z);
      if (src) R.simpleParticle(x + .5, y + 0.05, z + .5, src[0] === 28 ? [1, 0.45, 0.1] : [0.25, 0.45, 0.95], { size: 0.06, vx: 1e-4, vy: 0, vz: 1e-4, grav: 1, life: 1.2 });
    }
  }
}
