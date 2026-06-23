import "./style.css";
import { registerSW } from "virtual:pwa-register";

import { Game } from "./game/game";
import { chooseMove } from "./game/ai";
import { movesFrom } from "./game/rules";
import { Board, coordEq } from "./game/board";
import { VARIANTS, DEFAULT_VARIANT } from "./game/variants";
import { Piece, type Coord, type Side, type Variant } from "./game/types";
import { BoardRenderer, type RenderState } from "./ui/renderer";

type Mode = "ai" | "two-player";

interface UISettings {
  variant: Variant;
  mode: Mode;
  aiSide: Side;
  depth: number;
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el as T;
};

// --- Elements ---
const canvas = $("board") as HTMLCanvasElement;
const statusEl = $("status");
const moveListEl = $("move-list");
const variantSel = $("variant") as HTMLSelectElement;
const modeSel = $("mode") as HTMLSelectElement;
const aiSideSel = $("ai-side") as HTMLSelectElement;
const difficultySel = $("difficulty") as HTMLSelectElement;
const aiSideRow = $("ai-side-row");
const difficultyRow = $("difficulty-row");

// --- State ---
const settings: UISettings = {
  variant: DEFAULT_VARIANT,
  mode: "ai",
  aiSide: "attackers",
  depth: 2,
};

let game = new Game(settings.variant);
let selected: Coord | null = null;
let legalTargets: Coord[] = [];
let aiThinking = false;

// Populate the variant selector.
for (const v of Object.values(VARIANTS)) {
  const opt = document.createElement("option");
  opt.value = v.id;
  opt.textContent = v.name;
  variantSel.appendChild(opt);
}
variantSel.value = settings.variant.id;

const renderer = new BoardRenderer(canvas, onSquareTap);

function render(): void {
  renderer.resize(game.board.size);
  const state: RenderState = {
    board: game.board,
    selected,
    legalTargets,
    lastMove: game.lastMove,
  };
  renderer.draw(state);
  renderStatus();
  renderHistory();
}

function renderStatus(): void {
  const s = game.status;
  statusEl.classList.toggle("win", s.kind === "win");
  if (s.kind === "win") {
    const who = s.winner === "defenders" ? "Defenders" : "Attackers";
    const why =
      s.reason === "king-escaped" ? "the king escaped!" : "the king was captured!";
    statusEl.textContent = `${who} win — ${why}`;
  } else if (aiThinking) {
    statusEl.textContent = "AI is thinking…";
  } else {
    const side = game.turn === "defenders" ? "Defenders" : "Attackers";
    statusEl.textContent = `${side} to move`;
  }
}

function squareName(c: Coord): string {
  // Columns a.. ; rows numbered from the bottom for readability.
  const file = String.fromCharCode(97 + c.col);
  const rank = game.board.size - c.row;
  return `${file}${rank}`;
}

function renderHistory(): void {
  moveListEl.innerHTML = "";
  for (const m of game.moves) {
    const li = document.createElement("li");
    const cap = m.captures.length ? ` ×${m.captures.length}` : "";
    li.innerHTML = `${squareName(m.from)}→${squareName(m.to)}<span class="cap">${cap}</span>`;
    moveListEl.appendChild(li);
  }
  moveListEl.scrollTop = moveListEl.scrollHeight;
}

function humanControls(side: Side): boolean {
  if (settings.mode === "two-player") return true;
  return side !== settings.aiSide;
}

function onSquareTap(c: Coord): void {
  if (game.isOver || aiThinking) return;
  if (!game.board.inBounds(c)) return;
  if (!humanControls(game.turn)) return;

  const piece = game.board.get(c);
  const pieceSide = Board.sideOf(piece);

  // Tapping a legal target moves there.
  if (selected && legalTargets.some((t) => coordEq(t, c))) {
    const move = { from: selected, to: c };
    selected = null;
    legalTargets = [];
    game.play(move);
    render();
    maybeRunAI();
    return;
  }

  // Tapping one of your own pieces selects it.
  if (pieceSide === game.turn && piece !== Piece.Empty) {
    selected = c;
    legalTargets = movesFrom(game.board, c).map((m) => m.to);
  } else {
    selected = null;
    legalTargets = [];
  }
  render();
}

function maybeRunAI(): void {
  if (settings.mode !== "ai") return;
  if (game.isOver) return;
  if (game.turn !== settings.aiSide) return;

  aiThinking = true;
  renderStatus();
  // Defer so the UI can paint the "thinking" state before the (sync) search.
  setTimeout(() => {
    const move = chooseMove(game.board, settings.aiSide, settings.depth);
    if (move) game.play(move);
    aiThinking = false;
    render();
    // Chain in case the AI controls both… (not in standard modes, but safe).
    maybeRunAI();
  }, 30);
}

// --- Controls ---
function newGame(switchSides = false): void {
  if (switchSides) {
    settings.aiSide = settings.aiSide === "attackers" ? "defenders" : "attackers";
    aiSideSel.value = settings.aiSide;
  }
  game = new Game(settings.variant);
  selected = null;
  legalTargets = [];
  aiThinking = false;
  render();
  maybeRunAI();
}

$("new-game").addEventListener("click", () => newGame(false));

$("undo").addEventListener("click", () => {
  if (aiThinking) return;
  // In AI mode undo a full round so it's the human's turn again.
  game.undo();
  if (settings.mode === "ai" && game.turn === settings.aiSide && game.moves.length > 0) {
    game.undo();
  }
  selected = null;
  legalTargets = [];
  render();
});

variantSel.addEventListener("change", () => {
  settings.variant = VARIANTS[variantSel.value] ?? DEFAULT_VARIANT;
  newGame(false);
});

modeSel.addEventListener("change", () => {
  settings.mode = modeSel.value as Mode;
  updateSettingsVisibility();
  newGame(false);
});

aiSideSel.addEventListener("change", () => {
  settings.aiSide = aiSideSel.value as Side;
  newGame(false);
});

difficultySel.addEventListener("change", () => {
  settings.depth = parseInt(difficultySel.value, 10);
});

function updateSettingsVisibility(): void {
  const isAI = settings.mode === "ai";
  aiSideRow.classList.toggle("hidden", !isAI);
  difficultyRow.classList.toggle("hidden", !isAI);
}

// --- Boot ---
window.addEventListener("resize", () => render());
updateSettingsVisibility();
render();
maybeRunAI();

// Register the service worker for offline/installable behavior.
registerSW({ immediate: true });
