'use strict';
/* SANS-NOM — engine: input, player, combat, entities, camera, lighting, HUD, dialogue, saves. */

const cv = document.getElementById('game'), ctx = cv.getContext('2d');
cv.width = W; cv.height = H;
const LC = canvas(W, H), lctx = LC.getContext('2d');
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));

let S = null;            // saved state
let M = null;            // current map runtime
let P = null;            // player
let ents = [], parts = [], texts = [];
const cam = { x: 0, y: 0 };
let shake = 0, hitstop = 0, T = 0, fade = 1, redFlash = 0, mode = 'title', busy = 0, banner = null;
const MAPCACHE = {};
const SAVE_KEY = 'sansnom_save';

/* ---------------- state ---------------- */
function newState() {
  return { map: 'maison', x: 8 * TS, y: 4.2 * TS, hp: 6, maxHp: 6, gems: 0, keys: 0, potions: 0, sword: 0, flags: {}, names: {}, opened: {}, killed: {}, time: 0 };
}
const NAME_KEYS = ['bastien', 'noe', 'lila', 'gaspard', 'odile', 'aelle'];
const namesCount = () => NAME_KEYS.filter(k => S && S.names[k]).length;
function save(silent) {
  if (!S || !P) return;
  S.x = P.x; S.y = P.y;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  if (!silent) toast('Partie sauvegardée');
}
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return null; } }

/* ---------------- input ---------------- */
const keys = {}, pressed = {};
const BIND = {
  up: ['ArrowUp', 'KeyW', 'KeyZ'], down: ['ArrowDown', 'KeyS'], left: ['ArrowLeft', 'KeyA', 'KeyQ'], right: ['ArrowRight', 'KeyD'],
  attack: ['Space', 'KeyJ', 'KeyX'], dash: ['ShiftLeft', 'ShiftRight', 'KeyK', 'KeyL'], use: ['KeyE', 'Enter'], potion: ['KeyR', 'KeyF'], pause: ['Escape', 'KeyP'],
};
const btn = a => BIND[a].some(k => keys[k]) || !!touchKeys[a] || !!padKeys[a];
const tap = a => { const v = !!pressed[a]; return v; };
const touchKeys = {}, padKeys = {};
let padPrev = {};
addEventListener('keydown', e => {
  if (e.repeat) return;
  keys[e.code] = true;
  for (const a in BIND) if (BIND[a].includes(e.code)) pressed[a] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  onKey(e);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function pollPad() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(Boolean) : null;
  if (!gp) return;
  const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, b = i => gp.buttons[i] && gp.buttons[i].pressed;
  const now = { left: ax < -.4 || b(14), right: ax > .4 || b(15), up: ay < -.4 || b(12), down: ay > .4 || b(13), attack: b(0) || b(2), dash: b(1) || b(5), use: b(3), potion: b(4), pause: b(9) };
  for (const k in now) { padKeys[k] = now[k]; if (now[k] && !padPrev[k]) { pressed[k] = true; onKey({ code: '__pad_' + k }); } }
  padPrev = now;
}

/* ---------------- collision ---------------- */
function tileSolid(tx, ty) {
  const ch = M.tileAt(tx, ty);
  if (ch === undefined) return true;
  if (SOLID.has(ch)) return true;
  if (ch === 'D') return !S.flags.doorD;
  if (ch === 'G') return !S.flags.gateG;
  if (ch === 'H') return !S.flags.bossDead;
  if (ch === 'J') return !!(S.flags.bossFight && !S.flags.bossDead);
  return false;
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const boxOf = e => ({ x: e.x - e.bw / 2, y: e.y - e.bh, w: e.bw, h: e.bh });
function solidBox(bx, by, bw, bh, self) {
  const tx0 = Math.floor(bx / TS), tx1 = Math.floor((bx + bw - .01) / TS), ty0 = Math.floor(by / TS), ty1 = Math.floor((by + bh - .01) / TS);
  if (!(self && self.fly)) for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (tileSolid(tx, ty)) {
    if (self && self.swim === false) return true;
    return true;
  }
  if (self && self.fly) { if (bx < 0 || by < 0 || bx + bw > M.w * TS || by + bh > M.h * TS) return true; for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (WALLISH.has(M.tileAt(tx, ty))) return true; }
  const b = { x: bx, y: by, w: bw, h: bh };
  for (const r of M.rects) if (overlap(b, r)) return true;
  for (const e of ents) if (e !== self && e.solid && !e.dead && overlap(b, boxOf(e))) return true;
  return false;
}
function move(e, dx, dy) {
  e.hitWall = false;
  const step = (ax, d) => {
    const s = Math.sign(d); let rem = Math.abs(d);
    while (rem > 0) {
      const k = Math.min(1, rem);
      const nx = e.x + (ax === 'x' ? s * k : 0), ny = e.y + (ax === 'y' ? s * k : 0);
      if (!solidBox(nx - e.bw / 2, ny - e.bh, e.bw, e.bh, e)) { e.x = nx; e.y = ny; rem -= k; continue; }
      // corner nudge (Zelda-style)
      if (e === P) {
        let nudged = false;
        for (let o = 1; o <= 5 && !nudged; o++) for (const sg of [-1, 1]) {
          const ox = ax === 'y' ? sg * o : 0, oy = ax === 'x' ? sg * o : 0;
          if (!solidBox(nx + ox - e.bw / 2, ny + oy - e.bh, e.bw, e.bh, e)) { if (ax === 'x') e.y += sg * .8; else e.x += sg * .8; nudged = true; break; }
        }
      }
      e.hitWall = true; break;
    }
  };
  if (dx) step('x', dx);
  if (dy) step('y', dy);
}

/* ---------------- particles & text ---------------- */
function burst(x, y, n, col, o = {}) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = (o.speed || 50) * (.4 + Math.random());
    parts.push({ x, y, z: o.z ?? 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * .6, vz: (o.up ?? 40) * (.5 + Math.random()), life: 0, max: (o.life || .5) * (.6 + Math.random() * .6), col: Array.isArray(col) ? col[i % col.length] : col, size: o.size || 1, grav: o.grav ?? 140, glow: o.glow });
  }
}
function floatText(x, y, s, col = '#fff') { texts.push({ x, y, s, col, life: 0 }); }
function updParts(dt) {
  parts.forEach(p => { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= p.grav * dt; if (p.z < 0 && p.grav > 0) { p.z = 0; p.vz *= -.3; p.vx *= .6; p.vy *= .6; } p.vx *= .985; p.vy *= .985; });
  parts = parts.filter(p => p.life < p.max);
  texts.forEach(t => { t.life += dt; t.y -= dt * 18; });
  texts = texts.filter(t => t.life < 1);
}

/* ---------------- player ---------------- */
function makePlayer(x, y) {
  return { type: 'player', x, y, bw: 9, bh: 6, dir: 'down', fx: 0, fy: 1, anim: 0, moving: false, atk: 0, atkCd: 0, dash: 0, dashCd: 0, inv: 0, kbx: 0, kby: 0, hits: new Set(), trail: [], hold: null, stepT: 0 };
}
const ATK_T = .26;
function updPlayer(dt) {
  const p = P;
  p.inv = Math.max(0, p.inv - dt); p.atkCd = Math.max(0, p.atkCd - dt); p.dashCd = Math.max(0, p.dashCd - dt);
  let ix = 0, iy = 0;
  const control = mode === 'play' && !busy && !p.hold;
  if (control) {
    if (btn('left')) ix -= 1; if (btn('right')) ix += 1; if (btn('up')) iy -= 1; if (btn('down')) iy += 1;
    if (touchKeys.ax) { ix = touchKeys.ax; iy = touchKeys.ay; }
  }
  const len = Math.hypot(ix, iy); if (len > 1) { ix /= len; iy /= len; }
  if (len > .2 && p.atk <= 0) {
    if (Math.abs(ix) > Math.abs(iy) + .05) { p.dir = 'side'; p.fx = Math.sign(ix); p.fy = 0; }
    else if (Math.abs(iy) > 0) { p.dir = iy < 0 ? 'up' : 'down'; p.fy = Math.sign(iy); p.fx = 0; }
  }
  if (control && tap('attack') && p.atk <= 0 && p.atkCd <= 0 && S.sword > 0) { p.atk = ATK_T; p.hits.clear(); Snd.swing(); }
  if (control && tap('dash') && p.dashCd <= 0 && p.atk <= 0) {
    const dx = len > .2 ? ix : p.fx, dy = len > .2 ? iy : p.fy;
    p.dash = .17; p.dashCd = .55; p.dvx = dx * 200; p.dvy = dy * 200; p.inv = Math.max(p.inv, .22); Snd.dash();
    burst(p.x, p.y, 6, '#d8c8a8', { speed: 30, up: 10, life: .4, grav: 40 });
  }
  let vx = ix * 74, vy = iy * 74;
  if (p.atk > 0) { vx *= .3; vy *= .3; }
  if (p.dash > 0) { p.dash -= dt; vx = p.dvx; vy = p.dvy; p.trail.push({ x: p.x, y: p.y, dir: p.dir, fx: p.fx, life: .2 }); }
  vx += p.kbx; vy += p.kby; p.kbx *= Math.pow(.0005, dt); p.kby *= Math.pow(.0005, dt);
  move(p, vx * dt, vy * dt);
  p.moving = len > .2 && p.atk <= 0;
  if (p.moving) { p.anim += dt; p.stepT += dt; if (p.stepT > .28) { p.stepT = 0; Snd.step(); if (M.def.theme !== 'crypt' && Math.random() < .5) burst(p.x, p.y, 1, '#b8a888', { speed: 8, up: 8, life: .3, grav: 30 }); } }
  else p.anim = 0;
  p.trail.forEach(t => t.life -= dt); p.trail = p.trail.filter(t => t.life > 0);

  if (p.atk > 0) {
    const el = ATK_T - p.atk; p.atk -= dt;
    if (el > .03 && el < .19) swordHits();
    if (p.atk <= 0) p.atkCd = .06;
  }
  if (control && tap('use')) useAction();
  if (control && tap('potion')) drinkPotion();
}
function swordBox() {
  const p = P, r = 13;
  const cx = p.x + p.fx * r, cy = p.y - 6 + p.fy * r;
  const w = p.fx ? 18 : 24, h = p.fx ? 22 : 16;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
function swordHits() {
  const b = swordBox(), dmg = S.sword >= 2 ? 2 : 1;
  ents.forEach(e => {
    if (e.dead || P.hits.has(e)) return;
    if (!overlap(b, e.hurt ? e.hurt() : boxOf(e))) return;
    const T_ = TYPES[e.type];
    if (T_.onSword) { P.hits.add(e); T_.onSword(e, dmg); return; }
    if (e.enemy) { P.hits.add(e); hurtEnemy(e, dmg, P.x, P.y); }
  });
  // tall grass
  const tx0 = Math.floor(b.x / TS), tx1 = Math.floor((b.x + b.w) / TS), ty0 = Math.floor(b.y / TS), ty1 = Math.floor((b.y + b.h) / TS);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (M.tileAt(tx, ty) === '"') {
    M.grid[ty][tx] = '.';
    const x = tx * TS + 8, y = ty * TS + 12;
    burst(x, y, 10, ['#5aa84c', '#3f8a3a', '#7ac860'], { speed: 40, up: 50, life: .6 });
    Snd.cut();
    if (Math.random() < .3) drop(x, y, true);
  }
}
function hurtPlayer(dmg, fx, fy) {
  if (P.inv > 0 || P.dash > 0 || mode !== 'play') return;
  S.hp = Math.max(0, S.hp - dmg); P.inv = 1.1; redFlash = .5;
  const a = Math.atan2(P.y - fy, P.x - fx); P.kbx = Math.cos(a) * 160; P.kby = Math.sin(a) * 160;
  shake = 5; hitstop = .07; Snd.hurt();
  burst(P.x, P.y - 6, 8, ['#ff5a5a', '#ffffff'], { speed: 50, life: .4 });
  if (S.hp <= 0) gameOver();
}
function hurtEnemy(e, dmg, fx, fy) {
  if (e.inv > 0 || e.dead) return;
  const T_ = TYPES[e.type];
  if (T_.armor) dmg = T_.armor(e, dmg);
  e.hp -= dmg; e.flash = .12; e.inv = .22;
  const a = Math.atan2(e.y - fy, e.x - fx), kb = 150 * (e.kbRes ?? 1);
  e.kbx = Math.cos(a) * kb; e.kby = Math.sin(a) * kb;
  hitstop = .05; shake = Math.max(shake, 2.5); Snd.hit();
  burst(e.x, e.y - 6, 6, ['#ffffff', e.blood || '#c8d0e0'], { speed: 60, life: .35 });
  floatText(e.x, e.y - 18, dmg, dmg > 1 ? '#ffd866' : '#ffffff');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; Snd.die(); shake = Math.max(shake, 3);
  burst(e.x, e.y - 6, 18, [e.blood || '#c8d0e0', '#ffffff', '#8890a0'], { speed: 80, up: 60, life: .7 });
  const T_ = TYPES[e.type];
  if (T_.onDeath) T_.onDeath(e); else drop(e.x, e.y);
}
function drop(x, y, small) {
  const r = Math.random();
  if (r < (small ? .35 : .28) && S.hp < S.maxHp) spawn('pickup', x, y, { kind: 'heart' });
  else if (r < .75) spawn('pickup', x, y, { kind: 'gem', n: Math.random() < .12 ? 5 : 1 });
}
function drinkPotion() {
  if (S.potions <= 0) { toast('Pas de potion'); return; }
  if (S.hp >= S.maxHp) { toast('Tu es déjà en pleine forme'); return; }
  S.potions--; S.hp = Math.min(S.maxHp, S.hp + 6); Snd.potion();
  burst(P.x, P.y - 8, 16, ['#ff8ab0', '#ffffff'], { speed: 30, up: 60, life: .8, grav: -20 });
}
function gameOver() {
  mode = 'over'; Snd.play(null);
  setTimeout(() => { $('over').hidden = false; }, 700);
}

/* ---------------- entities ---------------- */
function spawn(type, x, y, props = {}) {
  const T_ = TYPES[type];
  const e = Object.assign({ type, x, y, bw: 10, bh: 8, hp: 1, maxHp: 1, kbx: 0, kby: 0, flash: 0, inv: 0, t: Math.random() * 10, dead: false }, T_.base ? T_.base() : {}, props);
  e.maxHp = e.hp;
  if (T_.init) T_.init(e);
  ents.push(e);
  return e;
}
function updEnts(dt) {
  ents.forEach(e => {
    if (e.dead) return;
    e.t += dt; e.flash = Math.max(0, e.flash - dt); e.inv = Math.max(0, e.inv - dt);
    if (e.kbx || e.kby) { move(e, e.kbx * dt, e.kby * dt); e.kbx *= Math.pow(.001, dt); e.kby *= Math.pow(.001, dt); if (Math.abs(e.kbx) + Math.abs(e.kby) < 4) e.kbx = e.kby = 0; }
    const T_ = TYPES[e.type];
    if (T_.update && (mode === 'play' || T_.always)) T_.update(e, dt);
    if (e.enemy && e.dmg && mode === 'play' && !busy && !e.harmless) {
      const hb = e.hurt ? e.hurt() : boxOf(e);
      if (overlap(boxOf(P), { x: hb.x + 1, y: hb.y + 1, w: hb.w - 2, h: hb.h - 2 })) hurtPlayer(e.dmg, e.x, e.y);
    }
  });
  ents = ents.filter(e => !e.dead || e.keep);
}
const distP = e => Math.hypot(P.x - e.x, P.y - e.y);
const toP = e => { const d = distP(e) || 1; return [(P.x - e.x) / d, (P.y - e.y) / d]; };
function drawSpr(s, x, y, o = {}) {
  const img = o.white ? s.white : o.grey ? (o.flip ? s.greyFlip : s.grey) : (o.flip ? s.flip : s.img);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.drawImage(img, Math.round(x - s.w / 2), Math.round(y - s.h));
  ctx.globalAlpha = 1;
}
const shadowAt = (x, y, big) => { const s = big ? SPR.shadowBig : SPR.shadow; ctx.drawImage(s.img, Math.round(x - s.w / 2 - cam.x), Math.round(y - s.h / 2 - cam.y)); };

const TYPES = {
  pickup: {
    base: () => ({ bw: 8, bh: 6, z: 10, vz: 60 }),
    always: true,
    update(e, dt) {
      e.vz -= 260 * dt; e.z += e.vz * dt; if (e.z < 0) { e.z = 0; e.vz = Math.abs(e.vz) > 30 ? -e.vz * .4 : 0; }
      if (e.t > 12) e.dead = true;
      const d = distP(e);
      if (d < 26 && e.t > .3) { const [ux, uy] = toP(e); e.x += ux * 90 * dt; e.y += uy * 90 * dt; }
      if (d < 8 && e.t > .3 && mode === 'play') {
        e.dead = true;
        if (e.kind === 'heart') { S.hp = Math.min(S.maxHp, S.hp + 2); Snd.heart(); }
        else { S.gems += e.n || 1; Snd.gem(); floatText(e.x, e.y - 10, '+' + (e.n || 1), '#9ff0ff'); }
      }
    },
    draw(e) {
      if (e.t > 9 && Math.floor(e.t * 8) % 2) return;
      shadowAt(e.x, e.y);
      const s = e.kind === 'heart' ? SPR.heart : SPR.gem;
      drawSpr(s, e.x - cam.x, e.y - cam.y - e.z - 1 - Math.sin(e.t * 4) * 1);
      if (e.kind === 'gem') addLight(e.x, e.y - 4, 14, .5, 'cold');
    },
  },

  slime: {
    base: () => ({ hp: 2, dmg: 1, enemy: true, bw: 12, bh: 8, blood: '#6cc24a', hop: 0, hvx: 0, hvy: 0 }),
    update(e, dt) {
      e.hop -= dt;
      if (e.hop <= 0) {
        const d = distP(e);
        if (d < 100) { const [ux, uy] = toP(e); e.hvx = ux * 55; e.hvy = uy * 55; } else { const a = Math.random() * 6.28; e.hvx = Math.cos(a) * 25; e.hvy = Math.sin(a) * 25; }
        e.hop = 1 + Math.random() * .6; e.jump = .35;
      }
      if (e.jump > 0) { e.jump -= dt; move(e, e.hvx * dt, e.hvy * dt); }
    },
    draw(e) {
      shadowAt(e.x, e.y);
      const z = e.jump > 0 ? Math.sin((.35 - e.jump) / .35 * Math.PI) * 6 : 0;
      drawSpr(SPR.slime[e.jump > 0 ? 0 : (Math.floor(e.t * 3) % 2)], e.x - cam.x, e.y - cam.y - z + 2, { white: e.flash > 0 });
    },
  },

  wolf: {
    base: () => ({ hp: 3, dmg: 2, enemy: true, bw: 14, bh: 8, blood: '#8c8f9c', st: 'roam', st_t: 0, face: 1 }),
    update(e, dt) {
      e.st_t -= dt; const d = distP(e);
      if (e.st === 'roam') {
        if (e.st_t <= 0) { const a = Math.random() * 6.28; e.rvx = Math.cos(a) * 22; e.rvy = Math.sin(a) * 22; e.st_t = 1.5 + Math.random(); }
        move(e, e.rvx * dt, e.rvy * dt); if (e.rvx) e.face = Math.sign(e.rvx);
        if (d < 100) { e.st = 'aim'; e.st_t = .5; e.face = Math.sign(P.x - e.x) || 1; }
      } else if (e.st === 'aim') {
        e.face = Math.sign(P.x - e.x) || 1;
        if (e.st_t <= 0) { const [ux, uy] = toP(e); e.cvx = ux * 170; e.cvy = uy * 170; e.st = 'charge'; e.st_t = .45; }
      } else if (e.st === 'charge') {
        move(e, e.cvx * dt, e.cvy * dt);
        if (Math.random() < .5) burst(e.x, e.y, 1, '#a89878', { speed: 10, up: 10, life: .3, grav: 30 });
        if (e.st_t <= 0 || e.hitWall) { e.st = 'rest'; e.st_t = .9; }
      } else if (e.st === 'rest' && e.st_t <= 0) { e.st = d < 120 ? 'aim' : 'roam'; e.st_t = .5; }
    },
    draw(e) {
      shadowAt(e.x, e.y, true);
      const shk = e.st === 'aim' ? (Math.random() - .5) * 2 : 0;
      drawSpr(SPR.wolf[(e.st === 'charge' || e.st === 'roam') ? Math.floor(e.t * 8) % 2 : 0], e.x - cam.x + shk, e.y - cam.y + 1, { flip: e.face < 0, white: e.flash > 0 });
      if (e.st === 'aim') { ctx.fillStyle = '#ff4040'; ctx.fillRect(Math.round(e.x - cam.x) - 1, Math.round(e.y - cam.y) - 18, 2, 4); ctx.fillRect(Math.round(e.x - cam.x) - 1, Math.round(e.y - cam.y) - 13, 2, 1); }
    },
  },

  bat: {
    base: () => ({ hp: 1, dmg: 1, enemy: true, bw: 10, bh: 6, fly: true, blood: '#6a3f80', z: 10 }),
    update(e, dt) {
      const d = distP(e);
      if (!e.awake) { if (d < 90) e.awake = true; else return; }
      const [ux, uy] = toP(e);
      e.ang = (e.ang || 0) + dt * 3;
      move(e, (ux * 50 + Math.cos(e.ang * 1.7) * 60) * dt, (uy * 50 + Math.sin(e.ang * 2.3) * 60) * dt);
    },
    draw(e) {
      shadowAt(e.x, e.y);
      drawSpr(SPR.bat[e.awake ? Math.floor(e.t * 10) % 2 : 1], e.x - cam.x, e.y - cam.y - 12 + Math.sin(e.t * 5) * 2, { white: e.flash > 0 });
    },
    hurt: null,
  },

  skel: {
    base: () => ({ hp: 4, dmg: 2, enemy: true, bw: 10, bh: 8, blood: '#e8e2d0', kbRes: .6, st: 'walk', st_t: 0, face: 1 }),
    update(e, dt) {
      e.st_t -= dt; const d = distP(e);
      if (d > 140 && e.st === 'walk') return;
      if (e.st === 'walk') {
        const [ux, uy] = toP(e); move(e, ux * 30 * dt, uy * 30 * dt); e.face = Math.sign(P.x - e.x) || 1;
        if (d < 26) { e.st = 'wind'; e.st_t = .45; }
      } else if (e.st === 'wind') {
        if (e.st_t <= 0) { e.st = 'swing'; e.st_t = .2; Snd.swing(); const [ux, uy] = toP(e); e.sx = ux; e.sy = uy; }
      } else if (e.st === 'swing') {
        const hb = { x: e.x + e.sx * 12 - 10, y: e.y - 8 + e.sy * 12 - 10, w: 20, h: 20 };
        if (overlap(hb, boxOf(P))) hurtPlayer(2, e.x, e.y);
        if (e.st_t <= 0) { e.st = 'rest'; e.st_t = .7; }
      } else if (e.st === 'rest' && e.st_t <= 0) e.st = 'walk';
    },
    draw(e) {
      shadowAt(e.x, e.y);
      const tint = e.st === 'wind' && Math.floor(e.t * 20) % 2;
      drawSpr(SPR.skel[e.st === 'walk' ? Math.floor(e.t * 5) % 2 : 0], e.x - cam.x, e.y - cam.y + 1, { flip: e.face < 0, white: e.flash > 0 || tint });
      if (e.st === 'swing' || e.st === 'wind') {
        const a = Math.atan2(e.sy || 0, e.sx || e.face), sx = e.x - cam.x, sy = e.y - cam.y - 8;
        ctx.save(); ctx.translate(Math.round(sx), Math.round(sy)); ctx.rotate(a + (e.st === 'wind' ? -1.4 : .6) + Math.PI / 4);
        ctx.drawImage(SPR.isword.img, 2, -10); ctx.restore();
      }
      addLight(e.x, e.y - 12, 10, .4, 'red');
    },
  },

  echo: {
    base: () => ({ hp: 4, dmg: 1, enemy: true, bw: 12, bh: 8, fly: true, blood: '#b8c4d8', kbRes: .7, dashT: 2.5 }),
    init(e) { if (S.names[e.name]) e.dead = true; },
    update(e, dt) {
      const d = distP(e);
      if (d > 150) { e.x += Math.sin(e.t) * 6 * dt; return; }
      const [ux, uy] = toP(e);
      e.dashT -= dt;
      if (e.dashT < 0 && e.dashT > -.35) move(e, ux * 130 * dt, uy * 130 * dt);
      else move(e, (ux * 24 + Math.cos(e.t * 2) * 18) * dt, (uy * 24 + Math.sin(e.t * 2.6) * 18) * dt);
      if (e.dashT < -.35) e.dashT = 2 + Math.random();
      if (Math.random() < .15) parts.push({ x: e.x + (Math.random() - .5) * 10, y: e.y, z: 8 + Math.random() * 6, vx: 0, vy: 0, vz: 10, life: 0, max: .8, col: '#b8c4d8', size: 1, grav: 0 });
    },
    draw(e) {
      const tele = e.dashT < .4 && e.dashT > 0 && Math.floor(e.t * 20) % 2;
      drawSpr(SPR.echo[Math.floor(e.t * 4) % 2], e.x - cam.x, e.y - cam.y - 6 + Math.sin(e.t * 3) * 2, { white: e.flash > 0 || tele, alpha: .82 });
      addLight(e.x, e.y - 10, 30, .7, 'gold');
      ctx.font = '7px "Pixelify Sans",monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,216,102,.8)';
      ctx.fillText(NPC[e.name] ? NPC[e.name].label.toUpperCase() : '?', Math.round(e.x - cam.x), Math.round(e.y - cam.y - 26));
    },
    onDeath(e) { S.killed[e.name] = true; freeName(e.name, e.x, e.y); for (let i = 0; i < 3; i++) spawn('pickup', e.x + (i - 1) * 8, e.y, { kind: 'gem', n: 1 }); },
  },

  wisp: {
    base: () => ({ bw: 1, bh: 1, z: 0 }),
    always: true,
    update(e, dt) {
      if (e.t < 1.2) { e.z += dt * 20; return; }
      if (e.target === 'meche' && MECHE.on) { const dx = MECHE.x - e.x, dy = MECHE.y - e.y; e.x += dx * dt * 4; e.y += dy * dt * 4; e.z *= .9; if (Math.hypot(dx, dy) < 4) e.dead = true; return; }
      e.vy = (e.vy || 0) - 300 * dt; e.y += e.vy * dt; e.x += Math.sin(e.t * 6) * 40 * dt;
      if (e.t > 3) e.dead = true;
    },
    draw(e) {
      const x = e.x - cam.x, y = e.y - cam.y - 12 - e.z;
      addLight(e.x, e.y - 12 - e.z, 36, 1, 'gold');
      ctx.font = 'bold 9px "Pixelify Sans",monospace'; ctx.textAlign = 'center';
      ctx.fillStyle = '#fff6c8'; ctx.shadowColor = '#ffd866'; ctx.shadowBlur = 8;
      ctx.fillText(e.label, Math.round(x), Math.round(y)); ctx.shadowBlur = 0;
      if (Math.random() < .6) parts.push({ x: e.x + (Math.random() - .5) * 20, y: e.y, z: 12 + e.z, vx: 0, vy: 0, vz: -5, life: 0, max: .6, col: '#ffd866', size: 1, grav: 0, glow: 1 });
    },
  },

  npc: {
    base: () => ({ bw: 10, bh: 7, solid: true, face: 1 }),
    init(e) { const d = NPC[e.id]; e.spr = d.spr; },
    update(e, dt) { if (NPC[e.id].update) NPC[e.id].update(e, dt); },
    draw(e) {
      const d = NPC[e.id], hollow = d.nameKey && !S.names[d.nameKey];
      shadowAt(e.x, e.y);
      const frame = e.moving ? [1, 0, 2, 0][Math.floor(e.t * 8) % 4] : 0;
      const bob = !hollow && Math.sin(e.t * 2) > .9 ? -1 : 0;
      drawSpr(e.spr[frame], e.x - cam.x, e.y - cam.y + 1 + bob, { grey: hollow });
      if (hollow && Math.random() < .05) parts.push({ x: e.x + (Math.random() - .5) * 10, y: e.y, z: 14, vx: 0, vy: 0, vz: 6, life: 0, max: 1.2, col: '#9aa0b0', size: 1, grav: 0 });
    },
    interact(e) { return NPC[e.id].talk(e); },
  },

  chest: {
    base: () => ({ bw: 14, bh: 8, solid: true }),
    init(e) { e.open = !!S.opened[e.id]; },
    draw(e) { drawSpr(SPR.chest[e.open ? 1 : 0], e.x - cam.x, e.y - cam.y + 1); if (!e.open) addLight(e.x, e.y - 6, 18, .35, 'gold'); },
    async interact(e) {
      if (e.open) return;
      e.open = true; S.opened[e.id] = true; Snd.chest();
      await giveItem(e.item, e);
    },
  },

  pot: {
    base: () => ({ bw: 10, bh: 7, solid: true }),
    draw(e) { drawSpr(SPR.pot, e.x - cam.x, e.y - cam.y + 1); },
    onSword(e) { e.dead = true; Snd.pot(); burst(e.x, e.y - 4, 14, ['#b5683c', '#7e4224', '#e0a070'], { speed: 60, up: 50, life: .6 }); drop(e.x, e.y, true); },
  },

  sign: {
    base: () => ({ bw: 12, bh: 6, solid: true }),
    draw(e) { drawSpr(SPR.sign, e.x - cam.x, e.y - cam.y + 1); },
    interact(e) { return say([[null, e.text]]); },
  },

  statue: {
    base: () => ({ bw: 12, bh: 8, solid: true }),
    draw(e) {
      shadowAt(e.x, e.y, true);
      drawSpr(SPR.statue, e.x - cam.x, e.y - cam.y + 1);
      const k = .6 + .4 * Math.sin(T * 2);
      ctx.fillStyle = `rgba(120,200,255,${k})`; ctx.fillRect(Math.round(e.x - cam.x) - 1, Math.round(e.y - cam.y) - 17, 2, 4);
      addLight(e.x, e.y - 14, 40, .8 * k, 'cold');
    },
    async interact(e) {
      S.hp = S.maxHp; Snd.save();
      burst(e.x, e.y - 14, 20, ['#9fd8ff', '#ffffff'], { speed: 30, up: 40, life: 1, grav: -10 });
      S.flags.save = { map: M.id, x: e.x, y: e.y + 14 };
      save(true);
      if (!S.flags.statueTalk) { S.flags.statueTalk = true; await say([['meche', "Une pierre de veille. Les anciens y gravaient leurs noms pour qu'on se souvienne d'eux. Touche-la, et elle se souviendra de toi aussi — même sans nom."]]); }
      toast('Cœurs restaurés · Partie sauvegardée');
    },
  },

  bramble: {
    base: () => ({ bw: 16, bh: 16, solid: true, keep: false }),
    init(e) { e.key = `br_${Math.round(e.x)}_${Math.round(e.y)}`; if (S.flags[e.key]) e.dead = true; },
    draw(e) { drawSpr(SPR.bramble, e.x - cam.x + (e.flash > 0 ? (Math.random() - .5) * 3 : 0), e.y - cam.y + 1); },
    onSword(e) {
      if (S.sword < 2) {
        e.flash = .2; Snd.clang(); burst(e.x, e.y - 8, 4, '#ffffff', { speed: 40, life: .2 });
        if (!S.flags.brambleHint) { S.flags.brambleHint = true; say([['meche', "Ta lame de bois rebondit sur les ronces. Il faudrait du métal… Bastien, le forgeron, saurait. S'il retrouvait son nom."]]); }
        return;
      }
      e.dead = true; S.flags[e.key] = true; Snd.cut(); shake = 2;
      burst(e.x, e.y - 8, 22, ['#3a5a2a', '#4a3a5a', '#8a2a4a'], { speed: 70, up: 60, life: .7 });
    },
  },

  brazier: {
    base: () => ({ bw: 12, bh: 7, solid: true }),
    init(e) { e.key = `bz_${Math.round(e.x)}_${Math.round(e.y)}`; e.lit = !!S.flags[e.key]; },
    draw(e) {
      drawSpr(SPR.brazier, e.x - cam.x, e.y - cam.y + 1);
      if (e.lit) { drawSpr(SPR.meche[Math.floor(T * 6) % 2], e.x - cam.x, e.y - cam.y - 8, { alpha: .9 }); addLight(e.x, e.y - 12, 60, 1, 'warm'); if (Math.random() < .3) burst(e.x, e.y - 14, 1, ['#ffb050', '#ffd866'], { speed: 6, up: 20, life: .6, grav: -20 }); }
    },
    onSword(e) {
      if (e.lit) return;
      e.lit = true; S.flags[e.key] = true; Snd.fire(); shake = 2;
      burst(e.x, e.y - 12, 20, ['#ffb050', '#ffd866', '#ff6a2a'], { speed: 50, up: 60, life: .7, grav: -30 });
      const all = ents.filter(x => x.type === 'brazier');
      if (all.every(b => b.lit) && !S.flags.gateG) {
        S.flags.gateG = true;
        setTimeout(() => { Snd.gate(); shake = 6; toast('Une grille s\'ouvre quelque part…'); }, 600);
        if (!S.flags.brazTalk) { S.flags.brazTalk = true; say([['meche', "J'ai sauté dans chaque brasier ! Je ne sais pas comment je savais faire ça. Mes mains s'en souviennent… si j'avais des mains."]]); }
      }
    },
  },

  altar: {
    base: () => ({ bw: 20, bh: 8, solid: true }),
    draw(e) {
      const x = Math.round(e.x - cam.x), y = Math.round(e.y - cam.y);
      ctx.fillStyle = '#3a3450'; ctx.fillRect(x - 12, y - 10, 24, 11); ctx.fillStyle = '#5a5480'; ctx.fillRect(x - 13, y - 12, 26, 3);
      if (!S.flags.ending) {
        const k = .7 + .3 * Math.sin(T * 3);
        ctx.font = 'bold 8px "Pixelify Sans",monospace'; ctx.textAlign = 'center'; ctx.fillStyle = `rgba(255,240,180,${k})`;
        ctx.shadowColor = '#ffd866'; ctx.shadowBlur = 10; ctx.fillText('✦', x, y - 16 - Math.sin(T * 2) * 2); ctx.shadowBlur = 0;
        addLight(e.x, e.y - 18, 70, 1, 'gold');
      }
    },
    interact(e) { return STORY.altar(e); },
  },
  bed: { base: () => ({ bw: 14, bh: 22, solid: true }), draw(e) { const x = Math.round(e.x - cam.x) - 8, y = Math.round(e.y - cam.y) - 26; ctx.fillStyle = '#4a2c18'; ctx.fillRect(x, y, 16, 28); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x + 2, y + 2, 12, 7); ctx.fillStyle = '#4a7ab8'; ctx.fillRect(x + 1, y + 10, 14, 16); ctx.fillStyle = '#5a8ac8'; ctx.fillRect(x + 1, y + 10, 14, 2); } },
  table: { base: () => ({ bw: 22, bh: 8, solid: true }), draw(e) { const x = Math.round(e.x - cam.x) - 12, y = Math.round(e.y - cam.y) - 14; ctx.fillStyle = '#5a3a20'; ctx.fillRect(x + 2, y + 6, 3, 9); ctx.fillRect(x + 19, y + 6, 3, 9); ctx.fillStyle = '#8a5a30'; ctx.fillRect(x, y, 24, 7); ctx.fillStyle = '#a87040'; ctx.fillRect(x, y, 24, 2); ctx.fillStyle = '#e8e0d0'; ctx.fillRect(x + 4, y + 1, 5, 2); ctx.fillStyle = '#ffd27a'; ctx.fillRect(x + 16, y - 3, 2, 4); addLight(e.x + 5, e.y - 18, 34, .8, 'warm'); } },
};

/* ---------------- items ---------------- */
const ITEM_INFO = {
  wsword: { spr: 'wsword', name: 'Épée de bois', text: "L'épée de bois que ta grand-mère t'avait taillée. Ce n'est pas grand-chose. C'est mieux que rien.\n\nESPACE (ou J) pour frapper. MAJ (ou K) pour une roulade." },
  isword: { spr: 'isword', name: 'Épée de fer', text: "Forgée par Bastien. Elle tranche les ronces et frappe deux fois plus fort." },
  key: { spr: 'key', name: 'Clé de la crypte', text: "Une vieille clé de fer. Elle ouvre une porte quelque part dans la crypte." },
  potion: { spr: 'potion', name: 'Potion', text: "Rend 3 cœurs. R (ou F) pour la boire." },
  crystal: { spr: 'crystal', name: 'Cœur de cristal', text: "Ton cœur s'agrandit. +1 cœur maximum." },
  gems30: { spr: 'gem', name: '30 éclats', text: "Des éclats de cristal. Lila en voudra sûrement, si elle redevient elle-même." },
};
async function giveItem(item, src) {
  const info = ITEM_INFO[item];
  if (item === 'wsword') S.sword = Math.max(S.sword, 1);
  if (item === 'isword') S.sword = 2;
  if (item === 'key') S.keys++;
  if (item === 'potion') S.potions++;
  if (item === 'crystal') { S.maxHp += 2; S.hp = S.maxHp; }
  if (item === 'gems30') S.gems += 30;
  busy++;
  P.hold = SPR[info.spr]; P.dir = 'down';
  burst(P.x, P.y - 24, 16, ['#ffd866', '#ffffff'], { speed: 40, up: 30, life: .8, grav: -10 });
  await wait(600);
  await say([[null, `**${info.name}**\n\n${info.text}`]]);
  P.hold = null; busy--;
}

/* ---------------- names ---------------- */
function freeName(key, x, y) {
  if (S.names[key]) return;
  S.names[key] = true;
  const d = NPC[key];
  spawn('wisp', x, y, { label: d ? d.label.toUpperCase() : key.toUpperCase(), target: key === 'aelle' ? 'meche' : 'village' });
  Snd.name(); shake = 3;
  setTimeout(() => {
    showBanner(d ? d.label : key, key === 'aelle' ? 'Un nom te revient' : 'Un nom est rentré à Brumeport');
    if (STORY.onName) STORY.onName(key);
  }, 1200);
  save(true);
}

/* ---------------- companion ---------------- */
const MECHE = { on: false, x: 0, y: 0, z: 14, t: 0 };
function updMeche(dt) {
  if (!MECHE.on) return;
  MECHE.t += dt;
  const tx = P.x - P.fx * 14 - (P.fx === 0 ? 10 : 0), ty = P.y - 2 - P.fy * 10;
  MECHE.x += (tx - MECHE.x) * Math.min(1, dt * 4); MECHE.y += (ty - MECHE.y) * Math.min(1, dt * 4);
  if (Math.random() < .35) parts.push({ x: MECHE.x + (Math.random() - .5) * 4, y: MECHE.y, z: MECHE.z + 4, vx: (Math.random() - .5) * 8, vy: 0, vz: 18, life: 0, max: .5, col: Math.random() < .5 ? '#ffb050' : '#ffd866', size: 1, grav: 0, glow: 1 });
}
function drawMeche() {
  if (!MECHE.on) return;
  const z = MECHE.z + Math.sin(MECHE.t * 3) * 2;
  ctx.globalAlpha = .25; ctx.drawImage(SPR.shadow.img, Math.round(MECHE.x - 7 - cam.x), Math.round(MECHE.y - 2 - cam.y), 10, 3); ctx.globalAlpha = 1;
  drawSpr(SPR.meche[Math.floor(MECHE.t * 6) % 2], MECHE.x - cam.x, MECHE.y - cam.y - z);
}

/* ---------------- lights ---------------- */
let LIGHTS = [];
function addLight(x, y, r, a = 1, col = null) { LIGHTS.push({ x: x - cam.x, y: y - cam.y, r, a, col }); }

/* ---------------- map loading ---------------- */
function loadMap(id, x, y) {
  M = MAPCACHE[id] || (MAPCACHE[id] = buildMap(id));
  S.map = id;
  ents = []; parts = []; texts = [];
  M.spawns.forEach(s => { const e = spawn(s.type, s.tx * TS + 8, s.ty * TS + 14, Object.assign({}, s.props)); if (s.type === 'chest' && s.props.id === undefined) e.id = `${id}_${s.tx}_${s.ty}`; });
  STORY.populate(id);
  P.x = x; P.y = y; P.kbx = P.kby = 0; P.trail = [];
  MECHE.x = x; MECHE.y = y;
  snapCam();
  Snd.play(typeof M.def.music === 'function' ? M.def.music() : M.def.music);
  S.flags.visited = S.flags.visited || {};
  if (!S.flags.visited[id]) { S.flags.visited[id] = true; showBanner(M.def.name, null, true); }
}
async function goto(id, x, y) {
  busy++;
  await fadeTo(1, 220);
  loadMap(id, x, y);
  save(true);
  await fadeTo(0, 260);
  busy--;
  if (STORY.onEnter) STORY.onEnter(id);
}
function fadeTo(v, ms) {
  const from = fade, t0 = performance.now();
  return new Promise(res => { const f = () => { const k = Math.min(1, (performance.now() - t0) / ms); fade = from + (v - from) * k; k < 1 ? requestAnimationFrame(f) : res(); }; f(); });
}
function checkExits() {
  if (busy || mode !== 'play') return;
  const pb = boxOf(P);
  for (const ex of M.def.exits) {
    const r = { x: ex.x * TS, y: ex.y * TS, w: ex.w * TS, h: (ex.h + (ex.door ? .55 : 0)) * TS };
    if (!overlap(pb, r)) continue;
    if (ex.need && !ex.need()) { P.y -= (ex.y * TS > P.y ? 3 : -3); if (!P.lockT || T - P.lockT > 2) { P.lockT = T; say([[null, ex.lock]]); } return; }
    goto(ex.to, ex.tx * TS, ex.ty * TS);
    return;
  }
}

/* ---------------- interaction ---------------- */
function useAction() {
  const reach = { x: P.x + P.fx * 10 - 9, y: P.y - 8 + P.fy * 10 - 7, w: 18, h: 16 };
  let best = null, bd = 99;
  ents.forEach(e => { if (e.dead || !TYPES[e.type].interact) return; if (overlap(reach, boxOf(e)) || distP(e) < 14) { const d = distP(e); if (d < bd) { bd = d; best = e; } } });
  if (best) { run(() => TYPES[best.type].interact(best)); return; }
  // locked door
  const tx = Math.floor((P.x + P.fx * 10) / TS), ty = Math.floor((P.y - 4 + P.fy * 10) / TS);
  if (M.tileAt(tx, ty) === 'D' && !S.flags.doorD) {
    if (S.keys > 0) { S.keys--; S.flags.doorD = true; Snd.door(); shake = 4; toast('La porte s\'ouvre'); }
    else say([[null, "Une lourde porte de fer, verrouillée. Il faudrait une clé."]]);
  }
}
async function run(fn) { busy++; try { await fn(); } finally { busy--; } }

/* ---------------- dialogue (HTML) ---------------- */
const dlg = { open: false, queue: [], resolve: null, full: '', shown: 0, done: true, acc: 0, choice: null };
function say(lines) {
  return new Promise(res => {
    dlg.queue = lines.slice(); dlg.resolve = res; dlg.open = true; $('dlg').hidden = false;
    nextLine();
  });
}
function ask(who, text, options) {
  return new Promise(res => {
    dlg.queue = [[who, text]]; dlg.open = true; $('dlg').hidden = false;
    dlg.choice = { options, res };
    dlg.resolve = null;
    nextLine();
  });
}
function nextLine() {
  const line = dlg.queue.shift();
  if (!line) { closeDlg(); return; }
  const [who, text] = line;
  const sp = who ? SPEAKERS[who] : null;
  $('dlg').classList.toggle('noface', !sp);
  $('dlg-name').textContent = sp ? (typeof sp.name === 'function' ? sp.name() : sp.name) : '';
  if (sp) drawPortraitInto($('dlg-face'), sp);
  dlg.html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
  dlg.full = text.replace(/\*\*?/g, ''); dlg.shown = 0; dlg.done = false; dlg.acc = 0;
  $('dlg-text').textContent = ''; $('dlg-more').hidden = true; $('dlg-choices').innerHTML = '';
}
function dlgTick(dt) {
  if (!dlg.open || dlg.done) return;
  dlg.acc += dt * 60;
  const n = Math.min(dlg.full.length, Math.floor(dlg.acc));
  if (n > dlg.shown) { dlg.shown = n; $('dlg-text').textContent = dlg.full.slice(0, n); if (n % 3 === 0) Snd.blip(); }
  if (dlg.shown >= dlg.full.length) finishLine();
}
function finishLine() {
  dlg.done = true; $('dlg-text').innerHTML = dlg.html;
  if (dlg.choice && !dlg.queue.length) {
    const box = $('dlg-choices'); box.innerHTML = '';
    dlg.choice.options.forEach((o, i) => {
      const b = document.createElement('button'); b.className = 'opt' + (o.disabled ? ' off' : ''); b.innerHTML = `<span>${i + 1}</span>`;
      b.append(o.label || o); if (o.disabled) b.disabled = true;
      b.onclick = ev => { ev.stopPropagation(); Snd.select(); const c = dlg.choice; dlg.choice = null; closeDlg(); c.res(i); };
      box.append(b);
    });
    dlg.sel = 0; highlightOpt();
  } else $('dlg-more').hidden = false;
}
function highlightOpt() { [...$('dlg-choices').children].forEach((b, i) => b.classList.toggle('sel', i === dlg.sel)); }
function advanceDlg() {
  if (!dlg.open) return;
  if (!dlg.done) { finishLine(); return; }
  if (dlg.choice && !dlg.queue.length) return;
  nextLine();
}
function closeDlg() { dlg.open = false; $('dlg').hidden = true; const r = dlg.resolve; dlg.resolve = null; r && r(); }
function drawPortraitInto(c, sp) {
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, c.width, c.height);
  x.fillStyle = sp.bg || '#1a1428'; x.fillRect(0, 0, c.width, c.height);
  const s = typeof sp.spr === 'function' ? sp.spr() : sp.spr;
  if (!s) return;
  const grey = sp.grey && sp.grey();
  const img = grey ? s.grey : s.img;
  const crop = sp.crop || [0, 0, s.w, Math.min(s.h, 12)];
  const k = Math.floor(Math.min(c.width / crop[2], c.height / crop[3]));
  x.drawImage(img, crop[0], crop[1], crop[2], crop[3], (c.width - crop[2] * k) / 2, (c.height - crop[3] * k) / 2 + (sp.dy || 0), crop[2] * k, crop[3] * k);
}

/* ---------------- banner & toast ---------------- */
function showBanner(title, sub, area) {
  const b = $('banner'); b.innerHTML = '';
  if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
  const t = document.createElement('b'); t.textContent = title; b.append(t);
  b.className = area ? 'area' : 'name';
  b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
  clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, 3400);
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('toasts').append(t); setTimeout(() => t.remove(), 2800);
}

/* ---------------- camera ---------------- */
function camTarget() {
  const mw = M.w * TS, mh = M.h * TS;
  return { x: mw <= W ? (mw - W) / 2 : clamp(P.x - W / 2, 0, mw - W), y: mh <= H ? (mh - H) / 2 : clamp(P.y - 8 - H / 2, 0, mh - H) };
}
function snapCam() { const t = camTarget(); cam.x = t.x; cam.y = t.y; }

/* ---------------- render ---------------- */
function drawPlayer() {
  const p = P;
  if (p.inv > 0 && p.dash <= 0 && Math.floor(p.inv * 14) % 2) return;
  const set = SPR.hero[p.hold ? 'down' : p.dir], frame = p.moving ? [1, 0, 2, 0][Math.floor(p.anim * 8) % 4] : 0;
  const flip = p.dir === 'side' && p.fx < 0 && !p.hold;
  p.trail.forEach(t => { const s2 = SPR.hero[t.dir][1]; ctx.globalAlpha = t.life * 2.5; ctx.drawImage(t.fx < 0 && t.dir === 'side' ? s2.white : s2.white, Math.round(t.x - 8 - cam.x), Math.round(t.y - 16 - cam.y)); ctx.globalAlpha = 1; });
  shadowAt(p.x, p.y);
  if (p.atk > 0 && p.dir === 'up') drawSword();
  drawSpr(set[frame], p.x - cam.x, p.y - cam.y + 1, { flip });
  if (p.atk > 0 && p.dir !== 'up') drawSword();
  if (p.hold) drawSpr(p.hold, p.x - cam.x, p.y - cam.y - 16 - Math.sin(T * 4));
}
function drawSword() {
  const p = P, k = 1 - p.atk / ATK_T;
  const base = Math.atan2(p.fy, p.fx);
  const a = base - 1.25 + k * 2.5;
  const hx = p.x - cam.x + p.fx * 3, hy = p.y - cam.y - 7 + p.fy * 2;
  const s = S.sword >= 2 ? SPR.isword : SPR.wsword;
  ctx.save(); ctx.translate(Math.round(hx), Math.round(hy)); ctx.rotate(a + Math.PI / 4);
  ctx.drawImage(s.img, 2, -10); ctx.restore();
  // slash arc
  ctx.save(); ctx.translate(hx, hy);
  for (let i = 0; i < 6; i++) {
    const a0 = base - 1.25 + Math.max(0, k - .35 + i * .06) * 2.5, a1 = base - 1.25 + Math.min(1, k + i * .02) * 2.5;
    ctx.strokeStyle = `rgba(255,255,255,${.12 + i * .07 * (1 - k)})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 11 + i, a0, a1); ctx.stroke();
  }
  ctx.restore();
}
function drawDynamicTiles() {
  const tx0 = Math.floor(cam.x / TS) - 1, ty0 = Math.floor(cam.y / TS) - 1, tx1 = tx0 + W / TS + 2, ty1 = ty0 + H / TS + 3;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const ch = M.tileAt(tx, ty); if (!ch) continue;
    const x = tx * TS - Math.round(cam.x), y = ty * TS - Math.round(cam.y);
    if (ch === '~') {
      ctx.fillStyle = '#5a9ae0';
      for (let k = 0; k < 2; k++) { const ox = Math.floor((T * 6 + hash(tx, ty, k) * 16 + k * 8) % 16); ctx.fillRect(x + ox - 2, y + 5 + k * 6 + Math.round(Math.sin(T * 2 + tx + k)), 4, 1); }
      if (hash(tx, ty, Math.floor(T * 2)) > .93) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + Math.floor(hash(tx, ty, 3) * 14), y + Math.floor(hash(ty, tx, 4) * 14), 1, 1); }
      const up = M.tileAt(tx, ty - 1);
      if (up && up !== '~' && up !== 'B') { ctx.fillStyle = 'rgba(230,245,255,.75)'; for (let i = 0; i < 16; i += 2) ctx.fillRect(x + i, y + 1 + Math.round(Math.sin(T * 3 + i * .5 + tx) * 1.2), 2, 1); }
    } else if (ch === '"') {
      const sway = Math.sin(T * 2 + tx * .7 + ty) * 1.2;
      for (let k = 0; k < 4; k++) {
        const bx = x + 2 + k * 4, by = y + 14;
        ctx.fillStyle = k % 2 ? '#3a8a34' : '#4aa040';
        for (let j = 0; j < 9; j++) ctx.fillRect(Math.round(bx + sway * (j / 9)), by - j, 2, 1);
        ctx.fillStyle = '#6ac458'; ctx.fillRect(Math.round(bx + sway), by - 9, 1, 1);
      }
    } else if (ch === 'i') {
      const f = Math.floor(T * 8 + tx) % 2;
      ctx.fillStyle = '#ff7a2a'; ctx.fillRect(x + 6, y + 3 - f, 4, 4 + f); ctx.fillStyle = '#ffd866'; ctx.fillRect(x + 7, y + 4, 2, 3);
      addLight(tx * TS + 8, ty * TS + 18, 56 + Math.sin(T * 9 + tx) * 4, 1, 'warm');
      if (Math.random() < .05) burst(tx * TS + 8, ty * TS + 20, 1, '#ffb050', { speed: 4, up: 14, life: .7, grav: -10, z: 14 });
    } else if (ch === 'f') {
      const f = Math.floor(T * 8) % 2;
      ctx.fillStyle = '#ff6a2a'; ctx.fillRect(x + 4, y + 8 - f, 8, 8 + f); ctx.fillStyle = '#ffd866'; ctx.fillRect(x + 6, y + 10, 4, 6);
      addLight(tx * TS + 8, ty * TS + 16, 90, 1, 'warm');
    } else if ((ch === 'D' && !S.flags.doorD) || (ch === 'G' && !S.flags.gateG) || (ch === 'H' && !S.flags.bossDead) || (ch === 'J' && S.flags.bossFight && !S.flags.bossDead)) {
      if (ch === 'D') { ctx.fillStyle = '#3a2a1a'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#5a4028'; for (let i = 1; i < 16; i += 5) ctx.fillRect(x + i, y, 4, 16); ctx.fillStyle = '#7a7a86'; ctx.fillRect(x, y + 3, 16, 2); ctx.fillRect(x, y + 11, 16, 2); if (M.tileAt(tx - 1, ty) !== 'D' && M.tileAt(tx, ty - 1) !== 'D') {} if (M.tileAt(tx + 1, ty) !== 'D' && M.tileAt(tx, ty + 1) !== 'D') { ctx.fillStyle = '#e8c040'; ctx.fillRect(x - 2, y + 4, 3, 4); ctx.fillStyle = '#1a1020'; ctx.fillRect(x - 1, y + 5, 1, 2); } }
      else { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, y, 16, 16); ctx.fillStyle = '#6a6a7a'; for (let i = 1; i < 16; i += 4) ctx.fillRect(x + i, y, 2, 16); ctx.fillStyle = '#8a8a9a'; ctx.fillRect(x, y + 2, 16, 2); ctx.fillRect(x, y + 12, 16, 2); }
    }
  }
}
function drawFog(level) {
  if (level <= 0) return;
  const g = SPR.glow.fog;
  for (let i = 0; i < 14; i++) {
    const r = 90 + hash(i, 1) * 80;
    const x = ((hash(i, 2) * (M.w * TS + 400) + T * (6 + hash(i, 3) * 8)) % (M.w * TS + 400)) - 200 - cam.x;
    const y = hash(i, 4) * M.h * TS - cam.y + Math.sin(T * .2 + i) * 20;
    ctx.globalAlpha = level * .22; ctx.drawImage(g, x - r, y - r * .6, r * 2, r * 1.2);
  }
  ctx.globalAlpha = 1;
}
function ambient(dt) {
  const th = M.def.theme;
  const rx = () => cam.x + Math.random() * W, ry = () => cam.y + Math.random() * H;
  if (th === 'forest' && Math.random() < dt * 3) parts.push({ x: rx(), y: cam.y - 4, z: 30, vx: 6 + Math.random() * 6, vy: 14, vz: 0, life: 0, max: 7, col: ['#c8a040', '#a8c050', '#d87a3a'][Math.floor(Math.random() * 3)], size: 2, grav: 0, leaf: 1 });
  if ((th === 'forest' || (th === 'village' && !S.flags.dawn)) && Math.random() < dt * 1.5) parts.push({ x: rx(), y: ry(), z: 4 + Math.random() * 20, vx: (Math.random() - .5) * 6, vy: (Math.random() - .5) * 6, vz: 0, life: 0, max: 3, col: '#e8ff8a', size: 1, grav: 0, glow: 1, fly: 1 });
  if (th === 'crypt' && Math.random() < dt * 4) parts.push({ x: rx(), y: ry(), z: 10, vx: 2, vy: 1, vz: -1, life: 0, max: 4, col: '#8a84a0', size: 1, grav: 0 });
}
function drawParts() {
  parts.forEach(p => {
    const a = Math.min(1, (1 - p.life / p.max) * 2);
    let x = p.x - cam.x, y = p.y - cam.y - p.z;
    if (p.leaf) { x += Math.sin(p.life * 3 + p.x) * 6; }
    if (p.fly) { ctx.globalAlpha = a * (.5 + .5 * Math.sin(p.life * 8 + p.x)); }
    else ctx.globalAlpha = a;
    ctx.fillStyle = p.col; ctx.fillRect(Math.round(x), Math.round(y), p.size, p.size);
    if (p.glow) addLight(p.x, p.y - p.z, 8, .5 * a, null);
  });
  ctx.globalAlpha = 1;
}
function drawLighting() {
  const dark = mode === 'title' ? .3 : typeof M.def.dark === 'function' ? M.def.dark() : M.def.dark;
  if (mode !== 'title' && P) {
    if (MECHE.on) addLight(MECHE.x, MECHE.y - 14, M.def.theme === 'crypt' ? 78 : 64, 1, 'warm');
    else addLight(P.x, P.y - 8, 34, .7);
  }
  if (M.def.id === 'village' || M.id === 'village') {
    M.houses.forEach(hs => { addLight((hs.x + .7) * TS, (hs.y + hs.h * .78) * TS, 40, .9, 'warm'); addLight((hs.x + hs.w - .7) * TS, (hs.y + hs.h * .78) * TS, 40, .9, 'warm'); });
  }
  if (dark > .01) {
    const tint = typeof M.def.tint === 'function' ? M.def.tint() : M.def.tint;
    const [r, g, b] = hexRgb(tint);
    lctx.globalCompositeOperation = 'source-over'; lctx.clearRect(0, 0, W, H);
    lctx.fillStyle = `rgba(${r},${g},${b},${dark})`; lctx.fillRect(0, 0, W, H);
    lctx.globalCompositeOperation = 'destination-out';
    LIGHTS.forEach(L => { lctx.globalAlpha = L.a; lctx.drawImage(SPR.glow.white, L.x - L.r, L.y - L.r, L.r * 2, L.r * 2); });
    lctx.globalAlpha = 1;
    ctx.drawImage(LC, 0, 0);
  }
  ctx.globalCompositeOperation = 'lighter';
  LIGHTS.forEach(L => { if (!L.col) return; ctx.globalAlpha = .18 * L.a; ctx.drawImage(SPR.glow[L.col], L.x - L.r * .8, L.y - L.r * .8, L.r * 1.6, L.r * 1.6); });
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (S.flags.dawn && M.id === 'village') { ctx.fillStyle = 'rgba(255,190,120,.12)'; ctx.fillRect(0, 0, W, H); }
}
function drawHUD() {
  const full = SPR.heart;
  for (let i = 0; i < S.maxHp / 2; i++) {
    const x = 6 + i * 9, y = 6, v = S.hp - i * 2;
    ctx.drawImage(full.grey, x, y); ctx.globalAlpha = .4; ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y + 1, 5, 3); ctx.globalAlpha = 1;
    if (v >= 2) ctx.drawImage(full.img, x, y);
    else if (v === 1) ctx.drawImage(full.img, 0, 0, 4, 6, x, y, 4, 6);
  }
  let x = 6; const y2 = 16;
  ctx.drawImage(SPR.gem.img, x, y2); pxText(ctx, S.gems, x + 8, y2 + 1, '#d0fbff'); x += 30;
  if (S.potions) { ctx.drawImage(SPR.potion.img, x, y2); pxText(ctx, S.potions, x + 8, y2 + 1, '#ffd0e0'); x += 22; }
  if (S.keys) { ctx.drawImage(SPR.key.img, x, y2 - 1); pxText(ctx, S.keys, x + 10, y2 + 1, '#fff0a0'); x += 22; }
  // names
  const n = namesCount();
  ctx.font = '8px "Pixelify Sans",monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#1d1424'; ctx.fillText('✦', W - 27, 13); ctx.fillStyle = '#ffd866'; ctx.fillText('✦', W - 28, 12);
  pxText(ctx, `${n}/6`, W - 24, 7, '#fff0c0');
  // boss bar
  const boss = ents.find(e => e.type === 'boss' && !e.dead && e.awake && e.st !== 'down');
  if (boss) {
    const bw = 160, bx = (W - bw) / 2, by = H - 14;
    ctx.fillStyle = '#1d1424'; ctx.fillRect(bx - 2, by - 2, bw + 4, 8);
    ctx.fillStyle = '#4a1a2a'; ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = boss.stun > 0 ? '#ffd866' : '#e8313a'; ctx.fillRect(bx, by, bw * Math.max(0, boss.hp) / boss.maxHp, 4);
    ctx.font = '7px "Pixelify Sans",monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#e8e0f0'; ctx.fillText('LE GARDIEN DES NOMS', W / 2, by - 4);
  }
  if (redFlash > 0) { ctx.fillStyle = `rgba(255,30,40,${redFlash * .35})`; ctx.fillRect(0, 0, W, H); }
}
function render() {
  LIGHTS = [];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (!M) return;
  const sx = shake > 0 ? (Math.random() - .5) * shake : 0, sy = shake > 0 ? (Math.random() - .5) * shake : 0;
  const rcx = cam.x, rcy = cam.y;
  cam.x = Math.round(rcx + sx); cam.y = Math.round(rcy + sy);
  ctx.drawImage(M.ground, -cam.x, -cam.y);
  drawDynamicTiles();
  const list = [];
  M.props.forEach(p => { if (p.sx - cam.x < W + 40 && p.sx - cam.x > -60 && p.sy - cam.y < H + 20 && p.y - cam.y > -10) list.push(p); });
  ents.forEach(e => { if (!e.dead) list.push(e); });
  if (mode !== 'title') list.push(P);
  list.sort((a, b) => a.y - b.y);
  list.forEach(o => {
    if (o === P) drawPlayer();
    else if (o.type) TYPES[o.type].draw(o);
    else {
      let alpha = 1;
      if (mode !== 'title' && !o.house && P.y < o.y - 4 && P.y > o.y - 44 && Math.abs(P.x - o.x) < 16) alpha = .55;
      ctx.globalAlpha = alpha; ctx.drawImage(o.img, Math.round(o.sx - cam.x), Math.round(o.sy - cam.y)); ctx.globalAlpha = 1;
      if (o.house && Math.random() < .25 && !S.flags.dawn) parts.push({ x: o.sx + o.img.width - 13 + Math.random() * 2, y: o.y, z: o.y - o.sy + 2, vx: 3 + Math.random() * 3, vy: 0, vz: 10, life: 0, max: 2.5, col: '#8a8a96', size: 2, grav: 0 });
    }
  });
  if (mode !== 'title') drawMeche();
  drawParts();
  texts.forEach(t => { pxText(ctx, t.s, Math.round(t.x - cam.x) - 2, Math.round(t.y - cam.y), t.col); });
  const fog = M.def.fog ? M.def.fog() : 0;
  drawFog(fog);
  drawLighting();
  if (mode !== 'title') drawHUD();
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${fade})`; ctx.fillRect(0, 0, W, H); }
  cam.x = rcx; cam.y = rcy;
}

/* ---------------- main loop ---------------- */
let last = 0;
function frame(ts) {
  let dt = Math.min(.05, (ts - last) / 1000) || .016; last = ts;
  pollPad();
  T += dt;
  if (hitstop > 0) { hitstop -= dt; dt = 0; }
  shake = Math.max(0, shake - (shake * 6 + 4) * (dt || .016));
  redFlash = Math.max(0, redFlash - (dt || .016) * 2);
  if (M) {
    if (mode === 'title') { cam.x = 120 + Math.sin(T * .05) * 100; cam.y = 60; }
    else if (mode === 'play' || mode === 'cut') {
      if (S) S.time += dt;
      updPlayer(dt); updMeche(dt); updEnts(dt); updParts(dt); ambient(dt);
      if (STORY.tick) STORY.tick(dt);
      checkExits();
      const t = camTarget(); cam.x += (t.x - cam.x) * Math.min(1, dt * 8); cam.y += (t.y - cam.y) * Math.min(1, dt * 8);
    } else { updParts(dt); }
  }
  dlgTick(dt || .016);
  render();
  for (const k in pressed) pressed[k] = false;
  requestAnimationFrame(frame);
}

/* ---------------- menus ---------------- */
function onKey(e) {
  if (mode === 'title') return;
  if (dlg.open) {
    const opts = $('dlg-choices').children;
    if (dlg.done && dlg.choice && opts.length) {
      const c = e.code;
      if (['ArrowUp', 'KeyW', 'KeyZ', '__pad_up'].includes(c)) { dlg.sel = (dlg.sel + opts.length - 1) % opts.length; highlightOpt(); Snd.select(); }
      if (['ArrowDown', 'KeyS', '__pad_down'].includes(c)) { dlg.sel = (dlg.sel + 1) % opts.length; highlightOpt(); Snd.select(); }
      if (/^Digit[1-9]$/.test(c)) { const b = opts[+c.slice(5) - 1]; b && b.click(); }
      if (['Space', 'Enter', 'KeyE', 'KeyJ', '__pad_attack', '__pad_use'].includes(c)) { const b = opts[dlg.sel]; b && !b.disabled && b.click(); }
      return;
    }
    if (['Space', 'Enter', 'KeyE', 'KeyJ', 'KeyX', '__pad_attack', '__pad_use'].includes(e.code)) advanceDlg();
    for (const k in pressed) pressed[k] = false;
    return;
  }
  if (BIND.pause.includes(e.code) || e.code === '__pad_pause') togglePause();
  if (e.code === 'KeyM') { $('btn-sound').click(); }
}
function togglePause() {
  if (mode === 'play' && !busy) { mode = 'pause'; $('pause').hidden = false; drawInventory(); }
  else if (mode === 'pause') { mode = 'play'; $('pause').hidden = true; }
}
function drawInventory() {
  const el = $('inv'); el.innerHTML = '';
  const row = (label, val) => { const d = document.createElement('div'); d.className = 'invrow'; d.innerHTML = `<span></span><b></b>`; d.firstChild.textContent = label; d.lastChild.textContent = val; el.append(d); };
  row('Épée', S.sword >= 2 ? 'Épée de fer' : S.sword ? 'Épée de bois' : '—');
  row('Cœurs', `${S.maxHp / 2}`);
  row('Éclats', S.gems); row('Potions', S.potions); row('Clés', S.keys);
  const names = document.createElement('div'); names.className = 'names';
  NAME_KEYS.forEach(k => { const s = document.createElement('span'); s.className = S.names[k] ? 'got' : ''; s.textContent = S.names[k] ? NPC[k].label : '? ? ?'; names.append(s); });
  el.append(names);
  const q = document.createElement('p'); q.className = 'quest'; q.textContent = STORY.quest(); el.append(q);
}

/* ---------------- boot ---------------- */
function layout() {
  const fit = Math.min(innerWidth / W, innerHeight / H);
  const kk = fit < 1 ? fit : fit >= 4 ? Math.floor(fit) : Math.floor(fit * 2) / 2;
  cv.style.width = W * kk + 'px'; cv.style.height = H * kk + 'px';
}
async function startGame(load) {
  Snd.init();
  $('title').hidden = true; $('over').hidden = true; $('hud-btns').hidden = false;
  S = load || newState();
  if (!S.flags.bossDead) S.flags.bossFight = false;
  P = makePlayer(S.x, S.y);
  MECHE.on = !!S.flags.meche;
  mode = 'play'; busy = 0; fade = 1;
  loadMap(S.map, S.x, S.y);
  await fadeTo(0, 600);
  if (STORY.onEnter) STORY.onEnter(S.map, true);
}
function toTitle() {
  mode = 'title'; $('title').hidden = false; $('pause').hidden = true; $('over').hidden = true; $('hud-btns').hidden = true;
  closeDlg(); busy = 0;
  S = S || newState();
  M = MAPCACHE.village || (MAPCACHE.village = buildMap('village'));
  ents = []; parts = []; fade = 0;
  $('t-continue').hidden = !loadSave();
  Snd.play('village');
}
function boot() {
  buildSprites();
  layout(); addEventListener('resize', layout);
  $('t-new').onclick = () => { if (loadSave() && !confirm('Commencer une nouvelle partie ? La sauvegarde actuelle sera remplacée.')) return; try { localStorage.removeItem(SAVE_KEY); } catch (e) {} startGame(null); };
  $('t-continue').onclick = () => { const s = loadSave(); if (s) startGame(s); };
  $('o-retry').onclick = () => { const s = loadSave(); startGame(s || null).then(() => { S.hp = S.maxHp; }); };
  $('p-resume').onclick = togglePause;
  $('p-quit').onclick = () => { save(true); toTitle(); };
  $('btn-sound').classList.toggle('off', !Snd.on);
  $('btn-sound').onclick = () => { Snd.init(); $('btn-sound').classList.toggle('off', !Snd.toggle()); };
  $('btn-pause').onclick = () => togglePause();
  $('dlg').addEventListener('click', advanceDlg);
  // touch controls
  const stick = $('stick'), knob = $('knob');
  let sid = null, sx = 0, sy = 0;
  stick.addEventListener('pointerdown', e => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; stick.setPointerCapture(sid); });
  stick.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy), m = 40; if (d > m) { dx *= m / d; dy *= m / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; touchKeys.ax = Math.abs(dx) > 8 ? dx / m : 0; touchKeys.ay = Math.abs(dy) > 8 ? dy / m : 0; if (!touchKeys.ax && !touchKeys.ay) { touchKeys.ax = 0; touchKeys.ay = 0; } });
  const endStick = () => { sid = null; knob.style.transform = ''; touchKeys.ax = 0; touchKeys.ay = 0; };
  stick.addEventListener('pointerup', endStick); stick.addEventListener('pointercancel', endStick);
  [['tb-a', 'attack', 'Space'], ['tb-b', 'dash', 'KeyK'], ['tb-e', 'use', 'KeyE']].forEach(([id, a, code]) => {
    $(id).addEventListener('pointerdown', e => { e.preventDefault(); Snd.init(); pressed[a] = true; onKey({ code }); });
  });
  toTitle();
  requestAnimationFrame(frame);
}
