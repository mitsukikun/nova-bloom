# NOVA BLOOM — Make the best game (best-game-01)

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mitsukikun/nova-bloom/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mitsukikun/nova-bloom/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A twin-stick arena survival roguelite in pure vanilla JS. No libraries, no
build step, no network request: `game/index.html` opens in desktop Chrome and
just plays.

## The game

You are Bloom, the last seed-ship, defending the garden against the Hollow.
Survive **10 waves** and slay the **Hollow Sovereign** on wave 10 to win.

- **Move** WASD / arrows, **aim** with the mouse, **hold click or Space** to fire.
- **Dash** (Shift / right-click) with brief invulnerability; dashing through
  enemies with Thorn Nova hurts them.
- **5 enemy kinds**: mote chasers, darter lungers (with a telegraph), splitters
  that burst into 3 motes, ranged spitters, and gold-ringed elites — plus two
  bosses: the **Hollow Warden** (wave 5) and the **Hollow Sovereign** (wave 10),
  with radial bursts, aimed fans, summons, spirals, and an enrage under 35% HP.
- **Level up** by collecting XP shards and draft 1 of 3 upgrades from a pool of
  12 (fire rate, twin shots, damage, speed, dash, magnet, max HP, thorn nova,
  ricochet, crit, regrowing shield, bomb seed).
- **Combo multiplier** for chained kills, heart and nova pickups, hit-stop,
  screen shake, particles, floating damage numbers, and a synthesized WebAudio
  soundtrack (bass pulse + SFX, no audio files).

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

## Screenshots

Deterministic staged scenes, produced by the game's own code stepping itself
with an autopilot (`game/src/shots.js`). Open one in the browser and capture
it at 1280x720:

- `?shot=start&seed=1` — the title screen (the cover)
- `?shot=play&seed=1` — mid-combat, wave 4
- `?shot=end&seed=1` — the real game-over screen

The same seed always stages the same scene, so the shots are reproducible.
The three JPEGs in `screenshots/` are those scenes, each under 256 KiB.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/dossier.json
```

`main.ts` copies `game/` and `screenshots/` to `/output` (or
`$MAKEFUN_OUTPUT_DIR`) and writes `dossier.json` with the vendored make.fun
library (`vendor/makefun-game.ts`, unchanged from the kit).

## Layout

```
game/
  index.html            the page; loads src/main.js as an ES module
  src/
    config.js           tuning: field, player, enemies, waves, palette
    random.js           seeded RNG (mulberry32) — every run is reproducible
    input.js            keyboard + mouse, one-shot action queues
    audio.js            synthesized WebAudio SFX + bass pulse
    particles.js        bursts, rings, floating text, shake, hit-stop
    player.js           movement, dash, firing, damage, shield regen
    enemies.js          the 5 enemy kinds + both boss patterns
    projectiles.js      friendly and hostile bullets, ricochet
    pickups.js          XP shards, hearts, nova seeds, magnet
    upgrades.js         the 12-upgrade draft pool
    world.js            game state, wave director, screens, scoring
    render.js           all drawing: garden, entities, HUD, menus
    shots.js            deterministic staged scenes + autopilot
    main.js             boot, fixed-step loop, click-to-pick cards
main.ts                 copies game/ + screenshots/ to /output, writes dossier
serve.ts                tiny static server for local play
screenshots/            3 staged renders (1-start is the cover)
LICENSE                 MIT
```

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=3fk7ms5j&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
