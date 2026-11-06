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
    out.fallback = S.rollLoot(R, 'jungle_temple', 5).length > 0;
    // Java's number providers: a uniform 1-3 count reaches 3, rolls of 2-4 reach 4, a binomial count works
    S.setStructs({ t: { x: { s: [1, 1, 1], p: [], b: new Int32Array(0), n: {}, e: [] } }, loot: { 'chests/desert_pyramid': { pools: [{ rolls: { min: 2, max: 4 }, entries: [{ type: 'minecraft:item', name: 'minecraft:bread', functions: [{ function: 'minecraft:set_count', count: { min: 1, max: 3 } }] }] }, { rolls: 1, entries: [{ type: 'minecraft:item', name: 'minecraft:apple', functions: [{ function: 'minecraft:set_count', count: { type: 'minecraft:binomial', n: 10, p: 0.5 } }] }] }] } } });
    const rolls = new Set(), counts = new Set(), bino = []; for (let i = 0; i < 300; i++) { const l = S.rollLoot(R, 'desert_pyramid', 5); rolls.add(l.filter(q => q[1] === 'bread').length); for (const q of l) if (q[1] === 'bread') counts.add(q[2]); else bino.push(q[2]); }
    out.providers = [Math.max(...rolls), Math.max(...counts), +(bino.reduce((a, b) => a + b, 0) / Math.max(1, bino.length)).toFixed(1)]; // (no real table given for it: the game's own)
    S.setStructs(null);
    return out; });
  ok(r.before, 'without the jar a chest rolls the game\'s own table', r);
  ok(r.real.join('|') === 'diamond|enchanted_book|golden_horse_armor|name_tag', 'with the jar, structure chests roll the real loot tables', r.real);
  ok(r.providers[0] === 4 && r.providers[1] === 3 && r.providers[2] > 3.5 && r.providers[2] < 6.5, "loot tables' numbers as Java's: uniform ranges reach their top, binomial counts work", r.providers);
  ok(r.fallback, 'a table the jar lacks falls back to the game\'s own', r.fallback);
};
