// The game's rules and state, with no drawing and no browser in it: orders on the board,
// skewers on the grill, the plate, the cook's hands, coins, combo and the shift timer.
// step() advances one fixed step. Actions (pick/place/flip/take/plate/serve/fan) are plain
// functions on the state, so the keyboard, the mouse and the screenshot autopilot all drive
// the same real rules. Nothing here allocates after createWorld returns (except short-lived
// order objects, which the pool-free design of this game accepts).

import { BINS, BOARD, COOK, COOKING, FIELD, GRILL, INGREDIENTS, ORDERS, PLATE, SHIFT_SECONDS, SKEWER_TYPES, SIDE_TYPES } from './config.js';

export const EVENT_SERVED = 1;
export const EVENT_EXPIRED = 2;
export const EVENT_BURNT = 4;
export const EVENT_OVER = 8;

/** Dish templates the night-market crowd orders. */
const MENU = [
  { name: 'Sate Ayam', skewers: { chicken: 2 }, sides: ['sauce', 'lontong'], price: 30 },
  { name: 'Sate Sapi', skewers: { beef: 2 }, sides: ['sauce', 'cucumber'], price: 34 },
  { name: 'Sate Tahu', skewers: { tofu: 2 }, sides: ['sauce', 'lontong'], price: 26 },
  { name: 'Sate Campur', skewers: { chicken: 1, beef: 1 }, sides: ['sauce'], price: 28 },
  { name: 'Sate Ayam + Es Teh', skewers: { chicken: 2 }, sides: ['sauce', 'tea'], price: 34 },
  { name: 'Sate Tahu Pedas', skewers: { tofu: 2 }, sides: ['sauce', 'cucumber', 'tea'], price: 30 },
];

export function ingredientById(id) {
  for (let i = 0; i < INGREDIENTS.length; i += 1) if (INGREDIENTS[i].id === id) return INGREDIENTS[i];
  return null;
}

export function grillSlotRect(index) {
  const col = index % GRILL.cols;
  const row = Math.floor(index / GRILL.cols);
  return {
    x: GRILL.x + col * (GRILL.slotW + GRILL.gapX),
    y: GRILL.y + row * (GRILL.slotH + GRILL.gapY),
    w: GRILL.slotW,
    h: GRILL.slotH,
  };
}

export function binRect(index) {
  return { x: BINS.x + index * (BINS.w + BINS.gap), y: BINS.y, w: BINS.w, h: BINS.h };
}

export function ticketRect(index) {
  return { x: BOARD.x, y: BOARD.y + index * (BOARD.ticketH + BOARD.gap), w: BOARD.w, h: BOARD.ticketH };
}

export function plateRect() {
  return { x: PLATE.x, y: PLATE.y, w: PLATE.w, h: PLATE.h };
}

export function qualityOf(skewer) {
  if (skewer.cook >= COOKING.burntAt) return 'burnt';
  if (skewer.flipped && skewer.cook >= COOKING.perfectMin && skewer.cook <= COOKING.perfectMax) return 'perfect';
  if (skewer.cook >= COOKING.goodMin) return 'good';
  return 'raw';
}

export function createWorld(random) {
  const grill = [];
  for (let i = 0; i < GRILL.cols * GRILL.rows; i += 1) grill.push(null);
  const smoke = [];
  for (let i = 0; i < 26; i += 1) smoke.push({ x: 0, y: 0, r: 0, a: 0, v: 0, seed: 0 });

  const state = {
    cook: { x: (FIELD.width - COOK.width) / 2 },
    carry: null, // { kind: 'raw'|'cooked'|'side', type, quality? }
    grill,
    plate: { skewers: [], sides: [] },
    orders: [],
    nextOrderId: 1,
    orderTimer: ORDERS.firstAt,
    timeLeft: SHIFT_SECONDS,
    elapsed: 0,
    coins: 0,
    served: 0,
    lost: 0,
    combo: 0,
    bestCombo: 0,
    fan: false,
    fanHeat: 0,
    over: false,
    smoke,
    flicker: 0,
  };

  function reset() {
    state.cook.x = (FIELD.width - COOK.width) / 2;
    state.carry = null;
    for (let i = 0; i < grill.length; i += 1) grill[i] = null;
    state.plate.skewers.length = 0;
    state.plate.sides.length = 0;
    state.orders.length = 0;
    state.nextOrderId = 1;
    state.orderTimer = ORDERS.firstAt;
    state.timeLeft = SHIFT_SECONDS;
    state.elapsed = 0;
    state.coins = 0;
    state.served = 0;
    state.lost = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.fan = false;
    state.fanHeat = 0;
    state.over = false;
    state.flicker = 0;
    for (let i = 0; i < smoke.length; i += 1) {
      const s = smoke[i];
      s.x = GRILL.x + random() * (GRILL.cols * GRILL.slotW);
      s.y = GRILL.y + random() * 120;
      s.r = 5 + random() * 9;
      s.a = 0.04 + random() * 0.08;
      s.v = 12 + random() * 18;
      s.seed = random() * 6.28;
    }
  }

  function spawnOrder() {
    if (state.orders.length >= BOARD.maxTickets) return;
    const dish = MENU[Math.floor(random() * MENU.length)];
    const ramp = Math.min(1, state.elapsed / SHIFT_SECONDS);
    const patience = Math.max(ORDERS.patienceMin, ORDERS.patience * (1 - 0.35 * ramp));
    state.orders.push({
      id: state.nextOrderId,
      name: dish.name,
      skewers: { ...dish.skewers },
      sides: [...dish.sides],
      price: dish.price,
      patience,
      maxPatience: patience,
    });
    state.nextOrderId += 1;
  }

  function orderInterval() {
    const ramp = Math.min(1, state.elapsed / SHIFT_SECONDS);
    return ORDERS.intervalStart + (ORDERS.intervalEnd - ORDERS.intervalStart) * ramp;
  }

  // --- player actions (all return true when they did something) ---

  function pickIngredient(id) {
    if (state.carry !== null || state.over) return false;
    const ing = ingredientById(id);
    if (!ing) return false;
    if (SKEWER_TYPES.includes(id)) state.carry = { kind: 'raw', type: id };
    else if (SIDE_TYPES.includes(id)) state.carry = { kind: 'side', type: id };
    else return false;
    return true;
  }

  function placeOnGrill(index) {
    if (state.over || !state.carry || state.carry.kind !== 'raw') return false;
    if (index < 0 || index >= grill.length || grill[index] !== null) return false;
    grill[index] = { type: state.carry.type, cook: 0, flipped: false };
    state.carry = null;
    return true;
  }

  function flipSlot(index) {
    if (state.over) return false;
    const s = grill[index];
    if (!s || s.cook >= COOKING.burntAt) return false;
    s.flipped = true;
    return true;
  }

  function takeFromGrill(index) {
    if (state.over || state.carry !== null) return false;
    const s = grill[index];
    if (!s) return false;
    const q = qualityOf(s);
    if (q === 'raw') return false;
    if (q === 'burnt') {
      grill[index] = null; // toss the burnt skewer
      return true;
    }
    state.carry = { kind: 'cooked', type: s.type, quality: q };
    grill[index] = null;
    return true;
  }

  function addToPlate() {
    if (state.over || !state.carry) return false;
    if (state.carry.kind === 'cooked') {
      state.plate.skewers.push({ type: state.carry.type, quality: state.carry.quality });
    } else if (state.carry.kind === 'side') {
      state.plate.sides.push(state.carry.type);
    } else {
      return false; // raw skewers never go on the plate
    }
    state.carry = null;
    return true;
  }

  function clearPlate() {
    if (state.plate.skewers.length === 0 && state.plate.sides.length === 0) return false;
    state.plate.skewers.length = 0;
    state.plate.sides.length = 0;
    return true;
  }

  /** Does the plate satisfy this order? Skewers by type, sides at least the required ones. */
  function plateMatches(order) {
    const have = {};
    for (const s of state.plate.skewers) have[s.type] = (have[s.type] || 0) + 1;
    for (const type of Object.keys(order.skewers)) {
      if ((have[type] || 0) < order.skewers[type]) return false;
    }
    for (const side of order.sides) {
      if (!state.plate.sides.includes(side)) return false;
    }
    return true;
  }

  function serveOrder(index) {
    if (state.over) return 0;
    const order = state.orders[index];
    if (!order || !plateMatches(order)) return 0;
    let perfects = 0;
    for (const s of state.plate.skewers) if (s.quality === 'perfect') perfects += 1;
    const comboBonus = state.combo >= 2 ? 4 * state.combo : 0;
    const earned = order.price + perfects * ORDERS.perfectBonus + comboBonus;
    state.coins += earned;
    state.served += 1;
    state.combo += 1;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    state.orders.splice(index, 1);
    state.plate.skewers.length = 0;
    state.plate.sides.length = 0;
    return earned;
  }

  /** Serve the first order the plate satisfies, if any. Returns coins earned (0 = no match). */
  function serveFirstMatch() {
    for (let i = 0; i < state.orders.length; i += 1) {
      const earned = serveOrder(i);
      if (earned > 0) return earned;
    }
    return 0;
  }

  /** Context action for the E key: plate what's carried, else take/flip at the grill. */
  function interact() {
    if (state.carry && (state.carry.kind === 'cooked' || state.carry.kind === 'side')) return addToPlate();
    if (state.carry && state.carry.kind === 'raw') {
      for (let i = 0; i < grill.length; i += 1) if (grill[i] === null) return placeOnGrill(i);
      return false;
    }
    // Hands empty: take the best cooked skewer, else flip the most-cooked unflipped one.
    let best = -1;
    let bestCook = 0;
    for (let i = 0; i < grill.length; i += 1) {
      const s = grill[i];
      if (!s) continue;
      const q = qualityOf(s);
      if (q === 'burnt') return takeFromGrill(i);
      if ((q === 'perfect' || q === 'good') && s.cook > bestCook) { best = i; bestCook = s.cook; }
    }
    if (best >= 0) return takeFromGrill(best);
    let flip = -1;
    let flipCook = 0;
    for (let i = 0; i < grill.length; i += 1) {
      const s = grill[i];
      if (s && !s.flipped && s.cook > COOKING.stallAt && s.cook > flipCook) { flip = i; flipCook = s.cook; }
    }
    if (flip >= 0) return flipSlot(flip);
    return false;
  }

  function step(dt, direction, harmless) {
    let events = 0;
    state.elapsed += dt;
    state.flicker += dt;
    if (state.over) return events;

    // Cook walks along the counter.
    state.cook.x = Math.min(FIELD.width - COOK.width - 8, Math.max(8, state.cook.x + direction * COOK.speed * dt));

    // Fan heat rises while fanning, cools off otherwise.
    state.fanHeat = Math.max(0, Math.min(1, state.fanHeat + (state.fan ? dt * 1.4 : -dt * 0.8)));

    // Smoke drifts up off the grill.
    for (let i = 0; i < smoke.length; i += 1) {
      const s = smoke[i];
      s.y -= s.v * dt * (1 + state.fanHeat);
      s.x += Math.sin(state.flicker * 1.3 + s.seed) * 8 * dt;
      if (s.y < GRILL.y - 70) {
        s.y = GRILL.y + 90 + random() * 30;
        s.x = GRILL.x + random() * (GRILL.cols * GRILL.slotW);
      }
    }

    if (harmless) return events;

    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      state.over = true;
      return events | EVENT_OVER;
    }

    // Grill cooking.
    const rate = COOKING.rate * (state.fan ? COOKING.fanMultiplier : 1);
    for (let i = 0; i < grill.length; i += 1) {
      const s = grill[i];
      if (!s) continue;
      const wasBurnt = s.cook >= COOKING.burntAt;
      if (!s.flipped && s.cook >= COOKING.stallAt) s.cook += COOKING.stalledRate * dt;
      else s.cook += rate * dt;
      if (!wasBurnt && s.cook >= COOKING.burntAt) {
        s.cook = COOKING.burntAt;
        state.combo = 0;
        events |= EVENT_BURNT;
      }
    }

    // New orders arrive.
    state.orderTimer -= dt;
    if (state.orderTimer <= 0) {
      spawnOrder();
      state.orderTimer += orderInterval();
    }

    // Patience runs out.
    for (let i = state.orders.length - 1; i >= 0; i -= 1) {
      state.orders[i].patience -= dt;
      if (state.orders[i].patience <= 0) {
        state.orders.splice(i, 1);
        state.lost += 1;
        state.combo = 0;
        events |= EVENT_EXPIRED;
      }
    }
    return events;
  }

  reset();
  return {
    state, reset, step, spawnOrder,
    pickIngredient, placeOnGrill, flipSlot, takeFromGrill, addToPlate, clearPlate,
    serveOrder, serveFirstMatch, interact, plateMatches, qualityOf,
  };
}
