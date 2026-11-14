// Night vision lights everything at night or underground: the terrain, mobs, and the fog (Java's FogRenderer scales its
// colour up), so the distance fades into a lit haze, not black; blindness still wins
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const o = {}, frame = () => { R.renderFrame(0.016, camera.position, null); return { fog: Math.max(R.scene ? scene.fog.color.r : 0, scene.fog.color.g, scene.fog.color.b), min: R.matOpaque.uniforms.uMin.value }; };
    W.time = 18000; delete PL.eff.night_vision; o.off = frame();
    addEffect(PL, 'night_vision', 6000, 0); o.on = frame();
    o.mob = lightBright(PL.x, -60, PL.z);
    addEffect(PL, 'blindness', 100, 0); o.blind = frame(); delete PL.eff.blindness; delete PL.eff.night_vision;
    return o; });
  console.log(JSON.stringify(r));
  ok(r.off.fog < 0.2 && r.off.min < 0.1, 'at night without it: dark fog, dark ground', r.off);
  ok(r.on.fog > 0.95 && r.on.min >= 0.8, 'with night vision: the ground lit and the fog a lit haze', r.on);
  ok(r.mob >= 0.8, 'mobs in the dark lit too', r.mob);
  ok(r.blind.fog === 0, 'blindness still makes the fog black', r.blind);
  ok(!p.errs.length, 'no page errors', p.errs);
};
