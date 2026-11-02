'use strict';
/* SANS-NOM — Acte I : la Brume. Characters, dialogue, encounters, boss, ending. */

const F = (tx, ty) => [tx * TS + 8, ty * TS + 14];

/* Forest cells that must stay walkable (spawn points); read by genForest(). */
const FOREST_SPOTS = [[24, 26], [8, 22], [32, 23], [31, 8], [18, 29], [23, 29], [10, 21], [6, 24], [18, 11], [24, 12], [12, 9], [30, 21], [34, 25], [29, 9], [33, 7], [8, 7], [34, 6], [5, 21], [17, 24], [22, 31]];

/* ---------------- villagers ---------------- */
const NPC = {
  odile: {
    label: 'Odile', nameKey: 'odile', look: { hair: '#e8e4dc', cloth: '#6a4a8a', dress: true, bun: true },
    async talk() {
      if (!S.names.odile) {
        await say([['odile', "« … un nom… j'avais un nom… Je chantais une chanson à quelqu'un… un enfant… »"]]);
        if (!S.flags.odileHollow) { S.flags.odileHollow = true; await say([['meche', "Elle ne te reconnaît pas. Ça passera. Il faut que ça passe."]]); }
        return;
      }
      if (!S.flags.odileGift) {
        S.flags.odileGift = true;
        await say([
          ['odile', "Mon cœur… Mon tout-petit. Viens là."],
          ['odile', "J'ai rêvé que j'étais une pierre, au fond de l'eau. Et que quelqu'un m'appelait. C'était toi, hein ?"],
          ['odile', "Il faut que je te dise une chose. Je l'ai gardée douze ans."],
          ['odile', "Ta mère s'appelait Aëlle. La nuit de ton baptême, avant que le prêtre prononce ton nom, elle te l'a pris. Comme on prend une braise dans ses mains."],
          ['odile', "Elle disait qu'une chose viendrait du Nord, un jour, et qu'elle chercherait ton nom avant tous les autres. Elle est partie vers la forêt avec. Elle n'est jamais revenue."],
          ['odile', "Prends ça. C'était à elle."],
        ]);
        await giveItem('crystal');
        return;
      }
      await say([['odile', "Va, mon cœur. Et reviens-moi."]]);
    },
  },
  bastien: {
    label: 'Bastien', nameKey: 'bastien', look: { hair: '#2a1a14', cloth: '#7a4a2a', beard: '#3a2418' },
    async talk() {
      if (!S.names.bastien) return say([['bastien', "« … le marteau… quelle main tient le marteau… la mienne ?… »"]]);
      if (S.sword < 2) {
        await say([
          ['bastien', "Sans-Nom ! C'est toi qui m'as ramené ? J'ai entendu ta voix, dans le gris. Et puis j'ai entendu mon nom."],
          ['bastien', "Une épée de bois contre des Échos… T'es plus têtu que ta grand-mère."],
          ['bastien', "Tiens. Je la gardais pour le fils du maire. Il attendra."],
        ]);
        await giveItem('isword');
        return say([['bastien', "Avec ça, les ronces du nord de la forêt ne te résisteront pas."]]);
      }
      return say([['bastien', "Garde-la bien affûtée. Et ramène-nous les autres."]]);
    },
  },
  lila: {
    label: 'Lila', nameKey: 'lila', look: { hair: '#d0503a', cloth: '#3f8a5a', dress: true },
    async talk() {
      if (!S.names.lila) return say([['lila', "« … trois pièces… quatre… je ne sais plus compter… je ne sais plus ce que je vends… »"]]);
      if (!S.flags.lilaHi) { S.flags.lilaHi = true; await say([['lila', "Ah ! Mon nom ! Il est tout chaud encore. Merci, Sans-Nom. Pour toi, prix d'ami."]]); }
      for (;;) {
        const opts = [`Potion — 15 éclats`, S.flags.shopCrystal ? { label: 'Cœur de cristal — vendu', disabled: true } : 'Cœur de cristal — 60 éclats', 'Rien, merci'];
        const c = await ask('lila', `Qu'est-ce qui te ferait plaisir ? (Tu as ${S.gems} éclats.)`, opts);
        if (c === 0) { if (S.gems >= 15) { S.gems -= 15; S.potions++; Snd.gem(); toast('Potion achetée'); } else await say([['lila', "Il te manque des éclats, mon grand cœur. Les herbes hautes et les pots en cachent souvent."]]); }
        else if (c === 1) { if (S.gems >= 60) { S.gems -= 60; S.flags.shopCrystal = true; await giveItem('crystal'); } else await say([['lila', "Soixante éclats. Pas un de moins, même pour toi."]]); }
        else return;
      }
    },
  },
  gaspard: {
    label: 'Gaspard', nameKey: 'gaspard', look: { hair: '#9a9a9a', cloth: '#2f5a8a', hat: true, hatCol: '#c8a040', beard: '#c8c8c8' },
    async talk() {
      if (!S.names.gaspard) return say([['gaspard', "« … la mer… elle a un nom, la mer ?… Moi j'en avais un… »"]]);
      if (!S.flags.gaspardGift) {
        S.flags.gaspardGift = true;
        await say([
          ['gaspard', "Quarante ans que je pêche ici, et j'avais jamais eu aussi froid qu'au fond de ce gris."],
          ['gaspard', "J'ai remonté ça dans mes filets il y a des années. Ça brillait comme un cœur. Je crois que c'est pour toi."],
        ]);
        return giveItem('crystal');
      }
      return say([['gaspard', "Si tu vas au nord, méfie-toi des loups gris. Ils chargent toujours en ligne droite. Un pas de côté, et ils se cognent le museau."]]);
    },
  },
  noe: {
    label: 'Noé', nameKey: 'noe', look: { hair: '#e8c060', cloth: '#c84a4a', child: true },
    async talk() {
      if (!S.names.noe) return say([['noe', "« … »"], [null, "Noé fixe le vide. Ses lèvres bougent, mais aucun son ne sort."]]);
      if (!S.flags.noeGift) {
        S.flags.noeGift = true;
        await say([
          ['noe', "Sans-Nom ! T'as vu ? J'étais une statue ! Une vraie !"],
          ['noe', "Tu sais ce qu'il y a dans la crypte ? Un géant en armure ! Mon grand-père disait qu'il garde les noms des morts pour que personne ne les vole."],
          ['noe', "Il est peut-être pas méchant. Peut-être qu'il a juste peur, comme nous."],
          ['noe', "Tiens, j'ai trouvé ça. C'est rose, alors c'est sûrement magique."],
        ]);
        return giveItem('potion');
      }
      return say([['noe', "Quand je serai grand, je serai Sans-Nom aussi. Comme ça, la brume pourra jamais m'attraper."]]);
    },
  },
  aelle: { label: 'Aëlle', nameKey: 'aelle', look: { hair: '#c86a2a', cloth: '#e8a040', dress: true } },
};
for (const k in NPC) Object.defineProperty(NPC[k], 'spr', { get() { return this._s || (this._s = villager(this.look)); } });

const SPEAKERS = {
  meche: { name: () => S.names.aelle ? 'Mèche · Aëlle' : 'Mèche', spr: () => SPR.meche[0], crop: [0, 0, 10, 10], bg: '#2a140a' },
  gardien: { name: 'Le Gardien des Noms', spr: () => SPR.gardienFace, crop: [0, 0, 16, 16], bg: '#0e0c18' },
  toi: { name: 'Toi', spr: () => SPR.hero.down[0] },
};
['odile', 'bastien', 'lila', 'gaspard', 'noe'].forEach(k => {
  SPEAKERS[k] = { name: () => S.names[k] ? NPC[k].label : '???', spr: () => NPC[k].spr[0], grey: () => !S.names[k] };
});

/* ---------------- the boss ---------------- */
TYPES.boss = {
  base: () => ({ hp: 30, dmg: 2, enemy: true, bw: 22, bh: 12, kbRes: 0, blood: '#8a90a0', st: 'sleep', st_t: 0, face: 1, stun: 0, harmless: true, summoned: false }),
  init(e) { if (S.flags.bossDead) e.dead = true; },
  armor(e, d) { return e.stun > 0 ? d * 2 : Math.max(1, d - 1); },
  update(e, dt) {
    if (e.st === 'sleep') return;
    e.harmless = false;
    e.st_t -= dt; e.stun = Math.max(0, e.stun - dt);
    const d = distP(e), fast = e.hp <= e.maxHp / 2 ? 1.35 : 1;
    if (e.st === 'walk') {
      const [ux, uy] = toP(e); move(e, ux * 24 * fast * dt, uy * 24 * fast * dt); e.face = Math.sign(P.x - e.x) || 1;
      if (d < 36) { e.st = 'wind'; e.st_t = .6 / fast; }
      else if (e.st_t <= 0) { e.st = 'aim'; e.st_t = .8 / fast; Snd.roar(); }
    } else if (e.st === 'wind') {
      if (e.st_t <= 0) { e.st = 'sweep'; e.st_t = .3; Snd.swing(); shake = 3; if (distP(e) < 40) hurtPlayer(2, e.x, e.y); burst(e.x, e.y - 10, 16, ['#ffd866', '#ffffff'], { speed: 90, up: 10, life: .4 }); }
    } else if (e.st === 'sweep') { if (e.st_t <= 0) { e.st = 'walk'; e.st_t = 2 + Math.random(); } }
    else if (e.st === 'aim') {
      e.face = Math.sign(P.x - e.x) || 1;
      if (e.st_t <= 0) { const [ux, uy] = toP(e); e.cvx = ux * 230 * fast; e.cvy = uy * 230 * fast; e.st = 'charge'; e.st_t = 1.3; }
    } else if (e.st === 'charge') {
      move(e, e.cvx * dt, e.cvy * dt);
      if (Math.random() < .7) burst(e.x, e.y, 1, '#5a5480', { speed: 20, up: 20, life: .4 });
      if (e.hitWall) {
        e.st = 'stun'; e.st_t = 2.2; e.stun = 2.2; shake = 9; Snd.door(); hitstop = .1;
        burst(e.x, e.y - 20, 24, ['#4c4566', '#8a84a0', '#2a2638'], { speed: 90, up: 120, life: 1 });
        if (e.hp <= e.maxHp / 2 && !e.summoned) { e.summoned = true; for (let i = 0; i < 3; i++) spawn('bat', e.x + (i - 1) * 30, e.y - 30, { awake: true }); }
      } else if (e.st_t <= 0) { e.st = 'walk'; e.st_t = 2; }
    } else if (e.st === 'stun') { if (e.st_t <= 0) { e.st = 'walk'; e.st_t = 1.5; } }
  },
  draw(e) {
    const x = Math.round(e.x - cam.x), y = Math.round(e.y - cam.y), f = e.face;
    const white = e.flash > 0, kneel = e.st === 'stun' || e.st === 'down' ? 6 : 0;
    const shk = e.st === 'aim' ? Math.round((Math.random() - .5) * 2) : 0;
    ctx.drawImage(SPR.shadowBig.img, x - 16, y - 5, 32, 10);
    const R = (c, dx, dy, w, h) => { ctx.fillStyle = white ? '#ffffff' : c; ctx.fillRect(x + shk + (f > 0 ? dx : -dx - w), y + dy + kneel, w, h); };
    const step = e.st === 'walk' ? Math.round(Math.sin(e.t * 6) * 2) : 0;
    // cape
    R('#3a1a2a', -12, -36, 22, 30); R('#2a1020', -12, -10, 22, 4);
    // legs
    R('#2a2838', -8 + step, -10 - kneel, 6, 10 + kneel); R('#2a2838', 2 - step, -10 - kneel, 6, 10 + kneel);
    R('#4a4866', -9 + step, -2, 8, 2); R('#4a4866', 1 - step, -2, 8, 2);
    // body
    R('#1d1424', -11, -34, 22, 25); R('#4a4866', -10, -33, 20, 23); R('#6a6890', -9, -32, 8, 21); R('#34324a', 6, -33, 4, 23);
    R('#8a88aa', -10, -24, 20, 2); R('#c9a64a', -2, -30, 4, 4);
    // pauldrons
    R('#5a5878', -14, -35, 7, 6); R('#5a5878', 7, -35, 7, 6); R('#8a88aa', -14, -35, 7, 2); R('#8a88aa', 7, -35, 7, 2);
    // helmet
    R('#1d1424', -8, -48, 16, 15); R('#5a5878', -7, -47, 14, 13); R('#7a78a0', -7, -47, 5, 13); R('#2a2838', -6, -41, 12, 3);
    R('#5a5878', -1, -52, 2, 5); R('#8a2a3a', -2, -54, 4, 3);
    const eye = e.st === 'aim' || e.st === 'charge' ? '#ff3a2a' : e.stun > 0 ? '#3a3450' : '#ffd866';
    ctx.fillStyle = eye; ctx.fillRect(x + shk + (f > 0 ? 1 : -5), y - 40 + kneel, 4, 1);
    // lantern arm
    const sw = e.st === 'wind' ? -8 : e.st === 'sweep' ? 10 : Math.round(Math.sin(e.t * 2) * 2);
    R('#4a4866', 10, -30, 4, 12); R('#1d1424', 12 + sw * .3, -18, 1, 6);
    R('#c9a64a', 9 + sw * .3, -12, 8, 9); R('#ffe08a', 11 + sw * .3, -10, 4, 5);
    if (!white) addLight(e.x + f * (13 + sw * .3), e.y - 8 + kneel, 70, 1, 'gold');
    if (e.stun > 0) for (let i = 0; i < 3; i++) { const a = T * 4 + i * 2.1; ctx.fillStyle = '#ffd866'; ctx.fillRect(x + Math.round(Math.cos(a) * 10), y - 56 + kneel + Math.round(Math.sin(a) * 3), 2, 2); }
    if (e.st === 'wind') { ctx.strokeStyle = `rgba(255,80,60,${.4 + .4 * Math.sin(T * 30)})`; ctx.beginPath(); ctx.arc(x, y - 6, 38, 0, Math.PI * 2); ctx.stroke(); }
  },
  onDeath(e) { e.dead = false; e.st = 'down'; e.harmless = true; e.enemy = false; STORY.bossDown(e); },
};

/* ---------------- story ---------------- */
const STORY = {
  populate(id) {
    if (id === 'village') {
      if (S.flags.dawn) {
        [['odile', 15.5, 9.8, 1], ['bastien', 13.5, 10.6, 1], ['lila', 18, 10.4, -1], ['gaspard', 19.5, 9.2, -1], ['noe', 16.8, 11.4, -1]].forEach(([k, x, y, f]) => spawn('npc', x * TS, y * TS, { id: k, face: f }));
        return;
      }
      spawn('npc', ...F(27, 6), { id: 'bastien' });
      spawn('npc', ...F(25, 12), { id: 'lila' });
      spawn('npc', ...F(15, 21), { id: 'gaspard' });
      spawn('npc', ...F(8, 11), { id: 'noe' });
      spawn('sign', ...F(17, 2), { text: "↑ Forêt des Murmures\n↓ Brumeport — « On ne perd jamais ce qu'on a nommé. »" });
      spawn('statue', ...F(12, 7), { id: 'village' });
      [[2, 2], [30, 1], [19, 15], [31, 17]].forEach(([x, y]) => spawn('pot', ...F(x, y)));
    }
    if (id === 'foret') {
      spawn('echo', ...F(24, 26), { name: 'bastien' });
      spawn('echo', ...F(8, 22), { name: 'noe' });
      spawn('echo', ...F(32, 23), { name: 'lila' });
      spawn('echo', ...F(31, 8), { name: 'gaspard' });
      [[18, 29], [23, 29], [10, 21], [6, 24], [18, 11], [24, 12], [12, 9]].forEach(([x, y]) => spawn('slime', ...F(x, y)));
      [[30, 21], [34, 25], [29, 9], [33, 7]].forEach(([x, y]) => spawn('wolf', ...F(x, y)));
      spawn('chest', ...F(8, 7), { id: 'f_gems', item: 'gems30' });
      spawn('chest', ...F(34, 6), { id: 'f_crystal', item: 'crystal' });
      spawn('chest', ...F(5, 21), { id: 'f_potion', item: 'potion' });
      spawn('statue', ...F(17, 24), { id: 'foret' });
      spawn('sign', ...F(22, 31), { text: "FORÊT DES MURMURES\nNe réponds pas si les arbres t'appellent." });
    }
  },

  async onEnter(id) {
    if (id === 'maison' && !S.flags.intro) return this.intro();
    if (id === 'village' && !S.flags.vTalk && S.flags.intro && !S.flags.dawn) { S.flags.vTalk = true; await wait(400); await run(() => say([['meche', "Regarde… ils sont tous gris. Comme des statues de cendre. La brume s'est posée sur tout Brumeport."], ['meche', "Les noms sont partis vers le nord. La route de la forêt est en haut du village."]])); }
    if (id === 'foret' && !S.flags.fTalk) { S.flags.fTalk = true; await wait(400); await run(() => say([['meche', "La forêt chuchote. Ce sont les noms… Ils sont portés par des Échos — des choses faites de brume. Si tu les bats, les noms seront libres."], [null, "ESPACE / J : frapper · MAJ / K : roulade · R : potion · E : parler, ouvrir"]])); }
    if (id === 'crypte' && !S.flags.cTalk) { S.flags.cTalk = true; await wait(400); await run(() => say([['meche', "Il fait si noir… Reste près de moi, je vais éclairer."]])); }
  },

  async intro() {
    busy++; mode = 'cut';
    fade = 1;
    await say([[null, "**Brumeport.** La nuit où la brume est venue."]]);
    await fadeTo(0, 1200);
    await say([[null, "Tu te réveilles. Il fait froid. Le feu s'est presque éteint.\n\nEt quelque chose te regarde depuis la cheminée."]]);
    MECHE.on = true; MECHE.x = 2.5 * TS; MECHE.y = 2.4 * TS; Snd.fire();
    burst(MECHE.x, MECHE.y, 20, ['#ffb050', '#ffd866'], { speed: 40, up: 40, life: .8, grav: -20 });
    await wait(700);
    await say([
      ['meche', "Oh ! Tu me vois ? Tu me *vois* ?"],
      ['meche', "Tout le monde est devenu gris. Ta grand-mère, les voisins, tout le village. La brume est entrée par les cheminées et elle a… elle a tiré leurs noms. Comme on tire un fil."],
      ['meche', "Je les ai vus s'envoler vers la forêt. Des petites lettres de lumière."],
      ['meche', "Moi aussi, j'ai perdu le mien. Je ne sais plus qui j'étais. Je sais juste que je brûlais dans ce foyer… et que je t'attendais."],
      ['meche', "Mais toi, la brume ne t'a rien pris. Parce que tu n'avais rien à prendre."],
      [null, "C'est vrai. Au baptême, le nom qu'on t'a donné a glissé sur toi comme de l'eau. Tout le village t'appelle *Sans-Nom*."],
      ['meche', "Appelle-moi Mèche. Le coffre de ta grand-mère — prends ce qu'il y a dedans. On va aller les chercher, ces noms."],
    ]);
    S.flags.meche = true; S.flags.intro = true;
    mode = 'play'; busy--;
    toast('Flèches / ZQSD pour bouger · E pour ouvrir');
    save(true);
  },

  onName(key) {
    if (key === 'aelle') return;
    if (!S.flags.firstName) { S.flags.firstName = true; run(() => say([['meche', "Tu as vu ? Le nom est parti vers le village ! Quelqu'un va se réveiller là-bas."]])); }
    if (key === 'bastien') setTimeout(() => run(() => say([['meche', "Bastien… le forgeron ! Il pourrait te forger une vraie lame. Retournons au village quand tu veux."]])), 2600);
  },

  tick() {
    if (M.id === 'crypte' && !S.flags.bossDead && !S.flags.bossFight && P.y < 17.4 * TS && !busy) this.bossIntro();
  },

  async bossIntro() {
    S.flags.bossFight = true; busy++;
    const boss = ents.find(e => e.type === 'boss');
    Snd.gate(); shake = 4; Snd.play(null);
    await wait(500);
    Snd.roar(); shake = 8;
    await say([
      ['gardien', "Recule, enfant."],
      ['gardien', "Ces noms sont sous ma garde. Personne ne les prendra. Pas même toi."],
      ['meche', "Attention ! Quand il charge, esquive — s'il se cogne contre un mur, il sera sans défense !"],
    ]);
    Snd.play('boss');
    if (boss) { boss.st = 'walk'; boss.st_t = 1.5; boss.awake = true; }
    busy--;
  },

  async bossDown(e) {
    busy++; Snd.play(null); hitstop = .3; shake = 10;
    ents.filter(x => x.type === 'bat').forEach(b => { b.dead = true; burst(b.x, b.y - 10, 8, '#6a3f80'); });
    await wait(1200);
    await say([
      ['gardien', "Arrête… Arrête. C'est fini."],
      ['gardien', "Tu crois que je les ai volés ? Je les ai *cachés*."],
      ['gardien', "Une brume vient du Nord. On l'appelle l'Oubli. Il dévore les noms, et ceux qu'il dévore ne reviennent jamais. Ni dans les chansons, ni sur les tombes. Nulle part."],
      ['gardien', "Sous la terre, il ne pouvait pas les trouver. Alors j'ai pris les noms de Brumeport avant lui. Pour les sauver."],
      ['gardien', "Maintenant ils sont rentrés chez eux. Et l'Oubli sait où ils sont."],
      ['meche', "Alors… on a tout gâché ?"],
      ['gardien', "Non. Il existe quelqu'un qu'il ne pourra jamais prendre."],
      ['gardien', "L'enfant sans nom."],
      ['gardien', "Ta mère le savait. Elle est venue ici il y a douze ans, avec un nom dans les mains. Le tien. Elle m'a demandé de le cacher, et je l'ai fait."],
      ['gardien', "Puis elle a donné le sien pour sceller la porte derrière elle. Son nom est resté ici, avec moi. Et son âme… son âme est restée près de toi. Dans un petit feu, au fond d'une cheminée."],
    ]);
    freeName('aelle', e.x, e.y - 20);
    await wait(2600);
    await say([
      ['meche', "… Aëlle."],
      ['meche', "Je m'appelais Aëlle."],
      ['meche', "Je me souviens. Ta première nuit. Ton poing fermé sur mon doigt. Je t'ai pris ton nom pour que rien, jamais, ne puisse te trouver."],
      ['meche', "Pardon. Pardon d'avoir oublié que j'étais ta mère."],
      ['gardien', "Ton nom est sur l'autel, derrière la grille. Ce que tu en feras… ce n'est plus à moi d'en décider."],
      ['gardien', "Je suis si fatigué. Laissez-moi dormir, maintenant."],
    ]);
    e.dead = true; e.keep = false;
    burst(e.x, e.y - 20, 50, ['#ffd866', '#ffffff', '#8a88aa'], { speed: 90, up: 120, life: 1.6, grav: -20 });
    S.flags.bossDead = true; Snd.gate(); shake = 6;
    Snd.play('crypt');
    save(true);
    busy--;
  },

  async altar() {
    if (S.flags.ending) return;
    await say([
      [null, "Sur l'autel, une petite lumière tremble. Des lettres d'or tournent lentement sur elles-mêmes. Tu ne peux pas les lire. Pas encore."],
      ['meche', "C'est ton nom. Si tu le prends, tu seras comme tout le monde. Tu auras un nom à toi. Mais l'Oubli pourra te trouver."],
      ['meche', "Si tu le laisses, tu resteras Sans-Nom. Invisible pour lui. La seule personne au monde qui puisse marcher jusqu'au Nord et le regarder en face."],
    ]);
    const c = await ask(null, "Que fais-tu ?", ['Prendre ton nom', "Le laisser sur l'autel"]);
    if (c === 0) {
      const name = await askName();
      S.flags.ending = 'take'; S.flags.playerName = name;
      Snd.name(); burst(P.x, P.y - 12, 40, ['#ffd866', '#ffffff'], { speed: 60, up: 80, life: 1.2, grav: -30 });
      await wait(900);
      await say([
        [null, `Les lettres se posent sur ta langue. Tu dis ton nom à voix haute, pour la première fois de ta vie :\n\n**${name}**.`],
        ['meche', `${name}. C'est le nom que je t'avais choisi. Il te va bien.`],
        ['meche', "Quelque part au Nord, quelque chose vient de l'entendre. Ça ne fait rien. On l'attendra ensemble."],
      ]);
    } else {
      S.flags.ending = 'leave';
      await say([
        ['meche', "Alors je reste ici. Je garderai ton nom, comme le Gardien l'a gardé. Un petit feu sur un autel… ce n'est pas si mal."],
        ['meche', "Quand tout sera fini, reviens le chercher. Reviens *me* chercher."],
      ]);
      const mx = MECHE.x, my = MECHE.y; MECHE.on = false;
      burst(mx, my - 14, 30, ['#ffb050', '#ffd866'], { speed: 30, up: 40, life: 1.4, grav: -20 });
      await wait(800);
      await say([[null, "Tu repars sans elle. Derrière toi, sur l'autel, une petite flamme veille."]]);
    }
    await this.epilogue();
  },

  async epilogue() {
    busy++; mode = 'cut';
    await fadeTo(1, 1800);
    S.flags.dawn = true; S.flags.meche = S.flags.ending === 'take';
    MECHE.on = S.flags.meche;
    loadMap('village', 16 * TS, 13.5 * TS);
    Snd.play('ending');
    await fadeTo(0, 2200);
    await wait(600);
    const nm = S.flags.playerName;
    await say([
      [null, "*À l'aube.* La brume s'est levée sur Brumeport. Pour la première fois depuis des jours, il y a des couleurs."],
      ['odile', nm ? `${nm}… Alors c'est ça, ton nom. Je l'avais sur le bout de la langue depuis douze ans.` : "Mon cœur. Tu es rentré. Ça me suffit."],
      ['bastien', "Le village entier te doit son nom. On ne l'oubliera pas. C'est le cas de le dire."],
      ['noe', "Tu repars, hein ? Vers le nord ?"],
      [null, "Au loin, au-delà de la forêt, au-delà des montagnes, la brume grise s'est arrêtée."],
      [null, nm ? "Elle écoute. Elle a entendu un nom nouveau, cette nuit." : "Elle cherche. Elle ne trouve pas. Elle ne te trouvera jamais."],
    ]);
    await fadeTo(1, 2000);
    $('end').hidden = false;
    $('end-sub').textContent = nm ? `Tu t'appelles ${nm}.` : 'Tu es toujours Sans-Nom.';
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    busy--; mode = 'over';
  },

  quest() {
    if (!S.sword) return "Ouvre le coffre de ta grand-mère.";
    if (!namesCount()) return "Prends la route du nord jusqu'à la Forêt des Murmures. Des Échos y portent les noms volés.";
    if (S.names.bastien && S.sword < 2) return "Retourne voir Bastien, le forgeron, à Brumeport.";
    if (S.sword < 2) return "Trouve l'Écho qui porte le nom de Bastien, le forgeron.";
    if (!(S.flags.visited || {}).crypte) return "Tranche les ronces au nord de la forêt et entre dans la crypte.";
    if (!S.flags.gateG) return "Crypte : allume les trois brasiers de la salle ouest.";
    if (!S.flags.doorD) return "Crypte : trouve la clé de la porte de fer (salle est).";
    if (!S.flags.bossDead) return "Affronte le Gardien des Noms.";
    return "Approche-toi de l'autel.";
  },
};

function askName() {
  return new Promise(res => {
    const box = $('namebox'), inp = $('name-input');
    box.hidden = false; inp.value = ''; setTimeout(() => inp.focus(), 50);
    const done = () => { const v = inp.value.trim().slice(0, 14) || 'Ael'; box.hidden = true; res(v.charAt(0).toUpperCase() + v.slice(1)); };
    $('name-ok').onclick = done;
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(); };
  });
}

/* portrait for the Gardien, built once sprites exist */
const _buildSprites = buildSprites;
buildSprites = function () {
  _buildSprites();
  SPR.gardienFace = procSprite(16, 16, x => {
    x.fillStyle = '#1d1424'; x.fillRect(1, 1, 14, 15); x.fillStyle = '#5a5878'; x.fillRect(2, 2, 12, 13); x.fillStyle = '#7a78a0'; x.fillRect(2, 2, 4, 13);
    x.fillStyle = '#2a2838'; x.fillRect(3, 7, 10, 3); x.fillStyle = '#ffd866'; x.fillRect(4, 8, 3, 1); x.fillRect(9, 8, 3, 1);
    x.fillStyle = '#8a2a3a'; x.fillRect(7, 0, 2, 2);
  });
};
