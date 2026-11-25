// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Canvas shapes only — no images, no network — so the night-market stall, the
// lanterns, the charcoal glow and the smoke are all drawn code.
import { BINS, BOARD, COOK, COOKING, FIELD, FONT, GRILL, INGREDIENTS, PALETTE, PLATE, SHIFT_SECONDS } from './config.js';
import { binRect, grillSlotRect, ingredientById, qualityOf, ticketRect } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function fmtTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function drawSky(state) {
    const g = context.createLinearGradient(0, 0, 0, 470);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, 470);
    // Stars.
    context.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 173) % FIELD.width;
      const y = (i * 97) % 150 + 8;
      context.fillRect(x, y, 2, 2);
    }
    // Moon.
    context.fillStyle = '#f7e8b0';
    context.beginPath();
    context.arc(1180, 62, 30, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8d28a';
    context.beginPath();
    context.arc(1170, 54, 7, 0, Math.PI * 2);
    context.arc(1190, 70, 5, 0, Math.PI * 2);
    context.fill();
    // Distant market stalls silhouettes.
    context.fillStyle = '#241534';
    for (let i = 0; i < 5; i += 1) {
      const x = 40 + i * 260;
      context.fillRect(x, 400, 180, 70);
      context.beginPath();
      context.moveTo(x - 12, 400);
      context.lineTo(x + 90, 368);
      context.lineTo(x + 192, 400);
      context.closePath();
      context.fill();
    }
    // String of lanterns across the top.
    context.strokeStyle = '#3a2a18';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, 30);
    context.quadraticCurveTo(640, 78, FIELD.width, 30);
    context.stroke();
    const lanternColors = ['#ff5a3c', '#f2c94c', '#7ec850', '#ff8fb2', '#4fc3f7'];
    for (let i = 0; i < 9; i += 1) {
      const t = i / 8;
      const x = 60 + t * 1160;
      const y = 30 + Math.sin(t * Math.PI) * 34;
      const sway = Math.sin(state.flicker * 0.9 + i * 1.7) * 3;
      const c = lanternColors[i % lanternColors.length];
      context.fillStyle = c;
      context.beginPath();
      context.ellipse(x + sway, y + 16, 15, 19, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.35)';
      context.fillRect(x + sway - 2, y + 2, 4, 26);
      context.fillStyle = '#ffd23d';
      context.beginPath();
      context.arc(x + sway, y + 16, 5, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawAwning() {
    // Striped stall awning over the grill area (below the HUD, above the grill).
    for (let i = 0; i < 10; i += 1) {
      context.fillStyle = i % 2 === 0 ? PALETTE.awningRed : PALETTE.awningCream;
      const x = 300 + i * 66;
      context.beginPath();
      context.moveTo(x, 70);
      context.lineTo(x + 66, 70);
      context.lineTo(x + 56, 102);
      context.lineTo(x + 10, 102);
      context.closePath();
      context.fill();
    }
    context.fillStyle = '#7d1f16';
    context.fillRect(300, 66, 660, 5);
  }

  function drawBoard(state) {
    rr(context, BOARD.x - 6, BOARD.y - 34, BOARD.w + 12, 34 + BOARD.maxTickets * (BOARD.ticketH + BOARD.gap) + 6, 10);
    context.fillStyle = PALETTE.panel;
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text('📋  ORDER BOARD', BOARD.x + 8, BOARD.y - 12, 17, PALETTE.gold, 'left', true);
    for (let i = 0; i < BOARD.maxTickets; i += 1) {
      const r = ticketRect(i);
      const order = state.orders[i];
      if (!order) {
        context.fillStyle = 'rgba(255,255,255,0.06)';
        rr(context, r.x, r.y, r.w, r.h, 8);
        context.fill();
        context.setLineDash([5, 5]);
        context.strokeStyle = 'rgba(255,255,255,0.18)';
        context.stroke();
        context.setLineDash([]);
        text('— menunggu pesanan —', r.x + r.w / 2, r.y + 50, 14, PALETTE.muted, 'center');
        continue;
      }
      const frac = Math.max(0, order.patience / order.maxPatience);
      context.fillStyle = PALETTE.paper;
      rr(context, r.x, r.y, r.w, r.h, 8);
      context.fill();
      context.fillStyle = frac > 0.5 ? '#7ec850' : frac > 0.25 ? '#f2a33c' : '#e5534b';
      rr(context, r.x + 8, r.y + r.h - 14, (r.w - 16) * frac, 8, 4);
      context.fill();
      text(`#${order.id}  ${order.name}`, r.x + 10, r.y + 24, 16, PALETTE.paperInk, 'left', true);
      const skewerBits = Object.entries(order.skewers).map(([t, n]) => `${n}× ${ingredientById(t).short}`).join('  ');
      text(skewerBits, r.x + 10, r.y + 46, 14, '#5a4020');
      const sideBits = order.sides.map((s) => ingredientById(s).short).join(' + ');
      text(sideBits, r.x + 10, r.y + 64, 13, '#7d5a2e');
      text(`Rp ${order.price}k`, r.x + r.w - 10, r.y + 24, 15, '#a03d33', 'right', true);
      text(`${Math.ceil(order.patience)}s`, r.x + r.w - 10, r.y + 64, 13, frac > 0.25 ? '#7d5a2e' : '#e5534b', 'right', true);
    }
  }

  function drawGrill(state) {
    // Grill body.
    rr(context, GRILL.x - 14, GRILL.y - 12, GRILL.cols * GRILL.slotW + (GRILL.cols - 1) * GRILL.gapX + 28, GRILL.rows * GRILL.slotH + (GRILL.rows - 1) * GRILL.gapY + 30, 14);
    context.fillStyle = PALETTE.grillBody;
    context.fill();
    context.strokeStyle = '#55555e';
    context.lineWidth = 2;
    context.stroke();
    text('🔥  ARANG — PANGGANGAN', GRILL.x + 4, GRILL.y - 6, 14, '#ffb26b', 'left', true);
    // Coals glow under each slot.
    for (let i = 0; i < state.grill.length; i += 1) {
      const r = grillSlotRect(i);
      const glow = 0.55 + 0.35 * Math.sin(state.flicker * 3 + i * 2.1) + state.fanHeat * 0.4;
      const g = context.createRadialGradient(r.x + r.w / 2, r.y + r.h - 18, 4, r.x + r.w / 2, r.y + r.h - 18, 70);
      g.addColorStop(0, `rgba(255, ${Math.floor(120 + 80 * glow)}, 40, ${0.55 * glow})`);
      g.addColorStop(1, 'rgba(255,80,20,0)');
      context.fillStyle = g;
      context.fillRect(r.x, r.y, r.w, r.h);
      // Charcoal lumps.
      context.fillStyle = '#1c1c20';
      for (let j = 0; j < 5; j += 1) {
        const cx = r.x + 22 + j * 34 + ((i * 7 + j * 13) % 9);
        const cy = r.y + r.h - 22 - ((i + j) % 2) * 6;
        context.beginPath();
        context.arc(cx, cy, 9, 0, Math.PI * 2);
        context.fill();
      }
      context.fillStyle = `rgba(255, ${Math.floor(140 + 90 * glow)}, 60, ${0.5 + 0.4 * glow})`;
      for (let j = 0; j < 3; j += 1) {
        const cx = r.x + 40 + j * 55;
        context.beginPath();
        context.arc(cx, r.y + r.h - 20, 3, 0, Math.PI * 2);
        context.fill();
      }
      // Slot frame.
      context.strokeStyle = '#4a4a52';
      context.lineWidth = 2;
      rr(context, r.x, r.y, r.w, r.h, 8);
      context.stroke();
      const s = state.grill[i];
      if (s) drawSkewerOnGrill(s, r);
      else {
        text('＋  kosong', r.x + r.w / 2, r.y + r.h / 2 + 5, 14, 'rgba(255,255,255,0.35)', 'center');
      }
    }
    // Smoke.
    for (const s of state.smoke) {
      context.fillStyle = `rgba(220,220,230,${s.a})`;
      context.beginPath();
      context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawSkewerShape(x, y, len, color, dark, angle) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.strokeStyle = '#d8c49a';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-len / 2, 0);
    context.lineTo(len / 2, 0);
    context.stroke();
    for (let j = -1; j <= 1; j += 1) {
      context.fillStyle = j === 0 ? color : dark;
      context.beginPath();
      context.arc(j * 22, 0, 11, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(0,0,0,0.18)';
      context.beginPath();
      context.arc(j * 22 + 3, 3, 6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawSkewerOnGrill(s, r) {
    const ing = ingredientById(s.type);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2 - 6;
    const q = qualityOf(s);
    const cookColor = s.cook >= COOKING.burntAt ? '#2a2018' : s.cook > 0.55 ? '#8a5a1e' : ing.color;
    drawSkewerShape(cx, cy, 150, cookColor, s.cook >= COOKING.burntAt ? '#120d08' : ing.dark, s.flipped ? 0.12 : -0.12);
    if (q === 'perfect') {
      context.fillStyle = '#ffd23d';
      context.beginPath();
      context.arc(cx + 62, cy - 26, 11, 0, Math.PI * 2);
      context.fill();
      text('★', cx + 62, cy - 19, 13, '#7d4415', 'center', true);
    }
    // Cook progress bar.
    const bw = r.w - 24;
    const frac = Math.min(1, s.cook / COOKING.burntAt);
    context.fillStyle = 'rgba(0,0,0,0.55)';
    rr(context, r.x + 12, r.y + r.h - 16, bw, 9, 4);
    context.fill();
    const barColor = q === 'burnt' ? '#3a2a20' : q === 'perfect' ? '#ffd23d' : q === 'good' ? '#7ec850' : '#f2a33c';
    context.fillStyle = barColor;
    rr(context, r.x + 12, r.y + r.h - 16, Math.max(6, bw * frac), 9, 4);
    context.fill();
    // Perfect window marker.
    context.fillStyle = 'rgba(255,255,255,0.75)';
    context.fillRect(r.x + 12 + bw * COOKING.perfectMin, r.y + r.h - 18, 2, 13);
    context.fillRect(r.x + 12 + bw * COOKING.perfectMax, r.y + r.h - 18, 2, 13);
    const label = q === 'burnt' ? 'GOSONG!' : q === 'perfect' ? 'PERFECT!' : q === 'good' ? 'matang' : s.flipped ? 'memasak…' : 'BALIK! (klik)';
    text(label, cx, r.y + 18, 13, q === 'burnt' ? '#ff8a7a' : q === 'perfect' ? '#ffd23d' : '#fdf6e3', 'center', true);
  }

  function drawPlateArea(state) {
    rr(context, PLATE.x - 8, PLATE.y - 34, PLATE.w + 16, 34 + PLATE.h + 62, 12);
    context.fillStyle = PALETTE.panel;
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.stroke();
    text('🍽️  PIRING SAJI', PLATE.x + 8, PLATE.y - 12, 16, PALETTE.gold, 'left', true);
    // Plate.
    context.fillStyle = '#f4efe4';
    context.beginPath();
    context.ellipse(PLATE.cx, PLATE.cy, 118, 74, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#c9bfa5';
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = '#e3dcc6';
    context.beginPath();
    context.ellipse(PLATE.cx, PLATE.cy, 88, 52, 0, 0, Math.PI * 2);
    context.fill();
    const skewers = state.plate.skewers;
    const sides = state.plate.sides;
    // Show at most 3 skewer rows so a loaded plate still fits its ellipse.
    const shown = Math.min(3, skewers.length);
    for (let i = 0; i < shown; i += 1) {
      const ing = ingredientById(skewers[i].type);
      const y = PLATE.cy - 18 + i * 20;
      drawSkewerShape(PLATE.cx, y, 140, skewers[i].quality === 'perfect' ? '#8a5a1e' : ing.color, ing.dark, (i % 2 === 0 ? -1 : 1) * 0.06);
      if (skewers[i].quality === 'perfect') text('★', PLATE.cx + 78, y + 4, 12, '#b8860b', 'left', true);
    }
    if (skewers.length > shown) text(`+${skewers.length - shown} sate lagi`, PLATE.cx, PLATE.cy + 40, 11, '#7d5a2e', 'center');
    // Sides on the plate.
    let sx = PLATE.cx - 70;
    const sideY = PLATE.cy + (skewers.length > shown ? 58 : 46);
    for (const side of sides) {
      const ing = ingredientById(side);
      context.fillStyle = ing.color;
      context.beginPath();
      context.arc(sx, sideY, 13, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = ing.dark;
      context.lineWidth = 2;
      context.stroke();
      text(ing.short, sx, sideY + 4, 8, '#3a2a18', 'center', true);
      sx += 34;
    }
    if (skewers.length === 0 && sides.length === 0) {
      text('piring kosong', PLATE.cx, PLATE.cy + 4, 14, '#9a8f78', 'center');
      text('taruh sate matang + lauk di sini', PLATE.cx, PLATE.cy + 24, 11, '#b3a888', 'center');
    }
    // Serve button.
    const canServe = state.orders.some((o) => {
      const have = {};
      for (const s of skewers) have[s.type] = (have[s.type] || 0) + 1;
      for (const t of Object.keys(o.skewers)) if ((have[t] || 0) < o.skewers[t]) return false;
      return o.sides.every((sd) => sides.includes(sd));
    });
    const by = PLATE.y + PLATE.h + 8;
    context.fillStyle = canServe ? '#2e9e4f' : '#5a5348';
    rr(context, PLATE.x + 8, by, 180, 40, 9);
    context.fill();
    text('✅ SAJIKAN  (S)', PLATE.x + 98, by + 26, 15, '#fff', 'center', true);
    context.fillStyle = '#7d5a2e';
    rr(context, PLATE.x + 196, by, 92, 40, 9);
    context.fill();
    text('🗑 BUANG (X)', PLATE.x + 242, by + 26, 13, '#fdf6e3', 'center', true);
    if (canServe) text('✓ cocok dengan pesanan!', PLATE.cx, by + 58, 13, '#7ec850', 'center', true);
  }

  function drawBins(state) {
    // Wooden counter.
    context.fillStyle = PALETTE.woodDark;
    rr(context, 12, BINS.y - 14, FIELD.width - 24, BINS.h + 26, 12);
    context.fill();
    context.fillStyle = PALETTE.counterTop;
    rr(context, 12, BINS.y - 14, FIELD.width - 24, 14, 7);
    context.fill();
    text('🧺  MEJA BAHAN — klik bahan atau tekan 1–7', 28, BINS.y - 10, 14, '#ffcf8a', 'left', true);
    for (let i = 0; i < INGREDIENTS.length; i += 1) {
      const ing = INGREDIENTS[i];
      const r = binRect(i);
      const carrying = state.carry && state.carry.type === ing.id;
      context.fillStyle = carrying ? '#5a4020' : '#3d2a16';
      rr(context, r.x, r.y, r.w, r.h, 10);
      context.fill();
      context.strokeStyle = carrying ? '#ffd23d' : '#6b4a26';
      context.lineWidth = carrying ? 3 : 2;
      context.stroke();
      // Ingredient icon.
      const cx = r.x + r.w / 2;
      const cy = r.y + 52;
      if (ing.id === 'tea') {
        context.fillStyle = '#e8a33d';
        rr(context, cx - 18, cy - 24, 36, 48, 5);
        context.fill();
        context.fillStyle = '#fff';
        context.fillRect(cx - 22, cy - 34, 6, 26);
        context.fillStyle = '#c9e8f5';
        context.fillRect(cx - 18, cy - 24, 36, 8);
      } else if (ing.id === 'sauce') {
        context.fillStyle = '#b06a2e';
        context.beginPath();
        context.ellipse(cx, cy + 6, 42, 20, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#8a4d1c';
        context.beginPath();
        context.ellipse(cx, cy, 42, 18, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#d98a3d';
        context.beginPath();
        context.arc(cx - 12, cy - 2, 6, 0, Math.PI * 2);
        context.arc(cx + 10, cy + 2, 5, 0, Math.PI * 2);
        context.fill();
      } else if (ing.id === 'lontong') {
        context.fillStyle = '#eef3d8';
        for (let j = 0; j < 3; j += 1) {
          rr(context, cx - 44 + j * 30, cy - 14 + (j % 2) * 8, 28, 22, 5);
          context.fill();
          context.strokeStyle = '#7d9c4a';
          context.lineWidth = 1;
          context.stroke();
        }
      } else if (ing.id === 'cucumber') {
        context.fillStyle = '#7ec850';
        for (let j = 0; j < 3; j += 1) {
          context.beginPath();
          context.arc(cx - 30 + j * 30, cy + (j % 2) * 10, 13, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#d8f5b0';
          context.beginPath();
          context.arc(cx - 30 + j * 30, cy + (j % 2) * 10, 7, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = '#7ec850';
        }
      } else {
        drawSkewerShape(cx, cy, 120, ing.color, ing.dark, -0.08);
        drawSkewerShape(cx, cy + 22, 120, ing.color, ing.dark, 0.08);
      }
      text(ing.name, cx, r.y + r.h - 30, 14, PALETTE.text, 'center', true);
      context.fillStyle = '#2b1d10';
      rr(context, r.x + 8, r.y + 8, 24, 24, 6);
      context.fill();
      text(ing.key, r.x + 20, r.y + 26, 14, '#ffd23d', 'center', true);
      if (carrying) text('DI TANGAN ✓', cx, r.y + r.h - 12, 11, '#ffd23d', 'center', true);
    }
  }

  function drawCook(state) {
    const x = state.cook.x;
    const y = COOK.y;
    const bob = Math.sin(state.flicker * 6) * 1.5;
    // Body / apron.
    context.fillStyle = '#f4efe4';
    rr(context, x + 8, y + 30 + bob, 48, 52, 10);
    context.fill();
    context.fillStyle = '#c0392b';
    context.fillRect(x + 8, y + 30 + bob, 48, 10);
    // Head.
    context.fillStyle = '#f2c49b';
    context.beginPath();
    context.arc(x + 32, y + 18 + bob, 17, 0, Math.PI * 2);
    context.fill();
    // Chef hat.
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(x + 32, y + 4 + bob, 15, Math.PI, 0);
    context.fill();
    context.fillRect(x + 17, y + 2 + bob, 30, 8);
    // Eyes + smile.
    context.fillStyle = '#2b1d10';
    context.beginPath();
    context.arc(x + 26, y + 16 + bob, 2, 0, Math.PI * 2);
    context.arc(x + 38, y + 16 + bob, 2, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#2b1d10';
    context.lineWidth = 1.5;
    context.beginPath();
    context.arc(x + 32, y + 22 + bob, 6, 0.2, Math.PI - 0.2);
    context.stroke();
    // Hands: what is carried floats above.
    if (state.carry) {
      const ing = ingredientById(state.carry.type);
      const cy = y - 18 + bob;
      if (state.carry.kind === 'raw') drawSkewerShape(x + 32, cy, 90, ing.color, ing.dark, -0.1);
      else if (state.carry.kind === 'cooked') drawSkewerShape(x + 32, cy, 90, state.carry.quality === 'perfect' ? '#8a5a1e' : ing.color, ing.dark, -0.1);
      else {
        context.fillStyle = ing.color;
        context.beginPath();
        context.arc(x + 32, cy, 13, 0, Math.PI * 2);
        context.fill();
      }
      text(ing.name, x + 32, y - 32 + bob, 12, '#ffd23d', 'center', true);
    }
  }

  function drawHud(state, screen) {
    context.fillStyle = 'rgba(16,10,24,0.92)';
    context.fillRect(0, 0, FIELD.width, 64);
    context.fillStyle = '#3a2a4a';
    context.fillRect(0, 64, FIELD.width, 3);
    text('🔥 SATAY SMOKE', 20, 40, 26, '#ffd23d', 'left', true);
    // Timer.
    const frac = Math.max(0, state.timeLeft / SHIFT_SECONDS);
    context.fillStyle = 'rgba(255,255,255,0.14)';
    rr(context, 430, 20, 300, 26, 13);
    context.fill();
    context.fillStyle = frac > 0.5 ? '#7ec850' : frac > 0.25 ? '#f2a33c' : '#e5534b';
    rr(context, 430, 20, 300 * frac, 26, 13);
    context.fill();
    text(`⏱ ${fmtTime(state.timeLeft)}`, 580, 40, 18, '#fff', 'center', true);
    text('SHIFT', 446, 40, 12, 'rgba(255,255,255,0.85)', 'left', true);
    // Coins / served / combo.
    text(`🪙 ${state.coins}`, 790, 40, 22, PALETTE.gold, 'left', true);
    text(`🍽 ${state.served} tersaji`, 920, 40, 16, PALETTE.text);
    if (state.combo >= 2) {
      text(`🔥 KOMBO ×${state.combo}`, 1080, 40, 18, '#ff7a1a', 'left', true);
    }
    // Fan indicator.
    if (state.fan) {
      context.fillStyle = '#ff7a1a';
      rr(context, 330, 78, 130, 26, 8);
      context.fill();
      text('💨 MENGIPAS…', 395, 96, 13, '#fff', 'center', true);
    }
  }

  function drawField(state) {
    drawSky(state);
    drawAwning();
    drawBoard(state);
    drawGrill(state);
    drawPlateArea(state);
    drawBins(state);
    drawCook(state);
  }

  function panel(title, lines, prompt, accent) {
    const w = 640;
    const h = 150 + lines.length * 32;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    context.fillStyle = 'rgba(10,6,16,0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = '#241a2e';
    rr(context, x, y, w, h, 16);
    context.fill();
    context.strokeStyle = accent || '#ffd23d';
    context.lineWidth = 3;
    context.stroke();
    text(title, FIELD.width / 2, y + 56, 40, accent || '#ffd23d', 'center', true);
    lines.forEach((line, i) => text(line, FIELD.width / 2, y + 104 + i * 32, 18, PALETTE.text, 'center'));
    text(prompt, FIELD.width / 2, y + h - 26, 16, PALETTE.muted, 'center');
  }

  function draw(state, screen, best) {
    resize();
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    context.fillStyle = '#0d0812';
    context.fillRect(-view.x / view.scale, -view.y / view.scale, FIELD.width + 2 * view.x / view.scale, FIELD.height + 2 * view.y / view.scale);
    drawField(state);
    drawHud(state, screen);
    if (screen === SCREEN_TITLE) {
      panel('🔥 SATAY SMOKE', [
        'Night Market Grill — warung sate di pasar malam.',
        'Ambil sate dari meja bahan, panggang di atas arang,',
        'balik sebelum gosong, sajikan dengan bumbu & lontong',
        'sebelum kesabaran pelanggan habis. Shift: 2½ menit.',
        'Tahan SPASI untuk mengipas arang — lebih cepat, lebih berisiko.',
      ], 'Tekan SPASI atau klik untuk mulai  •  ← → / A D bergerak  •  1–7 ambil bahan', '#ffd23d');
    } else if (screen === SCREEN_PAUSED) {
      panel('⏸ JEDA', ['Istirahat sebentar — arang tetap panas.', `Koin: ${state.coins}   •   Tersaji: ${state.served}   •   Kombo terbaik: ×${state.bestCombo}`], 'Tekan P atau klik untuk lanjut', '#4fc3f7');
    } else if (screen === SCREEN_OVER) {
      const lines = [
        `Koin malam ini: ${state.coins}   •   Pesanan tersaji: ${state.served}   •   Hangus / kabur: ${state.lost}`,
        `Kombo terbaik: ×${state.bestCombo}`,
        state.coins > best ? '★ Rekor baru! Warungmu makin ramai.' : `Rekor terbaik: ${best} koin`,
      ];
      panel('🌙 SHIFT SELESAI', lines, 'Tekan SPASI atau klik untuk main lagi', '#7ec850');
    }
  }

  return { draw };
}
