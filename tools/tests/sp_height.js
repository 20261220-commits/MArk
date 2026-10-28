// 1.18 world height (y -64..319): chunks saved by the older versions (y 0..255, or the first 128-high version) load
// into it with their blocks and chests in place and the new depths below y 0
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'creative', '1818');
  const r = await p.evaluate(() => {
    const o = { minY: S.MINY, maxY: S.MAXY, gen: W.gen };
    // a save from before 1.18: rows from y 0, 256 high
    const n = 256 * 256, b0 = new Uint16Array(n), m0 = new Uint8Array(n);
    b0[(10 << 8) | 5] = BID.diamond_block; b0[(250 << 8) | 5] = BID.glass; b0[5] = BID.bedrock;
    const d = { cx: 0, cz: 0, blocks: b0, meta: m0, light: new Uint8Array(n), biome: new Uint8Array(256), tileList: [[(10 << 8) | 7, { type: 'chest', items: [] }]] };
    fitRows(d, 0, 256, 0);
    const at = (y, i) => ((y - S.MINY) << 8) | i;
    o.old = { len: d.blocks.length === S.CVOL, diamond: d.blocks[at(10, 5)] === BID.diamond_block, glass: d.blocks[at(250, 5)] === BID.glass,
      deep: d.blocks[at(-30, 9)] !== 0 || d.blocks[at(-31, 9)] !== 0, floor: d.blocks[at(-64, 9)] === BID.bedrock, oldFloor: d.blocks[at(0, 5)] !== BID.bedrock, tile: d.tileList[0][0] === at(10, 7) };
    // the first version: 128 high, the rest is sky
    const b1 = new Uint16Array(256 * 128); b1[(100 << 8) | 3] = BID.gold_block;
    const d1 = { cx: 0, cz: 0, blocks: b1, meta: new Uint8Array(256 * 128), light: new Uint8Array(256 * 128), biome: new Uint8Array(256), tileList: [] };
    fitRows(d1, 0, 128, 0);
    o.v128 = { gold: d1.blocks[at(100, 3)] === BID.gold_block, sky: d1.blocks[at(200, 3)] === 0 };
    // a Nether chunk from before 1.18: nothing is made below y 0
    const b2 = new Uint16Array(n); b2[(5 << 8) | 1] = BID.netherrack;
    const d2 = { cx: 0, cz: 0, blocks: b2, meta: new Uint8Array(n), light: new Uint8Array(n), biome: new Uint8Array(256), tileList: [] };
    fitRows(d2, 0, 256, -1);
    o.nether = { rack: d2.blocks[at(5, 1)] === BID.netherrack, below: d2.blocks.subarray(0, 64 << 8).every(v => v === 0) };
    return o;
  });
  ok(r.minY === -64 && r.maxY === 320 && r.gen === 3, 'the world is 1.18: y -64..319, the 1.18 generator', r);
  ok(r.old.len && r.old.diamond && r.old.glass && r.old.tile, 'an older save keeps its blocks and chests at the same heights', r.old);
  ok(r.old.deep && r.old.floor && r.old.oldFloor, 'below y 0 it gets the 1.18 depths; the old bedrock floor turns to deepslate', r.old);
  ok(r.v128.gold && r.v128.sky, 'a save from the 128-high version loads too', r.v128);
  ok(r.nether.rack && r.nether.below, 'an old Nether chunk gets nothing below y 0', r.nether);
  ok(!p.errs.length, 'no page errors', p.errs);
};
