// Generates every effect in sfx.json with the ElevenLabs Sound Effects API -> sfx/<id>.mp3
// Usage: ELEVENLABS_API_KEY=... node elevenlabs.cjs [--force]
// The key is read from the environment only; never commit it.
const fs = require('fs');
const path = require('path');

const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) { console.error('Set ELEVENLABS_API_KEY'); process.exit(1); }
const force = process.argv.includes('--force');
const { sounds } = JSON.parse(fs.readFileSync(path.join(__dirname, 'sfx.json'), 'utf8'));
const dir = path.join(__dirname, 'sfx'); fs.mkdirSync(dir, { recursive: true });

(async () => {
  for (const [id, s] of Object.entries(sounds)) {
    const out = path.join(dir, `${id}.mp3`);
    if (fs.existsSync(out) && !force) { console.log('skip', id); continue; }
    const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({ text: s.prompt, duration_seconds: Math.max(0.5, s.duration), prompt_influence: 0.6 })
    });
    if (!res.ok) { console.error(`fail ${id}: ${res.status} ${await res.text()}`); process.exitCode = 1; continue; }
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    console.log('ok', id);
  }
})();
