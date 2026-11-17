// Neon Courier: every tuning number and colour in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.

export const FIELD = { width: 1280, height: 720, groundY: 664 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The courier drone: a circle with a velocity, not a paddle. */
export const DRONE = {
  radius: 18,
  accel: 2600,
  maxSpeed: 430,
  boostSpeed: 720,
  damping: 0.86,
  invulnerable: 2.0,
  boostDrain: 45,
  boostRefill: 18,
  boostMin: 10,
};

export const LIVES = 3;

/** A delivery: a glowing parcel drifting in from the right. */
export const PARCEL = {
  radius: 14,
  goldenRadius: 18,
  goldenChance: 0.08,
  basePoints: 100,
  goldenPoints: 500,
  interval: 1.15,
  intervalScale: 0.94,
  minInterval: 0.55,
  /** A parcel that flies past uncollected breaks the combo. */
  comboSeconds: 3.0,
  maxCombo: 5,
};

/** A storm drone: an enemy that patrols across the sky with a sine wobble. */
export const STORM = {
  radius: 16,
  interval: 2.2,
  intervalScale: 0.93,
  minInterval: 1.1,
  speedScale: 1.05,
  wobbleAmp: 70,
  wobbleHz: 1.4,
  /** A pass this close, without a hit, is a near miss worth points. */
  nearMiss: 48,
  nearMissPoints: 25,
};

/** A blackout tower: a tall building scrolling in from the right, anchored at the rooftops. */
export const TOWER = {
  minWidth: 56,
  maxWidth: 110,
  minHeight: 130,
  maxHeight: 280,
  interval: 2.6,
  intervalScale: 0.95,
  minInterval: 1.4,
};

/** A shield pickup: one free hit, drawn as a ring around the drone. */
export const SHIELD = {
  radius: 15,
  interval: 24,
};

/** Seconds of deliveries per level, and the last level: speeds and spawn rates stop growing there. */
export const LEVEL = { deliveries: 8, max: 12 };

/** How many of each thing can exist at once; the pools are allocated once, at boot. */
export const POOL = { parcels: 32, storms: 24, towers: 16, particles: 256, floaters: 16 };

export const PALETTE = {
  backdrop: '#070b1d',
  skyTop: '#0b1026',
  skyMid: '#131a3a',
  skyLow: '#1c2450',
  farCity: '#1a2247',
  nearCity: '#232c5c',
  rooftop: '#141a38',
  moon: '#f5f3ce',
  drone: '#22d3ee',
  droneDark: '#0e7490',
  parcel: '#fbbf24',
  golden: '#fde047',
  storm: '#fb7185',
  stormEye: '#ff2d55',
  tower: '#0d1230',
  towerBeacon: '#ff2d55',
  shield: '#67e8f9',
  text: '#eef1f5',
  muted: '#8b93b8',
  panel: '#101736',
  combo: '#f472b6',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'neon-courier.best';
