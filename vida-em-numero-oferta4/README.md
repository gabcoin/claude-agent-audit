# Vida em Número, Oferta 4: 26-second direct-response reel

A 1920×1080, 30 fps spot for [vidaemnumero.com/oferta4](https://www.vidaemnumero.com/oferta4). It follows the page's own copy and arc: hook, pain, reframe, mechanism, proof, offer stack and CTA. Every frame is drawn in code on a canvas.

**Output:** `vida-em-numero-oferta4.mp4` (H.264 + AAC, 26.0 s)

## Storyboard

| Time | Scene | Beat |
|---|---|---|
| 0–3 | **O gancho** | "SEU NOME ESTÁ AFASTANDO" lands, then **DINHEIRO** and **E AMOR?** slam in and their letters drift apart while coins and hearts are pushed off screen. "Veja agora, na tela, onde." |
| 3–6 | **As cenas** | Four 0.75 s cuts from the page: the day counter runs 20 → 30 while the money bar drains; the spotlight slides off "você"; a heartbeat flatlines in week 3; a progress bar freezes at 78% and glitches. |
| 6–7.5 | **Não é culpa sua** | The beat drops out under felt-piano chords. "Você fez tudo certo." |
| 7.5–10.5 | **O ímã** | "BIA SILVA" becomes a magnet: traced dipole field lines, iron filings settling and coins and hearts pulled in. "Você é um ímã. E o seu nome decide o que ele puxa." |
| 10.5–15.5 | **A árvore da Bia** | The page's worked example, computed live. The tree builds, **444** is flagged, and Expressão 9 (2+1+1+3+1+3+6+1 = 18) clashes with Destino 4 (06/01/1986 = 31). SILVA falls away, the tree becomes 2 1 1 / 3 2 / 5 and **4 = 4 · ALINHADO**. |
| 15.5–18 | **Sem cartório** | A split-flap board flips from registered names to the names people use (Anitta, Bruna Marquezine, Paolla Oliveira: 444 · 222 → zero). The ★★★★★ counter rolls to 23.847 mapas. |
| 18–22 | **Tudo o que você leva** | Bonus cards stack while the running total counts R$ 67 → 149, which is struck through before **R$ 49,90** lands with a shockwave. "Menos que uma pizza de sábado à noite." |
| 22–26 | **Em 1 minuto** | A phone mock-up: type the name and date, tap, the tree drops in and shows "NOME CORRIGIDO: BIA". End card with the gold CTA "QUERO VER A ENERGIA DO MEU NOME →", price, guarantee and URL. |

Every number on screen comes from the site's letter table and reduction rule, and matches the page.

## Sound

`audio.cjs` writes a 120 BPM score that moves from D minor to F major, with a sidechained kick, bass, plucks, pads, risers and a drop.

The 22 sound-effect cues live in `sfx.json`:
- **With ElevenLabs:** `elevenlabs.cjs` generates each cue into `sfx/<id>.mp3`, and `audio.cjs` uses those files when they exist.
- **Without them:** each cue falls back to a procedural stand-in.

```bash
export ELEVENLABS_API_KEY=...         # never commit the key
node elevenlabs.cjs                   # needs api.elevenlabs.io allowed by the network
node audio.cjs                        # -> reel.wav ("elevenlabs sfx used: N/22")
node render.cjs                       # -> vida-em-numero-oferta4.mp4 (needs ffmpeg + playwright)
```

To swap in new sound without re-rendering the frames, re-run `audio.cjs`, then mux with ffmpeg: `ffmpeg -i vida-em-numero-oferta4.mp4 -i reel.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest out.mp4`.
