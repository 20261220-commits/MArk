// 1.17 world height (y 0..255): new worlds stand on a bedrock floor at y 0; chunks saved by the 1.18 version (y -64..319)
// or by the old 128-high version load into it
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative', '1717');
  const r = await p.evaluate(() => {
    const o = { minY: S.MINY, maxY: S.MAXY, gen: W.gen };
    const x = Math.floor(PL.x), z = Math.floor(PL.z); o.floor = getBlock(x, 0, z) === BID.bedrock; o.top = topY(x, z);
    // a 1.18 save: rows from y -64, 384 high
    const n18 = 256 * 384, b18 = new Uint16Array(n18), m18 = new Uint8Array(n18), at = (y, i) => ((y + 64) << 8) | i;
    b18[at(-30, 5)] = BID.deepslate; b18[at(10, 5)] = BID.diamond_block; b18[at(300, 5)] = BID.glass;
    const d = { cx: 0, cz: 0, blocks: b18, meta: m18, light: new Uint8Array(n18), biome: new Uint8Array(256), tileList: [[at(10, 7), { type: 'chest', items: [] }], [at(-20, 7), { type: 'x' }]] };
    fitRows(d, -64, 384, 0);
    o.from18 = { len: d.blocks.length === S.CVOL, diamond: d.blocks[(10 << 8) | 5] === BID.diamond_block, floor: d.blocks[5] === BID.bedrock, tiles: d.tileList.map(([i]) => i), glassGone: !d.blocks.includes(BID.glass) };
    // the old 128-high version: rows from y 0, 128 high; the rest is sky
    const b12 = new Uint16Array(256 * 128); b12[(100 << 8) | 3] = BID.gold_block;
    const d2 = { cx: 0, cz: 0, blocks: b12, meta: new Uint8Array(256 * 128), light: new Uint8Array(256 * 128), biome: new Uint8Array(256), tileList: [] };
    fitRows(d2, 0, 128, 0);
    o.from128 = { len: d2.blocks.length === S.CVOL, gold: d2.blocks[(100 << 8) | 3] === BID.gold_block, sky: d2.blocks[(200 << 8) | 3] === 0 };
    return o;
  });
  ok(r.minY === 0 && r.maxY === 256 && r.gen === 2, 'the world is 1.17: y 0..255, the 1.17 generator', r);
  ok(r.floor && r.top > 40 && r.top < 200, 'new terrain stands on the bedrock floor at y 0', r);
  ok(r.from18.len && r.from18.diamond && r.from18.floor && r.from18.glassGone, 'a 1.18 save loads: y 0..255 kept, bedrock floor back, nothing outside the height', r.from18);
  ok(r.from18.tiles.length === 1 && r.from18.tiles[0] === ((10 << 8) | 7), 'its chests move with their blocks', r.from18.tiles);
  ok(r.from128.len && r.from128.gold && r.from128.sky, 'a save from the 128-high version loads too', r.from128);
  ok(!p.errs.length, 'no page errors', p.errs);
};
