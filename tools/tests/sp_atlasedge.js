// The terrain never samples a neighbouring tile of the texture atlas: every face's corners lie in one tile (the shader
// keeps each face's sampling inside that tile, so a GPU with low-precision shaders no longer shows a line of the next
// tile, e.g. lava, along the edge of stone)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => { let quads = 0, bad = 0, ex = [];
    scene.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.uv || !o.geometry.attributes.lt) return;
      const U = o.geometry.attributes.uv.array; if (!(U instanceof Uint16Array)) return;
      for (let q = 0; q + 8 <= U.length; q += 8) { quads++; let t = null, s = true;
        for (let k = 0; k < 4; k++) { const id = Math.floor(U[q + k * 2] / 256) + ',' + Math.floor(U[q + k * 2 + 1] / 256); if (t == null) t = id; else if (t !== id) s = false; }
        if (!s) { bad++; if (ex.length < 5) ex.push(Array.from(U.subarray(q, q + 8))); } } });
    return { quads, bad, ex, fs: R.matOpaque.fragmentShader.includes('vTile') }; });
  console.log(JSON.stringify(r));
  ok(r.quads > 1000 && r.bad === 0, 'every face of the terrain lies in one tile of the atlas', r);
  ok(r.fs, 'the terrain shader keeps sampling inside the face\'s tile');
  // a jar's second fire texture (only the burning overlay's, no tile of its own) must not land on the stone tile
  const f = await p.evaluate(() => { const D = new Uint8Array(1024 * 4); for (let i = 0; i < D.length; i += 4) { D[i] = 250; D[i + 1] = 120; D[i + 2] = 10; D[i + 3] = 255; }
    const before = Array.from(AD.slice(0, 64)); applyPackData({ tiles: {}, anim: { fire1: [0, 4] }, items: {}, ent: {} }, D); const after = Array.from(AD.slice(0, 64));
    return { same: JSON.stringify(before) === JSON.stringify(after), px: after.slice(0, 4) }; });
  ok(f.same, 'a jar\'s fire_1 (no atlas tile) leaves the stone tile alone (it drew a line of fire along every stone block)', f);
};
