// Savanna (and jungle) villagers wear their biome's clothes from the player's jar or pack; a pack without them (the
// built-in one) dresses them in the plains clothes instead of leaving them bare
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative');
  const r = await p.evaluate(() => { const o = {}, sum = t => { let s = 0; for (let i = 0; i < t.image.data.length; i += 7) s = (s * 31 + t.image.data[i]) >>> 0; return s; };
    const clear = () => { for (const k in entTex) if (k.startsWith('v:')) delete entTex[k]; };
    o.mapped = PACKMAP && typeof PACKMAP === 'object' ? JSON.stringify(PACKMAP).includes('villager/type/savanna') : null;
    clear(); const bare = PACKPX.ent.villager, plains = sum(villagerTexture('plains', 'none', 1)), sav = sum(villagerTexture('savanna', 'none', 1));
    o.fallback = plains === sav && !!PACKPX.ent.vtype_plains && !PACKPX.ent.vtype_savanna;
    // a jar's savanna clothes: used
    const w = bare.w, h = bare.h, px = new Uint8Array(w * h * 4); for (let i = 0; i < px.length; i += 4) { px[i] = 200; px[i + 1] = 60; px[i + 2] = 20; px[i + 3] = 255; }
    PACKPX.ent.vtype_savanna = { w, h, px }; clear(); const sav2 = villagerTexture('savanna', 'none', 1); o.own = sav2.image.data[0] === 200 && sav2.image.data[1] === 60; delete PACKPX.ent.vtype_savanna; clear();
    return o; });
  console.log(JSON.stringify(r));
  ok(r.fallback, 'without savanna clothes in the pack: the plains clothes, not bare', r);
  ok(r.own, 'with the jar\'s savanna clothes: those', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};
