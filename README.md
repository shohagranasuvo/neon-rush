# NEON RUSH

A polished futuristic browser survival racer. Ride a hover-bike down a three-lane night grid, dodge gates and drones, stack shard combos, and beat your own ghost.

**Outrun the grid. Don't blink.**

## Play

- Local: `npm install && npm run dev` then open the printed URL (usually `http://localhost:5173`)
- Production preview: `npm run build && npm run preview`

## Features

- 3-lane hover-bike runner with jump, slide, and lane switch
- Procedural city, stars, scanlines, particles, and screen shake
- Combo / rush multiplier, shield (Aegis), magnet (Pull)
- Rising speed and denser obstacle patterns
- Main menu, how-to, settings, pause, game over
- Procedural synth (Web Audio) — no audio files required
- Persistent high score, best combo, run count, and settings (`localStorage`)
- Quality / reduced-motion / mute options
- Touch: tap left/right thirds to switch lanes, top to jump, bottom to slide

## Controls

| Action | Keys | Touch |
| --- | --- | --- |
| Lane left / right | `A` `D` or `←` `→` | tap left / right third |
| Jump | `W` `Space` `↑` | tap upper third |
| Slide | `S` `↓` `Ctrl` | tap lower third |
| Pause | `Esc` `P` | pause button via overlay |
| Mute | `M` | settings |
| Start / retry | `Enter` `Space` | Ride button |

## Gameplay

Survive as long as you can. Low gates need a jump. High beams need a slide. Barriers and drones eat a life unless Aegis is up. Shards feed a rush multiplier that decays if you miss. Three hits and the grid takes you.

## Tech stack

- TypeScript
- Vite
- HTML5 Canvas 2D
- Web Audio API (procedural)
- Vitest
- localStorage

## Architecture

```
src/
  engine/     game loop, input, math, object pool
  game/       simulation, entities, audio, save, config
  render/     canvas renderer (perspective road, city, FX)
  ui/         HUD and menus
  main.ts     wiring: loop, audio, persistence
```

Simulation is decoupled from rendering so the world can be unit-tested without a browser.

## Scripts

```bash
npm install
npm run dev      # live game
npm test         # vitest
npm run build    # tsc + vite production build
npm run preview  # serve dist/
```

## License

MIT. Type: [Syne](https://fonts.google.com/specimen/Syne) and [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) via Google Fonts (SIL OFL). All game art and audio are original / procedural — no copyrighted game assets.
