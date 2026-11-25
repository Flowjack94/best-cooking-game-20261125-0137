// Satay Smoke: Night Market Grill — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the window,
// so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Length of one night shift, in seconds. */
export const SHIFT_SECONDS = 150;

export const COOK = { width: 64, height: 86, speed: 520, y: 624 };

/** Grill slots: 3 columns x 2 rows. */
export const GRILL = { x: 330, y: 118, slotW: 196, slotH: 118, gapX: 14, gapY: 12, cols: 3, rows: 2 };

/** Order board: tickets stack down the left side. */
export const BOARD = { x: 16, y: 98, w: 272, ticketH: 80, gap: 6, maxTickets: 4 };

/** Plate station on the right. */
export const PLATE = { x: 968, y: 118, w: 296, h: 248, cx: 1116, cy: 226 };

/** Ingredient bins along the bottom counter. */
export const BINS = { x: 24, y: 468, w: 168, h: 138, gap: 8 };

export const INGREDIENTS = [
  { id: 'chicken', key: '1', name: 'Sate Ayam', short: 'AYAM', color: '#f2a65a', dark: '#c47b2d' },
  { id: 'beef', key: '2', name: 'Sate Sapi', short: 'SAPI', color: '#d96a5f', dark: '#a03d33' },
  { id: 'tofu', key: '3', name: 'Sate Tahu', short: 'TAHU', color: '#f5e6c8', dark: '#c9a86a' },
  { id: 'sauce', key: '4', name: 'Bumbu Kacang', short: 'SAUS', color: '#b06a2e', dark: '#7d4415' },
  { id: 'lontong', key: '5', name: 'Lontong', short: 'LONTONG', color: '#eef3d8', dark: '#a8b878' },
  { id: 'cucumber', key: '6', name: 'Timun', short: 'TIMUN', color: '#7ec850', dark: '#4a8c2a' },
  { id: 'tea', key: '7', name: 'Es Teh', short: 'ES TEH', color: '#e8a33d', dark: '#a86a12' },
];

export const SKEWER_TYPES = ['chicken', 'beef', 'tofu'];
export const SIDE_TYPES = ['sauce', 'lontong', 'cucumber', 'tea'];

/** Cooking: progress 0..1.2. Unflipped skewers stall past 0.55 until flipped. */
export const COOKING = {
  rate: 0.085,
  fanMultiplier: 1.75,
  stallAt: 0.55,
  stalledRate: 0.012,
  perfectMin: 0.6,
  perfectMax: 0.9,
  goodMin: 0.42,
  burntAt: 1.0,
};

export const ORDERS = {
  firstAt: 2,
  intervalStart: 13,
  intervalEnd: 6.5,
  patience: 48,
  patienceMin: 30,
  rewardPerSkewer: 12,
  rewardPerSide: 4,
  perfectBonus: 6,
};

export const PALETTE = {
  skyTop: '#1a1033',
  skyMid: '#3b1d4e',
  skyLow: '#7a2e3d',
  awningRed: '#c0392b',
  awningCream: '#f7e8c9',
  wood: '#6b4423',
  woodDark: '#4a2c14',
  counter: '#8a5a2b',
  counterTop: '#a9713a',
  grillBody: '#2b2b30',
  coalGlow: '#ff7a1a',
  coalHot: '#ffd23d',
  panel: '#241a2e',
  panelEdge: '#4a3560',
  paper: '#fdf3d0',
  paperInk: '#3a2a18',
  text: '#fdf6e3',
  muted: '#c9b8a3',
  gold: '#f2c94c',
  green: '#7ec850',
  red: '#e5534b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'satay-smoke.best';
