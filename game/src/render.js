// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. The night city is drawn from the world's seeded
// skylines, so the backdrop is the same every run. Glow is a pre-rendered
// radial sprite per colour, drawn with drawImage: fast, and it reads at a glance.

import { DRONE, FIELD, FONT, LIVES, PALETTE, PARCEL, STORM } from './config.js';
import { KIND_GOLDEN } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 120, line: 36, bottom: 64 };

function roundRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, ratio: 1 };

  /** One glow sprite per colour, rendered once and stamped wherever a glow is needed. */
  const glows = new Map();
  function glow(color) {
    if (!glows.has(color)) {
      const size = 96;
      const sprite = document.createElement('canvas');
      sprite.width = size;
      sprite.height = size;
      const g = sprite.getContext('2d');
      const gradient = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.35, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.55;
      g.fillStyle = gradient;
      g.fillRect(0, 0, size, size);
      glows.set(color, sprite);
    }
    return glows.get(color);
  }
  function stampGlow(color, x, y, size) {
    const sprite = glow(color);
    context.drawImage(sprite, x - size / 2, y - size / 2, size, size);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.ratio = ratio;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || 400}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || 400} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  /** CSS pixels (what the pointer reports) into field coordinates. */
  function fieldPoint(cssX, cssY) {
    return {
      x: (cssX * view.ratio - view.x) / view.scale,
      y: (cssY * view.ratio - view.y) / view.scale,
    };
  }

  function skylineWidth(buildings) {
    const last = buildings[buildings.length - 1];
    return last.x + last.width;
  }

  function drawSkyline(buildings, color, parallax, scroll, windowColor) {
    const total = skylineWidth(buildings);
    const offset = (scroll * parallax) % total;
    context.fillStyle = color;
    for (let pass = 0; pass < 2; pass += 1) {
      const base = -offset + pass * total;
      for (const b of buildings) {
        const x = base + b.x;
        if (x + b.width < -20 || x > FIELD.width + 20) continue;
        context.fillRect(x, FIELD.groundY - b.height, b.width, b.height);
        if (windowColor) {
          context.fillStyle = windowColor;
          for (const w of b.lit) context.fillRect(x + w.dx, FIELD.groundY - b.height + w.dy, 9, 12);
          context.fillStyle = color;
        }
      }
    }
  }

  function drawField(state) {
    // Sky.
    const sky = context.createLinearGradient(0, 0, 0, FIELD.height);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = sky;
    context.fillRect(0, 0, FIELD.width, FIELD.height);

    // Stars, twinkling on the seeded clock.
    for (const s of state.stars) {
      context.globalAlpha = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(state.elapsed * 2 + s.twinkle));
      context.fillStyle = '#dfe6ff';
      context.fillRect(s.x, s.y, s.size, s.size);
    }
    context.globalAlpha = 1;

    // Moon, between the combo line and the level readout, clear of both.
    stampGlow(PALETTE.moon, 980, 95, 190);
    context.fillStyle = PALETTE.moon;
    context.beginPath();
    context.arc(980, 95, 34, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(11,16,38,0.25)';
    context.beginPath();
    context.arc(1108, 100, 8, 0, Math.PI * 2);
    context.arc(1130, 118, 5, 0, Math.PI * 2);
    context.fill();

    // Two skylines, far slow and near faster, then the rooftop line.
    drawSkyline(state.farCity, PALETTE.farCity, 0.25, state.scroll, '#ffd166');
    drawSkyline(state.nearCity, PALETTE.nearCity, 0.6, state.scroll, '#22d3ee');
    context.fillStyle = PALETTE.rooftop;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    context.fillStyle = '#2c3766';
    context.fillRect(0, FIELD.groundY, FIELD.width, 3);

    // Towers: blackout buildings with a blinking beacon.
    for (const t of state.towers) {
      if (!t.active) continue;
      context.fillStyle = '#0d1230';
      context.fillRect(t.x, t.y, t.width, t.height);
      context.fillStyle = '#fbbf24';
      for (let x = t.x + 4; x < t.x + t.width - 8; x += 16) context.fillRect(x, t.y, 8, 6);
      const blink = 0.5 + 0.5 * Math.sin(state.elapsed * 5 + t.x);
      context.globalAlpha = 0.4 + 0.6 * blink;
      context.fillStyle = PALETTE.towerBeacon;
      context.beginPath();
      context.arc(t.x + t.width / 2, t.y - 6, 5, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }

    // Parcels: glowing boxes with a tape cross; gold ones burn brighter.
    for (const p of state.parcels) {
      if (!p.active) continue;
      const y = p.y + p.bob;
      const golden = p.kind === KIND_GOLDEN;
      const shield = p.kind === 2;
      const color = shield ? PALETTE.shield : golden ? PALETTE.golden : PALETTE.parcel;
      stampGlow(color, p.x, y, golden ? 110 : 84);
      context.save();
      context.translate(p.x, y);
      context.rotate(Math.sin(state.elapsed * 2 + p.phase) * 0.12);
      if (shield) {
        context.strokeStyle = color;
        context.lineWidth = 4;
        context.beginPath();
        context.arc(0, 0, p.radius, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = color;
        context.beginPath();
        context.arc(0, 0, 6, 0, Math.PI * 2);
        context.fill();
      } else {
        context.fillStyle = golden ? '#fef08a' : '#fcd34d';
        roundRectPath(context, -p.radius, -p.radius, p.radius * 2, p.radius * 2, 5);
        context.fill();
        context.strokeStyle = golden ? '#a16207' : '#92400e';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(-p.radius, 0);
        context.lineTo(p.radius, 0);
        context.moveTo(0, -p.radius);
        context.lineTo(0, p.radius);
        context.stroke();
      }
      context.restore();
    }

    // Storm drones: dark discs with a red eye and a spinning rotor.
    for (const s of state.storms) {
      if (!s.active) continue;
      stampGlow(PALETTE.stormEye, s.x, s.y, 70);
      context.fillStyle = '#1e2438';
      context.beginPath();
      context.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#fb7185';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      context.stroke();
      const rotor = state.elapsed * 22 + s.phase;
      context.strokeStyle = 'rgba(251,113,133,0.9)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(s.x - Math.cos(rotor) * 20, s.y - 14 - Math.sin(rotor) * 4);
      context.lineTo(s.x + Math.cos(rotor) * 20, s.y - 14 + Math.sin(rotor) * 4);
      context.stroke();
      context.fillStyle = PALETTE.stormEye;
      context.beginPath();
      context.arc(s.x, s.y, 5, 0, Math.PI * 2);
      context.fill();
    }

    // The courier drone: glow, body, dome, rotors, engine trail already in particles.
    const player = state.player;
    const blink = player.invulnerable > 0 && Math.floor(state.elapsed * 12) % 2 === 0;
    stampGlow(PALETTE.drone, player.x, player.y, 120);
    if (player.shield) {
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 3;
      context.globalAlpha = 0.7 + 0.3 * Math.sin(state.elapsed * 6);
      context.beginPath();
      context.arc(player.x, player.y, player.radius + 10, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
    if (!blink) {
      const speed = Math.hypot(player.vx, player.vy);
      if (speed > DRONE.maxSpeed) {
        const flicker = 8 + 6 * Math.sin(state.elapsed * 47);
        context.fillStyle = '#f97316';
        context.beginPath();
        context.moveTo(player.x - player.vx * 0.04 - 8, player.y + 6);
        context.lineTo(player.x - player.vx * 0.04 - 26 - flicker, player.y + 14);
        context.lineTo(player.x - player.vx * 0.04 - 8, player.y + 22);
        context.closePath();
        context.fill();
      }
      context.fillStyle = PALETTE.droneDark;
      roundRectPath(context, player.x - 22, player.y - 10, 44, 20, 9);
      context.fill();
      context.fillStyle = PALETTE.drone;
      roundRectPath(context, player.x - 18, player.y - 12, 36, 16, 8);
      context.fill();
      context.fillStyle = '#a5f3fc';
      context.beginPath();
      context.arc(player.x + 4, player.y - 6, 7, 0, Math.PI * 2);
      context.fill();
      const rotor = state.elapsed * 30;
      context.strokeStyle = 'rgba(165,243,252,0.85)';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(player.x - 16 - Math.cos(rotor) * 10, player.y - 16);
      context.lineTo(player.x - 16 + Math.cos(rotor) * 10, player.y - 16);
      context.moveTo(player.x + 16 - Math.cos(rotor) * 10, player.y - 16);
      context.lineTo(player.x + 16 + Math.cos(rotor) * 10, player.y - 16);
      context.stroke();
      context.fillStyle = '#fde047';
      context.beginPath();
      context.arc(player.x - 14, player.y + 6, 3, 0, Math.PI * 2);
      context.arc(player.x + 14, player.y + 6, 3, 0, Math.PI * 2);
      context.fill();
    }

    // Particles, additive so sparks bloom.
    context.save();
    context.globalCompositeOperation = 'lighter';
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    context.globalAlpha = 1;

    // Floating score text.
    for (const f of state.floaters) {
      if (!f.active) continue;
      context.globalAlpha = Math.max(0, f.life);
      text(f.text, f.x, f.y, 24, f.color, 'center', 700);
    }
    context.globalAlpha = 1;
  }

  function drawHud(state, best) {
    // Score, top left.
    text('SCORE', 28, 44, 16, PALETTE.muted, 'left', 700);
    text(String(state.score), 28, 82, 40, PALETTE.parcel, 'left', 800);
    text(`BEST ${Math.max(best, state.score)}`, 28, 108, 16, PALETTE.muted, 'left', 600);
    // Combo, top centre, with its draining timer.
    if (state.combo > 1) {
      text(`×${state.combo} COMBO`, FIELD.width / 2, 62, 30, PALETTE.combo, 'center', 800);
      const width = 170;
      context.fillStyle = 'rgba(244,114,182,0.25)';
      roundRectPath(context, FIELD.width / 2 - width / 2, 74, width, 8, 4);
      context.fill();
      context.fillStyle = PALETTE.combo;
      roundRectPath(context, FIELD.width / 2 - width / 2, 74, width * (state.comboTimer / PARCEL.comboSeconds), 8, 4);
      context.fill();
    } else {
      text('COMBO ×1 — chain deliveries to build it', FIELD.width / 2, 52, 15, PALETTE.muted, 'center', 600);
    }
    // Lives, level and deliveries, top right.
    let hearts = '';
    for (let i = 0; i < LIVES; i += 1) hearts += i < state.lives ? '♥ ' : '♡ ';
    text(hearts.trim(), FIELD.width - 28, 52, 26, '#fb7185', 'right', 700);
    text(`LEVEL ${state.level}`, FIELD.width - 28, 82, 18, PALETTE.text, 'right', 700);
    text(`${state.deliveries} DELIVERIES`, FIELD.width - 28, 106, 15, PALETTE.muted, 'right', 600);
    // Boost meter, bottom left.
    text('BOOST — SHIFT', 28, FIELD.height - 52, 14, PALETTE.muted, 'left', 700);
    context.fillStyle = 'rgba(34,211,238,0.2)';
    roundRectPath(context, 28, FIELD.height - 44, 180, 10, 5);
    context.fill();
    context.fillStyle = state.player.boost > DRONE.boostMin ? PALETTE.drone : '#f87171';
    roundRectPath(context, 28, FIELD.height - 44, 180 * (state.player.boost / 100), 10, 5);
    context.fill();
    text('P pause · M mute', FIELD.width - 28, FIELD.height - 28, 14, PALETTE.muted, 'right', 600);
    // Level banner, centre.
    if (state.bannerTime > 0) {
      const pop = 1 + 0.25 * Math.max(0, state.bannerTime - 1.7);
      context.save();
      context.translate(FIELD.width / 2, 190);
      context.scale(pop, pop);
      context.globalAlpha = Math.min(1, state.bannerTime);
      text(state.banner, 0, 0, 44, PALETTE.golden, 'center', 800);
      context.restore();
      context.globalAlpha = 1;
    }
  }

  function dim(alpha) {
    context.fillStyle = `rgba(4,6,18,${alpha})`;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function panel(title, lines, prompt, promptBlink, yTop) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = yTop === undefined ? (FIELD.height - height) / 2 : yTop;
    context.fillStyle = 'rgba(16,23,54,0.92)';
    roundRectPath(context, x, y, PANEL.width, height, 16);
    context.fill();
    context.strokeStyle = 'rgba(34,211,238,0.5)';
    context.lineWidth = 2;
    roundRectPath(context, x, y, PANEL.width, height, 16);
    context.stroke();
    text(title, FIELD.width / 2, y + 58, 40, PALETTE.text, 'center', 800);
    lines.forEach((line, i) => {
      text(line.text, FIELD.width / 2, y + 108 + i * PANEL.line, line.size || 20, line.color || PALETTE.text, 'center', line.weight || 600);
    });
    if (prompt) {
      const alpha = promptBlink ? 0.55 + 0.45 * Math.sin(Date.now() / 280) : 1;
      context.globalAlpha = alpha;
      text(prompt, FIELD.width / 2, y + height - 26, 20, PALETTE.parcel, 'center', 700);
      context.globalAlpha = 1;
    }
  }

  function drawTitle(state, best) {
    dim(0.45);
    text('NEON', FIELD.width / 2, 168, 88, PALETTE.drone, 'center', 800);
    text('COURIER', FIELD.width / 2, 244, 88, PALETTE.combo, 'center', 800);
    text('Deliver the glow. Dodge the storm.', FIELD.width / 2, 288, 24, PALETTE.text, 'center', 600);
    panel('YOUR SHIFT', [
      { text: 'WASD / ARROWS — fly the drone', size: 20 },
      { text: 'MOUSE — steer · SHIFT — boost', size: 20 },
      { text: 'Catch parcels, chain combos ×5, grab gold', size: 20 },
      { text: 'Dodge storm drones and blackout towers — 3 lives', size: 20 },
    ], 'PRESS SPACE OR CLICK TO FLY', true, 320);
    if (best > 0) text(`BEST ${best}`, FIELD.width / 2, 672, 22, PALETTE.parcel, 'center', 700);
  }

  function drawOver(state, best) {
    dim(0.6);
    const isBest = state.score > 0 && state.score >= best;
    // A first shift has no best to beat, so it is a best of its own.
    const bestLine = best === 0 && state.score > 0
      ? 'FIRST SHIFT — NEW BEST!'
      : isBest
        ? `NEW BEST!  (was ${best})`
        : `BEST  ${best}`;
    const lines = [
      { text: `SCORE  ${state.score}`, size: 34, color: PALETTE.parcel, weight: 800 },
      { text: `${state.deliveries} deliveries · max combo ×${state.maxCombo} · reached level ${state.level}`, size: 20 },
      { text: bestLine, size: 20, color: isBest ? PALETTE.golden : PALETTE.muted },
    ];
    panel('SHIFT OVER', lines, 'SPACE / CLICK — FLY AGAIN', true);
  }

  function drawPaused() {
    dim(0.55);
    text('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10, 56, PALETTE.text, 'center', 800);
    text('P or ESC — resume', FIELD.width / 2, FIELD.height / 2 + 40, 22, PALETTE.muted, 'center', 600);
  }

  function draw(state, screen, best) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake: a deterministic wobble while the shake timer runs.
    const shake = state.shake > 0 ? state.shake * 14 : 0;
    const sx = shake * Math.sin(state.elapsed * 91);
    const sy = shake * Math.cos(state.elapsed * 83);
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
    } else {
      drawHud(state, best);
      if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, fieldPoint };
}
