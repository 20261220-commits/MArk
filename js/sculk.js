// Sculk sensors (1.17): vibrations within 8 blocks (footsteps, landing, blocks placed or broken, doors and
// chests used, projectiles, explosions) activate them for 40 ticks with a redstone signal that fades with distance.
// Wool between the source and the sensor muffles the vibration; walking on wool or carpet makes none.
const SENSORS = trackBlocks(BID.sculk_sensor);
const isWool = b => b === BID.white_wool;
function woolBetween(ax, ay, az, bx, by, bz) {
  const d = Math.hypot(bx - ax, by - ay, bz - az), n = Math.ceil(d * 2);
  for (let i = 1; i < n; i++) { const t = i / n; if (isWool(getBlock(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t), Math.floor(az + (bz - az) * t)))) return true; }
  return false;
}
function vibrate(x, y, z) {
  if (!SENSORS.size) return;
  for (const k of SENSORS) {
    const [sx, sy, sz] = k.split(',').map(Number), cx = sx + .5, cy = sy + .5, cz = sz + .5, d = Math.hypot(cx - x, cy - y, cz - z);
    if (d > 8 || getBlock(sx, sy, sz) !== BID.sculk_sensor || (getMeta(sx, sy, sz) & 3)) continue;
    if (woolBetween(x, y, z, cx, cy, cz)) continue;
    const power = Math.max(1, 15 - Math.floor(15 * d / 8));
    setMeta(sx, sy, sz, 1 | (power << 4)); rsNotify(sx, sy, sz); schedule(sx, sy, sz, 40);
    play('click', { pitch: 1.8, vol: 0.4 });
    for (let i = 0; i < 6; i++) { const t = i / 6; R.simpleParticle(x + (cx - x) * t, y + (cy - y) * t, z + (cz - z) * t, [0.2, 0.85, 0.9], { size: 0.08, vx: 1e-4, vy: 0, vz: 1e-4, grav: 0, life: 0.5 }); }
  }
}
SCHED_TICK[BID.sculk_sensor] = (x, y, z, b, m) => {
  if ((m & 3) === 1) { setMeta(x, y, z, 2); rsNotify(x, y, z); schedule(x, y, z, 1); } // short cooldown before it listens again
  else if ((m & 3) === 2) setMeta(x, y, z, 0);
};
// footsteps and landings of the player (sneaking is silent)
let stepDist = 0, wasGround = true;
function stepVibration() {
  if (!SENSORS.size || spectator()) { wasGround = PL.onGround; return; }
  const under = getBlock(Math.floor(PL.x), Math.floor(PL.y - 0.05), Math.floor(PL.z)), soft = isWool(under) || under === BID.carpet;
  if (PL.onGround && !wasGround && !soft) vibrate(PL.x, PL.y, PL.z);
  if (PL.onGround && !PL.sneaking && !soft) { stepDist += Math.hypot(PL.x - PL.px, PL.z - PL.pz); if (stepDist > 1.6) { stepDist = 0; vibrate(PL.x, PL.y, PL.z); } }
  wasGround = PL.onGround;
}
