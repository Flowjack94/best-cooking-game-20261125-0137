// The screenshot scenes behind ?shot=play|rush|start|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (pick what the oldest order needs, grill it, flip at the stall, take it when perfect,
// plate it with its sides, serve when the plate matches), so the frame is what a real
// game looks like and the same seed always gives the same frame.
import { GRILL, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const RUSH_SECONDS = 78;
const END_LIMIT_SECONDS = 400;

function orderNeeds(state) {
  // What the oldest order still needs, counting grill + plate + hands.
  const order = state.orders[0];
  if (!order) return null;
  const have = {};
  for (const s of state.grill) if (s) have[s.type] = (have[s.type] || 0) + 1;
  for (const s of state.plate.skewers) have[s.type] = (have[s.type] || 0) + 1;
  if (state.carry && state.carry.kind === 'cooked') have[state.carry.type] = (have[state.carry.type] || 0) + 1;
  if (state.carry && state.carry.kind === 'raw') have[state.carry.type] = (have[state.carry.type] || 0) + 1;
  for (const type of Object.keys(order.skewers)) {
    if ((have[type] || 0) < order.skewers[type]) return { kind: 'skewer', type };
  }
  for (const side of order.sides) {
    const onPlate = state.plate.sides.includes(side);
    const inHand = state.carry && state.carry.kind === 'side' && state.carry.type === side;
    if (!onPlate && !inHand) return { kind: 'side', type: side };
  }
  return null;
}

function autopilot(world) {
  const state = world.state;
  // 1. Serve whenever the plate matches.
  if (world.serveFirstMatch() > 0) return;
  // 2. Plate what is carried.
  if (state.carry && (state.carry.kind === 'cooked' || state.carry.kind === 'side')) {
    world.addToPlate();
    return;
  }
  // 3. Toss burnt skewers, take perfect/good ones.
  for (let i = 0; i < GRILL.cols * GRILL.rows; i += 1) {
    const s = state.grill[i];
    if (!s) continue;
    const q = world.qualityOf(s);
    if (q === 'burnt') { world.takeFromGrill(i); return; }
    if (q === 'perfect' || q === 'good') { world.takeFromGrill(i); return; }
  }
  // 4. Flip anything stalled past the flip point.
  for (let i = 0; i < GRILL.cols * GRILL.rows; i += 1) {
    const s = state.grill[i];
    if (s && !s.flipped && s.cook > 0.55) { world.flipSlot(i); return; }
  }
  // 5. Place a carried raw skewer on a free slot.
  if (state.carry && state.carry.kind === 'raw') {
    for (let i = 0; i < GRILL.cols * GRILL.rows; i += 1) {
      if (!state.grill[i]) { world.placeOnGrill(i); return; }
    }
    return;
  }
  // 6. Pick what the oldest order needs.
  const need = orderNeeds(state);
  if (need) {
    world.pickIngredient(need.type);
    return;
  }
  // 7. Nothing pending: keep the grill stocked speculatively (rotating types), so the
  // stall never looks empty and the next order starts from a hot grill.
  const types = ['chicken', 'beef', 'tofu'];
  const free = state.grill.some((s) => s === null);
  if (free && state.grill.filter((s) => s !== null).length < 3) {
    world.pickIngredient(types[(state.served + state.grill.filter((s) => s !== null).length) % 3]);
    return;
  }
}

/**
 * After the autopilot run, arrange the exact frame the screenshot takes: top the order
 * board up, fill the grill with skewers at staggered cook stages, and assemble a plate
 * — all through the real rules (spawnOrder, pick/place/flip, real step() calls).
 */
function tableau(world, targetOrders, targetGrill) {
  const state = world.state;
  world.serveFirstMatch();
  while (state.orders.length < targetOrders) world.spawnOrder();
  const types = ['chicken', 'chicken', 'beef', 'tofu', 'beef', 'chicken'];
  for (let i = 0; i < GRILL.cols * GRILL.rows && state.grill.filter((s) => s !== null).length < targetGrill; i += 1) {
    if (state.grill[i] === null) {
      world.pickIngredient(types[i % types.length]);
      world.placeOnGrill(i);
    }
  }
  // 3 s plain: skewers reach ~0.26. Flip them all, then 2.5 s fanned: fresh ones land
  // in the golden window (~0.63), older ones near it — none past burnt.
  for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, 0, false);
  for (let i = 0; i < state.grill.length; i += 1) if (state.grill[i]) world.flipSlot(i);
  state.fan = true;
  for (let i = 0; i < 2.5 / STEP; i += 1) world.step(STEP, 0, false);
  state.fan = false;
  // Plate one cooked skewer + sauce + lontong: a dish mid-assembly, ready to serve.
  for (let i = 0; i < state.grill.length; i += 1) {
    const s = state.grill[i];
    if (s && world.qualityOf(s) !== 'burnt' && world.qualityOf(s) !== 'raw') {
      world.takeFromGrill(i);
      break;
    }
  }
  if (state.carry) world.addToPlate();
  world.pickIngredient('sauce');
  world.addToPlate();
  world.pickIngredient('lontong');
  world.addToPlate();
}

/**
 * Set `world` to the named scene (start, play, rush or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'rush' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, 0, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : name === 'rush' ? RUSH_SECONDS : PLAY_SECONDS;
  let over = false;
  for (let i = 0; i < limit / STEP; i += 1) {
    // Fan while anything is cooking and nothing is close to burnt.
    const cooking = world.state.grill.some((s) => s && s.cook < 0.92);
    world.state.fan = cooking;
    autopilot(world);
    if (world.step(STEP, 0, false) & EVENT_OVER) { over = true; break; }
  }
  world.state.fan = false;
  if (name === 'end' && !over) {
    // Force the results screen: run the clock out with the autopilot still serving.
    for (let i = 0; i < END_LIMIT_SECONDS / STEP && !over; i += 1) {
      autopilot(world);
      if (world.step(STEP, 0, false) & EVENT_OVER) over = true;
    }
  }
  if (!over && (name === 'play' || name === 'rush')) {
    tableau(world, name === 'rush' ? 4 : 3, name === 'rush' ? 6 : 4);
  }
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.coins };
}
