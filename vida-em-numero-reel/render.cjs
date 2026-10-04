// Renders reel.html frame-by-frame with headless Chromium, then muxes with reel.wav via ffmpeg.
// Usage: node render.cjs [--frames 0,45,300] [--out frames_dir] [--workers 4]
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }

const ROOT = __dirname, FPS = 30, DUR = 20, TOTAL = FPS * DUR;
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') && a.push([v.slice(2), arr[i + 1]]), a), []));
const OUT = path.resolve(args.out || path.join(ROOT, 'frames'));
const WORKERS = +(args.workers || 4);
const only = args.frames ? args.frames.split(',').map(Number) : null;
const TYPES = { '.html': 'text/html', '.woff2': 'font/woff2', '.wav': 'audio/wav' };

const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/reel.html?render`;
  const browser = await chromium.launch({ args: ['--disable-web-security'] });
  const frames = only || [...Array(TOTAL).keys()];
  const t0 = Date.now(); let done = 0;
  await Promise.all([...Array(WORKERS).keys()].map(async w => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', e => console.error('pageerror', e.message));
    await page.goto(url); await page.evaluate(() => window.ready);
    for (let i = w; i < frames.length; i += WORKERS) {
      const f = frames[i];
      const b64 = await page.evaluate(t => { window.render(t); return document.getElementById('c').toDataURL('image/png').split(',')[1]; }, f / FPS);
      fs.writeFileSync(path.join(OUT, `f${String(f).padStart(4, '0')}.png`), Buffer.from(b64, 'base64'));
      if (++done % 50 === 0) console.log(`${done}/${frames.length} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
  await browser.close(); server.close();
  if (only) return;
  const wav = path.join(ROOT, 'reel.wav'), mp4 = path.join(ROOT, 'vida-em-numero-reel.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(OUT, 'f%04d.png'),
    ...(fs.existsSync(wav) ? ['-i', wav] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-tune', 'animation', ...(fs.existsSync(wav) ? ['-c:a', 'aac', '-b:a', '256k', '-shortest'] : []), '-movflags', '+faststart', mp4], { stdio: 'inherit' });
  console.log('wrote', mp4);
})();
