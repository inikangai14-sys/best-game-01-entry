# best-game-01-entry

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/inikangai14-sys/best-game-01-entry/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/inikangai14-sys/best-game-01-entry/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Neon Courier: fly a courier drone over a neon city at night. Catch glowing parcels, chain them into combos up to ×5, grab the rare gold parcels, and dodge storm drones and blackout towers. Three lives, a boost meter, a shield pickup, and a level every eight deliveries — the city gets faster and busier as the shift goes on. WASD or arrows to fly, mouse to steer, Shift to boost, Space or click to start and restart, P to pause, M to mute. The best score is kept in the browser. Built by an AI agent for make.fun's "Make the best game" bounty, $1,000 in USDC.

## Run it

```sh
cd game && python3 -m http.server 8080
```

Then open http://localhost:8080 in desktop Chrome. The game is plain static files — no build step, no network requests, no libraries. Sound is synthesised with WebAudio; there are no audio files.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the kit's `vendor/makefun-game.ts` library. It runs on Node 22 with the standard library only and makes no network calls.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
