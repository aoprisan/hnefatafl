import { Board, ORTHO } from "./board";
import { allMoves, applyMove, movesFrom, statusOf } from "./rules";
import { Piece, type Coord, type Move, type Side } from "./types";

const WIN = 1_000_000;

/** Tunable weights for the static evaluation — the heart of an AI "personality". */
export interface EvalWeights {
  material: number; // value of each soldier
  kingDistance: number; // reward for the king being far from a corner (attacker view)
  kingMobility: number; // penalty per king escape square (attacker view)
  kingSurround: number; // reward per attacker adjacent to the king (attacker view)
}

/**
 * Named AI personalities ("Jarls"). Each is the same minimax engine with a
 * different evaluation emphasis, giving distinct, recognisable styles of play.
 */
export interface Jarl {
  id: string;
  name: string;
  blurb: string;
  weights: EvalWeights;
}

export const JARLS: Jarl[] = [
  {
    id: "ragnar",
    name: "Ragnar the Reckless",
    blurb: "Lusts for blood — over-values captures, light on patience.",
    weights: { material: 10, kingDistance: 2, kingMobility: 0.5, kingSurround: 5 },
  },
  {
    id: "bjorn",
    name: "Björn the Patient",
    blurb: "Slowly boxes the king in; prizes position over plunder.",
    weights: { material: 4, kingDistance: 6, kingMobility: 3, kingSurround: 14 },
  },
  {
    id: "hilda",
    name: "Hilda Wall-Builder",
    blurb: "A balanced, textbook strategist.",
    weights: { material: 6, kingDistance: 4, kingMobility: 1.5, kingSurround: 10 },
  },
];

export const DEFAULT_JARL = JARLS[2];

export function jarlById(id: string): Jarl {
  return JARLS.find((j) => j.id === id) ?? DEFAULT_JARL;
}

/** Manhattan distance from the king to the nearest corner. */
function kingCornerDistance(board: Board): number {
  const king = board.findKing();
  if (!king) return board.size * 2;
  let best = Infinity;
  for (const c of board.variant.corners) {
    best = Math.min(best, Math.abs(c.col - king.col) + Math.abs(c.row - king.row));
  }
  return best;
}

function countAdjacentAttackers(board: Board, king: Coord): number {
  let n = 0;
  for (const d of ORTHO) {
    const c: Coord = { col: king.col + d.col, row: king.row + d.row };
    if (board.inBounds(c) && board.get(c) === Piece.Attacker) n++;
  }
  return n;
}

/**
 * Static evaluation from the attackers' perspective (positive favors attackers).
 * Combines material, the king's distance to a corner, the king's mobility, and
 * how boxed-in the king is, each scaled by the active personality's weights.
 */
export function evaluate(board: Board, w: EvalWeights = DEFAULT_JARL.weights): number {
  const attackers = board.piecesOf("attackers").length;
  const defenders = board
    .piecesOf("defenders")
    .filter((c) => board.get(c) === Piece.Defender).length;

  let score = 0;
  score += attackers * w.material;
  score -= defenders * w.material;
  score += kingCornerDistance(board) * w.kingDistance;

  const king = board.findKing();
  if (king) {
    score -= movesFrom(board, king).length * w.kingMobility;
    score += countAdjacentAttackers(board, king) * w.kingSurround;
  }
  return score;
}

/** Order moves so capturing moves are searched first (better alpha-beta cuts). */
function orderMoves(board: Board, moves: Move[]): Move[] {
  return moves
    .map((m) => ({ m, gain: applyMove(board, m).applied.captures.length }))
    .sort((a, b) => b.gain - a.gain)
    .map((x) => x.m);
}

function search(
  board: Board,
  toMove: Side,
  depth: number,
  alpha: number,
  beta: number,
  w: EvalWeights,
): number {
  const status = statusOf(board);
  if (status.kind === "win") {
    return status.winner === "attackers" ? WIN + depth : -(WIN + depth);
  }
  if (depth === 0) return evaluate(board, w);

  const moves = orderMoves(board, allMoves(board, toMove));
  if (moves.length === 0) {
    return toMove === "attackers" ? -(WIN + depth) : WIN + depth;
  }

  if (toMove === "attackers") {
    let best = -Infinity;
    for (const m of moves) {
      const child = applyMove(board, m).board;
      const v = search(child, "defenders", depth - 1, alpha, beta, w);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const child = applyMove(board, m).board;
      const v = search(child, "attackers", depth - 1, alpha, beta, w);
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

export interface AIOptions {
  depth: number;
  weights?: EvalWeights;
}

/**
 * Choose the best move for `side` using alpha-beta minimax to `depth`, scored by
 * the given personality weights. Returns null if the side has no legal moves.
 */
export function chooseMove(board: Board, side: Side, opts: AIOptions): Move | null {
  const w = opts.weights ?? DEFAULT_JARL.weights;
  const depth = opts.depth;
  const moves = orderMoves(board, allMoves(board, side));
  if (moves.length === 0) return null;

  const maximizing = side === "attackers";
  let bestMove = moves[0];
  let bestScore = maximizing ? -Infinity : Infinity;
  let alpha = -Infinity;
  let beta = Infinity;

  for (const m of moves) {
    const child = applyMove(board, m).board;
    const other: Side = side === "attackers" ? "defenders" : "attackers";
    const v = search(child, other, depth - 1, alpha, beta, w);
    if (maximizing) {
      if (v > bestScore) {
        bestScore = v;
        bestMove = m;
      }
      if (bestScore > alpha) alpha = bestScore;
    } else {
      if (v < bestScore) {
        bestScore = v;
        bestMove = m;
      }
      if (bestScore < beta) beta = bestScore;
    }
  }
  return bestMove;
}
