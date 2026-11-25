# 🔥 Satay Smoke: Night Market Grill

[![make.fun bounty](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/Flowjack94/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/Flowjack94/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137)

An entry for the [make.fun bounty "best-cooking-game-20261125-0137"](https://make.fun/bounty/best-cooking-game-20261125-0137) — a complete, original cooking game that runs entirely offline in a desktop browser from static files.

My referral link: https://make.fun/r/bbt3e5as (code `bbt3e5as`)

## The game

You run a satay grill stall at an Indonesian night market at dusk — warm lantern light, glowing charcoal, drifting smoke. Order tickets arrive on the board, each with a dish and a patience bar. Grab skewers from the ingredient bins (chicken, beef, tofu), grill them over the coals, flip them before they stall and burn, fan the charcoal to cook faster (but mind the burn risk), plate the cooked skewers with peanut sauce, lontong, cucumber or es teh, and serve the matching ticket before the customer walks away.

- **Coins** for every dish served, **perfect-timing bonus** for skewers taken in the golden window, **combo bonus** for serving several orders in a row.
- **150-second night shift** with ramping difficulty — orders arrive faster and patience runs shorter as the night goes on.
- **Title, pause and shift-results screens**, best score saved in your browser.
- Seeded, deterministic simulation with a fixed 1/60 s step; no network requests, no libraries.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

## Controls

| Input | Action |
| --- | --- |
| ← → or A / D | Move the cook along the counter |
| 1–7 (or click a bin) | Pick up an ingredient |
| Click a grill slot | Place a raw skewer / flip a cooking skewer / take a cooked one |
| Click the plate | Add what's in hand to the plate |
| S (or click ✅ SAJIKAN / a ticket) | Serve the matching order |
| Hold Space | Fan the coals — cooks faster, burns faster |
| E | Context interact (plate / take / flip / place) |
| X | Clear the plate |
| P / Esc | Pause |

## Screenshots

The cover (`screenshots/1-play.jpg`) shows a full mid-game scene: order board with tickets, skewers mid-cook on the grill with progress bars, ingredient bins, the shift timer and coins, and a plate being assembled. `2-rush.jpg` is the peak rush, `3-start.jpg` the title screen, `4-end.jpg` the shift results.

## License

MIT — see [LICENSE](LICENSE).
