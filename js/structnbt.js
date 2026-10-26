// Mojang structure files (.nbt) from a client.jar the player picked: read here, on the player's device, and kept in
// this browser only (nothing is uploaded or shipped with the game). The world generator then builds villages, outposts,
// bastion remnants, igloos, shipwrecks, ocean ruins, ruined portals and fossils from the real pieces.

// gzip -> bytes (the deflate decoder is userpack.js's inflateRaw)
function gunzip(b) {
  if (b[0] !== 0x1f || b[1] !== 0x8b) return b;
  const flg = b[3]; let p = 10;
  if (flg & 4) p += 2 + (b[p] | (b[p + 1] << 8));
  if (flg & 8) { while (b[p++]); }
  if (flg & 16) { while (b[p++]); }
  if (flg & 2) p += 2;
  const isize = (b[b.length - 4] | (b[b.length - 3] << 8) | (b[b.length - 2] << 16) | (b[b.length - 1] << 24)) >>> 0;
  return inflateRaw(b, isize || b.length * 6, p);
}
// NBT (big-endian, Java edition) -> plain objects; lists of compounds become arrays, int/long arrays become arrays
function parseNBT(b) {
  const d = new DataView(b.buffer, b.byteOffset, b.byteLength), td = new TextDecoder(); let p = 0;
  const str = () => { const n = d.getUint16(p); p += 2; const s = td.decode(b.subarray(p, p + n)); p += n; return s; };
  const val = t => {
    switch (t) {
      case 1: return d.getInt8(p++);
      case 2: { const v = d.getInt16(p); p += 2; return v; }
      case 3: { const v = d.getInt32(p); p += 4; return v; }
      case 4: { const v = d.getInt32(p) * 4294967296 + d.getUint32(p + 4); p += 8; return v; }
      case 5: { const v = d.getFloat32(p); p += 4; return v; }
      case 6: { const v = d.getFloat64(p); p += 8; return v; }
      case 7: { const n = d.getInt32(p); p += 4; const v = Array.from(b.subarray(p, p + n), x => (x << 24) >> 24); p += n; return v; }
      case 8: return str();
      case 9: { const et = b[p++], n = d.getInt32(p); p += 4; const a = new Array(Math.max(0, n)); for (let i = 0; i < n; i++) a[i] = val(et); return a; }
      case 10: { const o = {}; for (;;) { const ct = b[p++]; if (!ct) break; const k = str(); o[k] = val(ct); } return o; }
      case 11: { const n = d.getInt32(p); p += 4; const a = new Array(n); for (let i = 0; i < n; i++) { a[i] = d.getInt32(p); p += 4; } return a; }
      case 12: { const n = d.getInt32(p); p += 4; const a = new Array(n); for (let i = 0; i < n; i++) { a[i] = d.getInt32(p) * 4294967296 + d.getUint32(p + 4); p += 8; } return a; }
    }
    throw new Error('bad nbt tag ' + t);
  };
  const t = b[p++]; str(); return val(t);
}
// a structure file -> { s: size, p: palette ("name[k=v,...]"), b: Int32Array x,y,z,palette index per block,
// n: { block index: { jigsaw / chest data } }, e: [[x, y, z, entity id]] }
function compactStructure(nbt) {
  const pal = (nbt.palette || (nbt.palettes && nbt.palettes[0]) || []).map(s => {
    const name = s.Name.replace('minecraft:', ''), pr = s.Properties; return pr ? name + '[' + Object.keys(pr).sort().map(k => k + '=' + pr[k]).join(',') + ']' : name;
  });
  const blocks = nbt.blocks || [], b = new Int32Array(blocks.length * 4), n = {};
  blocks.forEach((bl, i) => {
    b[i * 4] = bl.pos[0]; b[i * 4 + 1] = bl.pos[1]; b[i * 4 + 2] = bl.pos[2]; b[i * 4 + 3] = bl.state;
    const t = bl.nbt; if (!t) return;
    if (t.id === 'minecraft:jigsaw' || t.pool) n[i] = { j: 1, name: (t.name || '').replace('minecraft:', ''), pool: (t.pool || '').replace('minecraft:', ''), target: (t.target || '').replace('minecraft:', ''), fin: (t.final_state || 'minecraft:air').replace('minecraft:', ''), joint: t.joint || 'rollable' };
    else if (t.LootTable) n[i] = { loot: t.LootTable.replace('minecraft:', '') };
    else if (t.mode === 'DATA' && t.metadata) n[i] = { data: t.metadata }; // data markers: "chest", "supply_chest", "drowned"...
  });
  const e = (nbt.entities || []).map(en => [en.pos[0], en.pos[1], en.pos[2], ((en.nbt && en.nbt.id) || '').replace('minecraft:', '')]);
  return { s: nbt.size, p: pal, b, n, e };
}
const STRUCT_DIRS = ['village/', 'pillager_outpost/', 'bastion/', 'igloo/', 'shipwreck/', 'underwater_ruin/', 'ruined_portal/', 'fossil/', 'nether_fossils/'];
// zip index -> { path: compact structure } for the structures the generator knows how to use
function extractStructures(files, progress) {
  const root = Object.keys(files).find(k => k.includes('data/minecraft/structures/')); if (!root) return null;
  const base = root.slice(0, root.indexOf('data/minecraft/structures/')) + 'data/minecraft/structures/';
  const out = {};
  for (const k of Object.keys(files)) {
    if (!k.startsWith(base) || !k.endsWith('.nbt')) continue;
    const rel = k.slice(base.length, -4); if (!STRUCT_DIRS.some(d => rel.startsWith(d))) continue;
    try { out[rel] = compactStructure(parseNBT(gunzip(files[k]()))); } catch (e) { /* skip unreadable files */ }
  }
  return Object.keys(out).length ? out : null;
}
// chest loot tables (data/minecraft/loot_tables/chests/*.json) keyed like the structure files name them
function extractLoot(files) {
  const out = {};
  for (const k of Object.keys(files)) {
    const i = k.indexOf('data/minecraft/loot_tables/chests/'); if (i < 0 || !k.endsWith('.json')) continue;
    try { out[k.slice(i + 27, -5)] = JSON.parse(new TextDecoder().decode(files[k]())); } catch (e) { /* skip */ }
  }
  return out;
}
// boot: hand the stored pieces to the generator here and in every worker (before any chunk is asked for)
async function loadStructs() {
  const d = await upGetKey('structs'); if (!d || !d.t) return false;
  S.setStructs(d); UPACK.structs = true;
  if (typeof workers !== 'undefined') for (const w of workers) w.postMessage({ type: 'structs', data: d });
  return true;
}
