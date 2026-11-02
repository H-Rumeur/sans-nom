'use strict';
/* SANS-NOM — synthesized sound effects and a small chiptune sequencer. */
const Snd = (() => {
  let ac = null, master, musicG, sfxG, noiseBuf, song = null, step = 0, nextT = 0;
  let on = true;
  try { on = localStorage.getItem('sansnom_sound') !== 'off'; } catch (e) {}

  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const freq = n => { const m = /^([A-G])(#|b)?(\d)$/.exec(n); if (!m) return 0; const i = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0); return 440 * Math.pow(2, (i - 9) / 12 + (+m[3] - 4)); };

  function init() {
    if (ac) { ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = ac.createGain(); master.gain.value = on ? .8 : 0; master.connect(ac.destination);
    musicG = ac.createGain(); musicG.gain.value = .32; musicG.connect(master);
    sfxG = ac.createGain(); sfxG.gain.value = .55; sfxG.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    setInterval(tick, 40);
  }
  function tone(f, t, dur, type = 'square', vol = .2, dest = sfxG, slideTo = 0) {
    if (!ac || !f) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g).connect(dest); o.start(t); o.stop(t + dur + .02);
  }
  function noise(t, dur, vol = .2, ftype = 'lowpass', f = 2000, dest = sfxG, fTo = 0) {
    if (!ac) return;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const fl = ac.createBiquadFilter(); fl.type = ftype; fl.frequency.setValueAtTime(f, t);
    if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl).connect(g).connect(dest); s.start(t, Math.random() * .5); s.stop(t + dur + .02);
  }
  const now = () => ac ? ac.currentTime : 0;

  const FX = {
    swing() { const t = now(); noise(t, .12, .25, 'bandpass', 1800, sfxG, 600); tone(520, t, .08, 'triangle', .05, sfxG, 260); },
    hit() { const t = now(); tone(240, t, .1, 'square', .16, sfxG, 90); noise(t, .08, .3, 'lowpass', 3000); },
    clang() { const t = now(); tone(1320, t, .25, 'square', .07); tone(1980, t, .2, 'triangle', .06); noise(t, .06, .2, 'highpass', 4000); },
    die() { const t = now(); noise(t, .35, .3, 'lowpass', 1600, sfxG, 200); [660, 520, 390, 260].forEach((f, i) => tone(f, t + i * .05, .08, 'square', .07)); },
    hurt() { const t = now(); tone(440, t, .25, 'square', .16, sfxG, 120); noise(t, .1, .2); },
    gem() { const t = now(); tone(1760, t, .07, 'square', .07); tone(2637, t + .06, .12, 'square', .06); },
    heart() { const t = now(); [880, 1108, 1318].forEach((f, i) => tone(f, t + i * .05, .1, 'triangle', .1)); },
    chest() { const t = now(); [392, 523, 659, 784].forEach((f, i) => tone(f, t + i * .12, i === 3 ? .7 : .14, 'square', .1)); [196, 262].forEach((f, i) => tone(f, t + i * .24, .4, 'triangle', .1)); },
    name() { const t = now(); [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => { tone(f, t + i * .07, .9, 'sine', .07); tone(f * 1.005, t + i * .07, .9, 'triangle', .04); }); },
    dash() { const t = now(); noise(t, .18, .2, 'bandpass', 600, sfxG, 2400); },
    step() { const t = now(); noise(t, .04, .05, 'lowpass', 700); },
    door() { const t = now(); noise(t, .4, .35, 'lowpass', 300, sfxG, 80); tone(90, t, .3, 'triangle', .2, sfxG, 50); },
    cut() { const t = now(); noise(t, .15, .3, 'highpass', 2500, sfxG, 800); },
    pot() { const t = now(); noise(t, .2, .35, 'bandpass', 1200, sfxG, 400); tone(300, t, .06, 'square', .06, sfxG, 150); },
    blip() { const t = now(); tone(660 + Math.random() * 40, t, .03, 'square', .025); },
    save() { const t = now(); [523, 659, 784, 1046].forEach(f => tone(f, t, 1.2, 'sine', .06)); },
    roar() { const t = now(); tone(110, t, .9, 'sawtooth', .18, sfxG, 45); noise(t, .9, .25, 'lowpass', 500, sfxG, 100); },
    fire() { const t = now(); noise(t, .5, .25, 'bandpass', 900, sfxG, 300); tone(200, t, .3, 'triangle', .06, sfxG, 400); },
    gate() { const t = now(); for (let i = 0; i < 6; i++) noise(t + i * .07, .06, .2, 'bandpass', 800 + i * 100); tone(150, t, .5, 'square', .05, sfxG, 100); },
    potion() { const t = now(); [523, 784, 1046, 1568].forEach((f, i) => tone(f, t + i * .06, .2, 'sine', .09)); },
    select() { const t = now(); tone(988, t, .05, 'square', .06); },
  };

  /* ---------- music ---------- */
  const seq = s => s.trim().split(/\s+/).filter(x => x !== '|');
  const SONGS = {
    village: { bpm: 84, tracks: [
      { w: 'square', v: .05, s: seq('E5 - - - A4 B4 | C5 - - - B4 A4 | G4 - - - E4 - | - - - - - - | F4 - - - A4 C5 | E5 - - - D5 C5 | B4 - - - G#4 - | A4 - - - - -') },
      { w: 'triangle', v: .16, s: seq('A2 - - E3 - - | A2 - - E3 - - | C3 - - G3 - - | E2 - - B2 - - | F2 - - C3 - - | A2 - - E3 - - | E2 - - B2 - - | A2 - - E3 - -') },
      { w: 'triangle', v: .05, s: seq('A3 C4 E4 A4 E4 C4 | A3 C4 E4 A4 E4 C4 | C4 E4 G4 C5 G4 E4 | E3 G#3 B3 E4 B3 G#3 | F3 A3 C4 F4 C4 A3 | A3 C4 E4 A4 E4 C4 | E3 G#3 B3 E4 B3 G#3 | A3 C4 E4 A4 E4 C4') },
    ] },
    forest: { bpm: 112, drums: 'k.h.s.h.k.h.s.hh', tracks: [
      { w: 'square', v: .05, s: seq('D5 - - A4 D5 E5 F5 - | E5 - D5 - C5 - A4 - | G4 - - A4 C5 - D5 - | A4 - - - - - - - | D5 - - A4 D5 E5 F5 - | G5 - F5 - E5 - C5 - | D5 - E5 - C5 - A4 - | D5 - - - - - - -') },
      { w: 'triangle', v: .17, s: seq('D3 - D3 - A2 - D3 - | C3 - C3 - G2 - C3 - | G2 - G2 - D3 - G2 - | A2 - A2 - E3 - A2 - | D3 - D3 - A2 - D3 - | C3 - C3 - G2 - C3 - | Bb2 - Bb2 - F3 - Bb2 - | A2 - A2 - E3 - C#3 -') },
    ] },
    crypt: { bpm: 66, tracks: [
      { w: 'triangle', v: .18, s: seq('D2 - - - - - - - - - - - - - - - C#2 - - - - - - - - - - - - - - - Bb1 - - - - - - - - - - - - - - - A1 - - - - - - - - - - - - - - -') },
      { w: 'sine', v: .07, s: seq('- - - - A4 - - - - - - - F4 - - - - - - - E4 - - - - - - - - - - - - - - - D5 - - - - - - - C#5 - - - - - - - - - - - A4 - - - - - - - - - - - - - - - - -') },
    ] },
    boss: { bpm: 150, drums: 'k.hks.hkk.hks.hs', tracks: [
      { w: 'square', v: .055, s: seq('E4 - G4 - B4 - A4 G4 | F#4 - - - D4 - - - | E4 - G4 - C5 - B4 A4 | B4 - - - - - - - | E5 - D5 - B4 - G4 - | A4 - G4 - F#4 - D4 - | E4 - F#4 - G4 - A4 - | B4 - - - B4 - - -') },
      { w: 'triangle', v: .2, s: seq('E2 E2 E3 E2 G2 E2 A2 B2 | D2 D2 D3 D2 F#2 D2 A2 D3 | C2 C2 C3 C2 E2 C2 G2 C3 | B1 B1 B2 B1 D#2 B1 F#2 B2 | E2 E2 E3 E2 G2 E2 A2 B2 | D2 D2 D3 D2 F#2 D2 A2 D3 | C2 C2 C3 C2 E2 C2 G2 C3 | B1 B1 B2 B1 D#2 B1 F#2 B2') },
    ] },
    ending: { bpm: 76, tracks: [
      { w: 'triangle', v: .09, s: seq('C5 - - - E5 - D5 - | C5 - - - G4 - - - | A4 - - - C5 - B4 - | G4 - - - - - - - | F4 - - - A4 - G4 - | E4 - - - C5 - - - | D5 - - - B4 - G4 - | C5 - - - - - - -') },
      { w: 'sine', v: .14, s: seq('C3 - - - G3 - - - | E3 - - - G3 - - - | F3 - - - C4 - - - | G3 - - - D3 - - - | F3 - - - C4 - - - | C3 - - - G3 - - - | G2 - - - D3 - - - | C3 - - - G3 - - -') },
    ] },
  };
  let current = null;
  function play(name) {
    if (current === name) return;
    current = name; song = SONGS[name] || null; step = 0;
    if (ac) nextT = ac.currentTime + .1;
  }
  function tick() {
    if (!ac || !song) return;
    const spb = 60 / song.bpm / 2;
    if (nextT < ac.currentTime - .5) nextT = ac.currentTime + .05;
    while (nextT < ac.currentTime + .2) {
      song.tracks.forEach(tr => {
        const n = tr.s[step % tr.s.length];
        if (n && n !== '-' && n !== '.') {
          let len = 1; while (tr.s[(step + len) % tr.s.length] === '-' && len < 32) len++;
          tone(freq(n), nextT, spb * len * .92, tr.w, tr.v, musicG);
        }
      });
      if (song.drums) {
        const d = song.drums[step % song.drums.length];
        if (d === 'k') { tone(130, nextT, .12, 'sine', .3, musicG, 45); }
        if (d === 's') noise(nextT, .1, .12, 'highpass', 1500, musicG);
        if (d === 'h') noise(nextT, .03, .05, 'highpass', 6000, musicG);
      }
      nextT += spb; step++;
    }
  }
  function toggle() {
    on = !on; try { localStorage.setItem('sansnom_sound', on ? 'on' : 'off'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(on ? .8 : 0, ac.currentTime, .05);
    return on;
  }
  const api = { init, play, toggle, get on() { return on; } };
  for (const k in FX) api[k] = () => { if (ac && on) FX[k](); };
  return api;
})();
