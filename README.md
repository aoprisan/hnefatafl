# Hnefatafl — Viking Chess (PWA)

A self-contained, installable **Progressive Web App** of Hnefatafl, the Norse
"king's table" board game. Built with **TypeScript + Vite + `vite-plugin-pwa`**.
No backend, no game libraries — pure TypeScript for the rules engine and a
`<canvas>` renderer with a dark Norse aesthetic. Mobile-first and touch-friendly.

- 🪓 Local **two-player** mode and **human-vs-AI** mode
- 🧠 Minimax + alpha-beta **AI** for either side, three difficulty levels
- 📜 Move history, **undo**, new game / switch sides
- ✨ Highlights legal moves, the last move, and captures
- 📦 Offline-capable & **installable** (service worker + web manifest)
- 🧩 **Data-driven** variants — ships with Fetlar 11×11 and Brandub 7×7

## Run it

```bash
npm install
npm run dev      # development server (Vite)
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
npm test         # run the unit tests (Vitest)
```

Open the dev URL Vite prints (default http://localhost:5173). To try the
installable/offline behavior, run `npm run build && npm run preview` and use your
browser's "Install app" action.

## How to play

Tap one of your pieces to highlight its legal moves, then tap a destination.
In human-vs-AI mode the AI replies automatically. **Defenders move first.**

### Rules (Fetlar / 11×11 standard)

- **Board:** 11×11. The center square (5,5) is the **throne**; the four
  **corners** are the escape squares. Only the **king** may stop on or pass
  through the throne and corners.
- **Movement:** every piece moves orthogonally any distance, rook-style — no
  jumping, no landing on an occupied square.
- **Sides:** Defenders = the **king** (on the throne) + 12 soldiers in a
  diamond around it. Attackers = 24 soldiers in four groups of 6 at the edge
  midpoints.
- **Capture (custodial):** flank an enemy soldier between two friendlies — or
  one friendly plus a **hostile square** (a corner, or the **empty throne**) —
  on opposite orthogonal sides. Capture is triggered **only by the moving
  player's move**; moving *into* a sandwich is safe. A single move can capture
  in multiple directions at once.
- **King capture:** the king is taken only when **surrounded on all four
  orthogonal sides** by attackers. A throne, corner, or the board edge adjacent
  to the king counts as one of those sides.
- **Win:** Defenders win if the **king reaches a corner**; Attackers win if the
  **king is captured**.

## Architecture

The code is split into a **pure, DOM-free game-logic module** and a thin UI
layer, so the rules are fully unit-testable and reusable.

```
src/
  game/            # pure rules engine — no DOM, no rendering
    types.ts       #   Coord, Piece, Move, Side, Variant, GameStatus
    variants.ts    #   data-driven layouts (Fetlar 11×11, Brandub 7×7)
    board.ts       #   Board state + special-square predicates
    rules.ts       #   legal moves, capture resolution, win detection
    game.ts        #   Game controller: turns, history, undo
    ai.ts          #   minimax + alpha-beta over a material/king eval
  ui/
    renderer.ts    # canvas rendering + pointer→square hit-testing
  main.ts          # wires game + renderer + controls + PWA registration
tests/             # Vitest: capture (incl. hostile squares) & win detection
scripts/
  generate-icons.mjs  # produces the PWA PNG icons (no image deps)
```

### AI

The opponent uses **minimax with alpha-beta pruning** (configurable depth 1–3)
over a static evaluation combining: material balance, the king's distance to the
nearest corner, the king's mobility, and how many attackers surround the king.
Capturing moves are searched first to improve pruning. The AI side and
difficulty are configurable in the UI.

### Adding a variant

Variants are **pure data**. Add a `Variant` to `src/game/variants.ts` (board
size, throne, corners, and starting coordinates) and register it in `VARIANTS`;
it appears in the variant selector automatically. The engine reads everything
from the variant — no rules code changes needed for board size or layout.

## Tests

```bash
npm test
```

Covers capture mechanics (basic custodial, hostile-square captures against the
empty throne and corners, "safe to move into a sandwich", multi-capture, and the
king's immunity to flanking), king-capture conditions (including throne / corner
/ edge as a wall), king escape, move generation, and the game controller.

## License

MIT
