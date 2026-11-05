// structure chests roll Java's own loot tables once the player's client.jar is converted (the pyramid, jungle temple,
// stronghold, mineshaft, fortress, buried treasure, dungeon...), without doubling a guaranteed item; without the jar,
// the game's own tables
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(() => {
    const R = S.rng(5), out = {};
    out.before = S.rollLoot(R, 'desert_pyramid', 5).length > 0;
    const one = name => ({ pools: [{ rolls: 1, entries: [{ type: 'minecraft:item', name: 'minecraft:' + name }] }] });
    S.setStructs({ t: { x: { s: [1, 1, 1], p: [], b: new Int32Array(0), n: {}, e: [] } }, loot: { 'chests/desert_pyramid': one('diamond'), 'chests/stronghold_library': one('enchanted_book'), 'chests/nether_bridge': one('golden_horse_armor'), 'chests/abandoned_mineshaft': one('name_tag'), 'chests/buried_treasure': one('heart_of_the_sea') } });
    const k = (kind) => S.rollLoot(R, kind, 5).map(l => l[1]).join(',');
    out.real = [k('desert_pyramid'), k('stronghold_library'), k('fortress'), k('mineshaft')];
    out.fallback = S.rollLoot(R, 'jungle_temple', 5).length > 0; // (no real table given for it: the game's own)
    S.setStructs(null);
    return out; });
  ok(r.before, 'without the jar a chest rolls the game\'s own table', r);
  ok(r.real.join('|') === 'diamond|enchanted_book|golden_horse_armor|name_tag', 'with the jar, structure chests roll the real loot tables', r.real);
  ok(r.fallback, 'a table the jar lacks falls back to the game\'s own', r.fallback);
};
