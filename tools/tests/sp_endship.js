// the end ship from the structure files, with what it holds: its brewing stand keeps the two potions of healing II it was
// built with, its chests get end city loot, an item frame holds the elytra, and a shulker sits at its sentry marker.
// (Stand-in pieces built here: the real ones come only from the player's own client.jar.)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(() => {
    const SZ = { base_floor: [10, 4, 10], base_roof: [12, 2, 12], bridge_end: [5, 6, 2], bridge_gentle_stairs: [5, 7, 8], bridge_piece: [5, 6, 4], bridge_steep_stairs: [5, 7, 4], fat_tower_base: [13, 4, 13], fat_tower_middle: [13, 8, 13], fat_tower_top: [17, 6, 17], second_floor_1: [12, 8, 12], second_floor_2: [12, 8, 12], second_roof: [14, 2, 14], ship: [13, 24, 29], third_floor_1: [14, 8, 14], third_floor_2: [14, 8, 14], third_roof: [16, 2, 16], tower_base: [7, 7, 7], tower_floor: [7, 4, 7], tower_piece: [7, 4, 7], tower_top: [9, 5, 9] };
    const pot = (slot, k) => ({ Slot: slot, id: 'minecraft:potion', Count: 1, tag: { Potion: 'minecraft:' + k } });
    const t = {};
    for (const k in SZ) {
      const blocks = [{ pos: [1, 0, 1], state: 0 }];
      if (k === 'ship') blocks.push(
        { pos: [6, 1, 6], state: 1, nbt: { id: 'minecraft:brewing_stand', Items: [pot(0, 'strong_healing'), pot(2, 'strong_healing')] } },
        { pos: [4, 1, 10], state: 2 }, { pos: [4, 2, 10], state: 3, nbt: { id: 'minecraft:structure_block', mode: 'DATA', metadata: 'Chest' } },
        { pos: [6, 2, 20], state: 3, nbt: { id: 'minecraft:structure_block', mode: 'DATA', metadata: 'Elytra' } },
        { pos: [8, 1, 14], state: 3, nbt: { id: 'minecraft:structure_block', mode: 'DATA', metadata: 'Sentry' } },
        { pos: [6, 1, 3], state: 4 });
      t['end_city/' + k] = compactStructure({ size: SZ[k], palette: [{ Name: 'minecraft:purpur_block' }, { Name: 'minecraft:brewing_stand', Properties: { has_bottle_0: 'true', has_bottle_1: 'false', has_bottle_2: 'true' } }, { Name: 'minecraft:chest', Properties: { facing: 'north', type: 'single', waterlogged: 'false' } }, { Name: 'minecraft:structure_block' }, { Name: 'minecraft:dragon_wall_head', Properties: { facing: 'north' } }], blocks, entities: [] });
    }
    S.setStructs({ t });
    const out = { compact: JSON.stringify(Object.values(t['end_city/ship'].n)) };
    // an end city with a ship (about half of them have one, as in Java)
    let found = null; const seed = W.seed;
    for (let a = -8; a <= 8 && !found; a++) for (let c = -8; c <= 8 && !found; c++) {
      const nA = S.makeNoise(seed + 201), nB = S.makeNoise(seed + 202), city = S.endCityAt(seed, a, c, nA, nB); if (!city) continue;
      const ship = S.assembleEndCity(seed, city.x, city.y, city.z, S.rng(S.hash32(seed, a, c, 64)).int(4)).find(q => q.path === 'end_city/ship'); if (ship) found = ship;
    }
    if (!found) { S.setStructs(null); return out; }
    const tiles = [], heads = []; let brewCk = null;
    for (let cx = found.box[0] >> 4; cx <= found.box[3] >> 4; cx++) for (let cz = found.box[2] >> 4; cz <= found.box[5] >> 4; cz++) {
      const d = S.genChunk(seed, cx, cz, 1); for (const q of d.tiles) { tiles.push(q); if (q.t === 'brew') brewCk = [cx, cz, d, q]; }
      for (let i = 0; i < d.blocks.length; i++) if (d.blocks[i] === BID.mob_head && ((d.meta[i] >> 2) & 7) === 3) heads.push(i);
    }
    out.kinds = tiles.map(q => q.t + (q.mob ? ':' + q.mob : '') + (q.frame ? ':frame:' + q.item : '')).sort();
    out.heads = heads.length;
    if (brewCk) { // the chunk as the game takes it in: the brewing stand's slots
      const [cx, cz, d, q] = brewCk, fx = 100000 + cx, _ = addChunk(fx, cz, d, d.tiles), ch = [...W.chunks.values()].find(k => k.cx === fx && k.cz === cz), tile = ch && ch.tiles.get(q.i);
      out.brew = tile && tile.items.map(s => s ? ITEMS[s.id].key : null);
      for (const [k, v] of [...W.chunks]) if (v.cx === fx) W.chunks.delete(k);
    }
    S.setStructs(null);
    return out; });
  ok(/strong_healing/.test(r.compact), "a structure file's brewing stand keeps the potions it holds", r.compact);
  ok(r.kinds && r.kinds.includes('brew') && r.kinds.includes('chest') && r.kinds.includes('mob:frame:elytra') && r.kinds.includes('mob:shulker'), 'the end ship has its brewing stand, chest, elytra in a frame and shulker', r.kinds);
  ok(r.heads > 0, 'the dragon head is on the ship', r.heads);
  ok(r.brew && r.brew[0] === 'strong_healing_potion' && r.brew[2] === 'strong_healing_potion' && !r.brew[1], 'its brewing stand holds two potions of healing II', r.brew);
};
