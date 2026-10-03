// Procedural soundtrack for the reel: 120 BPM, A minor, every hit locked to the animation timeline.
// Usage: node audio.cjs  -> writes reel.wav (44.1 kHz, 16-bit stereo, 20 s)
const fs = require('fs');
const path = require('path');
const SR = 44100, DUR = 20, N = SR * DUR, TAU = Math.PI * 2;
const bus = () => [new Float32Array(N), new Float32Array(N)];
const FX = bus(), MUS = bus(), REV = bus();
let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const lerp = (a, b, t) => a + (b - a) * t;

// voice(t0, dur, fn(x,u) -> sample, pan|[pan0,pan1], send, target bus)
function voice(t0, dur, fn, pan = 0, send = 0, B = FX) {
  const i0 = Math.round(t0 * SR), n = Math.round(dur * SR);
  for (let k = 0; k < n; k++) {
    const i = i0 + k; if (i < 0 || i >= N) continue;
    const x = k / SR, u = k / n, v = fn(x, u); if (!v) continue;
    const pn = Array.isArray(pan) ? lerp(pan[0], pan[1], u) : pan, a = (pn + 1) * Math.PI / 4;
    const l = v * Math.cos(a), r = v * Math.sin(a);
    B[0][i] += l; B[1][i] += r; if (send) { REV[0][i] += l * send; REV[1][i] += r * send; }
  }
}
function svf() { let low = 0, band = 0; return (x, fc, q = .7) => { const F = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6.5) / SR); low += F * band; const high = x - low - q * band; band += F * high; return { low, band, high }; }; }

/* ---------- instruments ---------- */
const kicks = [];
function kick(t, a = 1) { kicks.push(t); let ph = 0; voice(t, .5, x => { ph += TAU * (40 + 120 * Math.exp(-x * 32)) / SR; return a * .75 * Math.sin(ph) * Math.exp(-x * 6.5) + (x < .004 ? a * .25 * (rnd() * 2 - 1) * (1 - x / .004) : 0); }, 0, .04); }
function hat(t, a = .1, pan = .3) { let lp = 0; voice(t, .09, x => { const n = rnd() * 2 - 1; lp += .35 * (n - lp); return (n - lp) * a * Math.exp(-x * 60); }, pan); }
function tick(t, f, a = .08, pan = 0) { voice(t, .06, x => a * Math.sin(TAU * f * x) * Math.exp(-x * 80), pan, .15); }
function bell(t, f, a = .12, pan = 0, send = .5, decay = 1) {
  const parts = [[1, 1, 2.2], [2, .45, 3.2], [2.76, .3, 4.5], [5.4, .16, 6.5], [8.93, .08, 9]];
  voice(t, 3, x => { let v = 0; for (const [m, g, d] of parts) v += g * Math.sin(TAU * f * m * x) * Math.exp(-x * d / decay); return a * v * Math.min(1, x / .002); }, pan, send);
}
function pluck(t, f, a = .06, pan = 0) { voice(t, .5, x => a * (Math.sin(TAU * f * x) + .35 * Math.sin(TAU * 2 * f * x) * Math.exp(-x * 20)) * Math.exp(-x * 11) * Math.min(1, x / .003), pan, .3, MUS); }
function bass(t, dur, m, a = .2) { const f = mtof(m); voice(t, dur + .05, (x, u) => { const env = Math.min(1, x / .006) * (x > dur ? Math.max(0, 1 - (x - dur) / .05) : 1) * (.55 + .45 * Math.exp(-x * 6)); return a * Math.tanh(1.6 * (Math.sin(TAU * f * x) + .3 * Math.sin(TAU * 2 * f * x))) * env; }, 0, 0, MUS); }
function pad(t0, t1, notes, a = .035) {
  const dur = t1 - t0 + .6;
  notes.forEach((m, j) => [-1, 1].forEach(side => {
    const f = mtof(m) * (1 + side * .0035);
    voice(t0, dur, x => { const env = Math.min(1, x / .45) * Math.min(1, Math.max(0, (dur - x) / .6)); let v = 0;
      for (let h = 1; h <= 5; h++) v += Math.sin(TAU * f * h * x + h * j) / (h * h * .8 + .2);
      return a * v * env * (.85 + .15 * Math.sin(TAU * .5 * x + j)); }, side * .65, .55, MUS);
  }));
}
function sweep(t0, dur, f0, f1, a, { pan = [-.6, .6], shape = 'bell', q = .6, send = .3 } = {}) {
  const fl = svf();
  voice(t0, dur, (x, u) => { const fc = f0 * Math.pow(f1 / f0, u), n = rnd() * 2 - 1, b = fl(n, fc, q).band;
    const env = shape === 'bell' ? Math.pow(Math.sin(Math.PI * Math.pow(u, .8)), 2) : shape === 'rise' ? Math.pow(u, 2.6) : Math.pow(1 - u, 2);
    return a * b * env; }, pan, send);
}
function boom(t, a = 1) {
  let ph = 0; voice(t, 2.6, x => { ph += TAU * (30 + 32 * Math.exp(-x * 5)) / SR; return a * .8 * Math.sin(ph) * Math.exp(-x * 2); }, 0, .5);
  const fl = svf(); voice(t, 1.4, x => a * .7 * fl(rnd() * 2 - 1, 180 + 2500 * Math.exp(-x * 9), .9).low * Math.exp(-x * 4.5), 0, .8);
  sweep(t, .5, 7000, 1500, .25 * a, { shape: 'fall', pan: [0, 0], send: .6 });
}
function riser(t0, t1, a = .35) {
  sweep(t0, t1 - t0, 250, 9000, a, { shape: 'rise', pan: [-.3, .3], send: .3 });
  let ph = 0; voice(t0, t1 - t0, (x, u) => { ph += TAU * lerp(180, 960, u * u) / SR; return a * .22 * Math.sin(ph) * Math.pow(u, 2) + a * .1 * Math.sin(ph * 1.5) * Math.pow(u, 3); }, 0, .3);
}
function sparkle(t0, dur, count, a = .04) { for (let i = 0; i < count; i++) bell(t0 + rnd() * dur, 1800 + rnd() * 4200, a * (.4 + rnd() * .6), rnd() * 1.6 - .8, .6, .35); }
function glitch(t0, t1, a = .2) {
  for (let t = t0; t < t1; t += .028) {
    const r = rnd(), f = 120 + rnd() * 2800, pan = rnd() * 1.6 - .8;
    if (r < .45) voice(t, .026, x => a * Math.sign(Math.sin(TAU * f * x)) * .6, pan);
    else if (r < .85) { let hold = 0; voice(t, .026, (x, u) => { if ((Math.round(u * 1000)) % 6 === 0) hold = rnd() * 2 - 1; return a * hold * .8; }, pan); }
  }
}
function alarm(t, a = .12) { [[466, 0], [349, .09]].forEach(([f, d]) => voice(t + d, .085, x => a * Math.tanh(3 * Math.sin(TAU * f * x)) * Math.exp(-x * 14), 0, .3)); }
function scan(t0, dur, f0, f1, a = .06) { let ph = 0; voice(t0, dur, (x, u) => { ph += TAU * lerp(f0, f1, u) / SR; return a * Math.sin(ph) * Math.sin(Math.PI * u) * (1 + .4 * Math.sin(TAU * 30 * x)); }, [-.7, .7], .3); }
function drone(t0, t1, a = .12) { const d = t1 - t0; voice(t0, d, (x, u) => a * (Math.sin(TAU * 55 * x) + .5 * Math.sin(TAU * 110.4 * x) + .2 * Math.sin(TAU * 164.8 * x)) * Math.min(1, x / 1.2) * Math.min(1, (d - x) / .3), 0, .4); }

/* ---------- score (times in seconds; matches reel.html) ---------- */
const CH = { Am: [45, [57, 60, 64]], F: [41, [53, 57, 60]], C: [48, [55, 60, 64]], G: [43, [55, 59, 62]], E: [40, [52, 56, 59, 62]], Am9: [45, [57, 60, 64, 71, 76]] };
const BARS = ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'E', 'Am9'];
BARS.forEach((c, b) => pad(b * 2, b * 2 + 2, CH[c][1], b === 9 ? .045 : .03));
const chordAt = t => CH[BARS[Math.min(9, Math.floor(t / 2))]];

// 01 ignition
drone(0, 2.5, .1);
bell(.12, 2637, .05, 0, .7); sweep(.1, .9, 3000, 9000, .06, { shape: 'fall', pan: [-.8, .8] });
sweep(.42, .9, 600, 5000, .22); sparkle(.5, .9, 26, .035);
bell(1.28, 880, .06, -.3); bell(1.5, 1318.5, .05, .3);
riser(1.65, 2.5, .3); sweep(2.0, .5, 400, 6000, .3, { shape: 'rise', pan: [.5, -.5] });
glitch(2.44, 2.52, .12);

// groove 2.5 -> 15.5 (half-time inside the Núcleo Hermético)
for (let t = 2.5; t < 15.49; t += .5) {
  const half = t >= 9 && t < 12.5;
  if (!half || Math.abs((t - 9) % 1) < 1e-6) kick(t, half ? .9 : 1);
  if (!half) hat(t + .25, .11, .35);
  if (t >= 12.5) { hat(t + .125, .05, -.4); hat(t + .375, .05, -.4); }
}
// bass 8ths, sustained in half-time
for (let t = 2.5; t < 15.49; t += .25) {
  const [root] = chordAt(t);
  if (t >= 9 && t < 12.5) { if (Math.abs((t - 9) % 2) < 1e-6) bass(t, 1.9, root, .16); continue; }
  bass(t, .2, root + (Math.round(t / .25) % 4 === 3 ? 12 : 0), .15);
}
// arps
for (let t = 2.5; t < 15.49; t += (t >= 12.5 ? .125 : .25)) {
  const notes = chordAt(t)[1], k = Math.round(t / .125);
  pluck(t, mtof(notes[k % notes.length] + 12), t >= 12.5 ? .045 : .035, (k % 2 ? .45 : -.45));
}

// 02 the tree
boom(2.5, .9);
for (let i = 0; i < 28; i++) tick(3.1 + i * .028, 1400 + i * 45, .05, -.8 + i * .057);
for (let r = 1; r < 28; r++) tick(4.0 + r * .038, 700 + r * 60, .03, (r % 2 ? .5 : -.5));
scan(5.0, .55, 300, 1400, .07);
alarm(5.18, .1); alarm(5.38, .12);
glitch(5.62, 6.02, .2); sweep(5.6, .42, 2000, 300, .2, { shape: 'bell' });

// 03 one letter
boom(6, .75);
bell(6.55, 1318.5, .13, .2, .6); sparkle(6.55, .4, 12, .04);
for (let k = 0; k < 14; k++) tick(6.85 + k * .03, 1760 + k * 30, .04, -.7 + k * .1);
for (let r = 1; r < 14; r++) tick(7.15 + r * .052, 900 + r * 70, .03, (r % 2 ? .4 : -.4));
scan(7.9, .38, 400, 1600, .06);
[880, 1108.7, 1318.5, 1760].forEach((f, i) => bell(8.42 + i * .04, f, .08, -.4 + i * .27, .6));
sweep(8.7, .3, 8000, 300, .25, { shape: 'rise', pan: [.6, 0] });

// 04 Núcleo Hermético
boom(9, 1);
[440, 523.3, 587.3, 659.3, 784].forEach((f, k) => bell(9.15 + k * .06, f * 2, .07, -.6 + k * .3, .6));
sparkle(9.95, .75, 14, .03);
bell(11.35, 1760, .08, 0, .7);
sweep(11.85, .65, 300, 7000, .32, { shape: 'rise', pan: [-.4, .4] });

// 05 montage
boom(12.5, .65);
sweep(13.28, .44, 500, 6000, .26, { pan: [-.9, .9] }); kick(13.5, .6);
bell(13.98, 1046.5, .08, .4, .5);
sweep(14.28, .44, 500, 6000, .26, { pan: [-.9, .9] }); kick(14.5, .6);
for (let i = 0; i < 16; i++) { const u = i / 16, t = 14.42 + .58 * (1 - Math.pow(1 - u, 2.2)); tick(t, 2400, .045, .3); }
bell(15.0, 659.3, .1, 0, .6); bell(15.0, 1318.5, .06, 0, .6);

// 06 offer
sweep(15.45, .35, 1500, 6000, .12, { pan: [0, 0] });
sweep(16.0, .25, 6000, 1200, .12, { shape: 'fall', pan: [-.5, .5] });
riser(15.6, 17.0, .32);
[[16.22, 16.7], [16.22, 16.8], [16.22, 16.9], [16.22, 17.0]].forEach(([a, b], c) => {
  for (let t = a, step = .03; t < b - .01; t += step, step *= 1.09) tick(t, 1900 + c * 180, .03, -.45 + c * .3);
  voice(b, .12, x => .18 * Math.sin(TAU * 140 * x) * Math.exp(-x * 30), -.45 + c * .3, .2);
});
boom(17.0, 1.2); kick(17.0, 1.1); kick(17.5, .8);
[1318.5, 1760, 2637].forEach((f, i) => bell(17.0 + i * .03, f, .06, -.4 + i * .4, .7));
[17.12, 17.21, 17.3].forEach((t, i) => tick(t, 1100 + i * 220, .07, -.4 + i * .4));
sweep(17.7, .4, 600, 8000, .25, { shape: 'rise', pan: [-.5, .5] });

// 07 end card
boom(18.0, .85); bass(18.0, 1.8, 33, .2);
[440, 523.3, 659.3, 987.8, 1318.5].forEach((f, i) => bell(18.05 + i * .11, f, .08, -.6 + i * .3, .7, 1.4));
for (let i = 0; i < 18; i++) bell(19.2 + i * .03, 1760 * Math.pow(2, i / 12 * .9), .025, -.6 + i * .07, .7, .5); // CTA shimmer

/* ---------- mix ---------- */
// sidechain: duck the music bus under every kick
const duck = new Float32Array(N).fill(1); kicks.sort((a, b) => a - b);
for (const k of kicks) { const i0 = Math.round(k * SR); for (let i = i0; i < Math.min(N, i0 + SR * .4); i++) duck[i] = Math.min(duck[i], 1 - .6 * Math.exp(-(i - i0) / SR * 10)); }
// Schroeder reverb on the send bus
function reverb(x, off) {
  const out = new Float32Array(N);
  [1557, 1617, 1491, 1422, 1277, 1356].forEach((d0, ci) => { const d = d0 + off, buf = new Float32Array(d); let p = 0, lp = 0;
    for (let i = 0; i < N; i++) { const y = buf[p]; lp = y * .75 + lp * .25; buf[p] = x[i] + lp * .84; out[i] += y / 6; p = (p + 1) % d; } });
  [225, 556, 441].forEach(d0 => { const d = d0 + off, buf = new Float32Array(d); let p = 0;
    for (let i = 0; i < N; i++) { const b = buf[p], y = -out[i] * .5 + b; buf[p] = out[i] + b * .5; out[i] = y; p = (p + 1) % d; } });
  return out;
}
const RvL = reverb(REV[0], 0), RvR = reverb(REV[1], 23);
const L = new Float32Array(N), R = new Float32Array(N); let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR, fade = Math.min(1, (DUR - t) / .7);
  L[i] = Math.tanh(1.15 * (FX[0][i] + MUS[0][i] * duck[i] + RvL[i] * .5)) * fade;
  R[i] = Math.tanh(1.15 * (FX[1][i] + MUS[1][i] * duck[i] + RvR[i] * .5)) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = .89 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { buf.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); buf.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
fs.writeFileSync(path.join(__dirname, 'reel.wav'), buf);
console.log('wrote reel.wav  peak', peak.toFixed(3));
