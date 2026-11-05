// a structure's entities (a mineshaft's chest minecarts) come back once when their chunk is left and loaded again:
// a chunk that was saved before doesn't make them a second time
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const wait = ms => new Promise(r => setTimeout(r, ms));
    let cart = null;
    for (let t = 0; t < 40 && !cart; t++) { PL.x += 96; PL.mode = 'spectator'; for (let i = 0; i < 40; i++) { UI.paused = false; gameTick(); await wait(30); } cart = ENT.find(e => e.kind === 'minecart' && e.ctype === 'chest' && !e.dead); }
    if (!cart) return { found: false };
    const cx = Math.floor(cart.x) >> 4, cz = Math.floor(cart.z) >> 4, near = () => ENT.filter(e => e.kind === 'minecart' && !e.dead && Math.abs(e.x - cart.x) < 40 && Math.abs(e.z - cart.z) < 40).length;
    const out = { found: true, counts: [near()] };
    for (let round = 0; round < 2; round++) { unloadChunk(chunkAt(cx, cz)); await wait(800); await loadChunk(cx, cz); for (let i = 0; i < 20; i++) { UI.paused = false; gameTick(); await wait(20); } out.counts.push(near()); }
    PL.mode = 'survival'; return out; });
  ok(r.found && r.counts.every(n => n === r.counts[0]), 'a mineshaft\'s chest minecarts are not copied when their chunk loads again', r);
};
