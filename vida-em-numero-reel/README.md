# Vida em Número: 20s motion reel

A 1920×1080, 30 fps showreel spot for [vidaemnumero.com/oferta3](https://www.vidaemnumero.com/oferta3), the Mapa Numerológico Interativo offer.

**Output:** `vida-em-numero-reel.mp4` (H.264 + AAC, 20.0 s)

Every frame is drawn in code on a 2D canvas. The soundtrack is synthesized in code and locked to the same timeline. No stock footage, templates or samples are used.

## Storyboard

| Time | Scene | What happens |
|---|---|---|
| 0.0–2.5 | **Seu nome é um número** | A gold hairline ignites and 150 digits burst into a vortex. They settle into a numerological dial, then the camera dives through the title. |
| 2.5–6.0 | **A Árvore** | "Caroline Paola Oliveira da Silva" turns letter by letter into the site's own letter values, and the 406-digit Árvore cascades down. A scan laser finds the real **444 · 222** negative sequences. Glitch cut. |
| 6.0–9.0 | **Uma letra muda tudo** | Unused letters fall away. The rest fly into "Paolla Oliveira", and a single gold **L** arrives with a flare. The tree rebuilds clean and the verdict reads ✓ *Sem sequência negativa*. The scene implodes into a point. |
| 9.0–12.5 | **Núcleo Hermético** | The five core numbers orbit in 3D, tilt to face the camera and form a pentagram. The camera dives into *Destino*. |
| 12.5–15.5 | **O mapa por dentro** | A fast montage of Linha do Tempo (three cycles), Calendário Pessoal and Ano Pessoal (a slot-roll digit), joined by diagonal gold wipes. |
| 15.5–18.0 | **A oferta** | R$ 149,00 is struck through. A slot-machine roll lands on **R$ 49,90** with a shockwave and sparks, followed by the badges: economia R$ 99,10, Pix ou cartão, 7 dias de garantia. |
| 18.0–20.0 | **End card** | The brand mark draws itself, the wordmark tightens its tracking, and the gold CTA "Quero meu Mapa Completo" gets a shimmer pass, followed by the URL. |

The numerology is real. The letter table (A=1, C=3, F=8, O=7, P=8 …) and the reduction rule were reverse-engineered from the live offer page. The trees and their 444/222 sequences match what the page shows.

Brand tokens come from the site's CSS: `#0a0a0f` background, `#d4be7e` gold, `#7c3aed` violet, `#93c5fd` cycles blue, `#c4b5fd` personal lavender, and the Cinzel, Cormorant Garamond and Inter fonts (OFL, bundled in `fonts/`).

## Craft notes

- **Motion blur:** each frame averages 5 sub-frames across a 180° shutter.
- **Post stack:** two-pass bloom, chromatic aberration driven by impacts, glitch slicing, vignette, animated film grain and impact flashes.
- **Camera:** impact-driven shake, push-ins, a dive-through zoom and an implode transition.
- **Easing:** expo, back and cubic curves throughout, with per-character masked type reveals that keep kerning intact.
- **Sound:** 120 BPM in A minor (Am–F–C–G, then E → Am9 for the resolve). It has a kick sidechained against pads, bass and arps, plus booms, whooshes, risers, slot ticks, glitch bursts, bells and a Schroeder reverb. All hits land on the cuts.

## Rebuild

```bash
npm i playwright        # or use a preinstalled one
node audio.cjs          # -> reel.wav
node render.cjs         # -> frames/ + vida-em-numero-reel.mp4 (needs ffmpeg)
```

For a live preview, serve this folder (for example `npx serve .`), open `reel.html` and click. It plays in real time with the soundtrack.
