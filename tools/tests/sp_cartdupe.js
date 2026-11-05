// copies of a minecart left standing in one another (the old copying bug, saved into worlds before the fix) come
// back as one when their chunk loads again; a cart elsewhere in the chunk stays
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms));
    const cx = (Math.floor(PL.x) >> 4) + 2, cz = Math.floor(PL.z) >> 4, x = cx * 16 + 8.5, z = cz * 16 + 8.5, y = 150;
    for (const e of [...ENT]) if (e.kind === 'minecart') removeEnt(e);
    for (let i = 0; i < 3; i++) spawnMinecart(x, y, z, 'chest', { items: [{ id: IID.diamond, n: 5 }, ...new Array(26).fill(null)] });
    spawnMinecart(x + 4, y, z, 'chest');
    const before = ENT.filter(e => e.kind === 'minecart' && !e.dead).length;
    unloadChunk(chunkAt(cx, cz)); await wait(800); await loadChunk(cx, cz); for (let i = 0; i < 10; i++) { UI.paused = false; gameTick(); await wait(20); }
    const cs = ENT.filter(e => e.kind === 'minecart' && !e.dead);
    return { before, after: cs.length, diamonds: cs.reduce((a, e) => a + (e.items || []).reduce((s, q) => s + (q && q.id === IID.diamond ? q.n : 0), 0), 0) }; });
  ok(r.before === 4 && r.after === 2 && r.diamonds === 5, 'three copies of a chest minecart in one spot come back as one (with one load), the other cart stays', r);
};
