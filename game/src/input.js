// Keyboard and pointer input. Held keys give a steering direction; one-shot presses
// (start, pause, interact, serve, clear) are queued as bit flags and taken once by the loop,
// so a press between two frames is never lost and never counted twice. Pointer clicks are
// reported as logical playfield coordinates for the main loop to hit-test against stations.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_SERVE = 8;
export const ACTION_CLEAR = 16;
export const ACTION_FAN_START = 32;
export const ACTION_FAN_END = 64;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const SERVE = new Set(['KeyS']);
const CLEAR = new Set(['KeyX']);
const FAN = new Set(['Space']);
const PICK_KEYS = { Digit1: 'chicken', Digit2: 'beef', Digit3: 'tofu', Digit4: 'sauce', Digit5: 'lontong', Digit6: 'cucumber', Digit7: 'tea' };

export function createInput(target) {
  let left = false;
  let right = false;
  let fanHeld = false;
  let actions = 0;
  let pickQueue = [];
  let clickQueue = [];
  let clickPos = null;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (FAN.has(event.code)) {
      if (!event.repeat) {
        fanHeld = true;
        actions |= ACTION_FAN_START;
        // Space also starts the game from title / game-over screens.
        actions |= ACTION_CONFIRM;
      }
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (SERVE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_SERVE;
    } else if (CLEAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CLEAR;
    } else if (PICK_KEYS[event.code]) {
      if (!event.repeat) pickQueue.push(PICK_KEYS[event.code]);
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (FAN.has(event.code)) {
      fanHeld = false;
      actions |= ACTION_FAN_END;
    }
  });
  window.addEventListener('blur', () => {
    left = false;
    right = false;
    fanHeld = false;
    actions |= ACTION_FAN_END;
  });

  function logicalPos(event) {
    const rect = target.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const ox = (rect.width - 1280 * scale) / 2;
    const oy = (rect.height - 720 * scale) / 2;
    return { x: (event.clientX - rect.left - ox) / scale, y: (event.clientY - rect.top - oy) / scale };
  }

  target.addEventListener('pointerdown', (event) => {
    const pos = logicalPos(event);
    clickPos = pos;
    clickQueue.push(pos);
    // A click on the grill while playing also fans while held; the main loop decides.
    actions |= ACTION_CONFIRM;
  });

  return {
    direction() {
      return (right ? 1 : 0) - (left ? 1 : 0);
    },
    fanHeld() {
      return fanHeld;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takePicks() {
      const picks = pickQueue;
      pickQueue = [];
      return picks;
    },
    takeClicks() {
      const clicks = clickQueue;
      clickQueue = [];
      return clicks;
    },
    lastClickPos() {
      return clickPos;
    },
  };
}
