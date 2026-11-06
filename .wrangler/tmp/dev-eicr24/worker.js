var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// wrangler-modules-watch:wrangler:modules-watch
var init_wrangler_modules_watch = __esm({
  "wrangler-modules-watch:wrangler:modules-watch"() {
    init_modules_watch_stub();
  }
});

// ../../../tmp/claude-0/-home-user/8ba2eef5-aaaf-549c-a99f-e87a6bda5cd6/scratchpad/wr/node_modules/wrangler/templates/modules-watch-stub.js
var init_modules_watch_stub = __esm({
  "../../../tmp/claude-0/-home-user/8ba2eef5-aaaf-549c-a99f-e87a6bda5cd6/scratchpad/wr/node_modules/wrangler/templates/modules-watch-stub.js"() {
    init_wrangler_modules_watch();
  }
});

// js/mpcore.js
var require_mpcore = __commonJS({
  "js/mpcore.js"(exports, module) {
    init_modules_watch_stub();
    function mpSha256(str) {
      const b = unescape(encodeURIComponent(str)), n = b.length, words = [], K = [], H = [];
      const frac = /* @__PURE__ */ __name((x) => (x - Math.floor(x)) * 4294967296 | 0, "frac");
      for (let c = 2, k = 0; k < 64; c++) {
        let pr = true;
        for (let d = 2; d * d <= c; d++) if (c % d === 0) {
          pr = false;
          break;
        }
        if (pr) {
          if (k < 8) H[k] = frac(Math.pow(c, 1 / 2));
          K[k++] = frac(Math.pow(c, 1 / 3));
        }
      }
      for (let i = 0; i < n; i++) words[i >> 2] |= b.charCodeAt(i) << 24 - i % 4 * 8;
      words[n >> 2] |= 128 << 24 - n % 4 * 8;
      const L = ((n + 8 >> 6) + 1) * 16;
      for (let i = words.length; i < L; i++) words[i] = words[i] | 0;
      words[L - 1] = n * 8;
      const r = /* @__PURE__ */ __name((x, k) => x >>> k | x << 32 - k, "r"), w = new Array(64);
      for (let o = 0; o < L; o += 16) {
        let [a, bb, c, d, e, f, g, h] = H;
        for (let i = 0; i < 64; i++) {
          w[i] = i < 16 ? words[o + i] | 0 : (r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ w[i - 2] >>> 10) + w[i - 7] + (r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ w[i - 15] >>> 3) + w[i - 16] | 0;
          const t1 = h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] | 0, t2 = (r(a, 2) ^ r(a, 13) ^ r(a, 22)) + (a & bb ^ a & c ^ bb & c) | 0;
          h = g;
          g = f;
          f = e;
          e = d + t1 | 0;
          d = c;
          c = bb;
          bb = a;
          a = t1 + t2 | 0;
        }
        H[0] = H[0] + a | 0;
        H[1] = H[1] + bb | 0;
        H[2] = H[2] + c | 0;
        H[3] = H[3] + d | 0;
        H[4] = H[4] + e | 0;
        H[5] = H[5] + f | 0;
        H[6] = H[6] + g | 0;
        H[7] = H[7] + h | 0;
      }
      return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
    }
    __name(mpSha256, "mpSha256");
    function mpWorldCore2(store, out) {
      const S = store.state, players = /* @__PURE__ */ new Map(), auth = /* @__PURE__ */ new Map(), cache = /* @__PURE__ */ new Map(), fails = /* @__PURE__ */ new Map();
      const blank = /* @__PURE__ */ __name(() => ({ rec: null, edits: [], tiles: {} }), "blank");
      const CACHE_MAX = 600;
      const entry = /* @__PURE__ */ __name((dk) => {
        let p = cache.get(dk);
        if (p) {
          cache.delete(dk);
          cache.set(dk, p);
          return p;
        }
        p = store.keys.has(dk) ? Promise.resolve(store.load(dk)).then((c) => c || blank(), () => blank()) : Promise.resolve(blank());
        cache.set(dk, p);
        if (cache.size > CACHE_MAX && store.pending) for (const k of cache.keys()) {
          if (cache.size <= CACHE_MAX * 0.9) break;
          if (k !== dk && !store.pending(k)) cache.delete(k);
        }
        return p;
      }, "entry");
      const touch = /* @__PURE__ */ __name((dk, e) => {
        store.keys.add(dk);
        store.save(dk, e);
      }, "touch");
      const prefix = /* @__PURE__ */ __name((dim) => ({ "-1": "n", 1: "e" })[dim] || "", "prefix");
      const tmy = /* @__PURE__ */ __name(() => S.meta && S.meta.my != null ? +S.meta.my : -64, "tmy");
      const chunkKey = /* @__PURE__ */ __name((dim, x, z) => prefix(dim) + (x >> 4) + "," + (z >> 4), "chunkKey");
      const send = /* @__PURE__ */ __name((p, o) => out(p.id, o), "send");
      const others = /* @__PURE__ */ __name((p, o, sameDim) => {
        for (const q of players.values()) if (q !== p && q.joined && (!sameDim || q.dim === p.dim)) out(q.id, o);
      }, "others");
      function pickAuth(dim) {
        const cur = auth.get(dim), here = [...players.values()].filter((q) => q.joined && q.dim === dim), awake = here.filter((q) => !q.away);
        if (cur != null && here.some((q) => q.id === cur) && !(players.get(cur).away && awake.length)) return;
        if (here.length) auth.set(dim, (awake[0] || here[0]).id);
        else auth.delete(dim);
        const o = { t: "auth", dim, id: auth.has(dim) ? auth.get(dim) : null };
        for (const q of players.values()) if (q.joined) out(q.id, o);
      }
      __name(pickAuth, "pickAuth");
      function setDim(p, dim) {
        if (p.dim === dim) return;
        const old = p.dim;
        p.dim = dim;
        if (old != null) pickAuth(old);
        pickAuth(dim);
        send(p, { t: "auth", dim, id: auth.get(dim) });
      }
      __name(setDim, "setDim");
      let lastTick = 0, tickAcc = 0, saveN = 0;
      function tick() {
        if (!players.size || !S.meta) {
          lastTick = 0;
          return;
        }
        const g = S.meta.gamerules || {}, now = Date.now();
        tickAcc += lastTick ? Math.min(5e3, now - lastTick) / 50 : 20;
        lastTick = now;
        const n = Math.floor(tickAcc);
        tickAcc -= n;
        if (g.doDaylightCycle !== false) S.time += n;
        if (g.doWeatherCycle !== false && (S.weatherT = (S.weatherT || 24e3) - n) <= 0) {
          const on = S.rain < 0.5;
          S.rain = on ? 1 : 0;
          S.thunder = on && Math.random() < 0.3;
          S.weatherT = on ? 12e3 + Math.random() * 12e3 : 12e3 + Math.random() * 168e3;
        }
        const ow = [...players.values()].filter((q) => q.joined && q.dim === 0 && q.s && q.s.mode !== "spectator");
        const asleep = ow.length && ow.every((q) => q.s.sleep);
        S.sleepT = asleep ? (S.sleepT || 0) + 1 : 0;
        if (S.sleepT >= 5) {
          S.time = Math.ceil(S.time / 24e3) * 24e3;
          S.rain = 0;
          S.thunder = false;
          S.sleepT = 0;
          for (const q of players.values()) if (q.joined) out(q.id, { t: "wake" });
        }
        for (const q of players.values()) if (q.joined) out(q.id, { t: "time", time: S.time, rain: S.rain, thunder: S.thunder });
        if (++saveN % 10 === 0) store.saveState();
      }
      __name(tick, "tick");
      function message(id, m) {
        let p = players.get(id);
        if (!p) {
          p = { id, name: null, dim: null, joined: false, s: null };
          players.set(id, p);
        }
        p.seenAt = Date.now();
        const from = id;
        m.from = from;
        switch (m.t) {
          case "create":
            if (S.meta) {
              send(p, { t: "error", msg: "\uC774 \uC11C\uBC84\uC5D0\uB294 \uC774\uBBF8 \uC138\uACC4\uAC00 \uC788\uC2B5\uB2C8\uB2E4" });
              return;
            }
            S.meta = { name: String(m.meta.name || "\uC11C\uBC84 \uC138\uACC4").slice(0, 40), seed: m.meta.seed, gen: +m.meta.gen || 1, exp: m.meta.exp !== false, mode: m.meta.mode === "creative" ? "creative" : "survival", my: m.meta.my != null ? +m.meta.my : -64, diff: +m.meta.diff || 2, cheats: !!m.meta.cheats, spawn: m.meta.spawn || null, gamerules: m.meta.gamerules || {}, shared: m.meta.shared || {} };
            if (m.meta.priv && typeof m.meta.priv.key === "string" && m.meta.priv.key.length >= 6) S.meta.priv = { key: m.meta.priv.key.slice(0, 32) };
            S.time = +m.meta.time || 1e3;
            S.rain = 0;
            store.saveState();
            store.log(`\uC0C8 \uC138\uACC4 "${S.meta.name}" (\uC2DC\uB4DC ${S.meta.seed})`);
            send(p, { t: "created" });
            return;
          case "join": {
            if (!S.meta) {
              send(p, { t: "noworld" });
              return;
            }
            p.name = (typeof m.name === "string" && m.name.trim() ? m.name.trim() : "\uC190\uB2D8").slice(0, 16);
            p.skin = m.skin || null;
            p.account = null;
            S.logins = S.logins || {};
            const lg = m.login && typeof m.login.name === "string" && typeof m.login.cred === "string" && /^[0-9a-f]{64}$/.test(m.login.cred) ? m.login : null;
            if (lg) {
              const k = lg.name.trim().slice(0, 16).toLowerCase(), now = Date.now();
              let rec = S.logins[k];
              p.name = p.name || lg.name.trim().slice(0, 16);
              const f = fails.get(k);
              if (f && f.n >= 5 && now - f.t < 3e4) {
                send(p, { t: "error", msg: "\uBE44\uBC00\uBC88\uD638\uB97C \uC5EC\uB7EC \uBC88 \uD2C0\uB838\uC2B5\uB2C8\uB2E4. 30\uCD08 \uB4A4\uC5D0 \uB2E4\uC2DC \uD574 \uBCF4\uC138\uC694" });
                return;
              }
              const prevs = (Array.isArray(lg.prev) ? lg.prev : []).filter((q) => q && typeof q.name === "string" && typeof q.cred === "string" && /^[0-9a-f]{64}$/.test(q.cred)).slice(0, 6);
              const proves = /* @__PURE__ */ __name((r, cred) => r && mpSha256(r.salt + cred) === r.h, "proves");
              if (rec && !proves(rec, lg.cred)) {
                const old = prevs.find((q) => q.name.trim().toLowerCase() === k && proves(rec, q.cred));
                if (old) {
                  rec.h = mpSha256(rec.salt + lg.cred);
                  store.saveState();
                  store.log(`${k} \uACC4\uC815\uC758 \uBE44\uBC00\uBC88\uD638\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4`);
                }
              }
              if (!rec) for (const q of prevs) {
                const ok2 = q.name.trim().slice(0, 16).toLowerCase(), r = S.logins[ok2];
                if (ok2 === k || !proves(r, q.cred)) continue;
                r.h = mpSha256(r.salt + lg.cred);
                S.logins[k] = r;
                delete S.logins[ok2];
                if (S.players["a:" + ok2] && !S.players["a:" + k]) {
                  S.players["a:" + k] = S.players["a:" + ok2];
                  delete S.players["a:" + ok2];
                }
                rec = r;
                store.saveState();
                store.log(`${ok2} \uACC4\uC815\uC774 ${k}(\uC73C)\uB85C \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4`);
                break;
              }
              if (rec && mpSha256(rec.salt + lg.cred) !== rec.h) {
                fails.set(k, { n: (f && now - f.t < 3e4 ? f.n : 0) + 1, t: now });
                send(p, { t: "error", msg: `\uBE44\uBC00\uBC88\uD638\uAC00 \uD2C0\uB838\uC2B5\uB2C8\uB2E4 ("${p.name}" \uACC4\uC815\uC740 \uC774 \uC138\uACC4\uC5D0 \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4)` });
                return;
              }
              fails.delete(k);
              p.account = k;
              p.prevNames = prevs.map((q) => q.name.trim().slice(0, 16).toLowerCase()).filter((n) => n && n !== k);
              if (!rec) {
                const salt = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");
                S.logins[k] = { salt, h: mpSha256(salt + lg.cred), at: now };
                const prevK = prevs.map((q) => "a:" + q.name.trim().slice(0, 16).toLowerCase()).filter((n) => n !== "a:" + k && S.players[n] && !S.logins[n.slice(2)]);
                const old = prevK[0] || Object.keys(S.players).find((n) => n.toLowerCase() === k) || Object.keys(S.players).find((n) => !n.includes(":") && n.toLowerCase() === p.name.toLowerCase()) || (S.accounts && S.accounts[p.name] ? "g:" + S.accounts[p.name] : null);
                if (old && S.players[old] && !S.players["a:" + k]) {
                  S.players["a:" + k] = S.players[old];
                  delete S.players[old];
                }
                if (S.accounts) delete S.accounts[p.name];
                store.saveState();
                store.log(`${p.name} \uACC4\uC815\uC744 \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4`);
              }
            }
            if (p.account && p.name.toLowerCase() !== p.account && S.logins[p.name.toLowerCase()]) {
              send(p, { t: "error", msg: `"${p.name}"\uC740(\uB294) \uB2E4\uB978 \uACC4\uC815\uC758 \uC774\uB984\uC774\uB77C \uB2C9\uB124\uC784\uC73C\uB85C \uC4F8 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4` });
              return;
            }
            p.key = p.account ? "a:" + p.account : p.name;
            p.dev = typeof m.dev === "string" ? m.dev.slice(0, 40) : null;
            for (const q of [...players.values()]) if (q !== p && q.joined && (q.name.toLowerCase() === p.name.toLowerCase() || q.key === p.key)) {
              const same = p.account && q.key === p.key || p.dev && q.dev === p.dev && q.key === p.key || Date.now() - (q.seenAt || 0) > 2e4;
              if (!same) {
                send(p, { t: "error", msg: p.account && q.key === p.key ? "\uC774 \uACC4\uC815\uC73C\uB85C \uC774\uBBF8 \uC811\uC18D\uD574 \uC788\uC2B5\uB2C8\uB2E4" : "\uAC19\uC740 \uC774\uB984\uC758 \uD50C\uB808\uC774\uC5B4\uAC00 \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4" });
                return;
              }
              send(q, { t: "kicked", msg: "\uB2E4\uB978 \uACF3(\uB610\uB294 \uB2E4\uC2DC \uC5F0\uACB0\uD55C \uC774 \uAE30\uAE30)\uC5D0\uC11C \uAC19\uC740 \uC774\uB984\uC73C\uB85C \uC811\uC18D\uD588\uC2B5\uB2C8\uB2E4" });
              leave(q.id);
              if (store.drop) store.drop(q.id);
            }
            if (!p.account && S.logins[p.name.toLowerCase()]) {
              send(p, { t: "error", msg: `"${p.name}" \uC774\uB984\uC5D0\uB294 \uBE44\uBC00\uBC88\uD638\uAC00 \uAC78\uB824 \uC788\uC2B5\uB2C8\uB2E4. \uD0C0\uC774\uD2C0 \u2192 \uB85C\uADF8\uC778\uC5D0\uC11C \uC774 \uC774\uB984\uACFC \uBE44\uBC00\uBC88\uD638\uB85C \uB85C\uADF8\uC778\uD55C \uB4A4 \uC811\uC18D\uD558\uC138\uC694` });
              return;
            }
            p.joined = true;
            const prevRec = (p.prevNames || []).filter((n) => S.players["a:" + n] && !S.logins[n] && "a:" + n !== p.key);
            send(p, {
              t: "welcome",
              you: from,
              meta: S.meta,
              time: S.time,
              rain: S.rain,
              thunder: S.thunder,
              pdata: S.players[p.key] || null,
              prevRec,
              stored: [...store.keys],
              players: [...players.values()].filter((q) => q !== p && q.joined).map((q) => ({ id: q.id, name: q.name, skin: q.skin })),
              auth: Object.fromEntries(auth)
            });
            others(p, { t: "peer", id: from, name: p.name, skin: p.skin });
            store.log(`${p.name} \uC811\uC18D (${[...players.values()].filter((q) => q.joined).length}\uBA85)`);
            return;
          }
          case "dim":
            setDim(p, +m.dim || 0);
            return;
          case "pl":
            p.s = m;
            if (m.dim !== p.dim && p.joined) setDim(p, m.dim);
            others(p, m);
            return;
          case "pdata": {
            const nm = p.key || p.name || (typeof m.name === "string" ? m.name.slice(0, 16) : null);
            if (nm && m.d && typeof m.d === "object") {
              const at = Math.max(Date.now(), (S.players[nm] && S.players[nm].at || 0) + 1);
              m.d.at = at;
              S.players[nm] = m.d;
              p.pdataAt = Date.now();
              store.saveState();
              send(p, { t: "pdataok", at, seq: m.seq });
            }
            return;
          }
          // stamped with the server's clock: the player's device keeps the stamp with its own copy
          case "meta":
            if (S.meta && m.shared) {
              S.meta.shared = { ...S.meta.shared, ...m.shared };
              if (m.spawn) S.meta.spawn = m.spawn;
              if (m.gamerules) S.meta.gamerules = m.gamerules;
              store.saveState();
            }
            return;
          case "timeset":
            S.time = +m.time || S.time;
            if (m.rain != null) {
              S.rain = m.rain;
              S.thunder = !!m.thunder;
            }
            return;
          case "chunk": {
            const dk = prefix(m.dim) + m.cx + "," + m.cz;
            if (!store.keys.has(dk)) {
              send(p, { t: "chunkdata", cx: m.cx, cz: m.cz, dim: m.dim, none: true });
              return;
            }
            entry(dk).then((c) => {
              const o = { t: "chunkdata", cx: m.cx, cz: m.cz, dim: m.dim, edits: c.edits.length ? c.edits : null, tiles: Object.keys(c.tiles).length ? c.tiles : null, tmy: tmy() };
              if (c.rec && c.rec.b) Object.assign(o, { b: c.rec.b, m: c.rec.m, l: c.rec.l, bio: c.rec.bio, tl: c.rec.t || [], ch: c.rec.ch, my: c.rec.my, it: c.rec.it, mobs: c.rec.mobs || null });
              else {
                o.none = true;
                if (c.rec) {
                  o.mobs = c.rec.mobs || null;
                  o.stored = 1;
                }
              }
              send(p, o);
            });
            return;
          }
          case "chunkmobs":
            Promise.all((m.dks || []).filter((dk) => store.keys.has(dk)).map((dk) => entry(dk).then((c) => c.rec && c.rec.mobs ? [dk, c.rec.mobs] : null))).then((l) => send(p, { t: "chunkmobs", l: l.filter(Boolean) }));
            return;
          case "store":
            if (typeof m.dk !== "string" || !m.rec) return;
            entry(m.dk).then((c) => {
              c.rec = m.rec;
              c.edits = [];
              c.tiles = {};
              c.recChanged = true;
              touch(m.dk, c);
            });
            others(p, { t: "stored", dk: m.dk });
            return;
          case "mobsnap":
            if (auth.get(p.dim) !== from) return;
            for (const [dk, list] of m.l || []) entry(dk).then((c) => {
              if (c.rec) c.rec.mobs = list;
              else c.rec = { v: 2, it: m.it, mobs: list };
              c.recChanged = true;
              touch(dk, c);
            });
            return;
          case "sets":
            if (auth.get(p.dim) !== from) return;
            for (const e of m.l || []) {
              const dk = chunkKey(m.dim, e[0], e[2]);
              entry(dk).then((c) => {
                c.edits.push(e);
                if (c.edits.length > 2e4) c.edits.splice(0, c.edits.length - 2e4);
                touch(dk, c);
              });
            }
            others(p, m, true);
            return;
          case "tile":
            if (typeof m.dk === "string" && m.tile) {
              const i = m.y - tmy() << 8 | (m.z & 15) << 4 | m.x & 15;
              entry(m.dk).then((c) => {
                c.tiles[i] = m.tile;
                touch(m.dk, c);
              });
            }
            others(p, m, true);
            return;
          case "skin":
            if (p.joined && m.skin && typeof m.skin === "object" && JSON.stringify(m.skin).length < 2e5) {
              p.skin = m.skin;
              others(p, { t: "skin", id: from, skin: p.skin });
            }
            return;
          // a new skin mid-game: everyone sees it (and so do later arrivals)
          case "takeprev": {
            const n = typeof m.name === "string" ? m.name.toLowerCase() : "";
            if (!p.joined || !p.account || !(p.prevNames || []).includes(n) || !S.players["a:" + n] || S.logins[n]) return;
            S.players[p.key] = S.players["a:" + n];
            delete S.players["a:" + n];
            store.saveState();
            store.log(`${p.name}: \uC774\uC804 \uC544\uC774\uB514(${n})\uC758 \uAE30\uB85D\uC744 \uC774\uC5B4\uBC1B\uC558\uC2B5\uB2C8\uB2E4`);
            send(p, { t: "tookprev" });
            return;
          }
          case "hb":
            return;
          // a game saying it's still there (seenAt is set above)
          case "chat":
          case "sys":
          case "hitfx":
            others(p, m);
            return;
          case "nick": {
            const n = typeof m.name === "string" ? m.name.trim().slice(0, 16) : "";
            if (!p.joined || !n || /[\s<>"'&\\]/.test(n)) return;
            const lo = n.toLowerCase();
            if ([...players.values()].some((q) => q !== p && q.joined && q.name.toLowerCase() === lo) || S.logins && S.logins[lo] && lo !== p.account) {
              send(p, { t: "error", msg: `"${n}"\uC740(\uB294) \uC4F8 \uC218 \uC5C6\uB294 \uB2C9\uB124\uC784\uC785\uB2C8\uB2E4 (\uB2E4\uB978 \uD50C\uB808\uC774\uC5B4\uB098 \uACC4\uC815\uC758 \uC774\uB984)` });
              return;
            }
            const old = p.name;
            p.name = n;
            if (!p.account) {
              if (S.players[old] && !S.players[n]) {
                S.players[n] = S.players[old];
                delete S.players[old];
              }
              p.key = n;
              store.saveState();
            }
            for (const q of players.values()) if (q.joined) out(q.id, { t: "nick", id: p.id, name: n, old });
            return;
          }
          case "away":
            p.away = !!m.on;
            if (p.dim != null) pickAuth(p.dim);
            return;
        }
        if (m.t === "pl" && Number.isFinite(m.x) && Number.isFinite(m.y) && Number.isFinite(m.z)) {
          p.lastPl = { x: m.x, y: m.y, z: m.z, yaw: +m.yaw || 0, pitch: +m.pitch || 0, dim: m.dim | 0 };
          p.plAt = Date.now();
        }
        const to = m.to;
        delete m.to;
        if (typeof to === "number") {
          if (players.has(to)) out(to, m);
        } else if (to === "auth") {
          const a = auth.get(m.dim != null ? m.dim : p.dim);
          if (a != null && a !== from) out(a, m);
        } else if (to === "dim") others(p, m, true);
        else others(p, m);
      }
      __name(message, "message");
      function leave(id) {
        const p = players.get(id);
        if (!p) return;
        players.delete(id);
        if (!p.joined) return;
        const rec = p.key && S.players[p.key];
        if (rec && rec.s && p.lastPl && (p.plAt || 0) > (p.pdataAt || 0)) {
          const l = p.lastPl;
          Object.assign(rec.s, { x: l.x, y: l.y, z: l.z, yaw: l.yaw, pitch: l.pitch });
          rec.dim = l.dim;
        }
        others(p, { t: "gone", id });
        store.log(`${p.name} \uB098\uAC10 (${[...players.values()].filter((q) => q.joined).length}\uBA85)`);
        if (p.dim != null) pickAuth(p.dim);
        store.saveState();
      }
      __name(leave, "leave");
      function trim(keep) {
        if (!store.pending) return;
        for (const k of cache.keys()) {
          if (cache.size <= keep) break;
          if (!store.pending(k)) cache.delete(k);
        }
      }
      __name(trim, "trim");
      return { message, leave, tick, trim, cacheSize: /* @__PURE__ */ __name(() => cache.size, "cacheSize"), players, auth };
    }
    __name(mpWorldCore2, "mpWorldCore");
    if (typeof module !== "undefined") module.exports = { mpWorldCore: mpWorldCore2, mpSha256 };
  }
});

// .wrangler/tmp/bundle-lzas7V/middleware-loader.entry.ts
init_modules_watch_stub();

// .wrangler/tmp/bundle-lzas7V/middleware-insertion-facade.js
init_modules_watch_stub();

// cf/worker.js
init_modules_watch_stub();
var import_mpcore = __toESM(require_mpcore());
var { mpWorldCore } = import_mpcore.default;
var worker_default = {
  async fetch(req, env) {
    const url = new URL(req.url), u = url.pathname;
    if (u === "/skin") return skinProxy(url);
    if (u === "/profile") return profileLookup(url);
    if (u === "/ping") return new Response("ok", { headers: { "cache-control": "no-store" } });
    if (u.startsWith("/mp") || u === "/rooms" || u === "/stats" || u === "/report") return env.NEMO.get(env.NEMO.idFromName("main")).fetch(req);
    if (env.ASSETS && (u === "/" || u === "/index.html")) {
      const r = await env.ASSETS.fetch(new Request(new URL("/nemo-1.18.html", url)));
      return new Response(r.body, { status: r.status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    }
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response("not found", { status: 404 });
  }
};
var cors = { "access-control-allow-origin": "*" };
var PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[|::|fc|fd)/i;
var IMG_SIG = [[[137, 80, 78, 71], "image/png"], [[255, 216, 255], "image/jpeg"], [[71, 73, 70], "image/gif"], [[66, 77], "image/bmp"]];
var latin = /* @__PURE__ */ __name((b, a, z) => String.fromCharCode(...b.subarray(a, z)), "latin");
var imgType = /* @__PURE__ */ __name((b) => {
  for (const [sig, t] of IMG_SIG) if (sig.every((x, i) => b[i] === x)) return t;
  if (b.length > 12 && latin(b, 0, 4) === "RIFF" && latin(b, 8, 12) === "WEBP") return "image/webp";
  return null;
}, "imgType");
var pngSize = /* @__PURE__ */ __name((b) => {
  if (!(b.length > 24 && imgType(b) === "image/png")) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return [v.getUint32(16), v.getUint32(20)];
}, "pngSize");
var okHost = /* @__PURE__ */ __name((u) => /^https?:$/.test(u.protocol) && !(PRIVATE_HOST.test(u.hostname) || /\.(local|internal)$/i.test(u.hostname)), "okHost");
async function getLimited(url, max, accept) {
  const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (nemo skin import)", accept }, signal: AbortSignal.timeout(8e3) });
  if (!r.ok) return { status: r.status };
  if (+(r.headers.get("content-length") || 0) > max) return { status: 413 };
  const buf = new Uint8Array(await r.arrayBuffer());
  return buf.length > max ? { status: 413 } : { buf, type: r.headers.get("content-type") || "", url: r.url || String(url) };
}
__name(getLimited, "getLimited");
async function skinProxy(url) {
  const end = /* @__PURE__ */ __name((code, msg) => new Response(msg, { status: code, headers: { "content-type": "text/plain; charset=utf-8", ...cors } }), "end");
  let target;
  try {
    target = new URL(url.searchParams.get("u") || "");
  } catch (e) {
    return end(400, "bad url");
  }
  if (!okHost(target)) return end(400, "not allowed");
  try {
    const r = await getLimited(target, 2e6, "image/*,text/html;q=0.8,*/*;q=0.5");
    if (!r.buf) return end(502, "status " + r.status);
    let found = imgType(r.buf) ? r : null;
    if (!found && /html/i.test(r.type)) {
      const html = new TextDecoder().decode(r.buf), seen = /* @__PURE__ */ new Set(), cands = [];
      for (const m of html.matchAll(/(?:src|href|content|data-src|data-skin|data-url)\s*=\s*["']([^"'<>]+)["']/gi)) {
        let x;
        try {
          x = new URL(m[1].replace(/&amp;/g, "&"), r.url);
        } catch (e) {
          continue;
        }
        if (!okHost(x) || seen.has(x.href)) continue;
        seen.add(x.href);
        const k = x.href.toLowerCase(), score = (/\.png(\?|$)/.test(k) ? 2 : 0) + (/skin/.test(k) ? 2 : 0) + (/download/.test(k) ? 3 : 0) + (/texture/.test(k) ? 2 : 0) - (/(logo|icon|avatar|head|render|preview|banner|favicon|sprite)/.test(k) ? 3 : 0);
        if (score > 0 || /\.(png|jpe?g|webp|gif)(\?|$)/.test(k)) cands.push([score, x]);
      }
      cands.sort((a, b) => b[0] - a[0]);
      for (const [, x] of cands.slice(0, 10)) {
        const c = await getLimited(x, 5e5, "image/*").catch(() => ({}));
        if (!c.buf || !imgType(c.buf)) continue;
        const sz = pngSize(c.buf);
        if (!sz || sz[0] === 64 && (sz[1] === 64 || sz[1] === 32)) {
          found = c;
          if (sz) break;
        }
      }
    }
    if (!found || found.buf.length > 5e5) return end(415, "no skin picture there");
    return new Response(found.buf, { headers: { "content-type": imgType(found.buf), ...cors, "cache-control": "public, max-age=3600" } });
  } catch (e) {
    return end(502, "fetch failed");
  }
}
__name(skinProxy, "skinProxy");
async function profileLookup(url) {
  const send = /* @__PURE__ */ __name((code, o) => new Response(JSON.stringify(o), { status: code, headers: { "content-type": "application/json; charset=utf-8", ...cors, "cache-control": code === 200 ? "public, max-age=300" : "no-store" } }), "send");
  const name = (url.searchParams.get("name") || "").trim();
  if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) return send(400, { error: "bad name" });
  const text = /* @__PURE__ */ __name((b) => new TextDecoder().decode(b), "text");
  try {
    let id = null;
    for (const x of ["https://api.mojang.com/users/profiles/minecraft/" + name, "https://api.minecraftservices.com/minecraft/profile/lookup/name/" + name]) {
      const r2 = await getLimited(x, 1e5, "application/json").catch(() => ({}));
      if (r2.buf && r2.buf.length) {
        try {
          const j = JSON.parse(text(r2.buf));
          if (j.id) {
            id = j.id;
            break;
          }
        } catch (e) {
        }
      }
    }
    if (!id) return send(404, { error: "no such player" });
    const r = await getLimited("https://sessionserver.mojang.com/session/minecraft/profile/" + id, 1e5, "application/json");
    if (!r.buf) return send(502, { error: "profile" });
    const prof = JSON.parse(text(r.buf)), tp = (prof.properties || []).find((p) => p.name === "textures");
    const tex = tp ? JSON.parse(text(b64dec(tp.value))).textures || {} : {}, fix = /* @__PURE__ */ __name((x) => x ? String(x).replace(/^http:/, "https:") : null, "fix");
    return send(200, { name: prof.name || name, id, skin: fix(tex.SKIN && tex.SKIN.url), slim: !!(tex.SKIN && tex.SKIN.metadata && tex.SKIN.metadata.model === "slim"), cape: fix(tex.CAPE && tex.CAPE.url) });
  } catch (e) {
    return send(502, { error: "lookup failed" });
  }
}
__name(profileLookup, "profileLookup");
function b64dec(s) {
  const bin = atob(String(s).replace(/\s+/g, "")), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
__name(b64dec, "b64dec");
function b64enc(u) {
  let s = "";
  for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768));
  return btoa(s);
}
__name(b64enc, "b64enc");
var hex = /* @__PURE__ */ __name((buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join(""), "hex");
var randHex = /* @__PURE__ */ __name((n) => hex(crypto.getRandomValues(new Uint8Array(n))), "randHex");
async function* gzLines(gz) {
  const rd = new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip")).pipeThrough(new TextDecoderStream()).getReader();
  let rest = "";
  for (; ; ) {
    const { value, done } = await rd.read();
    if (done) break;
    rest += value;
    let i;
    while ((i = rest.indexOf("\n")) >= 0) {
      yield rest.slice(0, i);
      rest = rest.slice(i + 1);
    }
  }
  if (rest) yield rest;
}
__name(gzLines, "gzLines");
function githubBackup({ repo, token, branch = "world-backup", api = "https://api.github.com", file = "world.json.gz" }) {
  const H = { authorization: "Bearer " + token, accept: "application/vnd.github+json", "user-agent": "nemo-server", "content-type": "application/json" };
  const call = /* @__PURE__ */ __name(async (method, p, body, missing = [404]) => {
    const r = await fetch(api + "/repos/" + repo + p, { method, headers: H, body: body ? JSON.stringify(body) : void 0, signal: AbortSignal.timeout(6e4) });
    if (missing.includes(r.status) || method === "GET" && r.status === 409) return null;
    if (!r.ok) {
      const e = new Error(`GitHub ${method} ${p}: ${r.status} ${(await r.text()).slice(0, 200)}`);
      e.status = r.status;
      throw e;
    }
    return r.json();
  }, "call");
  const setRef = /* @__PURE__ */ __name(async (name, sha) => {
    if (!await call("PATCH", "/git/refs/heads/" + name, { sha, force: true }, [404, 422])) await call("POST", "/git/refs", { ref: "refs/heads/" + name, sha });
  }, "setRef");
  const dayOf = /* @__PURE__ */ __name((t) => Math.floor(t / 864e5), "dayOf"), stamp = /* @__PURE__ */ __name((c) => Date.parse(((c && c.message || "").match(/\d{4}-\d\d-\d\dT[\d:.]+Z/) || [])[0]), "stamp");
  return {
    branch,
    async days() {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const ref = await call("GET", "/git/ref/heads/" + branch + "-day" + d).catch(() => null);
        if (!ref) continue;
        const c = await call("GET", "/git/commits/" + ref.object.sha).catch(() => null), t = stamp(c);
        days.push([branch + "-day" + d, isFinite(t) ? t : 0]);
      }
      return days.sort((a, b) => b[1] - a[1]).map((d) => d[0]);
    },
    async loadGz(name) {
      const ref = await call("GET", "/git/ref/heads/" + name);
      if (!ref) return null;
      const c = await call("GET", "/git/commits/" + ref.object.sha), t = await call("GET", "/git/trees/" + c.tree.sha), f = t && t.tree.find((x) => x.path === file);
      if (!f) return null;
      const r = await fetch(api + "/repos/" + repo + "/git/blobs/" + f.sha, { headers: { ...H, accept: "application/vnd.github.raw" }, signal: AbortSignal.timeout(6e4) });
      if (!r.ok) throw new Error("GitHub blob " + r.status);
      return new Uint8Array(await r.arrayBuffer());
    },
    async save(gz, { suspect = false } = {}) {
      const content = b64enc(gz);
      const blob = await call("POST", "/git/blobs", { content, encoding: "base64" });
      const tree = await call("POST", "/git/trees", { tree: [{ path: file, mode: "100644", type: "blob", sha: blob.sha }] });
      const now = /* @__PURE__ */ new Date(), commit = await call("POST", "/git/commits", { message: (suspect ? "suspect world backup " : "world backup ") + now.toISOString(), tree: tree.sha, parents: [] });
      if (suspect) {
        await setRef(branch + "-suspect", commit.sha);
        return gz.length;
      }
      const head = await call("GET", "/git/ref/heads/" + branch);
      if (head && head.object.sha !== commit.sha) await setRef(branch + "-prev", head.object.sha);
      await setRef(branch, commit.sha);
      const day = dayOf(now.getTime()), name = branch + "-day" + day % 7, ref = await call("GET", "/git/ref/heads/" + name), c = ref && await call("GET", "/git/commits/" + ref.object.sha), t = stamp(c);
      if (!(isFinite(t) && dayOf(t) === day)) await setRef(name, commit.sha);
      return gz.length;
    }
  };
}
__name(githubBackup, "githubBackup");
var DROPPABLE = /* @__PURE__ */ new Set(["pl", "mobs", "vehs", "items", "xps", "time"]);
var WORLD_ID = /^[\w\-가-힣]{1,40}$/;
var CHUNK_KEY = /^[ne]?-?\d+,-?\d+$|^o:/;
var CODE_CH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var SAVE_EVERY = 15e3;
var MIRROR_EVERY = 3e5;
var BACKUP_EVERY = 30 * 6e4;
var J = /* @__PURE__ */ __name((o) => JSON.stringify(o), "J");
var NemoServer = class {
  static {
    __name(this, "NemoServer");
  }
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.worlds = /* @__PURE__ */ new Map();
    this.rooms = /* @__PURE__ */ new Map();
    this.nextId = 1;
    this.TRAFFIC = { since: Date.now(), total: 0, kinds: {} };
    this.IN = { frames: 0, kinds: {} };
    this.DROPS = [];
    this.STARTED = Date.now();
    this.BK = { blocked: false, lastError: null, restoredFrom: null, lastBackup: null };
    this.worldName = (env.WORLD || "world").replace(/[^\w\-가-힣]/g, "_");
    this.requireLogin = /^(1|true|yes)$/i.test(env.REQUIRE_LOGIN || "");
    this.backup = env.GITHUB_TOKEN && env.GITHUB_BACKUP_REPO ? githubBackup({ repo: env.GITHUB_BACKUP_REPO, token: env.GITHUB_TOKEN, branch: env.GITHUB_BACKUP_BRANCH || "world-backup", api: env.GITHUB_API_URL || void 0 }) : null;
    this.sql.exec("CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY, state TEXT)");
    this.sql.exec("CREATE TABLE IF NOT EXISTS chunks (wid TEXT, dk TEXT, data TEXT, PRIMARY KEY (wid, dk))");
    this.sql.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)");
    this.timers = false;
    this.isChanged = !!this.kv("changed");
    ctx.blockConcurrencyWhile(async () => {
      if (this.kv("restoring")) this.wipe();
      for (const r of this.sql.exec("SELECT id FROM worlds").toArray()) this.openWorld(r.id);
      if (![...this.worlds.values()].some((w) => w.state.meta)) await this.restoreIfEmpty();
    });
  }
  kv(k, v) {
    if (v === void 0) {
      const r = this.sql.exec("SELECT v FROM kv WHERE k = ?", k).toArray()[0];
      return r ? JSON.parse(r.v) : null;
    }
    if (v === null) this.sql.exec("DELETE FROM kv WHERE k = ?", k);
    else this.sql.exec("INSERT OR REPLACE INTO kv VALUES (?, ?)", k, J(v));
  }
  wipe() {
    this.sql.exec("DELETE FROM worlds");
    this.sql.exec("DELETE FROM chunks");
    this.kv("restoring", null);
    this.worlds.clear();
  }
  log(t) {
    console.log(t);
  }
  // the clock of the worlds, and their saving, run while anyone is connected (the object sleeps when no one is)
  startTimers() {
    if (this.timers) return;
    this.timers = true;
    this.tickT = setInterval(() => {
      for (const w of this.worlds.values()) if (w.conns.size) w.core.tick();
    }, 1e3);
    this.saveT = setInterval(() => {
      this.saveAll();
      this.deadCheck();
    }, SAVE_EVERY);
  }
  stopTimersIfIdle() {
    if ([...this.worlds.values()].some((w) => w.conns.size) || [...this.rooms.values()].some((r) => r.host)) return;
    clearInterval(this.tickT);
    clearInterval(this.saveT);
    this.timers = false;
  }
  // ---------- worlds ----------
  openWorld(id) {
    let w = this.worlds.get(id);
    if (w) return w;
    const state = { meta: null, time: 1e3, rain: 0, thunder: false, players: {}, weatherT: 12e3 + Math.random() * 168e3 };
    w = { id, state, keys: /* @__PURE__ */ new Set(), keysLoaded: false, dirty: /* @__PURE__ */ new Map(), stateDirty: false, conns: /* @__PURE__ */ new Map(), mirrorStateAt: 0, restorer: null, mirPend: /* @__PURE__ */ new Map() };
    const row = this.sql.exec("SELECT state FROM worlds WHERE id = ?", id).toArray()[0];
    if (row) {
      try {
        Object.assign(state, JSON.parse(row.state));
      } catch (e) {
        state.meta = null;
      }
    }
    const store = {
      state,
      keys: w.keys,
      load: /* @__PURE__ */ __name((dk) => {
        if (w.dirty.has(dk)) return w.dirty.get(dk);
        const r = this.sql.exec("SELECT data FROM chunks WHERE wid = ? AND dk = ?", id, dk).toArray()[0];
        try {
          return r ? JSON.parse(r.data) : null;
        } catch (e) {
          return null;
        }
      }, "load"),
      save: /* @__PURE__ */ __name((dk, c) => w.dirty.set(dk, c), "save"),
      pending: /* @__PURE__ */ __name((dk) => w.dirty.has(dk), "pending"),
      drop: /* @__PURE__ */ __name((cid) => {
        const c = w.conns.get(cid);
        if (c) setTimeout(() => c.close(), 200);
      }, "drop"),
      saveState: /* @__PURE__ */ __name(() => {
        w.stateDirty = true;
        this.changed();
      }, "saveState"),
      log: /* @__PURE__ */ __name((t) => this.log(`[${id}] ${t}`), "log")
    };
    let lastO = null, lastS = "";
    w.core = mpWorldCore(store, (cid, o) => {
      const c = w.conns.get(cid);
      if (!c) return;
      if (o !== lastO) {
        if (lastO === null) queueMicrotask(() => {
          lastO = null;
        });
        lastO = o;
        lastS = J(o);
      }
      c.send(lastS, DROPPABLE.has(o.t) && o.t + ":" + (o.id != null ? o.id : o.from != null ? o.from : ""));
    });
    this.worlds.set(id, w);
    return w;
  }
  ensureKeys(w) {
    if (w.keysLoaded) return;
    w.keysLoaded = true;
    for (const r of this.sql.exec("SELECT dk FROM chunks WHERE wid = ?", w.id).toArray()) w.keys.add(r.dk);
  }
  changed() {
    if (!this.isChanged) {
      this.isChanged = true;
      this.kv("changed", true);
    }
  }
  saveWorld(w, force) {
    const st = w.state;
    if (!st.meta) return;
    if (!st.wid) {
      st.wid = randHex(8);
      w.stateDirty = true;
    }
    const ver = st.cver || (st.cver = {}), out = [];
    if (w.dirty.size) this.changed();
    for (const [dk, c] of w.dirty) {
      const e = { rec: c.rec, edits: c.edits, tiles: c.tiles };
      ver[dk] = (ver[dk] || 0) + 1;
      w.stateDirty = true;
      this.sql.exec("INSERT OR REPLACE INTO chunks VALUES (?, ?, ?)", w.id, dk, J(e));
      w.keys.add(dk);
      out.push([dk, ver[dk], e]);
    }
    if (w.stateDirty) {
      this.sql.exec("INSERT OR REPLACE INTO worlds VALUES (?, ?)", w.id, J(st));
      w.stateDirty = false;
    }
    w.dirty.clear();
    for (const o of out) w.mirPend.set(o[0], o);
    const since = Date.now() - (w.mirrorStateAt || 0);
    if (force || w.mirPend.size && since > MIRROR_EVERY || since > MIRROR_EVERY * 2) {
      this.mirrorOut(w, [...w.mirPend.values()]);
      w.mirPend.clear();
    }
  }
  saveAll() {
    for (const w of this.worlds.values()) {
      if (w.conns.size) w.stateDirty = true;
      this.saveWorld(w);
      if (!w.conns.size) w.core.trim(0);
    }
    if (this.isChanged && this.backup && Date.now() - (this.kv("backupAt") || 0) > BACKUP_EVERY) this.ctx.storage.setAlarm(Date.now() + 1e3);
  }
  dropIfEmpty(w) {
    if (w.state.meta || w.conns.size) return;
    this.worlds.delete(w.id);
  }
  newWorldId() {
    for (; ; ) {
      const id = "w" + Date.now().toString(36) + randHex(2);
      if (!this.worlds.has(id) && !this.sql.exec("SELECT id FROM worlds WHERE id = ?", id).toArray().length) return id;
    }
  }
  // ---------- the players' copies ----------
  mirrorState(w) {
    const o = { ...w.state };
    delete o.logins;
    return o;
  }
  joinedConns(w) {
    return [...w.conns].filter(([id]) => {
      const p = w.core.players.get(id);
      return p && p.joined;
    }).map(([, c]) => c);
  }
  mirrorOut(w, l) {
    const to = this.joinedConns(w);
    w.mirrorStateAt = Date.now();
    if (!to.length || !w.state.meta) return;
    const s = J({ t: "mirror", wid: w.state.wid, state: this.mirrorState(w), l });
    for (const c of to) c.send(s);
  }
  mirrorFill(w, id, m) {
    const c = w.conns.get(id), st = w.state;
    if (!c || !st.meta) return;
    this.ensureKeys(w);
    const have = m.wid === st.wid && m.vers && typeof m.vers === "object" ? m.vers : {}, ver = st.cver || {};
    const need = [...w.keys].filter((dk) => !(dk in have) || have[dk] < (ver[dk] || 0));
    c.send(J({ t: "mirror", wid: st.wid, state: this.mirrorState(w), reset: m.wid !== st.wid, l: [] }));
    const next = /* @__PURE__ */ __name(() => {
      if (!w.conns.has(id) || !need.length) return;
      const l = need.splice(0, 6).map((dk) => {
        const e = w.core && w.dirty.get(dk);
        if (e) return [dk, ver[dk] || 0, e];
        const r = this.sql.exec("SELECT data FROM chunks WHERE wid = ? AND dk = ?", w.id, dk).toArray()[0];
        try {
          return r ? [dk, ver[dk] || 0, JSON.parse(r.data)] : null;
        } catch (er) {
          return null;
        }
      }).filter(Boolean);
      if (l.length) c.send(J({ t: "mirror", wid: st.wid, l }));
      setTimeout(next, 250);
    }, "next");
    setTimeout(next, 3e3);
  }
  restorePart(w, id, m) {
    const c = w.conns.get(id), st = w.state;
    if (!c) return;
    if (m.part === "begin") {
      if (st.meta || w.restorer != null || !m.state || !m.state.meta || !m.state.meta.seed) {
        c.send(J({ t: "error", msg: "\uC774 \uC138\uACC4\uB294 \uC11C\uBC84\uC5D0 \uC774\uBBF8 \uC788\uC2B5\uB2C8\uB2E4" }));
        return;
      }
      w.restorer = id;
      const s2 = { ...m.state };
      delete s2.logins;
      Object.assign(st, s2, { logins: {} });
      st.players = st.players || {};
      st.cver = {};
      w.keysLoaded = true;
      w.stateDirty = true;
      this.log(`[${w.id}] \uD50C\uB808\uC774\uC5B4\uC758 \uC0AC\uBCF8\uC5D0\uC11C \uC138\uACC4 "${st.meta.name}"\uB97C \uB418\uC0B4\uB9AC\uB294 \uC911`);
      return;
    }
    if (w.restorer !== id) return;
    if (m.part === "chunk") {
      for (const [dk, v, e] of m.l || []) {
        if (typeof dk !== "string" || !/^[ne]?-?\d+,-?\d+$/.test(dk) || !e) continue;
        this.sql.exec("INSERT OR REPLACE INTO chunks VALUES (?, ?, ?)", w.id, dk, J({ rec: e.rec || null, edits: e.edits || [], tiles: e.tiles || {} }));
        w.keys.add(dk);
        st.cver[dk] = +v || 1;
      }
      w.stateDirty = true;
      return;
    }
    if (m.part === "end") {
      w.restorer = null;
      this.saveWorld(w);
      this.changed();
      this.log(`[${w.id}] \uC138\uACC4\uB97C \uB418\uC0B4\uB838\uC2B5\uB2C8\uB2E4 (\uCCAD\uD06C ${w.keys.size}\uAC1C)`);
      c.send(J({ t: "restored" }));
      this.backupSoon();
    }
  }
  // ---------- backup ----------
  worldCounts() {
    const o = {};
    for (const r of this.sql.exec("SELECT wid, COUNT(*) AS n FROM chunks GROUP BY wid").toArray()) o[r.wid] = r.n;
    for (const w of this.worlds.values()) if (w.state.meta && !(w.id in o)) o[w.id] = 0;
    return o;
  }
  async snapshot() {
    for (const w of this.worlds.values()) this.saveWorld(w);
    const ws = this.sql.exec("SELECT id, state FROM worlds").toArray().filter((r) => {
      try {
        return JSON.parse(r.state).meta;
      } catch (e) {
        return false;
      }
    });
    if (!ws.length) return null;
    const cs = new CompressionStream("gzip"), wr = cs.writable.getWriter(), enc = new TextEncoder(), outP = new Response(cs.readable).arrayBuffer();
    const put = /* @__PURE__ */ __name((s) => wr.write(enc.encode(s)), "put");
    await put("NEMO3\n");
    for (const r of ws) {
      await put("W	" + r.id + "	" + r.state.replace(/\n/g, "") + "\n");
      for (const { dk } of this.sql.exec("SELECT dk FROM chunks WHERE wid = ?", r.id).toArray()) {
        const c = this.sql.exec("SELECT data FROM chunks WHERE wid = ? AND dk = ?", r.id, dk).toArray()[0];
        if (c) await put("C	" + r.id + "	" + dk + "	" + c.data.replace(/\n/g, "") + "\n");
      }
    }
    await wr.close();
    return new Uint8Array(await outP);
  }
  suspect(counts) {
    const m = this.kv("manifest");
    if (!m) return null;
    for (const id in m) {
      const n0 = m[id], n = counts[id];
      if (n == null) return "\uC138\uACC4 " + id + "\uC774(\uAC00) \uC5C6\uC5B4\uC9D0";
      if (n0 >= 10 && n < n0 * 0.7) return "\uC138\uACC4 " + id + "\uC758 \uCCAD\uD06C\uAC00 " + n0 + "\uAC1C\uC5D0\uC11C " + n + "\uAC1C\uB85C \uC904\uC5B4\uB4E6";
    }
    return null;
  }
  backupSoon() {
    if (this.backup) this.ctx.storage.setAlarm(Date.now() + 5e3);
  }
  async backupNow(why) {
    if (!this.backup || this.BK.blocked) return;
    try {
      const snap = await this.snapshot();
      if (!snap) return;
      const counts = this.worldCounts(), bad = this.suspect(counts);
      if (bad) {
        this.log("\u26A0 \uC774\uC0C1\uD55C \uBC31\uC5C5\uC774\uB77C \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uACE0 \uB530\uB85C \uB461\uB2C8\uB2E4 (" + bad + ")");
        this.BK.lastError = "\uC758\uC2EC \uBC31\uC5C5: " + bad;
        await this.backup.save(snap, { suspect: true });
        this.kv("backupAt", Date.now());
        return;
      }
      const hash = hex(await crypto.subtle.digest("SHA-1", snap));
      if (hash !== this.kv("backupHash")) {
        await this.backup.save(snap);
        this.kv("backupHash", hash);
        this.BK.lastBackup = { at: (/* @__PURE__ */ new Date()).toISOString(), why, kb: Math.round(snap.length / 1024) };
        this.log(`\uC138\uACC4 \uBC31\uC5C5 \uC644\uB8CC (${why}, ${Math.round(snap.length / 1024)} KB)`);
      }
      this.kv("manifest", counts);
      this.kv("backupAt", Date.now());
      this.kv("changed", null);
      this.isChanged = false;
    } catch (e) {
      this.BK.lastBackup = { at: (/* @__PURE__ */ new Date()).toISOString(), why, error: e.message };
      this.log("\uC138\uACC4 \uBC31\uC5C5 \uC2E4\uD328: " + e.message);
      throw e;
    }
  }
  // a restore point read through once to check it is whole, then written; a broken one gives way to the one before
  async checkGz(gz) {
    let w = 0, c = 0, first = true;
    for await (const line of gzLines(gz)) {
      if (first) {
        first = false;
        if (line !== "NEMO3") return null;
        continue;
      }
      if (line.startsWith("W	")) {
        try {
          if (JSON.parse(line.slice(line.indexOf("	", 2) + 1)).meta) w++;
        } catch (e) {
          return null;
        }
      } else if (line.startsWith("C	")) c++;
    }
    return w ? { worlds: w, chunks: c } : null;
  }
  async restoreFrom(gz) {
    this.kv("restoring", true);
    const ids = /* @__PURE__ */ new Set(), counts = {};
    for await (const line of gzLines(gz)) {
      const a = line.indexOf("	"), b = line.indexOf("	", a + 1);
      if (a < 0 || b < 0) continue;
      const kind = line.slice(0, a), id = line.slice(a + 1, b);
      if (!WORLD_ID.test(id)) continue;
      if (kind === "W") {
        this.sql.exec("INSERT OR REPLACE INTO worlds VALUES (?, ?)", id, line.slice(b + 1));
        ids.add(id);
        counts[id] = 0;
      } else if (kind === "C" && ids.has(id)) {
        const c = line.indexOf("	", b + 1);
        if (c < 0) continue;
        const dk = line.slice(b + 1, c);
        if (!CHUNK_KEY.test(dk)) continue;
        this.sql.exec("INSERT OR REPLACE INTO chunks VALUES (?, ?, ?)", id, dk, line.slice(c + 1));
        counts[id]++;
      }
    }
    this.kv("restoring", null);
    return ids.size ? { ids, counts } : null;
  }
  // its own restore points first; with none at all (a server just set up), those of GITHUB_RESTORE_FROM (the Render server's)
  async restoreOnce() {
    const r = await this.restoreFromBackup(this.backup);
    if (r !== "none" || !this.env.GITHUB_RESTORE_FROM) return r;
    this.log("\uC774 \uC11C\uBC84\uC758 \uBC31\uC5C5\uC774 \uC5C6\uC5B4 " + this.env.GITHUB_RESTORE_FROM + " \uC5D0\uC11C \uC138\uACC4\uB97C \uAC00\uC838\uC635\uB2C8\uB2E4");
    return this.restoreFromBackup(githubBackup({ repo: this.env.GITHUB_BACKUP_REPO, token: this.env.GITHUB_TOKEN, branch: this.env.GITHUB_RESTORE_FROM, api: this.env.GITHUB_API_URL || void 0 }));
  }
  async restoreFromBackup(B) {
    let sawAny = false, days = null;
    for (let i = 0; ; i++) {
      let name = i === 0 ? B.branch : i === 1 ? B.branch + "-prev" : null;
      if (i >= 2) {
        if (!days) days = await B.days();
        name = days[i - 2];
        if (!name) break;
      }
      let gz;
      try {
        gz = await B.loadGz(name);
      } catch (e) {
        if (i === 0) throw e;
        continue;
      }
      if (!gz) continue;
      sawAny = true;
      let ok = null;
      try {
        ok = await this.checkGz(gz);
      } catch (e) {
        ok = null;
      }
      if (!ok) {
        this.log(`\uBC31\uC5C5 ${name}\uC774(\uAC00) \uB9DD\uAC00\uC838 \uC788\uC5B4 \uADF8 \uC804 \uAC83\uC744 \uBD05\uB2C8\uB2E4`);
        continue;
      }
      this.wipe();
      const r = await this.restoreFrom(gz);
      if (!r) continue;
      for (const id of r.ids) this.openWorld(id);
      this.kv("manifest", r.counts);
      this.kv("backupHash", hex(await crypto.subtle.digest("SHA-1", gz)));
      this.BK.restoredFrom = name;
      this.log(`\uBC31\uC5C5\uC5D0\uC11C \uC138\uACC4\uB97C \uB418\uC0B4\uB838\uC2B5\uB2C8\uB2E4 (${name}, \uC138\uACC4 ${r.ids.size}\uAC1C)`);
      return "restored";
    }
    if (sawAny) throw new Error("\uC77D\uC744 \uC218 \uC788\uB294 \uBC31\uC5C5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4");
    return "none";
  }
  async restoreIfEmpty() {
    if (!this.backup) {
      if (!/^(1|true|yes)$/i.test(this.env.ALLOW_NO_BACKUP || "")) {
        this.BK.blocked = true;
        this.BK.lastError = "GITHUB_TOKEN \uBE44\uBC00 \uAC12\uC774 \uC5C6\uC2B5\uB2C8\uB2E4";
      }
      return;
    }
    try {
      const r = await this.restoreOnce();
      if (r === "none") this.log("\uBC31\uC5C5\uB41C \uC138\uACC4 \uC5C6\uC74C \u2014 \uC0C8 \uC138\uACC4\uB97C \uAE30\uB2E4\uB9BD\uB2C8\uB2E4");
      this.BK.blocked = false;
      this.BK.lastError = null;
    } catch (e) {
      this.BK.blocked = true;
      this.BK.lastError = e.message;
      this.log("\uBC31\uC5C5 \uBD88\uB7EC\uC624\uAE30 \uC2E4\uD328: " + e.message);
      await this.ctx.storage.setAlarm(Date.now() + 6e4);
    }
  }
  async alarm() {
    if (this.BK.blocked) {
      if (this.backup) await this.restoreIfEmpty();
      return;
    }
    if (this.kv("changed")) {
      this.isChanged = true;
      await this.backupNow(this.anyConn() ? "30\uBD84\uB9C8\uB2E4" : "\uBAA8\uB450 \uB098\uAC10");
    }
  }
  anyConn() {
    return [...this.worlds.values()].some((w) => w.conns.size);
  }
  // ---------- stats and lists ----------
  noteDrop(d) {
    this.DROPS.push(d);
    if (this.DROPS.length > 40) this.DROPS.shift();
  }
  countOut(s) {
    const n = s.length;
    this.TRAFFIC.total += n;
    const m = /"t":"([a-z_]+)"/.exec(s.slice(0, 60)), k = m ? m[1] : "?";
    this.TRAFFIC.kinds[k] = (this.TRAFFIC.kinds[k] || 0) + n;
  }
  stats() {
    const T = this.TRAFFIC;
    return {
      host: "cloudflare",
      traffic: { sinceMin: Math.round((Date.now() - T.since) / 6e4), MB: +(T.total / 1048576).toFixed(2), byKindKB: Object.fromEntries(Object.entries(T.kinds).sort((x, y) => y[1] - x[1]).slice(0, 15).map(([k, v]) => [k, Math.round(v / 1024)])) },
      incoming: { frames: this.IN.frames, requests: Math.ceil(this.IN.frames / 20), perMin: +(this.IN.frames / Math.max(1, (Date.now() - T.since) / 6e4)).toFixed(1), byKind: Object.fromEntries(Object.entries(this.IN.kinds).sort((x, y) => y[1] - x[1]).slice(0, 15)) },
      uptimeMin: Math.round((Date.now() - this.STARTED) / 6e4),
      lastBackup: this.BK.lastBackup,
      backup: { on: !!this.backup, locked: this.BK.blocked, lastError: this.BK.lastError, restoredFrom: this.BK.restoredFrom, lastAt: this.kv("backupAt"), changed: !!this.kv("changed") },
      worlds: [...this.worlds.values()].filter((w) => w.state.meta).map((w) => ({ id: w.state.meta.priv ? "(\uBE44\uACF5\uAC1C)" : w.id, name: w.state.meta.priv ? "(\uBE44\uACF5\uAC1C \uC11C\uBC84)" : w.state.meta.name, players: [...w.core.players.values()].filter((q) => q.joined).length, conns: w.conns.size, chunks: w.keysLoaded ? w.keys.size : null, cached: w.core.cacheSize(), unsaved: w.dirty.size })),
      rooms: [...this.rooms.values()].filter((r) => r.host).length,
      recentDrops: this.DROPS.slice().reverse()
    };
  }
  roomList() {
    const info = /* @__PURE__ */ __name((w) => ({ id: w.id, name: w.state.meta.name, mode: w.state.meta.mode, players: [...w.core.players.values()].filter((q) => q.joined).length, last: w.state.last || 0 }), "info");
    const list = [...this.worlds.values()].filter((w) => w.state.meta && !w.state.meta.priv).map(info).sort((a, b) => b.players - a.players || b.last - a.last);
    const def = this.worlds.get(this.worldName);
    return {
      world: def && def.state.meta && !def.state.meta.priv ? info(def) : list[0] || null,
      worlds: list,
      rooms: [...this.rooms].filter(([, r]) => r.host).map(([code, r]) => ({ code, host: r.hostName, world: r.worldName, mode: r.mode, players: r.guests.size + 1 }))
    };
  }
  newCode() {
    for (; ; ) {
      let c = "";
      for (let i = 0; i < 4; i++) c += CODE_CH[Math.floor(Math.random() * CODE_CH.length)];
      if (!this.rooms.has(c)) return c;
    }
  }
  async fetch(req) {
    const url = new URL(req.url), u = url.pathname, jh = { "content-type": "application/json", "cache-control": "no-store", ...cors };
    if (u === "/rooms") return new Response(J(this.roomList()), { headers: jh });
    if (u === "/stats") return new Response(JSON.stringify(this.stats(), null, 1), { headers: jh });
    if (u === "/report") {
      try {
        const o = JSON.parse((await req.text()).slice(0, 2e3));
        this.noteDrop({ at: (/* @__PURE__ */ new Date()).toISOString(), side: "game", name: String(o.name || "").slice(0, 16), why: String(o.why || "").slice(0, 200), world: String(o.world || "").slice(0, 40), secs: +o.secs || 0 });
      } catch (e) {
      }
      return new Response(null, { status: 204, headers: cors });
    }
    if (req.headers.get("upgrade") !== "websocket") return new Response("websocket only", { status: 426 });
    const pair = new WebSocketPair(), ws = pair[1];
    ws.accept();
    this.connect(ws, url);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  deadCheck() {
    const now = Date.now();
    for (const c of this.allConns) if (now - c.seen > 12e4) c.kill("2\uBD84 \uB3D9\uC548 \uC751\uB2F5 \uC5C6\uC74C");
  }
  // ---------- one connection ----------
  connect(ws, url) {
    this.startTimers();
    this.allConns = this.allConns || /* @__PURE__ */ new Set();
    const S = this, id = this.nextId++;
    let role = null, wp = false, w = null, room = null, roomName = null, closed = false;
    const c = {
      seen: Date.now(),
      backlog: /* @__PURE__ */ __name(() => 0, "backlog"),
      send(s, drop) {
        if (closed) return;
        try {
          ws.send(s);
          S.countOut(s);
        } catch (e) {
        }
      },
      close() {
        if (closed) return;
        try {
          ws.close(1e3, "bye");
        } catch (e) {
        }
        gone("\uC11C\uBC84\uAC00 \uB2EB\uC74C");
      },
      kill(why) {
        if (closed) return;
        try {
          ws.close(1001, "timeout");
        } catch (e) {
        }
        gone(why);
      }
    };
    this.allConns.add(c);
    const handle = /* @__PURE__ */ __name((m) => {
      if (!m || typeof m !== "object") return;
      S.IN.kinds[m.t] = (S.IN.kinds[m.t] || 0) + 1;
      if (m.t === "multi" && Array.isArray(m.l)) {
        for (const x of m.l) {
          try {
            handle(x);
          } catch (e) {
            S.log("\uBA54\uC2DC\uC9C0 \uCC98\uB9AC \uC624\uB958: " + (e && e.stack || e));
          }
        }
        return;
      }
      if (m.t === "hb" && !wp && role !== "guest") return;
      if (wp) {
        if (m.t === "restore") {
          S.restorePart(w, id, m);
          return;
        }
        if (m.t === "mirrorhave") {
          S.mirrorFill(w, id, m);
          return;
        }
        if (m.t === "flush") {
          setTimeout(() => {
            w.stateDirty = true;
            S.saveWorld(w, true);
            c.send(J({ t: "flushed" }));
          }, 150);
          return;
        }
        if (m.t === "create" && w.state.meta == null) {
          w.keysLoaded = true;
          w.core.message(id, m);
          w.stateDirty = true;
          S.saveWorld(w);
          S.changed();
          return;
        }
        if (m.t !== "join") {
          w.core.message(id, m);
          return;
        }
        if (S.requireLogin && !(m.login && m.login.cred)) {
          c.send(J({ t: "error", msg: "\uC774 \uC11C\uBC84\uB294 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4 (\uD0C0\uC774\uD2C0 \u2192 \uB85C\uADF8\uC778)" }));
          return;
        }
        w.core.message(id, m);
        w.state.last = Date.now();
        w.stateDirty = true;
        return;
      }
      if (!role) {
        if (m.t !== "hello") return;
        let code = String(m.room || url.searchParams.get("room") || "").trim().toUpperCase().slice(0, 12), wid = null;
        if (m.role === "join" && !code) {
          if (m.newWorld) wid = S.newWorldId();
          else if (m.world != null) {
            wid = String(m.world);
            if (!WORLD_ID.test(wid)) {
              c.send(J({ t: "error", msg: "\uC798\uBABB\uB41C \uC138\uACC4 \uC774\uB984\uC785\uB2C8\uB2E4" }));
              c.close();
              return;
            }
          } else {
            const def = S.worlds.get(S.worldName);
            if (!(def && def.state.meta)) {
              const open = [...S.rooms].filter(([, r]) => r.host);
              if (open.length === 1) code = open[0][0];
            }
          }
        }
        if (m.role === "join") {
          const r = code ? S.rooms.get(code) : null;
          m.role = r && r.host ? "guest" : code ? "none" : "world";
        }
        if (m.role === "none") {
          c.send(J({ t: "error", msg: `\uBC29 \uCF54\uB4DC ${code}\uB85C \uC5F4\uB9B0 \uC138\uACC4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4 (\uB2EB\uD614\uAC70\uB098 \uCF54\uB4DC\uAC00 \uD2C0\uB838\uC5B4\uC694)` }));
          c.close();
          return;
        }
        if (m.role === "world" && S.BK.blocked) {
          c.send(J({ t: "error", msg: S.backup ? "\uC11C\uBC84\uAC00 \uC138\uACC4 \uBC31\uC5C5\uC744 \uC544\uC9C1 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD574 \uC7A0\uC2DC \uC7A0\uAC00 \uB450\uC5C8\uC2B5\uB2C8\uB2E4. 1~2\uBD84 \uB4A4 \uB2E4\uC2DC \uC811\uC18D\uD574 \uC8FC\uC138\uC694" : "\uC11C\uBC84\uC5D0 \uBC31\uC5C5 \uC124\uC815(GITHUB_TOKEN)\uC774 \uC544\uC9C1 \uC5C6\uC5B4 \uC11C\uBC84 \uC138\uACC4\uB97C \uC7A0\uAC00 \uB450\uC5C8\uC2B5\uB2C8\uB2E4" }));
          c.close();
          return;
        }
        if (m.role === "world") {
          const ww = S.openWorld(wid || S.worldName), pk = ww.state.meta && ww.state.meta.priv && ww.state.meta.priv.key;
          if (pk && String(m.key || "") !== pk) {
            c.send(J({ t: "error", msg: "\uBE44\uACF5\uAC1C \uC11C\uBC84\uC785\uB2C8\uB2E4. \uCD08\uB300 \uCF54\uB4DC\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4" }));
            c.close();
            S.dropIfEmpty(ww);
            return;
          }
          role = "world";
          wp = true;
          w = ww;
          S.ensureKeys(w);
          w.conns.set(id, c);
          roomName = w.id;
          c.send(J({ t: "hello", id, world: w.state.meta ? { name: w.state.meta.name, seed: w.state.meta.seed } : null, kind: "world", wid: w.id, multi: 1 }));
          return;
        }
        if (m.role === "host") {
          roomName = code && !(S.rooms.get(code) || {}).host ? code : S.newCode();
          room = { host: c, guests: /* @__PURE__ */ new Map(), hostName: String(m.name || "\uD50C\uB808\uC774\uC5B4").slice(0, 16), worldName: String(m.world || "").slice(0, 40), mode: m.mode === "creative" ? "creative" : "survival" };
          S.rooms.set(roomName, room);
          role = "host";
        } else {
          roomName = code || "main";
          room = S.rooms.get(roomName);
          if (!room || !room.host) {
            c.send(J({ t: "error", msg: "\uC544\uC9C1 \uC138\uACC4\uB97C \uC5F0 \uD638\uC2A4\uD2B8\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4" }));
            c.close();
            return;
          }
          room.guests.set(id, c);
          role = "guest";
        }
        c.send(J({ t: "hello", id: role === "host" ? 0 : id, kind: role, room: roomName, multi: 1 }));
        return;
      }
      const dr = DROPPABLE.has(m.t) && m.t + ":" + (m.id != null ? m.id : role === "guest" ? id : "");
      if (role === "guest") {
        if (room.host) room.host.send(J({ ...m, from: id }), dr);
        return;
      }
      const to = m.to;
      delete m.to;
      const s = J(m);
      if (to != null) {
        const g = room.guests.get(to);
        if (g) g.send(s, dr);
      } else for (const g of room.guests.values()) g.send(s, dr);
    }, "handle");
    const gone = /* @__PURE__ */ __name((why) => {
      if (closed) return;
      closed = true;
      S.allConns.delete(c);
      {
        const p = wp && w.core.players.get(id);
        if (p && p.joined || role) S.noteDrop({ at: (/* @__PURE__ */ new Date()).toISOString(), side: "server", world: wp ? w.id : roomName, name: p ? p.name : role, why });
      }
      if (wp) {
        w.conns.delete(id);
        w.core.leave(id);
        if (w.restorer === id) {
          w.restorer = null;
          S.saveWorld(w);
        }
        if (!w.conns.size) {
          w.stateDirty = true;
          S.saveWorld(w);
          S.dropIfEmpty(w);
          if (!S.anyConn()) S.backupSoon();
        }
      } else if (role === "guest") {
        room.guests.delete(id);
        if (room.host) room.host.send(J({ t: "leave", from: id }));
      } else if (role === "host") {
        room.host = null;
        for (const g of room.guests.values()) {
          g.send(J({ t: "hostgone" }));
          g.close();
        }
        room.guests.clear();
        S.rooms.delete(roomName);
      }
      S.stopTimersIfIdle();
    }, "gone");
    ws.addEventListener("message", (e) => {
      c.seen = Date.now();
      S.IN.frames++;
      if (typeof e.data !== "string") return;
      let m;
      try {
        m = JSON.parse(e.data);
      } catch (er) {
        return;
      }
      try {
        handle(m);
      } catch (er) {
        S.log("\uBA54\uC2DC\uC9C0 \uCC98\uB9AC \uC624\uB958: " + (er && er.stack || er));
      }
    });
    ws.addEventListener("close", () => {
      try {
        ws.close();
      } catch (e) {
      }
      gone("\uD50C\uB808\uC774\uC5B4 \uCABD\uC5D0\uC11C \uB2EB\uD798");
    });
    ws.addEventListener("error", () => gone("\uB124\uD2B8\uC6CC\uD06C \uC624\uB958"));
  }
};

// ../../../tmp/claude-0/-home-user/8ba2eef5-aaaf-549c-a99f-e87a6bda5cd6/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
init_modules_watch_stub();
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../tmp/claude-0/-home-user/8ba2eef5-aaaf-549c-a99f-e87a6bda5cd6/scratchpad/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
init_modules_watch_stub();
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-lzas7V/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../tmp/claude-0/-home-user/8ba2eef5-aaaf-549c-a99f-e87a6bda5cd6/scratchpad/wr/node_modules/wrangler/templates/middleware/common.ts
init_modules_watch_stub();
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-lzas7V/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  NemoServer,
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
