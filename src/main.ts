import "./style.css";
import { registerSW } from "virtual:pwa-register";

import { Game } from "./game/game";
import { chooseMove, JARLS, jarlById, DEFAULT_JARL, type Jarl } from "./game/ai";
import { movesFrom } from "./game/rules";
import { Board, coordEq } from "./game/board";
import { threatenedSquares, kingEscapePath } from "./game/analysis";
import { encodeGame, decodeGame } from "./game/share";
import {
  SAGA,
  buildLoadout,
  battleJarl,
  loadProgress,
  saveProgress,
  freshProgress,
  offerBoons,
  boonById,
  type SagaProgress,
} from "./game/saga";
import { VARIANTS, DEFAULT_VARIANT } from "./game/variants";
import { Piece, type Coord, type Side, type Variant, type RuleFlags } from "./game/types";
import { BoardRenderer, type RenderState } from "./ui/renderer";

type Mode = "ai" | "two-player" | "saga";

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
const jarlSel = $("jarl") as HTMLSelectElement;
const jarlBlurb = $("jarl-blurb");
const aiSideSel = $("ai-side") as HTMLSelectElement;
const difficultySel = $("difficulty") as HTMLSelectElement;
const jarlRow = $("jarl-row");
const aiSideRow = $("ai-side-row");
const difficultyRow = $("difficulty-row");
const dangerBtn = $("danger") as HTMLButtonElement;
const shareBtn = $("share") as HTMLButtonElement;
const toastEl = $("toast");

// Saga elements
const sagaPanel = $("saga-panel");
const sagaTitle = $("saga-title");
const sagaProgressEl = $("saga-progress");
const sagaIntro = $("saga-intro");
const sagaBoons = $("saga-boons");
const boonDraft = $("boon-draft");
const boonChoices = $("boon-choices");

// --- Settings/state ---
const settings = {
  variant: DEFAULT_VARIANT as Variant,
  mode: "ai" as Mode,
  aiSide: "attackers" as Side,
  depth: 2,
  jarl: DEFAULT_JARL as Jarl,
  showDanger: false,
};

let game = new Game(settings.variant);
let selected: Coord | null = null;
let legalTargets: Coord[] = [];
let aiThinking = false;

let saga: SagaProgress = loadProgress();
let sagaResolved = false; // guards one-time handling of a finished battle

// --- Populate selectors ---
for (const v of Object.values(VARIANTS)) {
  const opt = document.createElement("option");
  opt.value = v.id;
  opt.textContent = v.name;
  variantSel.appendChild(opt);
}
variantSel.value = settings.variant.id;

for (const j of JARLS) {
  const opt = document.createElement("option");
  opt.value = j.id;
  opt.textContent = j.name;
  jarlSel.appendChild(opt);
}
jarlSel.value = settings.jarl.id;

const renderer = new BoardRenderer(canvas, onSquareTap);

// --- Rendering ---
function render(): void {
  renderer.resize(game.board.size);
  renderer.draw(buildRenderState());
  renderStatus();
  renderHistory();
  renderSaga();
}

function ravensSightActive(): boolean {
  return settings.mode === "saga" && saga.boons.includes("farsight");
}

function buildRenderState(): RenderState {
  const state: RenderState = {
    board: game.board,
    selected,
    legalTargets,
    lastMove: game.lastMove,
  };
  const showDanger = settings.showDanger || ravensSightActive();
  if (showDanger && !game.isOver && humanControls(game.turn)) {
    state.danger = threatenedSquares(game.board, game.turn);
    if (game.turn === "defenders") state.escapePath = kingEscapePath(game.board);
  }
  return state;
}

function renderStatus(): void {
  const s = game.status;
  statusEl.classList.toggle("win", s.kind === "win");
  if (s.kind === "win") {
    const who = s.winner === "defenders" ? "Defenders" : "Attackers";
    const why = s.reason === "king-escaped" ? "the king escaped!" : "the king was captured!";
    statusEl.textContent = `${who} win — ${why}`;
  } else if (aiThinking) {
    statusEl.textContent = `${settings.mode === "saga" ? settings.jarl.name : "AI"} is thinking…`;
  } else {
    const side = game.turn === "defenders" ? "Defenders" : "Attackers";
    statusEl.textContent = `${side} to move`;
  }
}

function squareName(c: Coord): string {
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

// --- Input ---
function humanControls(side: Side): boolean {
  if (settings.mode === "two-player") return true;
  return side !== settings.aiSide; // ai + saga: AI plays settings.aiSide
}

function onSquareTap(c: Coord): void {
  if (game.isOver || aiThinking) return;
  if (!game.board.inBounds(c)) return;
  if (!humanControls(game.turn)) return;

  const piece = game.board.get(c);
  const pieceSide = Board.sideOf(piece);

  if (selected && legalTargets.some((t) => coordEq(t, c))) {
    const move = { from: selected, to: c };
    selected = null;
    legalTargets = [];
    game.play(move);
    afterMove();
    return;
  }

  if (pieceSide === game.turn && piece !== Piece.Empty) {
    selected = c;
    legalTargets = movesFrom(game.board, c).map((m) => m.to);
  } else {
    selected = null;
    legalTargets = [];
  }
  render();
}

function afterMove(): void {
  render();
  if (game.isOver) {
    handleGameOver();
    return;
  }
  maybeRunAI();
}

function maybeRunAI(): void {
  if (settings.mode === "two-player") return;
  if (game.isOver || game.turn !== settings.aiSide) return;

  aiThinking = true;
  renderStatus();
  setTimeout(() => {
    const move = chooseMove(game.board, settings.aiSide, {
      depth: settings.depth,
      weights: settings.jarl.weights,
    });
    if (move) game.play(move);
    aiThinking = false;
    render();
    if (game.isOver) handleGameOver();
    else maybeRunAI();
  }, 30);
}

// --- Game lifecycle ---
function startStandardGame(): void {
  game = new Game(settings.variant);
  selected = null;
  legalTargets = [];
  aiThinking = false;
  render();
  maybeRunAI();
}

function startGameFrom(variant: Variant, rules?: RuleFlags): void {
  game = new Game(variant, rules);
  selected = null;
  legalTargets = [];
  aiThinking = false;
  render();
  maybeRunAI();
}

// --- Saga ---
function startBattle(index: number): void {
  saga.battleIndex = Math.min(index, SAGA.length - 1);
  const battle = SAGA[saga.battleIndex];
  const loadout = buildLoadout(battle, saga.boons);
  settings.mode = "saga";
  settings.aiSide = "attackers"; // human always leads the defenders in the saga
  settings.depth = battle.aiDepth;
  settings.jarl = battleJarl(battle);
  sagaResolved = false;
  boonDraft.classList.add("hidden");
  saveProgress(saga);
  syncControlsToSettings();
  startGameFrom(loadout.variant, loadout.rules);
}

function handleGameOver(): void {
  if (settings.mode !== "saga" || sagaResolved) return;
  sagaResolved = true;
  const s = game.status;
  if (s.kind !== "win") return;

  if (s.winner === "defenders") {
    saga.wins++;
    const isLast = saga.battleIndex >= SAGA.length - 1;
    saveProgress(saga);
    if (isLast) {
      showToast("⚔ Saga complete! The king is free across all lands.");
      renderSaga();
    } else {
      presentBoonDraft();
    }
  } else {
    saga.losses++;
    saveProgress(saga);
    showToast("☠ The king has fallen. Rally and try this battle again.");
    renderSaga();
  }
}

function presentBoonDraft(): void {
  const offered = offerBoons(saga.boons, 3);
  boonChoices.innerHTML = "";
  if (offered.length === 0) {
    // No boons left to take — just advance.
    startBattle(saga.battleIndex + 1);
    return;
  }
  for (const boon of offered) {
    const btn = document.createElement("button");
    btn.className = "boon-card";
    btn.innerHTML = `<strong>${boon.name}</strong><span>${boon.desc}</span>`;
    btn.addEventListener("click", () => {
      saga.boons.push(boon.id);
      saveProgress(saga);
      startBattle(saga.battleIndex + 1);
    });
    boonChoices.appendChild(btn);
  }
  boonDraft.classList.remove("hidden");
  renderSaga();
}

function renderSaga(): void {
  const isSaga = settings.mode === "saga";
  sagaPanel.classList.toggle("hidden", !isSaga);
  if (!isSaga) return;

  const battle = SAGA[saga.battleIndex];
  sagaTitle.textContent = battle.name;
  sagaProgressEl.textContent = `Battle ${saga.battleIndex + 1}/${SAGA.length} · ${saga.wins}W ${saga.losses}L`;
  sagaIntro.textContent = `${battle.intro} Enemy: ${settings.jarl.name}.`;

  sagaBoons.innerHTML = "";
  if (saga.boons.length === 0) {
    sagaBoons.innerHTML = `<span class="muted">No boons yet — win a battle to draft one.</span>`;
  } else {
    for (const id of saga.boons) {
      const b = boonById(id);
      if (!b) continue;
      const chip = document.createElement("span");
      chip.className = "boon-chip";
      chip.textContent = b.name;
      chip.title = b.desc;
      sagaBoons.appendChild(chip);
    }
  }
}

// --- Controls wiring ---
function syncControlsToSettings(): void {
  variantSel.value = settings.variant.id;
  modeSel.value = settings.mode;
  jarlSel.value = settings.jarl.id;
  aiSideSel.value = settings.aiSide;
  difficultySel.value = String(settings.depth);
  jarlBlurb.textContent = settings.mode === "two-player" ? "" : settings.jarl.blurb;
  updateVisibility();
}

function updateVisibility(): void {
  const isAI = settings.mode === "ai";
  const isSaga = settings.mode === "saga";
  const usesAI = isAI || isSaga;
  jarlRow.classList.toggle("hidden", !usesAI);
  difficultyRow.classList.toggle("hidden", !isAI); // saga sets its own depth
  aiSideRow.classList.toggle("hidden", !isAI); // saga: human always defends
  variantSel.disabled = isSaga; // saga picks the variant per battle
  jarlSel.disabled = isSaga;
  shareBtn.classList.toggle("hidden", isSaga); // saga games aren't shareable
}

$("new-game").addEventListener("click", () => {
  if (settings.mode === "saga") startBattle(saga.battleIndex);
  else startStandardGame();
});

$("undo").addEventListener("click", () => {
  if (aiThinking) return;
  game.undo();
  if (settings.mode !== "two-player" && game.turn === settings.aiSide && game.moves.length > 0) {
    game.undo();
  }
  selected = null;
  legalTargets = [];
  render();
});

dangerBtn.addEventListener("click", () => {
  settings.showDanger = !settings.showDanger;
  dangerBtn.setAttribute("aria-pressed", String(settings.showDanger));
  dangerBtn.classList.toggle("active", settings.showDanger);
  render();
});

shareBtn.addEventListener("click", async () => {
  const token = encodeGame(game);
  const url = `${location.origin}${location.pathname}#g=${token}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("🔗 Game link copied — send it to your opponent.");
  } catch {
    showToast(url);
  }
});

variantSel.addEventListener("change", () => {
  settings.variant = VARIANTS[variantSel.value] ?? DEFAULT_VARIANT;
  startStandardGame();
});

modeSel.addEventListener("change", () => {
  settings.mode = modeSel.value as Mode;
  if (settings.mode === "saga") {
    syncControlsToSettings();
    startBattle(saga.battleIndex);
  } else {
    syncControlsToSettings();
    startStandardGame();
  }
});

jarlSel.addEventListener("change", () => {
  settings.jarl = jarlById(jarlSel.value);
  jarlBlurb.textContent = settings.jarl.blurb;
});

aiSideSel.addEventListener("change", () => {
  settings.aiSide = aiSideSel.value as Side;
  startStandardGame();
});

difficultySel.addEventListener("change", () => {
  settings.depth = parseInt(difficultySel.value, 10);
});

$("saga-start").addEventListener("click", () => {
  saga = freshProgress();
  saveProgress(saga);
  settings.mode = "saga";
  syncControlsToSettings();
  startBattle(0);
});

// --- Toast ---
let toastTimer: number | undefined;
function showToast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.add("hidden"), 3600);
}

// --- Boot ---
function bootFromLink(): boolean {
  const m = location.hash.match(/#g=([A-Za-z0-9_-]+)/);
  if (!m) return false;
  const restored = decodeGame(m[1]);
  if (!restored) return false;
  game = restored;
  settings.mode = "two-player";
  settings.variant = restored.variant;
  syncControlsToSettings();
  render();
  showToast("🔗 Loaded a shared game — make your move, then Share it back.");
  return true;
}

window.addEventListener("resize", () => render());
syncControlsToSettings();

if (!bootFromLink()) {
  render();
  maybeRunAI();
}

registerSW({ immediate: true });
