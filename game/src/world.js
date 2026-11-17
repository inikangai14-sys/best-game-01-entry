// Neon Courier's rules and state, with no drawing and no browser in it: the
// courier drone, the parcels, storm drones and blackout towers, spawning,
// collisions, score, combo, lives and levels. step() advances one fixed step
// and returns what happened as bit flags, so the caller can react (and play a
// sound) without the world knowing about screens or sound. Nothing here
// allocates after createWorld returns: every list is a pool built once.

import {
  DRONE, FIELD, LEVEL, LIVES, PARCEL, POOL, SHIELD, STORM, TOWER,
} from './config.js';

export const KIND_PARCEL = 0;
export const KIND_GOLDEN = 1;
export const KIND_STORM = 2;
export const KIND_TOWER = 3;

export const EVENT_PARCEL = 1;
export const EVENT_GOLDEN = 2;
export const EVENT_HIT = 4;
export const EVENT_SHIELD = 8;
export const EVENT_LEVEL = 16;
export const EVENT_OVER = 32;
export const EVENT_CLOSE = 64;

function circleRect(cx, cy, cr, rx, ry, rw, rh) {
  const nearX = Math.max(rx, Math.min(cx, rx + rw));
  const nearY = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nearX;
  const dy = cy - nearY;
  return dx * dx + dy * dy < cr * cr;
}

function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const reach = ar + br;
  return dx * dx + dy * dy < reach * reach;
}

export function createWorld(random) {
  const player = {
    x: 320, y: 360, vx: 0, vy: 0, radius: DRONE.radius,
    invulnerable: 0, shield: false, boost: 100,
  };
  const parcels = [];
  for (let i = 0; i < POOL.parcels; i += 1) {
    parcels.push({ active: false, kind: KIND_PARCEL, x: 0, y: 0, radius: 0, bob: 0, phase: 0 });
  }
  const storms = [];
  for (let i = 0; i < POOL.storms; i += 1) {
    storms.push({ active: false, x: 0, y: 0, baseY: 0, radius: STORM.radius, speed: 0, amp: 0, hz: 0, phase: 0, counted: false });
  }
  const towers = [];
  for (let i = 0; i < POOL.towers; i += 1) {
    towers.push({ active: false, x: 0, y: 0, width: 0, height: 0 });
  }
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff' });
  }
  const floaters = [];
  for (let i = 0; i < POOL.floaters; i += 1) {
    floaters.push({ active: false, x: 0, y: 0, text: '', life: 0, color: '#ffffff' });
  }

  // The city behind the game: stars and two rooftop skylines, laid out once from
  // the seed so the backdrop is the same every run and every screenshot.
  const stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: random() * FIELD.width, y: random() * 420, size: 1 + random() * 1.6, twinkle: random() * Math.PI * 2 });
  }
  function skyline(count, minW, maxW, minH, maxH) {
    const buildings = [];
    let x = 0;
    for (let i = 0; i < count; i += 1) {
      const width = minW + random() * (maxW - minW);
      const height = minH + random() * (maxH - minH);
      const lit = [];
      const rows = Math.floor(height / 34);
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < Math.floor(width / 26); c += 1) {
          if (random() < 0.28) lit.push({ dx: 8 + c * 26, dy: 12 + r * 34 });
        }
      }
      buildings.push({ x, width, height, lit });
      x += width + 4 + random() * 30;
    }
    return buildings;
  }
  const farCity = skyline(14, 60, 130, 90, 260);
  const nearCity = skyline(10, 90, 170, 140, 330);

  const state = {
    player, parcels, storms, towers, particles, floaters, stars, farCity, nearCity,
    score: 0, lives: LIVES, level: 1, deliveries: 0,
    combo: 1, comboTimer: 0, maxCombo: 1,
    elapsed: 0, parcelTimer: 0.6, stormTimer: 1.6, towerTimer: 2.0, shieldTimer: SHIELD.interval,
    shake: 0, banner: '', bannerTime: 0, worldSpeed: 170, scroll: 0,
  };

  function reset() {
    player.x = 320;
    player.y = 360;
    player.vx = 0;
    player.vy = 0;
    player.invulnerable = 0;
    player.shield = false;
    player.boost = 100;
    for (const p of parcels) p.active = false;
    for (const s of storms) s.active = false;
    for (const t of towers) t.active = false;
    for (const p of particles) p.active = false;
    for (const f of floaters) f.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.deliveries = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.maxCombo = 1;
    state.elapsed = 0;
    state.parcelTimer = 0.6;
    state.stormTimer = 1.6;
    state.towerTimer = 2.0;
    state.shieldTimer = SHIELD.interval;
    state.shake = 0;
    state.banner = '';
    state.bannerTime = 0;
    state.worldSpeed = 170;
    state.scroll = 0;
  }

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const angle = random() * Math.PI * 2;
      const power = speed * (0.4 + random() * 0.8);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * power;
      p.vy = Math.sin(angle) * power;
      p.maxLife = 0.35 + random() * 0.35;
      p.life = p.maxLife;
      p.size = 2 + random() * 3;
      p.color = color;
    }
  }

  function floatText(x, y, text, color) {
    const f = free(floaters);
    if (f === null) return;
    f.active = true;
    f.x = x;
    f.y = y;
    f.text = text;
    f.life = 1;
    f.color = color;
  }

  function spawnParcel() {
    const p = free(parcels);
    if (p === null) return;
    p.active = true;
    p.kind = random() < PARCEL.goldenChance ? KIND_GOLDEN : KIND_PARCEL;
    p.radius = p.kind === KIND_GOLDEN ? PARCEL.goldenRadius : PARCEL.radius;
    p.x = FIELD.width + 40;
    p.y = 70 + random() * 530;
    p.bob = 0;
    p.phase = random() * Math.PI * 2;
  }

  function spawnStorm() {
    const s = free(storms);
    if (s === null) return;
    s.active = true;
    s.x = FIELD.width + 40;
    s.baseY = 80 + random() * 480;
    s.y = s.baseY;
    s.speed = state.worldSpeed * STORM.speedScale * (0.9 + random() * 0.25);
    s.amp = 30 + random() * STORM.wobbleAmp;
    s.hz = 0.8 + random() * STORM.wobbleHz;
    s.phase = random() * Math.PI * 2;
    s.counted = false;
  }

  function spawnTower() {
    const t = free(towers);
    if (t === null) return;
    t.active = true;
    t.width = TOWER.minWidth + random() * (TOWER.maxWidth - TOWER.minWidth);
    t.height = TOWER.minHeight + random() * (TOWER.maxHeight - TOWER.minHeight);
    t.x = FIELD.width + 20;
    t.y = FIELD.groundY - t.height;
  }

  function spawnShield() {
    const p = free(parcels);
    if (p === null) return;
    p.active = true;
    p.kind = 2; // a shield pickup rides the parcel pool as kind 2
    p.radius = SHIELD.radius;
    p.x = FIELD.width + 40;
    p.y = 90 + random() * 480;
    p.bob = 0;
    p.phase = random() * Math.PI * 2;
  }

  function levelSpeed() {
    return 170 + 18 * (state.level - 1);
  }

  function takeHit(events) {
    if (player.shield) {
      player.shield = false;
      player.invulnerable = DRONE.invulnerable;
      state.shake = 0.45;
      burst(player.x, player.y, '#67e8f9', 22, 260);
      floatText(player.x, player.y - 34, 'SHIELD DOWN', '#67e8f9');
      return events | EVENT_SHIELD;
    }
    state.lives -= 1;
    state.combo = 1;
    state.comboTimer = 0;
    player.invulnerable = DRONE.invulnerable;
    state.shake = 0.6;
    burst(player.x, player.y, '#fb7185', 26, 320);
    if (state.lives === 0) return events | EVENT_HIT | EVENT_OVER;
    return events | EVENT_HIT;
  }

  /**
   * One fixed step. `control` is { x, y, boost, pointer } — x/y the held-key
   * steering (-1..1 each), boost whether Shift is held, pointer the mouse target
   * in field coordinates (or null). With `harmless` set (the title screen's
   * backdrop) things drift but nothing touches the player and nothing scores.
   */
  function step(dt, control, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.scroll += state.worldSpeed * dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.bannerTime > 0) state.bannerTime = Math.max(0, state.bannerTime - dt);

    // The drone: keyboard steering, or the pointer when the mouse moved lately.
    if (harmless) {
      player.x = 320;
      player.y = 360 + Math.sin(state.elapsed * 1.2) * 28;
      player.vx = 0;
      player.vy = 0;
    } else {
      let ax = control.x * DRONE.accel;
      let ay = control.y * DRONE.accel;
      if (control.x === 0 && control.y === 0 && control.pointer !== null) {
        const dx = control.pointer.x - player.x;
        const dy = control.pointer.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 12) {
          ax = (dx / dist) * DRONE.accel * 0.9;
          ay = (dy / dist) * DRONE.accel * 0.9;
        }
      }
      const boosting = control.boost && player.boost > DRONE.boostMin;
      if (boosting) player.boost = Math.max(0, player.boost - DRONE.boostDrain * dt);
      else player.boost = Math.min(100, player.boost + DRONE.boostRefill * dt);
      const max = boosting ? DRONE.boostSpeed : DRONE.maxSpeed;
      player.vx += ax * dt;
      player.vy += ay * dt;
      player.vx *= DRONE.damping;
      player.vy *= DRONE.damping;
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > max) {
        player.vx = (player.vx / speed) * max;
        player.vy = (player.vy / speed) * max;
      }
      player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
      player.y = Math.min(FIELD.groundY - player.radius, Math.max(player.radius, player.y + player.vy * dt));
      if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
      // Engine trail while moving fast.
      if (speed > 220 && Math.floor(state.elapsed * 60) % 2 === 0) {
        const p = free(particles);
        if (p !== null) {
          p.active = true;
          p.x = player.x - player.vx * 0.03;
          p.y = player.y + 10;
          p.vx = -player.vx * 0.1;
          p.vy = 20 + random() * 20;
          p.maxLife = 0.3;
          p.life = 0.3;
          p.size = 2.5;
          p.color = '#22d3ee';
        }
      }
    }

    // Combo clock: let it run out and the streak is gone.
    if (state.comboTimer > 0) {
      state.comboTimer = Math.max(0, state.comboTimer - dt);
      if (state.comboTimer === 0) state.combo = 1;
    }

    // Spawning.
    state.parcelTimer -= dt;
    if (state.parcelTimer <= 0) {
      spawnParcel();
      state.parcelTimer += Math.max(PARCEL.minInterval, PARCEL.interval * PARCEL.intervalScale ** (state.level - 1));
    }
    state.stormTimer -= dt;
    if (state.stormTimer <= 0) {
      spawnStorm();
      state.stormTimer += Math.max(STORM.minInterval, STORM.interval * STORM.intervalScale ** (state.level - 1));
    }
    state.towerTimer -= dt;
    if (state.towerTimer <= 0) {
      spawnTower();
      state.towerTimer += Math.max(TOWER.minInterval, TOWER.interval * TOWER.intervalScale ** (state.level - 1));
    }
    if (!player.shield) {
      state.shieldTimer -= dt;
      if (state.shieldTimer <= 0) {
        spawnShield();
        state.shieldTimer = SHIELD.interval;
      }
    }

    // Parcels drift left and bob; collect them, or watch them fly past.
    for (const p of parcels) {
      if (!p.active) continue;
      p.x -= state.worldSpeed * dt;
      p.bob = Math.sin(state.elapsed * 3 + p.phase) * 6;
      if (p.x < -40) {
        p.active = false;
        if (!harmless && p.kind !== 2) {
          state.combo = 1;
          state.comboTimer = 0;
        }
        continue;
      }
      if (harmless) continue;
      if (!circleHit(player.x, player.y, player.radius, p.x, p.y + p.bob, p.radius)) continue;
      p.active = false;
      if (p.kind === 2) {
        player.shield = true;
        burst(p.x, p.y, '#67e8f9', 14, 200);
        floatText(p.x, p.y - 24, 'SHIELD UP', '#67e8f9');
        events |= EVENT_SHIELD;
        continue;
      }
      const golden = p.kind === KIND_GOLDEN;
      const points = (golden ? PARCEL.goldenPoints : PARCEL.basePoints) * state.combo;
      state.score += points;
      state.deliveries += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.combo = Math.min(PARCEL.maxCombo, state.combo + 1);
      state.comboTimer = PARCEL.comboSeconds;
      burst(p.x, p.y, golden ? '#fde047' : '#fbbf24', golden ? 20 : 12, 240);
      floatText(p.x, p.y - 24, `+${points}`, golden ? '#fde047' : '#fbbf24');
      events |= golden ? EVENT_GOLDEN : EVENT_PARCEL;
      const level = Math.min(LEVEL.max, 1 + Math.floor(state.deliveries / LEVEL.deliveries));
      if (level !== state.level) {
        state.level = level;
        state.worldSpeed = levelSpeed();
        state.banner = level >= 4 ? `LEVEL ${level} — STORM SURGE` : `LEVEL ${level} — RUSH HOUR`;
        state.bannerTime = 2;
        events |= EVENT_LEVEL;
      }
    }

    // Storm drones patrol across; a close pass without a hit is a near miss.
    for (const s of storms) {
      if (!s.active) continue;
      s.x -= s.speed * dt;
      s.y = s.baseY + Math.sin(state.elapsed * s.hz * Math.PI * 2 + s.phase) * s.amp;
      if (s.x < -50) {
        s.active = false;
        continue;
      }
      if (harmless) continue;
      if (!s.counted && !circleHit(player.x, player.y, player.radius, s.x, s.y, s.radius)) {
        const d = Math.hypot(player.x - s.x, player.y - s.y);
        if (d < STORM.nearMiss + s.radius) {
          s.counted = true;
          state.score += STORM.nearMissPoints;
          floatText(player.x, player.y - 30, `CLOSE! +${STORM.nearMissPoints}`, '#f472b6');
          events |= EVENT_CLOSE;
        }
      }
      if (player.invulnerable === 0 && circleHit(player.x, player.y, player.radius, s.x, s.y, s.radius)) {
        s.active = false;
        events = takeHit(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // Blackout towers scroll in; the drone threads over them or around them.
    for (const t of towers) {
      if (!t.active) continue;
      t.x -= state.worldSpeed * dt;
      if (t.x + t.width < 0) {
        t.active = false;
        continue;
      }
      if (harmless) continue;
      if (player.invulnerable === 0 && circleRect(player.x, player.y, player.radius, t.x, t.y, t.width, t.height)) {
        events = takeHit(events);
        if (events & EVENT_OVER) return events;
      }
    }

    // Particles and floaters age out.
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    for (const f of floaters) {
      if (!f.active) continue;
      f.life -= dt * 0.8;
      if (f.life <= 0) {
        f.active = false;
        continue;
      }
      f.y -= 42 * dt;
    }
    return events;
  }

  reset();
  return { state, reset, step };
}
