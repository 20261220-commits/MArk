// death messages as Java words them (who did it, named mobs, falls high or low, "while fighting / trying to escape"),
// armour hidden with O in the inventory (it still protects), and naming in the anvil (Korean typing keeps its box,
// the item's name in the box, an emptied box takes a name off, a rename alone is never too expensive)
module.exports = async ({ ok, srv, b, lib }) => {
  const p = await lib.page(b, srv); await lib.newWorld(p, 'survival');
  const r = await p.evaluate(async () => {
    const o = {}, X = Math.floor(PL.x), Y = 160, Z = Math.floor(PL.z);
    W.meta.gamerules = { ...(W.meta.gamerules || {}), doMobSpawning: false, doImmediateRespawn: true, keepInventory: true };
    let last = null; const sd = UI.showDeath; UI.showDeath = m => { last = m; return sd(m); };
    const fresh = () => { PL.dead = false; PL.health = 20; PL.inv = 0; PL.credit = null; PL.x = X + .5; PL.y = Y; PL.z = Z + .5; PL.mode = 'survival'; };
    const kill = (f) => { fresh(); last = null; f(); return last; };
    const mob = (t, name) => { const e = spawnMob(t, X + 2, Y, Z); e.ai = null; if (name) e.name = name; return e; };
    o.zombie = kill(() => hurtPlayer(100, 'mob', mob('zombie')));
    o.named = kill(() => hurtPlayer(100, 'mob', mob('zombie', '철수')));
    o.arrow = kill(() => { const s = mob('skeleton'); hurtPlayer(100, 'arrow', s, { x: 0, y: 0, z: 0 }); });
    o.creeper = kill(() => { const c = mob('creeper'); MOB_BLAST = c; hurtPlayer(100, 'explosion', c, { x: X, y: Y, z: Z }); MOB_BLAST = false; });
    o.highFall = kill(() => { PL.fallDist = 20; hurtPlayer(100, 'fall'); });
    o.lowFall = kill(() => { PL.fallDist = 4; hurtPlayer(100, 'fall'); });
    o.doomed = kill(() => { hurtPlayer(1, 'mob', mob('spider')); PL.inv = 0; PL.fallDist = 20; hurtPlayer(100, 'fall'); });
    o.lavaEscape = kill(() => { hurtPlayer(1, 'mob', mob('zombie')); PL.inv = 0; hurtPlayer(100, 'lava'); });
    o.lava = kill(() => hurtPlayer(100, 'lava'));
    o.void = kill(() => hurtPlayer(100, 'void'));
    for (const e of [...ENT]) if (e.kind === 'mob') removeEnt(e);
    // armour hidden
    UI.showDeath = sd; fresh(); INV.armor[0] = { id: IID.iron_helmet, n: 1 }; INV.armor[1] = { id: IID.iron_chestplate, n: 1 };
    UI.openScreen('inv'); await new Promise(r => setTimeout(r, 100));
    GUI.hover = GUI.slots.findIndex(s => s.group === 'armor' && s.get() === INV.armor[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', key: 'o', bubbles: true }));
    o.hid = !!INV.armor[0].hid; UI.closeScreen();
    const m = { userData: null }; o.defense = typeof armorPoints === 'function' ? armorPoints() : null;
    o.chestId = IID.iron_chestplate; o.plArmor = (() => { const a = INV.armor.map(s => s && !s.hid ? s.id : 0); return a; })();
    // anvil
    UI.openScreen('anvil', { x: X, y: Y - 1, z: Z }); await new Promise(r => setTimeout(r, 100));
    GUI.ctx.items[0] = { id: IID.diamond_sword, n: 1 }; UI.renderScreen();
    o.prefill = $('aname').value;
    const box = $('aname'); box.value = '전설의 검'; box.dispatchEvent(new Event('input', { bubbles: true }));
    o.sameBox = $('aname') === box; const res = anvilResult(GUI.ctx); o.renamed = res && res.out.name; o.cost = res && res.cost;
    GUI.ctx.items[0] = { id: IID.diamond_sword, n: 1, name: '옛 이름', rp: 63 }; UI.renderScreen(); const b2 = $('aname'); b2.value = ''; b2.dispatchEvent(new Event('input', { bubbles: true }));
    const r2 = anvilResult(GUI.ctx); o.cleared = r2 && !('name' in r2.out); o.cheapRename = r2 && r2.cost <= 39;
    UI.closeScreen();
    return o;
  });
  ok(/좀비에게 살해당했습니다$/.test(r.zombie) && /철수에게 살해당했습니다$/.test(r.named), 'killed by a mob: its name (a named one by its name)', [r.zombie, r.named]);
  ok(/스켈레톤에게 저격당했습니다$/.test(r.arrow) && /크리퍼에 의해 폭파당했습니다$/.test(r.creeper), 'shot by a skeleton, blown up by a creeper', [r.arrow, r.creeper]);
  ok(/높은 곳에서 떨어졌습니다$/.test(r.highFall) && /땅에 너무 세게 떨어졌습니다$/.test(r.lowFall) && /거미 때문에 추락사했습니다$/.test(r.doomed), 'falls: from high, too hard, doomed by a mob', [r.highFall, r.lowFall, r.doomed]);
  ok(/좀비에게서 도망치려고 용암에서 수영하려 했습니다$/.test(r.lavaEscape) && /용암에서 수영하려 했습니다$/.test(r.lava) && /세계 밖으로 떨어졌습니다$/.test(r.void), 'lava (escaping a mob too), the void', [r.lavaEscape, r.lava, r.void]);
  ok(r.hid && r.plArmor[0] === 0 && r.plArmor[1] === r.chestId, 'O over a worn helmet hides it (sent to others as not worn), the chestplate stays', r);
  ok(r.prefill === '다이아몬드 검' && r.sameBox && r.renamed === '전설의 검' && r.cost === 1, 'anvil: the name in the box, typing keeps the box (Korean input), a rename costs 1', r);
  ok(r.cleared && r.cheapRename, 'anvil: an emptied box takes the name off; a rename alone is never too expensive', r);
  ok(!p.errs.length, 'no page errors', p.errs);
};
