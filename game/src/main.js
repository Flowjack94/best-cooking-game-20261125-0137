// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
// Mouse clicks hit-test against the real stations: ingredient bins, grill slots, the
// plate's serve/clear buttons and order tickets.
//
// ?seed=N fixes the order pattern. ?shot=start|play|rush|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, GRILL, INGREDIENTS, PLATE, SHIFT_SECONDS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BURNT, EVENT_EXPIRED, EVENT_OVER, EVENT_SERVED } from './world.js';
import { binRect, grillSlotRect, plateRect, ticketRect } from './world.js';
import {
  ACTION_CLEAR, ACTION_CONFIRM, ACTION_FAN_END, ACTION_FAN_START, ACTION_INTERACT,
  ACTION_PAUSE, ACTION_SERVE, createInput,
} from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function inRect(pos, r) {
  return pos.x >= r.x && pos.x <= r.x + r.w && pos.y >= r.y && pos.y <= r.y + r.h;
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Serve orders before patience runs out.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.coins > best) {
      best = world.state.coins;
      saveBest(best);
    }
    announce(`Shift over. ${world.state.coins} coins, ${world.state.served} orders served. Best ${best}.`);
  }

  /** One click during play: bins pick up, grill slots place/flip/take, plate serves/clears. */
  function handleClick(pos) {
    if (screen !== SCREEN_PLAY) return;
    for (let i = 0; i < INGREDIENTS.length; i += 1) {
      if (inRect(pos, binRect(i))) {
        if (world.pickIngredient(INGREDIENTS[i].id)) announce(`${INGREDIENTS[i].name} in hand.`);
        return;
      }
    }
    for (let i = 0; i < GRILL.cols * GRILL.rows; i += 1) {
      if (inRect(pos, grillSlotRect(i))) {
        const slot = world.state.grill[i];
        const carry = world.state.carry;
        if (slot === null && carry && carry.kind === 'raw') world.placeOnGrill(i);
        else if (slot && carry === null) world.takeFromGrill(i);
        else if (slot && !slot.flipped) world.flipSlot(i);
        else if (slot) world.takeFromGrill(i);
        return;
      }
    }
    const serveBtn = { x: PLATE.x + 8, y: PLATE.y + PLATE.h + 8, w: 180, h: 40 };
    const clearBtn = { x: PLATE.x + 196, y: PLATE.y + PLATE.h + 8, w: 92, h: 40 };
    if (inRect(pos, serveBtn)) {
      const earned = world.serveFirstMatch();
      if (earned > 0) announce(`Served! +${earned} coins.`);
      return;
    }
    if (inRect(pos, clearBtn)) {
      world.clearPlate();
      return;
    }
    if (inRect(pos, plateRect())) {
      world.addToPlate();
      return;
    }
    for (let i = 0; i < world.state.orders.length; i += 1) {
      if (inRect(pos, ticketRect(i))) {
        const earned = world.serveOrder(i);
        if (earned > 0) announce(`Served order #${world.state.orders[i]?.id ?? ''}! +${earned} coins.`);
        return;
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_FAN_START) world.state.fan = true;
    if (actions & ACTION_FAN_END) world.state.fan = false;
    if (actions & ACTION_INTERACT) world.interact();
    if (actions & ACTION_SERVE) {
      const earned = world.serveFirstMatch();
      if (earned > 0) announce(`Served! +${earned} coins.`);
    }
    if (actions & ACTION_CLEAR) world.clearPlate();
    for (const id of input.takePicks()) world.pickIngredient(id);
    for (const pos of input.takeClicks()) handleClick(pos);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, 0, true);
      return;
    }
    const events = world.step(STEP, input.direction(), false);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_SERVED) announce(`Served! ${world.state.coins} coins.`);
    else if (events & EVENT_BURNT) announce('A skewer burnt! Combo lost.');
    else if (events & EVENT_EXPIRED) announce('An order walked away. Combo lost.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Satay Smoke. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
