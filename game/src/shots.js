// The screenshot scenes behind ?shot=start|play|rush|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (chase the nearest parcel, keep clear of storm drones and
// towers), so the frame is what a real game looks like and the same seed always
// gives the same frame. The play pilot looks well ahead and keeps its lives;
// the end pilot looks only a moment ahead, so it is caught out once things
// speed up, as a hurried player is.

import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const RUSH_LIMIT_SECONDS = 90;
const END_LIMIT_SECONDS = 600;
const HORIZON_PLAY = 1.2;
const HORIZON_END = 0.2;
const SAMPLE = 1 / 30;
/** The drone's top speed in px/s (world.js caps it here); the lookahead flies at this speed. */
const MAX_SPEED = 430;

/** The nearest parcel ahead of the drone, or null when the sky is empty. Parcels
 * already near the left edge are skipped: they are about to fly off anyway, and
 * chasing them drags the drone out of the frame. */
function nearestParcel(state) {
  let best = null;
  let bestScore = Infinity;
  for (const p of state.parcels) {
    if (!p.active || p.kind === 2 || p.x < 160) continue;
    const score = Math.abs(p.x - state.player.x) + Math.abs(p.y - state.player.y) * 0.6;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** True when the drone, flying toward (tx, ty) at its real top speed, would hit a hazard within `horizon` seconds. */
function dangerAhead(state, tx, ty, horizon) {
  const player = state.player;
  const dx = tx - player.x;
  const dy = ty - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const travel = Math.min(dist, MAX_SPEED * t);
    const x = player.x + ux * travel;
    const y = player.y + uy * travel;
    for (const s of state.storms) {
      if (!s.active) continue;
      const sx = s.x - s.speed * t;
      const sy = s.baseY + Math.sin((state.elapsed + t) * s.hz * Math.PI * 2 + s.phase) * s.amp;
      const ddx = x - sx;
      const ddy = y - sy;
      if (ddx * ddx + ddy * ddy < 52 * 52) return { up: sy > y };
    }
    for (const tower of state.towers) {
      if (!tower.active) continue;
      const tx0 = tower.x - state.worldSpeed * t;
      if (x > tx0 - 34 && x < tx0 + tower.width + 34 && y > tower.y - 34) return { up: true };
    }
  }
  return null;
}

/** Steer toward the nearest parcel (or `target`, when one is given), dodging whatever the lookahead finds. */
function autopilot(state, horizon, target = null) {
  const player = state.player;
  // A blackout tower ahead and low: climb early, before the lookahead even needs to.
  for (const tower of state.towers) {
    if (!tower.active) continue;
    if (tower.x > player.x - 20 && tower.x < player.x + 420 && player.y > tower.y - 70) {
      return { x: 0, y: -1, boost: false, pointer: null };
    }
  }
  const parcel = target === null ? nearestParcel(state) : null;
  const targetX = target !== null ? target.x : parcel === null ? FIELD.width / 2 : parcel.x;
  const targetY = target !== null ? target.y : parcel === null ? FIELD.height / 2 : parcel.y;
  const danger = dangerAhead(state, targetX, targetY, horizon);
  let x = 0;
  let y = 0;
  if (targetX > player.x + 10) x = 1;
  else if (targetX < player.x - 10) x = -1;
  if (danger !== null) {
    y = danger.up ? -1 : 1;
  } else if (targetY > player.y + 12) y = 1;
  else if (targetY < player.y - 12) y = -1;
  return { x, y, boost: false, pointer: null };
}

/**
 * Set `world` to the named scene (start, play, rush or end; any other name is
 * start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'rush' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0, boost: false, pointer: null }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      if (world.step(STEP, autopilot(world.state, HORIZON_END), false) & EVENT_OVER) break;
    }
    return { screen: SCREEN_OVER, best: 0 };
  }
  const limit = name === 'rush' ? RUSH_LIMIT_SECONDS : PLAY_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world.state, HORIZON_PLAY), false);
    if (events & EVENT_OVER) break;
    // The rush scene is the moment the level banner is up: stop just after it fires.
    if (name === 'rush' && world.state.level >= 2 && world.state.bannerTime > 0.4) break;
  }
  // The play scene ends with the drone flying home to mid-field, so the frame
  // shows it clearly instead of catching it half off an edge after a chase.
  if (name === 'play' && world.state.lives > 0) {
    for (let i = 0; i < 1.2 / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, HORIZON_PLAY, { x: FIELD.width / 2, y: 380 }), true);
    }
  }
  return { screen: world.state.lives === 0 ? SCREEN_OVER : SCREEN_PLAY, best: 0 };
}
