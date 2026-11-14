// The dragon keeps its health and the crystals stay destroyed when the player leaves the End (dying there, or going
// home) and comes back
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms)), go = async n => { for (let i = 0; i < n; i++) { UI.paused = false; await wait(50); } };
    const toDim = async (d, x, y, z, how) => { switchDim(d, x, y, z, how); for (let i = 0; i < 400 && (UI.menu === 'loading' || W.dim !== d); i++) await wait(100); showMenu(null); UI.paused = false; };
    await toDim(1, 100.5, 49, 0.5, 'end');
    PL.x = 0.5; PL.z = 6.5; PL.y = S.END_PORTAL_Y + 2; PL.flying = true; await go(60);
    const dragon = () => ENT.filter(e => e.type === 'ender_dragon' && !e.dead), crystals = () => ENT.filter(e => e.type === 'end_crystal' && !e.dead);
    for (const c of crystals()) crystalHurt(c);
    const d = dragon()[0]; d.hp = 80; await go(20);
    o.before = { n: dragon().length, hp: Math.round(dragon()[0].hp), crystals: crystals().length };
    await toDim(0, W.worldSpawn[0] + .5, W.worldSpawn[1] + 1, W.worldSpawn[2] + .5, 'respawn'); await go(20);
    await toDim(1, 100.5, 49, 0.5, 'end'); PL.x = 0.5; PL.z = 6.5; PL.y = S.END_PORTAL_Y + 2; PL.flying = true; await go(100);
    o.after = { n: dragon().length, hp: dragon()[0] && Math.round(dragon()[0].hp), crystals: crystals().length };
    return o; });
  console.log(JSON.stringify(r));
  ok(r.before.crystals === 0 && r.before.hp === 80, 'the crystals destroyed, the dragon hurt', r.before);
  ok(r.after.n === 1 && r.after.hp >= 79 && r.after.hp <= 81 && r.after.crystals === 0, 'back in the End: one dragon, its health as it was, no crystals', r.after);
};
