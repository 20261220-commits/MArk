// The dragon flies and fights as in Java: round the nodes of the island, its head and neck hit for 10 and its wings
// throw players away, only the head takes full damage, it lands, looks, roars and breathes, takes off after losing a
// quarter of its health sitting, and a blown-up healing crystal hurts it and sends it at the player
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => { const o = {}, wait = ms => new Promise(r => setTimeout(r, ms));
    switchDim(1, 100.5, 49, 0.5, 'end'); for (let i = 0; i < 400 && (UI.menu === 'loading' || W.dim !== 1); i++) await wait(100); showMenu(null); UI.paused = true;
    PL.x = 0.5; PL.z = 6.5; PL.y = S.END_PORTAL_Y + 30; PL.mode = 'creative'; PL.flying = true;
    for (let i = 0; i < 40; i++) { W.pump(); await wait(50); }
    const D = () => ENT.find(e => e.type === 'ender_dragon' && !e.dead);
    for (let i = 0; i < 60 && !D(); i++) { gameTick(); await wait(20); }
    const d = D(); o.has = !!d; if (!d) return o;
    const T = n => { for (let i = 0; i < n; i++) gameTick(); };
    // flight: round the island, never stopping, turning gradually
    let minR = 1e9, maxR = 0, minY = 1e9, maxY = 0, maxTurn = 0, minSp = 1e9, maxSp = 0, nodes = new Set();
    d.phase = 'hold'; d.phaseT = 0; d.tgt = null; const land0 = Math.random; Math.random = () => { const v = land0(); return v < 0.12 ? 0.12 + v : v; }; // (no landing or strafing while watching it fly)
    for (let i = 0; i < 1200; i++) { const y0 = d.yaw; gameTick(); if (d.phase !== 'hold') { d.phase = 'hold'; } const rr = Math.hypot(d.x, d.z); minR = Math.min(minR, rr); maxR = Math.max(maxR, rr); minY = Math.min(minY, d.y); maxY = Math.max(maxY, d.y);
      let dy = Math.abs(d.yaw - y0) % (Math.PI * 2); if (dy > Math.PI) dy = Math.PI * 2 - dy; maxTurn = Math.max(maxTurn, dy); if (i > 200) { const sp = Math.hypot(d.vx, d.vz); minSp = Math.min(minSp, sp); maxSp = Math.max(maxSp, sp); } nodes.add(d.node); }
    Math.random = land0;
    o.fly = { minR: Math.round(minR), maxR: Math.round(maxR), minY: Math.round(minY), maxY: Math.round(maxY), maxTurnDeg: +(maxTurn * 180 / Math.PI).toFixed(1), minSp: +minSp.toFixed(2), maxSp: +maxSp.toFixed(2), nodes: nodes.size };
    // its head hurts: 10
    PL.mode = 'survival'; PL.flying = false; PL.health = 20; PL.inv = 0; d.hurt = 0;
    d.phase = 'sit_scan'; d.phaseT = 0; d.scanT = 0; d.vx = d.vy = d.vz = 0; d.x = 0; d.z = 0.5; d.y = S.END_PORTAL_Y + 4; d.yaw = 0; // facing -z: its head at z -6
    const hd = dragonParts(d)[0]; PL.x = (hd[1] + hd[4]) / 2; PL.z = (hd[3] + hd[6]) / 2; PL.y = hd[2] - 0.5; PL.vx = PL.vy = PL.vz = 0;
    const h0 = PL.health; dragonAI(d); o.head = +(h0 - PL.health).toFixed(1);
    // its wing (flying) throws the player and hurts 5
    d.phase = 'hold'; d.phaseT = 0; d.tgt = [0, d.y, -100]; PL.health = 20; PL.inv = 0; d.hurt = 0; PL.dragonHitT = -9;
    const wg = dragonParts(d)[3]; PL.x = (wg[1] + wg[4]) / 2 + 1; PL.z = (wg[3] + wg[6]) / 2; PL.y = d.y; PL.vx = PL.vy = PL.vz = 0;
    dragonAI(d); o.wing = { dmg: +(20 - PL.health).toFixed(1), push: +Math.hypot(PL.vx, PL.vz).toFixed(2), away: Math.sign(PL.x - d.x) === Math.sign(PL.vx) };
    // sitting, its wings don't push: the player can walk up to it
    d.phase = 'sit_scan'; d.phaseT = 0; d.scanT = 0; d.hurt = 0; PL.health = 20; PL.inv = 0; d.x = 0; d.z = 0.5; d.y = S.END_PORTAL_Y + 4; d.yaw = 0;
    const wg2 = dragonParts(d)[3]; PL.x = (wg2[1] + wg2[4]) / 2 + 1; PL.z = (wg2[3] + wg2[6]) / 2 - 3; PL.y = d.y - 1; PL.vx = PL.vy = PL.vz = 0;
    dragonAI(d); o.sitPush = +Math.hypot(PL.vx, PL.vz).toFixed(2);
    // only the head takes full damage
    d.phase = 'hold'; d.inv = 0; let hp = d.hp; d.hitPart = 'body'; hurtMob(d, 10, PL); o.body = +(hp - d.hp).toFixed(2);
    d.inv = 0; hp = d.hp; d.hitPart = 'head'; hurtMob(d, 10, PL); o.headDmg = +(hp - d.hp).toFixed(2);
    // the raycast finds the head
    d.boxes = dragonParts(d).map(b => b.slice(1)); d.boxParts = dragonParts(d).map(b => b[0]); /* (as each tick does) */ PL.mode = 'creative'; const hd2 = dragonParts(d)[0]; PL.x = (hd2[1] + hd2[4]) / 2; PL.z = (hd2[3] + hd2[6]) / 2 - 3; PL.y = hd2[2] - 1.1; PL.yaw = Math.PI; /* (in front of its face: from behind, the neck is in the way, as in Java) */ PL.pitch = 0;
    const ray = raycast(5); o.ray = ray && ray.type === 'ent' ? ray.part : String(ray && ray.type); PL.mode = 'survival';
    // sitting: looks at a near player, roars, breathes
    d.hp = 200; d.phase = 'land'; d.phaseT = 0; d.tgt = null; d.x = 0; d.z = 0.5; d.y = S.END_PORTAL_Y + 4.3; d.vx = d.vy = d.vz = 0; PL.x = 0.5; PL.z = -9; PL.y = S.END_PORTAL_Y + 1; PL.health = 20; PL.inv = 0;
    const seen = new Set(); let cloud = false; const c0 = ENT.filter(e => e.kind === 'cloud').length;
    for (let i = 0; i < 400; i++) { gameTick(); PL.health = 20; seen.add(d.phase); if (ENT.filter(e => e.kind === 'cloud').length > c0) cloud = true; if (d.phase === 'sit_flame' && cloud) break; }
    o.sit = { phases: [...seen], cloud };
    // a quarter of its health lost sitting: it takes off
    d.phase = 'sit_scan'; d.phaseT = 0; d.scanT = 0; d.sitDmg = 0; for (let i = 0; i < 6; i++) { d.inv = 0; d.hitPart = 'head'; hurtMob(d, 9, PL); } o.takeoff = d.phase;
    // a healing crystal blown up: 10 damage, then it goes for the player
    d.phase = 'hold'; d.phaseT = 0; d.inv = 0; const cr = ENT.find(e => e.type === 'end_crystal' && !e.dead); d.healFrom = cr; hp = d.hp; PL.x = cr.x + 20; PL.z = cr.z; PL.y = cr.y; PL.health = 20;
    crystalHurt(cr, 1, PL); o.crystal = { dmg: +(hp - d.hp).toFixed(1), phase: d.phase };
    return o; });
  console.log(JSON.stringify(r));
  ok(r.has, 'the End has its dragon');
  const f = r.fly || {};
  ok(f.maxR < 110 && f.minR > 5 && f.minY > 45 && f.maxY < 130 && f.nodes >= 4, 'it goes round the island from node to node', f);
  ok(f.maxTurnDeg < 12 && f.minSp > 0.3 && f.maxSp < 1.6, 'always flying forward, turning gradually (no turning on the spot)', f);
  ok(r.head >= 9 && r.head <= 11, 'its head hits for 10', r.head);
  ok(r.wing && r.wing.dmg >= 4 && r.wing.dmg <= 6 && r.wing.push > 0.3 && r.wing.away, 'its wing throws the player away and hits for 5', r.wing);
  ok(r.sitPush === 0, 'sitting, its wings push no one away (the player can reach its head)', r.sitPush);
  ok(r.body === 3.5 && r.headDmg === 10, 'the body takes a quarter (plus 1), the head all of it', [r.body, r.headDmg]);
  ok(r.ray === 'head', 'aiming at its head hits the head', r.ray);
  ok(r.sit && ['sit_scan', 'sit_roar', 'sit_flame'].every(k => r.sit.phases.includes(k)) && r.sit.cloud, 'landed, it looks, roars and breathes dragon\'s breath', r.sit);
  ok(r.takeoff === 'takeoff', 'a quarter of its health lost sitting: it takes off', r.takeoff);
  ok(r.crystal && r.crystal.dmg === 10 && r.crystal.phase === 'strafe', 'its healing crystal blown up: 10 damage, and it goes for the player', r.crystal);
  ok(!p.errs.length, 'no page errors', p.errs);
};
