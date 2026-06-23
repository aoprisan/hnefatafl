import { Board, ORTHO, coordEq } from "./board";
import {
  Piece,
  type AppliedMove,
  type Coord,
  type GameStatus,
  type Move,
  type Side,
} from "./types";

/**
 * Can a piece legally stop on / pass through a square?
 *
 * Movement rule: all pieces slide orthogonally any distance, never jumping and
 * never landing on an occupied square. Only the king may enter or pass through
 * the throne and the corners.
 */
function canTraverse(board: Board, c: Coord, isKing: boolean): boolean {
  if (!board.inBounds(c)) return false;
  if (!board.isEmpty(c)) return false;
  if (board.isBlocked(c)) return false; // impassable terrain
  if (board.isRestricted(c) && !isKing) return false;
  return true;
}

/** Generate all legal destinations for the piece on `from`. */
export function movesFrom(board: Board, from: Coord): Move[] {
  const piece = board.get(from);
  if (piece === Piece.Empty) return [];
  const isKing = piece === Piece.King;
  const moves: Move[] = [];

  for (const dir of ORTHO) {
    let to: Coord = { col: from.col + dir.col, row: from.row + dir.row };
    while (canTraverse(board, to, isKing)) {
      moves.push({ from, to: { ...to } });
      to = { col: to.col + dir.col, row: to.row + dir.row };
    }
  }
  return moves;
}

/** Generate every legal move available to `side`. */
export function allMoves(board: Board, side: Side): Move[] {
  const out: Move[] = [];
  for (const from of board.piecesOf(side)) {
    for (const m of movesFrom(board, from)) out.push(m);
  }
  return out;
}

/**
 * Is `anchor` a friendly flank for `side` — i.e. can it form the far wall of a
 * capture? This is true for a friendly piece, a corner, or the empty throne
 * (when the variant treats the throne as hostile).
 */
function isAnchor(board: Board, anchor: Coord, side: Side): boolean {
  if (!board.inBounds(anchor)) return false;
  if (board.isBlocked(anchor)) return false;

  // A friendly piece is always a valid flank.
  if (Board.sideOf(board.get(anchor)) === side) return true;

  // Hostile squares can help capture, unless the "shieldwall" boon protects the
  // defenders from the attackers using them.
  if (side === "attackers" && board.rules.defenderShieldwall) return false;

  if (board.isCorner(anchor) && board.rules.hostileCorners) return true;
  if (board.isThrone(anchor) && board.isEmpty(anchor) && board.rules.hostileThrone) {
    return true;
  }
  if (board.isSanctuary(anchor) && board.isEmpty(anchor)) return true;

  return false;
}

/**
 * Resolve custodial captures triggered by `mover` (the moving side) landing on
 * `to`. The king is never captured this way — see {@link isKingCaptured}.
 * Returns the squares of captured pieces (already removed from `board`).
 */
export function resolveCaptures(board: Board, to: Coord, mover: Side): Coord[] {
  const captured: Coord[] = [];

  for (const dir of ORTHO) {
    const adj: Coord = { col: to.col + dir.col, row: to.row + dir.row };
    if (!board.inBounds(adj)) continue;

    const target = board.get(adj);
    const targetSide = Board.sideOf(target);
    // Must be an enemy soldier; the king cannot be flanked.
    if (targetSide === null || targetSide === mover || target === Piece.King) continue;

    const beyond: Coord = { col: adj.col + dir.col, row: adj.row + dir.row };
    if (isAnchor(board, beyond, mover)) {
      board.set(adj, Piece.Empty);
      captured.push({ ...adj });
    }
  }

  return captured;
}

/**
 * The king is captured when surrounded on all four orthogonal sides by
 * attackers. A side counts as "surrounded" if it is an attacker, the throne, a
 * corner, or off the board edge.
 */
export function isKingCaptured(board: Board): boolean {
  const king = board.findKing();
  if (!king) return true; // No king on the board => captured/gone.

  for (const dir of ORTHO) {
    const adj: Coord = { col: king.col + dir.col, row: king.row + dir.row };
    if (!board.inBounds(adj)) continue; // edge counts as a wall
    if (board.isThrone(adj) || board.isCorner(adj)) continue; // restricted square counts
    if (board.isBlocked(adj) || board.isSanctuary(adj)) continue; // terrain counts as a wall
    if (board.get(adj) === Piece.Attacker) continue; // attacker counts
    return false; // open side
  }
  return true;
}

/** Has the king reached a corner (defenders win)? */
export function isKingEscaped(board: Board): boolean {
  const king = board.findKing();
  return king !== null && board.isCorner(king);
}

/**
 * Apply a move to a fresh clone, resolving captures and reporting the result.
 * The input board is not mutated.
 */
export function applyMove(board: Board, move: Move): { board: Board; applied: AppliedMove } {
  const next = board.clone();
  const piece = next.get(move.from);
  const side = Board.sideOf(piece);
  if (side === null) {
    throw new Error("applyMove: no piece on the source square");
  }

  next.set(move.from, Piece.Empty);
  next.set(move.to, piece);

  const captures = resolveCaptures(next, move.to, side);

  return {
    board: next,
    applied: { ...move, side, piece, captures },
  };
}

/** Evaluate terminal conditions for the position. */
export function statusOf(board: Board): GameStatus {
  if (isKingEscaped(board)) {
    return { kind: "win", winner: "defenders", reason: "king-escaped" };
  }
  if (isKingCaptured(board)) {
    return { kind: "win", winner: "attackers", reason: "king-captured" };
  }
  return { kind: "playing" };
}

/** Is `move` legal for the piece currently on its source square? */
export function isLegalMove(board: Board, move: Move): boolean {
  return movesFrom(board, move.from).some((m) => coordEq(m.to, move.to));
}
