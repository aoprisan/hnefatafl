import { Board, ORTHO } from "./board";
import { allMoves, applyMove, movesFrom, statusOf } from "./rules";
import { Piece, type Coord, type Move, type Side } from "./types";

const WIN = 1_000_000;

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
 * how boxed-in the king is.
 */
export function evaluate(board: Board): number {
  const attackers = board.piecesOf("attackers").length;
  // Defenders excluding the king (the king is scored separately, below).
  const defenders = board
    .piecesOf("defenders")
    .filter((c) => board.get(c) === Piece.Defender).length;

  let score = 0;
  score += attackers * 6;
  score -= defenders * 6;

  // King far from a corner is good for attackers.
  score += kingCornerDistance(board) * 4;

  const king = board.findKing();
  if (king) {
    // Fewer escape squares for the king is good for attackers.
    score -= movesFrom(board, king).length * 1.5;
    // Surrounding the king is good for attackers.
    score += countAdjacentAttackers(board, king) * 10;
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
): number {
  const status = statusOf(board);
  if (status.kind === "win") {
    // Prefer faster wins by nudging the score with remaining depth.
    return status.winner === "attackers" ? WIN + depth : -(WIN + depth);
  }
  if (depth === 0) return evaluate(board);

  const moves = orderMoves(board, allMoves(board, toMove));
  if (moves.length === 0) {
    // No legal move: treat as a loss for the side to move.
    return toMove === "attackers" ? -(WIN + depth) : WIN + depth;
  }

  if (toMove === "attackers") {
    let best = -Infinity;
    for (const m of moves) {
      const child = applyMove(board, m).board;
      const v = search(child, "defenders", depth - 1, alpha, beta);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const child = applyMove(board, m).board;
      const v = search(child, "attackers", depth - 1, alpha, beta);
      if (v < best) best = v;
      if (best < beta) beta = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

/**
 * Choose the best move for `side` using alpha-beta minimax to `depth`.
 * Returns null if the side has no legal moves.
 */
export function chooseMove(board: Board, side: Side, depth: number): Move | null {
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
    const v = search(child, other, depth - 1, alpha, beta);
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
