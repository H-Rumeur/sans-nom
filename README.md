# SANS-NOM — Acte I : la Brume

Action-aventure en vue de dessus, pixel art, dans le navigateur.

> Une brume grise a arraché le nom de tous les habitants de Brumeport. Ils sont devenus des statues de cendre.
> Une seule personne n'a rien perdu : toi, l'enfant à qui on n'a jamais pu donner de nom.
> Avec Mèche, une petite flamme qui a oublié qui elle était, pars reprendre les noms aux Échos de la forêt.

## Jouer

```bash
python -m http.server 8766
```
Puis http://localhost:8766

| Action | Clavier | Manette |
|---|---|---|
| Bouger | Flèches / ZQSD / WASD | Stick / croix |
| Épée | Espace / J | A / X |
| Roulade (invincible) | Maj / K | B / RB |
| Parler, ouvrir | E / Entrée | Y |
| Potion | R / F | LB |
| Menu | Échap | Start |

Sur mobile : joystick virtuel + boutons à l'écran.

## Contenu de l'acte I (≈ 30–45 min)

- **4 zones** : la maison d'Odile, le village de Brumeport, la Forêt des Murmures (générée à partir d'une graine), la Crypte des Noms
- **6 noms à libérer** : chaque Écho vaincu rend son nom à un villageois. Le personnage gris reprend ses couleurs et te récompense (épée de fer, boutique, cœurs…)
- **Ennemis** : slimes, loups (charge en ligne droite), chauves-souris, squelettes (attaque annoncée), Échos (ruée), et un **boss** en 2 phases, le Gardien des Noms, qu'on étourdit en le faisant foncer dans un mur
- **Énigmes** : les ronces (il faut l'épée de fer), les brasiers (Mèche les allume), une clé, une porte
- **Rebondissement final** et **choix** : reprendre ton nom (que tu tapes toi-même) ou le laisser sur l'autel
- Pierres de veille (sauvegarde + soin), sauvegarde automatique, inventaire, objectif courant dans le menu

## Technique

Aucune image ni aucun son externe : tout est dessiné et synthétisé par le code.
- Sprites pixel art définis en ASCII (`js/pix.js`), arbres et maisons générés
- Éclairage dynamique (feu, torches, Mèche, lanternes), brume animée, lucioles, feuilles
- Musique chiptune par zone + effets sonores synthétisés (`js/sound.js`)
- Effets « juicy » : hitstop, tremblement d'écran, flash, recul, particules, chiffres de dégâts

| Fichier | Rôle |
|---|---|
| `js/story.js` | Histoire, personnages, dialogues, boss, fin — **là où on écrit** |
| `js/world.js` | Cartes, tuiles, générateur de forêt |
| `js/game.js` | Moteur : joueur, combat, ennemis, caméra, lumière, interface, sauvegarde |
| `js/pix.js` | Sprites et police bitmap |
| `js/sound.js` | Effets et musiques |

## Suite prévue — Acte II : l'Oubli

Le Gardien a révélé la vraie menace : l'Oubli, une brume venue du Nord qui dévore les noms pour toujours. Prochaines zones possibles : les montagnes, une ville fortifiée, la tour du Roi Gris.

## Mise en ligne & monétisation

1. **itch.io** : zipper le dossier → projet HTML → jouable dans le navigateur. Acte I gratuit.
2. Acte II + III payants (ou jeu complet 5–10 €), puis **Steam** via Electron/Tauri quand il y a une communauté.
3. Clips courts : un villageois gris qui reprend ses couleurs, le boss qui se cogne au mur, la révélation de Mèche.
