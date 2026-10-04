// Soundtrack for the Oferta 4 reel: 120 BPM, D minor -> F major lift, locked to reel.html.
// Sound effects come from sfx/<id>.mp3 (ElevenLabs, see elevenlabs.cjs) when present,
// otherwise from the procedural stand-ins below. Usage: node audio.cjs -> reel.wav
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const SR = 44100, DUR = 26, N = SR * DUR, TAU = Math.PI * 2;
const bus = () => [new Float32Array(N), new Float32Array(N)];
const FX = bus(), MUS = bus(), REV = bus();
let seed = 11; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const lerp = (a, b, t) => a + (b - a) * t;

function voice(t0, dur, fn, pan = 0, send = 0, B = FX) {
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  for (let k = 0; k < n; k++) {
    const i = i0 + k; if (i < 0 || i >= N) continue;
    const v = fn(k / SR, k / n); if (!v) continue;
    const pn = Array.isArray(pan) ? lerp(pan[0], pan[1], k / n) : pan, a = (pn + 1) * Math.PI / 4, l = v * Math.cos(a), r = v * Math.sin(a);
    B[0][i] += l; B[1][i] += r; if (send) { REV[0][i] += l * send; REV[1][i] += r * send; }
  }
}
function svf() { let low = 0, band = 0; return (x, fc, q = .7) => { const F = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6.5) / SR); low += F * band; const high = x - low - q * band; band += F * high; return { low, band, high }; }; }

/* ---------- instruments ---------- */
const kicks = [];
function kick(t, a = 1) { kicks.push(t); let ph = 0; voice(t, .5, x => { ph += TAU * (40 + 120 * Math.exp(-x * 32)) / SR; return a * .75 * Math.sin(ph) * Math.exp(-x * 6.5) + (x < .004 ? a * .25 * (rnd() * 2 - 1) * (1 - x / .004) : 0); }, 0, .04); }
function clap(t, a = .25) { const f = svf(); voice(t, .25, x => { const env = (x < .03 ? (Math.floor(x / .01) % 2 ? .6 : 1) : 1) * Math.exp(-x * 18); return a * f(rnd() * 2 - 1, 1500, .5).band * env; }, 0, .35); }
function hat(t, a = .1, pan = .3) { let lp = 0; voice(t, .09, x => { const n = rnd() * 2 - 1; lp += .35 * (n - lp); return (n - lp) * a * Math.exp(-x * 60); }, pan); }
function tick(t, f, a = .08, pan = 0) { voice(t, .06, x => a * Math.sin(TAU * f * x) * Math.exp(-x * 80), pan, .15); }
function bell(t, f, a = .12, pan = 0, send = .5, decay = 1) {
  const parts = [[1, 1, 2.2], [2, .45, 3.2], [2.76, .3, 4.5], [5.4, .16, 6.5], [8.93, .08, 9]];
  voice(t, 3, x => { let v = 0; for (const [m, g, d] of parts) v += g * Math.sin(TAU * f * m * x) * Math.exp(-x * d / decay); return a * v * Math.min(1, x / .002); }, pan, send);
}
function keys(t, m, a = .09, pan = 0) { const f = mtof(m); voice(t, 2.5, x => a * (Math.sin(TAU * f * x) + .4 * Math.sin(TAU * 2 * f * x) * Math.exp(-x * 3) + .15 * Math.sin(TAU * 3 * f * x) * Math.exp(-x * 5)) * Math.exp(-x * 1.6) * Math.min(1, x / .004), pan, .6, MUS); }
function pluck(t, f, a = .06, pan = 0) { voice(t, .5, x => a * (Math.sin(TAU * f * x) + .35 * Math.sin(TAU * 2 * f * x) * Math.exp(-x * 20)) * Math.exp(-x * 11) * Math.min(1, x / .003), pan, .3, MUS); }
function bass(t, dur, m, a = .2) { const f = mtof(m); voice(t, dur + .05, x => { const env = Math.min(1, x / .006) * (x > dur ? Math.max(0, 1 - (x - dur) / .05) : 1) * (.55 + .45 * Math.exp(-x * 6)); return a * Math.tanh(1.6 * (Math.sin(TAU * f * x) + .3 * Math.sin(TAU * 2 * f * x))) * env; }, 0, 0, MUS); }
function pad(t0, t1, notes, a = .03) {
  const dur = t1 - t0 + .6;
  notes.forEach((m, j) => [-1, 1].forEach(side => { const f = mtof(m) * (1 + side * .0035);
    voice(t0, dur, x => { const env = Math.min(1, x / .45) * Math.min(1, Math.max(0, (dur - x) / .6)); let v = 0; for (let h = 1; h <= 5; h++) v += Math.sin(TAU * f * h * x + h * j) / (h * h * .8 + .2); return a * v * env * (.85 + .15 * Math.sin(TAU * .5 * x + j)); }, side * .65, .55, MUS); }));
}
function sweep(t0, dur, f0, f1, a, { pan = [-.6, .6], shape = 'bell', q = .6, send = .3 } = {}) {
  const fl = svf(); voice(t0, dur, (x, u) => { const b = fl(rnd() * 2 - 1, f0 * Math.pow(f1 / f0, u), q).band; const env = shape === 'bell' ? Math.pow(Math.sin(Math.PI * Math.pow(u, .8)), 2) : shape === 'rise' ? Math.pow(u, 2.6) : Math.pow(1 - u, 2); return a * b * env; }, pan, send);
}
function boom(t, a = 1) {
  let ph = 0; voice(t, 2.6, x => { ph += TAU * (30 + 32 * Math.exp(-x * 5)) / SR; return a * .8 * Math.sin(ph) * Math.exp(-x * 2); }, 0, .5);
  const fl = svf(); voice(t, 1.4, x => a * .7 * fl(rnd() * 2 - 1, 180 + 2500 * Math.exp(-x * 9), .9).low * Math.exp(-x * 4.5), 0, .8);
  sweep(t, .5, 7000, 1500, .25 * a, { shape: 'fall', pan: [0, 0], send: .6 });
}
function riser(t0, t1, a = .3) {
  sweep(t0, t1 - t0, 250, 9000, a, { shape: 'rise', pan: [-.3, .3] });
  let ph = 0; voice(t0, t1 - t0, (x, u) => { ph += TAU * lerp(180, 960, u * u) / SR; return a * .22 * Math.sin(ph) * u * u; }, 0, .3);
}
function sparkle(t0, dur, count, a = .04) { for (let i = 0; i < count; i++) bell(t0 + rnd() * dur, 1800 + rnd() * 4200, a * (.4 + rnd() * .6), rnd() * 1.6 - .8, .6, .35); }
function glitch(t0, t1, a = .2) { for (let t = t0; t < t1; t += .028) { const r = rnd(), f = 120 + rnd() * 2800, pan = rnd() * 1.6 - .8;
  if (r < .45) voice(t, .026, x => a * Math.sign(Math.sin(TAU * f * x)) * .6, pan); else if (r < .85) { let hold = 0; voice(t, .026, (x, u) => { if (Math.round(u * 1000) % 6 === 0) hold = rnd() * 2 - 1; return a * hold * .8; }, pan); } } }
function hum(t0, dur, a = .1) { voice(t0, dur, (x, u) => a * Math.sin(Math.PI * u) * (Math.sin(TAU * 55 * x) + .5 * Math.sin(TAU * 110.7 * x) + .25 * Math.sin(TAU * lerp(440, 880, u) * x) * (.5 + .5 * Math.sin(TAU * 7 * x))), [-.4, .4], .4); }

/* ---------- procedural stand-ins for each ElevenLabs cue ---------- */
const PROC = {
  slam: (t, g) => boom(t, g),
  whoosh: (t, g) => sweep(t, .45, 400, 6500, .3 * g, { pan: [-.8, .8] }),
  repel: (t, g) => { sweep(t, 1.4, 3000, 300, .25 * g, { shape: 'fall' }); hum(t, 1.4, .06 * g); },
  tick: (t, g) => { tick(t, 2400, .12 * g); tick(t + .01, 1200, .08 * g); },
  cash_drain: (t, g) => { for (let i = 0; i < 6; i++) bell(t + i * .07, 3200 - i * 300, .04 * g, -.5 + i * .2, .3, .3); },
  spotlight: (t, g) => { voice(t, .7, (x, u) => .08 * g * Math.sin(TAU * 120 * x) * Math.sin(Math.PI * u), [0, .7], .3); sweep(t + .2, .5, 800, 3000, .15 * g); },
  flatline: (t, g) => { [0, .2].forEach(d => voice(t + d, .08, x => .12 * g * Math.sin(TAU * 1000 * x), .3, .3)); voice(t + .4, .45, (x, u) => .1 * g * Math.sin(TAU * 1000 * x) * (1 - u), .3, .3); },
  glitch: (t, g) => glitch(t, t + .35, .2 * g),
  magnet_hum: (t, g) => hum(t, 3, .11 * g),
  attract: (t, g) => { sparkle(t, 1, 22, .035 * g); sweep(t, 1, 300, 5000, .2 * g, { shape: 'rise' }); },
  alarm: (t, g) => [[466, 0], [349, .12]].forEach(([f, d]) => voice(t + d, .12, x => .12 * g * Math.tanh(3 * Math.sin(TAU * f * x)) * Math.exp(-x * 12), 0, .3)),
  clash: (t, g) => { boom(t, .5 * g); glitch(t, t + .3, .15 * g); },
  resolve: (t, g) => [587.3, 740, 880, 1174.7].forEach((f, i) => bell(t + i * .05, f, .08 * g, -.4 + i * .27, .6)),
  split_flap: (t, g) => { for (let i = 0; i < 40; i++) { const tt = t + i * .035 + rnd() * .01; voice(tt, .02, x => .1 * g * (rnd() * 2 - 1) * Math.exp(-x * 300), rnd() - .5); } },
  card_slide: (t, g) => sweep(t, .35, 3000, 900, .16 * g, { shape: 'fall', pan: [-.6, 0] }),
  strike: (t, g) => sweep(t, .25, 6000, 1500, .15 * g, { shape: 'fall' }),
  ka_ching: (t, g) => { bell(t, 2093, .1 * g, .2); bell(t + .08, 2637, .08 * g, -.2); sparkle(t, .6, 10, .03 * g); },
  pop: (t, g) => voice(t, .08, x => .2 * g * Math.sin(TAU * lerp(300, 900, x / .08) * x) * Math.exp(-x * 40), 0, .2),
  typing: (t, g) => { for (let i = 0; i < 10; i++) tick(t + i * .07 + rnd() * .02, 3000 + rnd() * 1500, .05 * g, rnd() * .4); },
  tap: (t, g) => { tick(t, 1800, .14 * g); voice(t, .06, x => .1 * g * Math.sin(TAU * 200 * x) * Math.exp(-x * 60)); },
  cascade: (t, g) => [62, 65, 69, 72, 74, 77, 81].forEach((m, i) => bell(t + i * .05, mtof(m + 12), .04 * g, -.6 + i * .2, .5, .5)),
  shimmer: (t, g) => { for (let i = 0; i < 16; i++) bell(t + i * .03, 1760 * Math.pow(2, i / 16), .025 * g, -.6 + i * .08, .7, .5); }
};

/* ---------- music ---------- */
const CH = { Dm: [38, [50, 53, 57, 62]], Bb: [34, [50, 53, 58]], F: [41, [53, 57, 60]], C: [36, [52, 55, 60]], Fadd9: [41, [53, 57, 60, 67, 69]] };
const BARS = ['Dm', 'Bb', 'Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'F', 'C', 'Bb', 'C', 'Fadd9'];
BARS.forEach((c, b) => pad(b * 2, b * 2 + 2, CH[c][1], b === 12 ? .04 : .028));
const chordAt = t => CH[BARS[Math.min(12, Math.floor(t / 2))]];
const groove = t => (t >= 3 && t < 6) || (t >= 10.5 && t < 13.4) || (t >= 13.9 && t < 19.5) || (t >= 20 && t < 22);
const half = t => (t >= 7.5 && t < 10.5) || (t >= 22 && t < 24);
hum(0, 3, .07);
for (let t = 0; t < 25.99; t += .5) {
  if (groove(t)) { kick(t); hat(t + .25, .1, .35); if (Math.round(t * 2) % 4 === 2) clap(t, .2); if (t >= 15.5) { hat(t + .125, .045, -.4); hat(t + .375, .045, -.4); } }
  else if (half(t) && Math.abs(t % 1) < 1e-6) { kick(t, .85); hat(t + .5, .07, .3); }
}
for (let t = 3; t < 22; t += .25) { if (!groove(t)) continue; const [root] = chordAt(t); bass(t, .2, root + (Math.round(t / .25) % 4 === 3 ? 12 : 0), .14); }
[[7.5, 10.5], [22, 24]].forEach(([a, b]) => { for (let t = a; t < b; t += 2) bass(t, 1.9, chordAt(t)[0], .14); });
for (let t = 7.5; t < 24; t += .25) { if (t >= 13.4 && t < 13.9) continue; const n = chordAt(t)[1], k = Math.round(t / .25); if (t < 10.5 || t >= 15.5) pluck(t, mtof(n[k % n.length] + 12), .035, k % 2 ? .45 : -.45); }
// "Não é culpa sua": the beat drops out, felt-piano chords
[[6.0, [62, 65, 69]], [6.55, [58, 62, 65]], [7.05, [60, 64, 67]]].forEach(([t, ns]) => ns.forEach((m, i) => keys(t + i * .02, m, .07, -.3 + i * .3)));
riser(9.7, 10.5, .25); riser(19.1, 20.0, .32); riser(23.4, 24.0, .22);
boom(13.9, .4); boom(18.0, .45);
// end: F major bloom
bass(24, 1.9, 29, .18); [69, 72, 76, 79, 84].forEach((m, i) => bell(24.05 + i * .1, mtof(m), .07, -.6 + i * .3, .7, 1.4));

/* ---------- effects: ElevenLabs files when present, otherwise procedural ---------- */
const { sounds } = JSON.parse(fs.readFileSync(path.join(__dirname, 'sfx.json'), 'utf8'));
let used = 0;
for (const [id, s] of Object.entries(sounds)) {
  const file = path.join(__dirname, 'sfx', `${id}.mp3`);
  if (fs.existsSync(file)) {
    const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(SR), '-'], { maxBuffer: 1 << 28 });
    const pcm = new Float32Array(raw.buffer, raw.byteOffset, raw.length / 4); used++;
    for (const at of s.at) { const i0 = Math.round(at * SR); for (let k = 0; k < pcm.length / 2; k++) { const i = i0 + k; if (i >= N) break;
      FX[0][i] += pcm[2 * k] * s.gain; FX[1][i] += pcm[2 * k + 1] * s.gain; REV[0][i] += pcm[2 * k] * s.gain * .15; REV[1][i] += pcm[2 * k + 1] * s.gain * .15; } }
  } else for (const at of s.at) PROC[id](at, 1);
}

/* ---------- mix ---------- */
const duck = new Float32Array(N).fill(1); kicks.sort((a, b) => a - b);
for (const k of kicks) { const i0 = Math.round(k * SR); for (let i = i0; i < Math.min(N, i0 + SR * .4); i++) duck[i] = Math.min(duck[i], 1 - .6 * Math.exp(-(i - i0) / SR * 10)); }
function reverb(x, off) {
  const out = new Float32Array(N);
  [1557, 1617, 1491, 1422, 1277, 1356].forEach(d0 => { const d = d0 + off, buf = new Float32Array(d); let p = 0, lp = 0;
    for (let i = 0; i < N; i++) { const y = buf[p]; lp = y * .75 + lp * .25; buf[p] = x[i] + lp * .84; out[i] += y / 6; p = (p + 1) % d; } });
  [225, 556, 441].forEach(d0 => { const d = d0 + off, buf = new Float32Array(d); let p = 0;
    for (let i = 0; i < N; i++) { const b = buf[p], y = -out[i] * .5 + b; buf[p] = out[i] + b * .5; out[i] = y; p = (p + 1) % d; } });
  return out;
}
const RvL = reverb(REV[0], 0), RvR = reverb(REV[1], 23);
const L = new Float32Array(N), R = new Float32Array(N); let peak = 0;
for (let i = 0; i < N; i++) {
  const fade = Math.min(1, (DUR - i / SR) / .7);
  L[i] = Math.tanh(1.15 * (FX[0][i] + MUS[0][i] * duck[i] + RvL[i] * .5)) * fade;
  R[i] = Math.tanh(1.15 * (FX[1][i] + MUS[1][i] * duck[i] + RvR[i] * .5)) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = .89 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
fs.writeFileSync(path.join(__dirname, 'reel.wav'), buf);
console.log(`wrote reel.wav  peak ${peak.toFixed(3)}  elevenlabs sfx used: ${used}/${Object.keys(sounds).length}`);
