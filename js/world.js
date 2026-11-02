'use strict';
/* SANS-NOM — tiles, map layouts, forest generator, ground prerender. */

const WALLISH = new Set(['#', 'i', '=', 'f', 'W']);
const SOLID = new Set(['T', 'R', '~', '#', 'i', 'F', '=', 'f', 'W', ' ', 'I']);
const GRASSY = new Set(['.', ',', '"', 'T', 'R', 'F', 'Y']);

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------------- layouts ---------------- */
const VILLAGE_ROWS = [
  'TTTTTTTTTTTTTTT::TTTTTTTTTTTTTTTTT',
  'T"..,....T....T::T.....,....."...T',
  'T..........,...::...........,....T',
  'T....HHHHH.....::.....HHHHH......T',
  'T....HHHHH.....::.....HHHHH....,.T',
  'T....HHHHH.....::.....HHHHH......T',
  'T.,...::.......::.......::.......T',
  'T.....:::::::::::::::::::........T',
  'T.......,......::...........,....T',
  'T..FFFF........::.......HHHHHH...T',
  'T..F,,F....TT..::.......HHHHHH...T',
  'T..F,,F....TT..::.......HHHHHH...T',
  'T..FFFF........::..........::....T',
  'T..............:::::::::::::.....T',
  'T...HHHHH......::..........,.....T',
  'T...HHHHH...,..::.....R..........T',
  'T...HHHHH......::...............RT',
  'T.....::.......::.....,.....""...T',
  'T.....::::::::::::..........""...T',
  'Tsssssssssssss:::ssssssssssssssssT',
  'ssssssssssssssBBBsssssssssssssssss',
  '~~~~~~~~~~~~~~BBB~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~BBB~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];
const HOUSE_ROWS = [
  '============',
  '==f======W==',
  '=wwwwwwwwww=',
  '=wCwwwwwwBw=',
  '=wwwwTwwwww=',
  '=wwwwwwwOww=',
  '=wwwwwwwwww=',
  '=wwwwwwwwww=',
  '=====XX=====',
];
const CRYPT_ROWS = [
  '###########i######i###########',
  '##########__________##########',
  '##########____Z_____##########',
  '##########__________##########',
  '##########__________##########',
  '##########__________##########',
  '##############HH##############',
  '#######i######HH######i#######',
  '#####____________________#####',
  '#####____________________#####',
  '#####___I____________I___#####',
  '#####_________O__________#####',
  '#####____________________#####',
  '#####____________________#####',
  '#####____________________#####',
  '#####___I____________I___#####',
  '#####____________________#####',
  '#####____________________#####',
  '##############JJ##############',
  '##########i###__###i##########',
  '########______________########',
  '########__v________v__########',
  '########______E_______########',
  '########______________########',
  '########____v_________########',
  '########_p__________p_########',
  '##############DD##############',
  '###########i##DD##i###########',
  '#______##____________##______#',
  '#_b__b_##__S_______p_##___C__#',
  '#______##____________##_k____#',
  '#____________________GG______#',
  '#____________________GG______#',
  '#______##____________##____k_#',
  '#__b___##_______p____##______#',
  '#______##____________##______#',
  '##############__##############',
  '##############XX##############',
  '##############################',
];

function genForest() {
  const w = 40, h = 34, g = Array.from({ length: h }, () => Array(w).fill('T'));
  const r = rng(1337), set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; };
  const clear = (cx, cy, rad) => { for (let y = Math.floor(cy - rad - 2); y <= Math.ceil(cy + rad + 2); y++) for (let x = Math.floor(cx - rad - 2); x <= Math.ceil(cx + rad + 2); x++) { const d = Math.hypot(x - cx, (y - cy) * 1.15); if (d <= rad + (r() - .5) * 1.4 && x > 0 && x < w - 1 && y > 0) set(x, y, '.'); } };
  const path = (x0, y0, x1, y1, jit = .6) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2; let ox = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n; ox = jit ? Math.max(-1, Math.min(1, ox + (r() - .5) * jit)) : 0;
      const x = Math.round(x0 + (x1 - x0) * t + (Math.abs(y1 - y0) > Math.abs(x1 - x0) ? ox : 0));
      const y = Math.round(y0 + (y1 - y0) * t + (Math.abs(y1 - y0) > Math.abs(x1 - x0) ? 0 : ox));
      for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 2; dx++) if (g[y + dy] && g[y + dy][x + dx] === 'T') set(x + dx, y + dy, '.');
      set(x, y, ':'); set(x + 1, y, ':'); set(x, y + 1, ':'); set(x + 1, y + 1, ':');
    }
  };
  const C = { A: [20, 31, 3], B: [20, 25, 4.5], Cw: [8, 22, 4.5], D: [32, 23, 4.5], E: [20, 12, 4], F: [9, 8, 4], G: [31, 8, 4.5], Hc: [20, 3, 2.5] };
  Object.values(C).forEach(([x, y, rad]) => clear(x, y, rad));
  path(20, 33, 20, 31, 0); path(20, 31, 20, 25, 0); path(20, 25, 8, 22); path(20, 25, 32, 23); path(20, 25, 20, 12, 0);
  path(20, 12, 9, 8); path(20, 12, 31, 8); path(20, 12, 20, 2, 0);
  for (let x = 0; x < w; x++) { const yc = 17 + Math.round(Math.sin(x * .35) * 1.2); set(x, yc, '~'); set(x, yc + 1, '~'); if (x === 20 || x === 21) { set(x, yc, 'B'); set(x, yc + 1, 'B'); set(x, yc - 1, ':'); set(x, yc + 2, ':'); } }
  for (let x = 18; x <= 23; x++) { set(x, 0, '#'); set(x, 1, '#'); }
  set(20, 1, 'X'); set(21, 1, 'X');
  set(19, 6, 'T'); set(22, 6, 'T'); set(18, 6, 'T'); set(23, 6, 'T'); set(20, 6, 'Y'); set(21, 6, 'Y');
  (typeof FOREST_SPOTS !== 'undefined' ? FOREST_SPOTS : []).forEach(([sx, sy]) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[sy + dy] && 'TR'.includes(g[sy + dy][sx + dx]) && sy + dy > 0 && sx + dx > 0 && sx + dx < w - 1) set(sx + dx, sy + dy, '.'); });
  const nearPath = (x, y) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g[y + dy] && (g[y + dy][x + dx] === ':' || g[y + dy][x + dx] === 'B')) return true; return false; };
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (g[y][x] === '.' && !nearPath(x, y)) {
    if ((typeof FOREST_SPOTS !== 'undefined' ? FOREST_SPOTS : []).some(([sx, sy]) => Math.abs(sx - x) <= 1 && Math.abs(sy - y) <= 1)) continue;
    const k = r(); if (k < .11) g[y][x] = '"'; else if (k < .2) g[y][x] = ','; else if (k < .225) g[y][x] = 'R';
  }
  return g.map(row => row.join(''));
}

/* ---------------- map definitions ---------------- */
const MAPS = {
  maison: {
    name: 'Chez Odile', rows: HOUSE_ROWS, ground: 'w', theme: 'house', music: 'village',
    dark: () => .45, tint: '#1a0c04',
    legend: { C: { t: 'w', spawn: ['chest', { id: 'sword', item: 'wsword' }] }, B: { t: 'w', spawn: ['bed'] }, T: { t: 'w', spawn: ['table'] }, O: { t: 'w', spawn: ['npc', { id: 'odile' }] } },
    exits: [{ x: 5, y: 8, w: 2, h: 1, to: 'village', tx: 7.5, ty: 7, need: () => S.sword > 0, lock: "Mèche : « Attends ! Prends quelque chose pour te défendre. Le coffre de ta grand-mère… »" }],
  },
  village: {
    name: 'Brumeport', rows: VILLAGE_ROWS, ground: '.', theme: 'village', music: () => S.flags.dawn ? 'ending' : 'village',
    dark: () => S.flags.dawn ? .05 : .5, tint: () => S.flags.dawn ? '#ffd0a0' : '#0b1236',
    fog: () => S.flags.dawn ? 0 : Math.max(.15, 1 - namesCount() / 6),
    legend: {},
    exits: [
      { x: 15, y: 0, w: 2, h: 1, to: 'foret', tx: 20.5, ty: 32.3 },
      { x: 7, y: 5, w: 1, h: 1, to: 'maison', tx: 6, ty: 7.6, door: true },
    ],
  },
  foret: {
    name: 'Forêt des Murmures', rows: null, gen: genForest, ground: '.', theme: 'forest', music: 'forest',
    dark: () => .38, tint: '#06180c', fog: () => .35,
    legend: { Y: { t: '.', spawn: ['bramble'] } },
    exits: [
      { x: 19, y: 33, w: 3, h: 1, to: 'village', tx: 16, ty: 1.4 },
      { x: 20, y: 1, w: 2, h: 1, to: 'crypte', tx: 15, ty: 35.6 },
    ],
  },
  crypte: {
    name: 'La Crypte des Noms', rows: CRYPT_ROWS, ground: '_', theme: 'crypt', music: () => S.flags.bossFight && !S.flags.bossDead ? 'boss' : 'crypt',
    dark: () => .86, tint: '#04020a',
    legend: {
      S: { t: '_', spawn: ['statue', { id: 'crypte' }] }, b: { t: '_', spawn: ['brazier'] }, p: { t: '_', spawn: ['pot'] },
      C: { t: '_', spawn: ['chest', { id: 'cryptkey', item: 'key' }] }, k: { t: '_', spawn: ['skel'] }, v: { t: '_', spawn: ['bat'] },
      E: { t: '_', spawn: ['echo', { name: 'odile' }] }, O: { t: '_', spawn: ['boss'] }, Z: { t: '_', spawn: ['altar'] },
    },
    exits: [{ x: 14, y: 37, w: 2, h: 1, to: 'foret', tx: 21, ty: 2.6 }],
  },
};

/* ---------------- tile painting ---------------- */
const PALS = {
  village: { grass: '#4f9a45', grassD: '#3f8538', grassL: '#6cb85a', tuft: '#3a7a34' },
  forest: { grass: '#3c7a3a', grassD: '#2f652f', grassL: '#53954a', tuft: '#2a5a2c' },
};
function paintTile(x, ch, tx, ty, map) {
  const px = tx * TS, py = ty * TS, pal = PALS[map.theme] || PALS.village;
  const at = (dx, dy) => map.tileAt(tx + dx, ty + dy);
  const R = (c, ix, iy, w = 1, h = 1) => { x.fillStyle = c; x.fillRect(px + ix, py + iy, w, h); };
  const speck = (base, d, l, n = 10, s = 0) => { R(base, 0, 0, 16, 16); for (let k = 0; k < n; k++) { R(hash(tx, ty, k + s) > .5 ? d : l, Math.floor(hash(tx, k, ty + s) * 16), Math.floor(hash(k, ty, tx + s) * 16)); } };
  const grass = () => {
    speck(pal.grass, pal.grassD, pal.grassL, 14);
    if (hash(tx, ty, 9) > .55) { const ix = Math.floor(hash(tx, ty, 2) * 11) + 2, iy = Math.floor(hash(tx, ty, 3) * 10) + 4; R(pal.tuft, ix, iy, 1, 2); R(pal.tuft, ix + 2, iy, 1, 2); R(pal.tuft, ix + 1, iy + 1, 1, 2); }
  };
  switch (ch) {
    case '.': case '"': case 'Y': grass(); break;
    case ',': grass(); for (let k = 0; k < 3; k++) { const c = ['#ffffff', '#ffe04a', '#ff8ab0', '#9ac8ff'][Math.floor(hash(tx, ty, k + 20) * 4)]; const ix = 2 + Math.floor(hash(tx, ty, k + 5) * 11), iy = 2 + Math.floor(hash(tx, ty, k + 7) * 11); R(c, ix, iy); R(c, ix - 1, iy); R(c, ix + 1, iy); R(c, ix, iy - 1); R(c, ix, iy + 1); R('#ffcc33', ix, iy); } break;
    case 'X':
      if (map.theme === 'house') { R('#7a4e2a', 0, 0, 16, 16); R('#8a2a2a', 1, 2, 14, 10); R('#b04040', 2, 3, 12, 8); break; }
      R('#0a0810', 0, 0, 16, 16); for (let i = 0; i < 4; i++) R(shade('#4a4460', -i * .22), 1, 2 + i * 3, 14, 2);
      break;
    case ':':
      speck('#c4a06a', '#a88654', '#dcc08a', 12);
      for (let k = 0; k < 2; k++) R('#8a7048', Math.floor(hash(tx, ty, k + 30) * 14) + 1, Math.floor(hash(tx, ty, k + 31) * 14) + 1, 2, 1);
      [[0, -1, 'top'], [0, 1, 'bot'], [-1, 0, 'left'], [1, 0, 'right']].forEach(([dx, dy, side]) => {
        if (!GRASSY.has(at(dx, dy))) return;
        for (let i = 0; i < 16; i++) { const d = 1 + Math.floor(hash(tx * 3 + i, ty * 5, dx + dy * 3) * 2.4); x.fillStyle = pal.grass;
          if (side === 'top') x.fillRect(px + i, py, 1, d); if (side === 'bot') x.fillRect(px + i, py + 16 - d, 1, d);
          if (side === 'left') x.fillRect(px, py + i, d, 1); if (side === 'right') x.fillRect(px + 16 - d, py + i, d, 1); }
      });
      break;
    case 's': speck('#e2cc92', '#cdb57a', '#f2e2b0', 10); break;
    case '~': case 'B':
      speck('#2a64bd', '#255aab', '#3270c8', 6);
      if (at(0, -1) !== '~' && at(0, -1) !== 'B') { R('#5a9ae0', 0, 0, 16, 2); R('#3a7ad0', 0, 2, 16, 1); }
      if (ch === 'B') {
        R('#3a2410', 0, 0, 16, 16);
        for (let j = 0; j < 16; j += 4) { R('#a87a46', 1, j, 14, 3); R('#c8965a', 1, j, 14, 1); }
        R('#5a3a1a', 0, 0, 2, 16); R('#5a3a1a', 14, 0, 2, 16);
      }
      break;
    case 'T': grass(); break;
    case 'R': grass(); R('#1d1424', 2, 4, 12, 11); R('#7a7a86', 3, 4, 10, 10); R('#9a9aa8', 4, 5, 5, 4); R('#5a5a66', 3, 11, 10, 3); R('#babac6', 5, 5, 2, 1); break;
    case 'F': grass(); R('#5a3a1e', 0, 6, 16, 2); R('#5a3a1e', 0, 11, 16, 2); R('#8a6a3a', 0, 6, 16, 1); R('#8a6a3a', 0, 11, 16, 1);
      [2, 12].forEach(i => { R('#4a2e16', i, 3, 3, 12); R('#9a7a4a', i, 3, 3, 1); }); break;
    case '_': case 'D': case 'G': case 'H': case 'J': case 'I':
      R('#2a2638', 0, 0, 16, 16);
      R('#221f2e', 0, 7, 16, 1); R('#221f2e', ((ty % 2) * 8) + 7, 0, 1, 7); R('#221f2e', ((ty % 2) * 8 + 3) % 16, 8, 1, 8);
      for (let k = 0; k < 6; k++) R(hash(tx, ty, k) > .5 ? '#322d42' : '#25212f', Math.floor(hash(k, tx, ty) * 16), Math.floor(hash(ty, k, tx) * 16));
      if (hash(tx, ty, 77) > .9) { R('#2f4a2e', 3, 10, 3, 2); R('#3a5a36', 4, 9, 1, 1); }
      if (hash(tx, ty, 78) > .95) { R('#c8c0a8', 9, 4, 4, 1); R('#c8c0a8', 9, 3, 1, 3); R('#c8c0a8', 12, 3, 1, 3); }
      if (map.theme === 'crypt' && WALLISH.has(at(0, -1))) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(px, py, 16, 5); }
      break;
    case '#': case 'i': {
      const below = at(0, 1);
      if (!WALLISH.has(below) && below !== ' ' && below !== undefined) {
        R('#29243a', 0, 0, 16, 16);
        for (let j = 0; j < 16; j += 4) for (let i = (j % 8 ? 0 : 4) - 4; i < 16; i += 8) { R('#3b3550', i + 1, j + 1, 7, 3); R('#4a4466', i + 1, j + 1, 7, 1); }
        R('#5a5480', 0, 0, 16, 1); R('#120f1a', 0, 15, 16, 1);
        if (ch === 'i') { R('#3a2a1a', 6, 7, 4, 2); R('#5a4024', 7, 9, 2, 4); }
      } else { R('#4c4566', 0, 0, 16, 16); for (let k = 0; k < 8; k++) R(hash(tx, ty, k) > .5 ? '#433c5a' : '#564f72', Math.floor(hash(k, tx, ty) * 16), Math.floor(hash(ty, k, tx) * 16), 2, 1); R('#3a3450', 0, 15, 16, 1); }
      break;
    }
    case 'w': R('#7a4e2a', 0, 0, 16, 16); for (let j = 0; j < 16; j += 4) { R('#8c5e34', 0, j, 16, 3); R('#5e3a1e', ((ty * 7 + j) % 16), j, 1, 3); } R('#6a4222', 0, 15, 16, 1); break;
    case '=': case 'f': case 'W': {
      const below = at(0, 1);
      if (!WALLISH.has(below) && below !== undefined) {
        R('#6a4a34', 0, 0, 16, 16); for (let i = 0; i < 16; i += 4) R('#5a3c28', i, 0, 1, 16); R('#3a2618', 0, 14, 16, 2); R('#8a6a4a', 0, 0, 16, 1);
        if (ch === 'f') { R('#4a4048', 0, 2, 16, 14); R('#5a5058', 1, 2, 14, 2); R('#100808', 3, 6, 10, 10); }
        if (ch === 'W') { R('#2a1a10', 3, 3, 10, 9); R('#1a2a5a', 4, 4, 8, 7); R('#2a1a10', 7, 4, 1, 7); R('#2a1a10', 4, 7, 8, 1); R('#e8e0ff', 10, 5, 1, 1); }
      } else { R('#3a2a20', 0, 0, 16, 16); R('#2a1e16', 0, 15, 16, 1); }
      break;
    }
    case ' ': R('#000', 0, 0, 16, 16); break;
    default: grass();
  }
}

/* ---------------- runtime map ---------------- */
function buildMap(id) {
  const def = MAPS[id];
  const rows = def.rows || (def._gen = def._gen || def.gen());
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const grid = [], spawns = [], houses = [];
  for (let y = 0; y < h; y++) {
    grid.push([]);
    for (let x = 0; x < w; x++) {
      let ch = rows[y][x] || 'T';
      const lg = def.legend[ch];
      if (lg) { spawns.push({ type: lg.spawn[0], props: Object.assign({}, lg.spawn[1] || {}), tx: x, ty: y }); ch = lg.t; }
      grid[y].push(ch);
    }
  }
  // detect house footprints ('H' blocks in the village)
  if (id === 'village') {
    const seen = new Set(), roofs = ['red', 'blue', 'green', 'brown'];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (grid[y][x] === 'H' && !seen.has(x + ',' + y)) {
      let x1 = x; while (grid[y][x1 + 1] === 'H') x1++;
      let y1 = y; while (grid[y1 + 1] && grid[y1 + 1][x] === 'H') y1++;
      for (let j = y; j <= y1; j++) for (let i = x; i <= x1; i++) { seen.add(i + ',' + j); grid[j][i] = '.'; }
      houses.push({ x, y, w: x1 - x + 1, h: y1 - y + 1, roof: roofs[houses.length % 4] });
    }
  }
  const map = {
    id, def, w, h, grid, spawns, houses, props: [], rects: [], theme: def.theme,
    tileAt(x, y) { return (x < 0 || y < 0 || x >= w || y >= h) ? undefined : grid[y][x]; },
  };
  // prerender ground
  const c = canvas(w * TS, h * TS), x = c.getContext('2d');
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) paintTile(x, grid[ty][tx], tx, ty, map);
  // shadows & props
  const dark = def.theme === 'forest';
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const ch = grid[ty][tx];
    if (ch === 'T') {
      x.drawImage(SPR.shadowTree.img, tx * TS - 6, ty * TS + 10);
      const spr = (dark ? SPR.treesDark : SPR.trees)[Math.floor(hash(tx, ty, 4) * 3)];
      const ox = Math.round((hash(tx, ty, 5) - .5) * 4);
      map.props.push({ y: ty * TS + 15, x: tx * TS + 8, sx: tx * TS - 8 + ox, sy: ty * TS - 24, img: spr.img });
    }
    if (ch === 'I') {
      x.drawImage(SPR.shadowBig.img, tx * TS - 5, ty * TS + 10);
      map.props.push({ y: ty * TS + 15, x: tx * TS + 8, sx: tx * TS, sy: ty * TS - 16, img: SPR.pillar.img });
    }
  }
  houses.forEach(hs => {
    const spr = houseSprite(hs.w, hs.h, hs.roof);
    x.drawImage(SPR.shadowBig.img, 0, 0, 26, 8, hs.x * TS - 2, (hs.y + hs.h) * TS - 5, hs.w * TS + 4, 8);
    map.props.push({ y: (hs.y + hs.h) * TS - 1, x: (hs.x + hs.w / 2) * TS, sx: hs.x * TS, sy: hs.y * TS - 10, img: spr.img, house: hs });
    map.rects.push({ x: hs.x * TS + 2, y: hs.y * TS + 4, w: hs.w * TS - 4, h: hs.h * TS - 4 });
  });
  map.ground = c;
  return map;
}
