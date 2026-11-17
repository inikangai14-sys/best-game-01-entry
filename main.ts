// Neon Courier, a best-game-01 entry (Node 22, standard library only). The game
// is this directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, no library and no network
// request). This program hands it in: it copies game/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// The game: fly a courier drone over a neon city at night. Catch glowing
// parcels, chain them into combos, grab the gold ones, dodge storm drones and
// blackout towers, and survive rush hour. Three lives, a boost meter, a shield
// pickup, levels every eight deliveries. Title, play, pause and game-over
// screens, a HUD, and synthesised sound (WebAudio, no audio files).
//
// Serve it locally with any static server from game/, for example:
//   cd game && python3 -m http.server 8080
// then open http://localhost:8080. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

// A one-line summary on stdout, so a build log shows what was handed in
// without opening the dossier. This prints nothing into the output files.
const shots = existsSync(join(out, 'screenshots'))
  ? readdirSync(join(out, 'screenshots')).filter((name) => name.endsWith('.jpg') || name.endsWith('.png'))
  : [];
console.log(`neon-courier: wrote ${join(out, 'dossier.json')} (${dossier.length} bytes), ${shots.length} screenshot(s), game/ copied.`);
