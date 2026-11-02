'use strict';
/* SANS-NOM — pixel art: sprite parser, sprite sheets, procedural props, bitmap font. */

const W = 320, H = 180, TS = 16;

/* ---------- helpers ---------- */
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hexRgb(a), B = hexRgb(b); return rgbHex(A.map((v, i) => v + (B[i] - v) * t)); };
const shade = (h, k) => k < 0 ? mix(h, '#000000', -k) : mix(h, '#ffffff', k);
const hash = (x, y = 0, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

/* Build a sprite from ASCII rows + palette. Returns {img, flip, white, grey, w, h}. */
function sprite(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = canvas(w, h), x = c.getContext('2d');
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const col = pal[r[i]]; if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } } });
  return finish(c);
}
function finish(c) {
  const w = c.width, h = c.height;
  const f = canvas(w, h), fx = f.getContext('2d'); fx.translate(w, 0); fx.scale(-1, 1); fx.drawImage(c, 0, 0);
  const wh = canvas(w, h), wx = wh.getContext('2d'); wx.drawImage(c, 0, 0); wx.globalCompositeOperation = 'source-in'; wx.fillStyle = '#ffffff'; wx.fillRect(0, 0, w, h);
  const gr = canvas(w, h), gx = gr.getContext('2d'); gx.drawImage(c, 0, 0);
  const d = gx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) { const l = d.data[i] * .3 + d.data[i + 1] * .55 + d.data[i + 2] * .15; const v = 70 + l * .55; d.data[i] = v; d.data[i + 1] = v; d.data[i + 2] = v + 12; }
  gx.putImageData(d, 0, 0);
  const grf = canvas(w, h), grfx = grf.getContext('2d'); grfx.translate(w, 0); grfx.scale(-1, 1); grfx.drawImage(gr, 0, 0);
  return { img: c, flip: f, white: wh, grey: gr, greyFlip: grf, w, h };
}
function procSprite(w, h, fn) { const c = canvas(w, h); fn(c.getContext('2d'), w, h); return finish(c); }

/* ---------- hero ---------- */
const HERO_PAL = { k: '#1d1424', h: '#b0562c', H: '#6e3519', s: '#f4c7a1', S: '#d49a78', e: '#1d1424', r: '#f0948a', b: '#3d7fd9', B: '#25549a', t: '#8a6038', T: '#5e3f22', p: '#3a3150', o: '#4a2c1c', w: '#ffffff' };
const D_HEAD = ['.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhHhhHhhk...', '...khsssssshk...', '...kssessessk...', '...ksrssssrsk...', '....kssssssk....'];
const U_HEAD = ['.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khHhhhhHhk...', '....kHHHHHHk....'];
const S_HEAD = ['.....kkkkkk.....', '....khhhhhhk....', '...khhhhhhhhk...', '...khhhhhhhhk...', '...khhhHhhhhk...', '...khhhhssssk...', '...khhhsssesk...', '...khhhssssrk...', '....khsssssk....'];
const D_BODY = ['...kbbbbbbbbk...', '..kttTbbbbTttk..', '..ksttttttttsk..', '...kTTTTTTTTk...'];
const U_BODY = ['...kbbbbbbbbk...', '..kttTtBBtTttk..', '..ksttttttttsk..', '...kTTTTTTTTk...'];
const S_BODY = ['..bbkbbbbbbk....', '...kttttTtttk...', '...ktttsttttk...', '....kTTTTTTk....'];
const L_IDLE = ['...kppk..kppk...', '...kook..kook...', '....kk....kk....'];
const L_W1 = ['...kppk..kppk...', '...kook...kk....', '....kk..........'];
const L_W2 = ['...kppk..kppk...', '....kk...kook...', '..........kk....'];
const SL_IDLE = ['....kppkkppk....', '....kook.kook...', '.....kk...kk....'];
const SL_W1 = ['...kppk..kppk...', '..kook....kook..', '...kk......kk...'];
const SL_W2 = ['.....kppppk.....', '.....kooook.....', '......kkkk......'];
const SCARF_FLY = ['.bb.............'];

/* ---------- villagers (palette-swapped) ---------- */
const V_BODY = ['...kcccccccck...', '..kccCccccCcck..', '..ksccccccccsk..', '...kCCCCCCCCk...'];
const V_DRESS = ['..kccccccccccK..', '..kCCCCCCCCCCk..', '...kk......kk...'];
function villagerRows(o) {
  const head = D_HEAD.slice();
  if (o.hat) { head[0] = '....kkkkkkkk....'; head[1] = '...kaaaaaaaak...'; head[2] = '..kaaaaaaaaaak..'; }
  if (o.bun) { head[0] = '......kkkk......'; head[1] = '....khhhhhhk....'; }
  if (o.beard) { head[7] = '...kffffffffk...'; head[8] = '....kffffffk....'; }
  if (o.child) head[7] = '...ksrssssrsk...';
  return [...head, ...V_BODY, ...(o.dress ? V_DRESS : L_IDLE)];
}
function villagerWalk(o, legs) { const r = villagerRows(o); return o.dress ? r : [...r.slice(0, 13), ...legs]; }

/* ---------- creatures ---------- */
const MECHE_ROWS = [
  ['.....k....', '....kyk...', '...kyyk...', '..kyYyyk..', '.kyYwwYyk.', '.kYeYYeYk.', 'kyYYwwYYyk', 'koyYYYYyok', '.kooyyook.', '..kkkkkk..'],
  ['....k.....', '...kyk....', '...kyyk...', '..kyyYyk..', '.kyYwwYyk.', '.kYeYYeYk.', 'kyYYwwYYyk', 'koyYYYYyok', '.kooyyook.', '..kkkkkk..'],
];
const MECHE_PAL = { k: '#5a1a0a', y: '#ffa02a', Y: '#ffd866', w: '#fff6c8', o: '#e0501a', e: '#3a1a10' };
const SLIME = [
  ['................', '......kkkk......', '....kkgggGkk....', '...kgwwggggGk...', '..kgwggggggggk..', '..kggegggegggk..', '.kgggggggggggGk.', '.kggggggggggGGk.', '.kGgggggggggGGk.', '..kGGGGGGGGGGk..', '...kkkkkkkkkk...', '................'],
  ['................', '................', '.....kkkkkk.....', '...kkgwwggGkk...', '..kgwgggggggGk..', '.kgggegggggeggk.', '.kggggggggggggk.', 'kgggggggggggggGk', 'kGgggggggggggGGk', '.kGGGGGGGGGGGGk.', '..kkkkkkkkkkkk..', '................'],
];
const SLIME_PAL = { k: '#173012', g: '#6cc24a', G: '#3f8a32', w: '#d8ffb0', e: '#10200a' };
const ECHO = [
  ['......kkkk......', '....kkmmmmkk....', '...kmmmmmmmmk...', '..kmmMmmmmMmmk..', '..kmmeemmeemmk..', '..kmmeemmeemmk..', '..kmmmmmmmmmmk..', '..kmmmmoommmmk..', '..kmmmmmmmmmmk..', '..kmmmmGGmmmmk..', '..kmmmGGGGmmmk..', '..kmmmmGGmmmmk..', '...kmmmmmmmmk...', '...kmkmmmmkmk...', '....k.kmmk.k....', '......k..k......'],
  ['......kkkk......', '....kkmmmmkk....', '...kmmmmmmmmk...', '..kmmMmmmmMmmk..', '..kmmeemmeemmk..', '..kmmeemmeemmk..', '..kmmmmmmmmmmk..', '..kmmmmoommmmk..', '..kmmmmmmmmmmk..', '..kmmmmGGmmmmk..', '..kmmmGGGGmmmk..', '..kmmmmGGmmmmk..', '...kmmmmmmmmk...', '...kmmkmmkmmk...', '...k.kmmmmk.k...', '.......kk.......'],
];
const ECHO_PAL = { k: '#4a4a66', m: '#b8c4d8', M: '#eef2fa', e: '#1a1830', o: '#2a2840', G: '#ffd866' };
const WOLF = [
  ['................', '..........k.k...', '.........kGkGk..', '........kGGGGGk.', 'k......kGGGeGGGk', 'kk....kgGGGGGGnk', '.kgk.kggggggGkk.', '..kgkggggggggk..', '..kggggggggggk..', '..kgGgggggggGk..', '..kgk.kgk.kgkgk.', '..kk..kk..kkkk..'],
  ['................', '..........k.k...', '.........kGkGk..', '........kGGGGGk.', '.k.....kGGGeGGGk', 'kgk...kgGGGGGGnk', '..kgkkggggggGkk.', '..kgggggggggk...', '..kggggggggggk..', '..kgGgggggggGk..', '...kgkkgk.kgk...', '...kk.kk..kk....'],
];
const WOLF_PAL = { k: '#1c1a24', g: '#8c8f9c', G: '#b5b8c4', e: '#ff4040', n: '#1a1020' };
const BAT = [
  ['k..............k', 'kk............kk', 'kbk...kkkk...kbk', 'kbbk.kbbbbk.kbbk', '.kbbkbebbebkbbk.', '..kbbbbbbbbbbk..', '...kk.kbbk.kk...', '......k..k......'],
  ['................', '................', '......kkkk......', '.....kbbbbk.....', '..kkkbebbebkkk..', '.kbbbbbbbbbbbbk.', 'kbbk.kbbbbk.kbbk', 'kk....k..k....kk'],
];
const BAT_PAL = { k: '#1a0f20', b: '#6a3f80', e: '#ff5a5a' };
const SKEL = [
  ['.....kkkkkk.....', '....kwwwwwwk....', '...kwwwwwwwwk...', '...kwkkwwkkwk...', '...kwkrwwkrwk...', '...kwwwkkwwwk...', '....kwkwkwkk....', '.....kkkkkk.....', '...kkaaaaaakk...', '..kwkaAaaAakwk..', '..kwkaaaaaakwk..', '..kwkaAAAAakwk..', '...kkkaaaakkk...', '....kwk..kwk....', '....kwk..kwk....', '....kk....kk....'],
  ['.....kkkkkk.....', '....kwwwwwwk....', '...kwwwwwwwwk...', '...kwkkwwkkwk...', '...kwkrwwkrwk...', '...kwwwkkwwwk...', '....kwkwkwkk....', '.....kkkkkk.....', '...kkaaaaaakk...', '..kwkaAaaAakwk..', '..kwkaaaaaakwk..', '..kwkaAAAAakwk..', '...kkkaaaakkk...', '....kwk...kwk...', '...kwk....kwk...', '...kk......kk...'],
];
const SKEL_PAL = { k: '#16141c', w: '#e8e2d0', a: '#5a6070', A: '#8a90a0', r: '#ff3a2a' };

/* ---------- items ---------- */
const ITEMS_SPR = {
  heart: [['.kk.kk.', 'kRrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'], { k: '#3a0a10', r: '#e8313a', R: '#ffb0b0' }],
  gem: [['..kk..', '.kCck.', 'kCccck', 'kcccck', '.kcck.', '..kk..'], { k: '#0a3a44', c: '#3ad0e8', C: '#d0fbff' }],
  key: [['.kkk....', 'kyYyk...', 'ky.yk...', 'kyyykkkk', '.kkkyyyk', '....kkyk', '......k.'], { k: '#3a2a08', y: '#e8b830', Y: '#fff0a0' }],
  potion: [['..kk..', '..kk..', '.kRRk.', 'kRrrrk', 'krrrrk', '.kkkk.'], { k: '#2a0a20', r: '#e83a7a', R: '#ffb0d0' }],
  wsword: [['.......k', '......kw', '.....kwk', '....kwk.', 'kk.kwk..', '.kkwk...', '..kk....', '.k.k....'], { k: '#3a2410', w: '#c89050' }],
  isword: [['.......k', '......kw', '.....kwk', '....kwk.', 'kk.kwk..', '.kyyk...', '..ky....', '.k.k....'], { k: '#22283a', w: '#dfe6f0', y: '#d8a030' }],
  crystal: [['..kk..', '.kRrk.', 'kRrrrk', 'krrrrk', '.krrk.', '..kk..'], { k: '#3a0a10', r: '#ff4a6a', R: '#ffd0e0' }],
};
const CHEST = [
  ['..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kwWWWWWWWWWWwk.', 'kkkkkkkkkkkkkkkk', 'kwwwwwkyykwwwwwk', 'kwWWWWkYYkWWWWwk', 'kwwwwwwkkwwwwwwk', 'kwWWWWWWWWWWWWwk', 'kwwwwwwwwwwwwwwk', 'kkkkkkkkkkkkkkkk'],
  ['..kkkkkkkkkkkk..', '.kwwwwwwwwwwwwk.', '.kWWWWWWWWWWWWk.', 'kkkkkkkkkkkkkkkk', 'kddddddddddddddk', 'kddddddddddddddk', 'kwwwwwwkkwwwwwwk', 'kwWWWWWWWWWWWWwk', 'kwwwwwwwwwwwwwwk', 'kkkkkkkkkkkkkkkk'],
];
const CHEST_PAL = { k: '#2a1608', w: '#c8843a', W: '#94582a', y: '#e8c040', Y: '#fff0a0', d: '#1a0e06' };
const POT = [['...kkkkkk...', '..kppppppk..', '...kPPPPk...', '..kppppppk..', '.kpPppppppk.', '.kpPppppppk.', '.kppppppppk.', '.kPppppppPk.', '..kPPPPPPk..', '...kkkkkk...'], { k: '#2a1408', p: '#b5683c', P: '#7e4224' }];
const SIGN = [['kkkkkkkkkkkk', 'kwwwwwwwwwwk', 'kwkkkwkkwwwk', 'kwwwwwwwwwwk', 'kwkkwkkkkwwk', 'kwwwwwwwwwwk', 'kkkkkkkkkkkk', '....kwwk....', '....kwwk....', '...kkkkkk...'], { k: '#2a1608', w: '#c89858' }];

/* ---------- procedural props ---------- */
function makeTree(variant, dark) {
  const pal = dark ? ['#1f4a24', '#2c6630', '#3d8a3c', '#5aa84c'] : ['#26592a', '#347a34', '#4a9c40', '#74c458'];
  const hues = [[0, 0, 0], [12, -6, 0], [-8, 8, 6]][variant % 3];
  const P = pal.map(c => rgbHex(hexRgb(c).map((v, i) => v + hues[i])));
  return procSprite(32, 40, (x) => {
    x.fillStyle = '#3e2614'; x.fillRect(13, 26, 6, 13); x.fillStyle = '#5e3a1e'; x.fillRect(14, 26, 2, 13); x.fillStyle = '#2a180c'; x.fillRect(18, 26, 1, 13);
    x.fillRect(12, 38, 8, 2);
    const blobs = [[16, 16, 13], [9, 19, 8], [23, 19, 8], [16, 9, 9], [11, 11, 7], [21, 11, 7]];
    const R = (r, cx, cy, col) => { x.fillStyle = col; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * .8) x.fillRect(cx + i, cy + j, 1, 1); };
    blobs.forEach(([cx, cy, r]) => R(r, cx, cy + 1, '#132a14'));
    blobs.forEach(([cx, cy, r]) => R(r - 1, cx, cy, P[0]));
    blobs.forEach(([cx, cy, r]) => R(r - 2, cx - 1, cy - 1, P[1]));
    blobs.forEach(([cx, cy, r], k) => R(Math.max(1, r - 5), cx - 2, cy - 3, P[2]));
    for (let k = 0; k < 40; k++) { const i = Math.floor(hash(k, variant) * 26) + 3, j = Math.floor(hash(k, variant + 9) * 22) + 2; const d = x.getImageData(i, j, 1, 1).data; if (d[3]) { x.fillStyle = hash(k, 3) > .5 ? P[3] : P[0]; x.fillRect(i, j, 1, 1); } }
  });
}
function makeHouse(wt, ht, roof) {
  const w = wt * 16, h = ht * 16, rh = Math.round(h * .58);
  const roofs = { red: ['#8e2f2c', '#b5443c', '#d8645a'], blue: ['#2e4f86', '#3e6db0', '#6a98d8'], green: ['#3a6a36', '#4f8a4a', '#7ab872'], brown: ['#5a3a24', '#7a5232', '#a07448'] }[roof];
  return procSprite(w, h + 10, (x) => {
    const top = 10;
    x.fillStyle = '#d8c4a0'; x.fillRect(2, top + rh - 4, w - 4, h - rh + 4);
    for (let j = top + rh; j < top + h; j += 4) { x.fillStyle = '#b8a07a'; x.fillRect(2, j, w - 4, 1); }
    x.fillStyle = '#7a6448'; x.fillRect(2, top + h - 2, w - 4, 2); x.fillRect(2, top + rh - 4, 2, h - rh + 4); x.fillRect(w - 4, top + rh - 4, 2, h - rh + 4);
    // roof
    for (let j = 0; j < rh; j++) {
      const inset = Math.max(0, Math.round((rh - j) * .12));
      x.fillStyle = j % 4 === 3 ? roofs[0] : (j < 3 ? roofs[2] : roofs[1]);
      x.fillRect(inset, top + j - 2, w - inset * 2, 1);
      if (j % 4 === 3) for (let i = (j % 8 === 3 ? 0 : 4); i < w; i += 8) { x.fillStyle = roofs[0]; x.fillRect(i, top + j - 5, 1, 3); }
    }
    x.fillStyle = '#1d1424'; x.fillRect(0, top + rh - 2, w, 2);
    x.fillStyle = roofs[2]; x.fillRect(4, top - 2, w - 8, 1);
    // chimney
    x.fillStyle = '#6a5a52'; x.fillRect(w - 16, top - 8, 6, 10); x.fillStyle = '#4a3a34'; x.fillRect(w - 16, top - 8, 6, 2);
    // door
    const dx = Math.floor(w / 2) - 5;
    x.fillStyle = '#3a2210'; x.fillRect(dx, top + h - 14, 10, 14); x.fillStyle = '#6a4220'; x.fillRect(dx + 1, top + h - 13, 8, 13);
    x.fillStyle = '#4a2c14'; x.fillRect(dx + 4, top + h - 13, 1, 13); x.fillStyle = '#e8c040'; x.fillRect(dx + 7, top + h - 7, 1, 1);
    // windows
    [[8, 1], [w - 18, 1]].forEach(([wx]) => {
      if (Math.abs(wx - dx) < 12) return;
      x.fillStyle = '#3a2210'; x.fillRect(wx, top + rh + 1, 10, 9);
      x.fillStyle = '#ffd27a'; x.fillRect(wx + 1, top + rh + 2, 8, 7);
      x.fillStyle = '#3a2210'; x.fillRect(wx + 4, top + rh + 2, 1, 7); x.fillRect(wx + 1, top + rh + 5, 8, 1);
      x.fillStyle = '#7a4a24'; x.fillRect(wx - 1, top + rh + 10, 12, 2);
      ['#e84a6a', '#ffd84a', '#ffffff', '#e84a6a'].forEach((c, i) => { x.fillStyle = c; x.fillRect(wx + i * 3, top + rh + 9, 2, 1); });
    });
  });
}
function makeStatue() {
  return procSprite(16, 28, (x) => {
    x.fillStyle = '#3a3a48'; x.fillRect(2, 22, 12, 6); x.fillStyle = '#5a5a6c'; x.fillRect(3, 22, 10, 2);
    x.fillStyle = '#6c6c80'; x.fillRect(4, 4, 8, 18); x.fillStyle = '#8a8aa0'; x.fillRect(5, 4, 3, 18);
    x.fillStyle = '#4a4a5c'; x.fillRect(11, 4, 1, 18);
    x.fillStyle = '#6c6c80'; x.fillRect(5, 1, 6, 3); x.fillRect(7, 0, 2, 1);
    x.fillStyle = '#2a2a38'; x.fillRect(6, 9, 4, 6);
  });
}
function makePillar() {
  return procSprite(16, 32, (x) => {
    x.fillStyle = '#2a2638'; x.fillRect(1, 26, 14, 6);
    x.fillStyle = '#4a4466'; x.fillRect(3, 4, 10, 23); x.fillStyle = '#5e5880'; x.fillRect(4, 4, 3, 23); x.fillStyle = '#322e48'; x.fillRect(11, 4, 2, 23);
    x.fillStyle = '#5e5880'; x.fillRect(1, 0, 14, 5); x.fillStyle = '#2a2638'; x.fillRect(1, 4, 14, 1);
    for (let j = 8; j < 26; j += 6) { x.fillStyle = '#2a2638'; x.fillRect(3, j, 10, 1); }
  });
}
function makeBramble() {
  return procSprite(16, 18, (x) => {
    for (let k = 0; k < 7; k++) {
      x.strokeStyle = k % 2 ? '#3a5a2a' : '#4a3a5a'; x.lineWidth = 2; x.beginPath();
      const sx = 2 + k * 2, sy = 17; x.moveTo(sx, sy);
      x.bezierCurveTo(sx + 6 * Math.sin(k), 10, sx - 5 * Math.cos(k), 6, 3 + hash(k) * 10, 1 + hash(k, 2) * 4); x.stroke();
    }
    for (let k = 0; k < 18; k++) { x.fillStyle = '#c8c0a0'; x.fillRect(1 + hash(k, 5) * 14, 1 + hash(k, 6) * 15, 1, 1); }
    for (let k = 0; k < 4; k++) { x.fillStyle = '#8a2a4a'; x.fillRect(2 + hash(k, 8) * 12, 3 + hash(k, 9) * 10, 2, 2); }
  });
}
function makeBrazier() {
  return procSprite(14, 14, (x) => {
    x.fillStyle = '#2a2430'; x.fillRect(4, 8, 6, 6); x.fillStyle = '#3e3648'; x.fillRect(5, 8, 2, 6);
    x.fillStyle = '#4a4258'; x.fillRect(0, 4, 14, 5); x.fillStyle = '#6a6080'; x.fillRect(1, 4, 12, 1);
    x.fillStyle = '#1a1620'; x.fillRect(2, 5, 10, 2);
  });
}
function makeShadow(w, h) {
  return procSprite(w, h, (x) => { x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); x.fill(); });
}
function makeGlow(r, col) {
  const c = canvas(r * 2, r * 2), x = c.getContext('2d');
  const [a, b, d] = hexRgb(col), gr = x.createRadialGradient(r, r, 0, r, r, r);
  gr.addColorStop(0, `rgba(${a},${b},${d},1)`); gr.addColorStop(1, `rgba(${a},${b},${d},0)`);
  x.fillStyle = gr; x.fillRect(0, 0, r * 2, r * 2); return c;
}

/* ---------- bitmap font (3x5) for the HUD ---------- */
const FONT = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  '/': '001001010100100', x: '000101010101000', '+': '000010111010000',
};
function pxText(c, s, x, y, col = '#fff', shadow = '#1d1424') {
  [[1, 1, shadow], [0, 0, col]].forEach(([ox, oy, cc]) => {
    if (!cc) return; c.fillStyle = cc;
    [...String(s)].forEach((ch, k) => { const f = FONT[ch]; if (!f) return; for (let i = 0; i < 15; i++) if (f[i] === '1') c.fillRect(x + k * 4 + (i % 3) + ox, y + Math.floor(i / 3) + oy, 1, 1); });
  });
}

/* ---------- sprite sheet ---------- */
const SPR = {};
function buildSprites() {
  const mk = (head, body, legs, scarf) => sprite([...head, ...body, ...legs], HERO_PAL);
  SPR.hero = {
    down: [mk(D_HEAD, D_BODY, L_IDLE), mk(D_HEAD, D_BODY, L_W1), mk(D_HEAD, D_BODY, L_W2)],
    up: [mk(U_HEAD, U_BODY, L_IDLE), mk(U_HEAD, U_BODY, L_W1), mk(U_HEAD, U_BODY, L_W2)],
    side: [mk(S_HEAD, S_BODY, SL_IDLE), mk(S_HEAD, S_BODY, SL_W1), mk(S_HEAD, S_BODY, SL_W2)],
  };
  SPR.meche = MECHE_ROWS.map(r => sprite(r, MECHE_PAL));
  SPR.slime = SLIME.map(r => sprite(r, SLIME_PAL));
  SPR.echo = ECHO.map(r => sprite(r, ECHO_PAL));
  SPR.wolf = WOLF.map(r => sprite(r, WOLF_PAL));
  SPR.bat = BAT.map(r => sprite(r, BAT_PAL));
  SPR.skel = SKEL.map(r => sprite(r, SKEL_PAL));
  for (const k in ITEMS_SPR) SPR[k] = sprite(...ITEMS_SPR[k]);
  SPR.chest = CHEST.map(r => sprite(r, CHEST_PAL));
  SPR.pot = sprite(...POT); SPR.sign = sprite(...SIGN);
  SPR.trees = [0, 1, 2].map(v => makeTree(v, false));
  SPR.treesDark = [0, 1, 2].map(v => makeTree(v, true));
  SPR.statue = makeStatue(); SPR.pillar = makePillar(); SPR.bramble = makeBramble(); SPR.brazier = makeBrazier();
  SPR.shadow = makeShadow(14, 5); SPR.shadowBig = makeShadow(26, 8); SPR.shadowTree = makeShadow(28, 9);
  SPR.glow = { warm: makeGlow(64, '#ffb050'), cold: makeGlow(64, '#9fd8ff'), gold: makeGlow(64, '#ffe08a'), white: makeGlow(64, '#ffffff'), fog: makeGlow(64, '#b8bccc'), red: makeGlow(64, '#ff4a3a') };
  SPR.houses = {};
}
function villager(o) {
  const pal = { k: '#1d1424', h: o.hair, H: shade(o.hair, -.3), s: o.skin || '#f0c49c', S: '#d49a78', e: '#1d1424', r: '#f0948a', c: o.cloth, C: shade(o.cloth, -.3), K: '#1d1424', p: '#3a3150', o: '#4a2c1c', a: o.hatCol || '#3a5a8a', f: o.beard || '#5a3a24', m: '#a05a4a' };
  return [sprite(villagerRows(o), pal), sprite(villagerWalk(o, L_W1), pal), sprite(villagerWalk(o, L_W2), pal)];
}
function houseSprite(w, h, roof) { const k = `${w}x${h}${roof}`; return SPR.houses[k] || (SPR.houses[k] = makeHouse(w, h, roof)); }
