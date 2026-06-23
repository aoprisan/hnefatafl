import { Board, coordEq } from "./board";
import { allMoves, applyMove, movesFrom } from "./rules";
import { Piece, type Coord, type Side } from "./types";

/**
 * Squares currently occupied by `side` that the opponent could capture on their
 * very next move. Pure analysis used by the "danger" overlay — it never mutates
 * the live board.
 */
export function threatenedSquares(board: Board, side: Side): Coord[] {
  const enemy: Side = side === "attackers" ? "defenders" : "attackers";
  const danger: Coord[] = [];
  const seen = new Set<number>();

  for (const move of allMoves(board, enemy)) {
    const { applied } = applyMove(board, move);
    for (const cap of applied.captures) {
      const key = cap.row * board.size + cap.col;
      if (!seen.has(key)) {
        seen.add(key);
        danger.push(cap);
      }
    }
  }
  return danger;
}

/**
 * The king's shortest escape route to a corner, as a list of squares (the
 * king's own moves), or null if no route exists ignoring enemy interference.
 * A breadth-first search over king slide-moves; great as a teaching hint.
 */
export function kingEscapePath(board: Board): Coord[] | null {
  const king = board.findKing();
  if (!king) return null;
  if (board.isCorner(king)) return [king];

  const size = board.size;
  const key = (c: Coord) => c.row * size + c.col;
  const prev = new Map<number, Coord | null>();
  const queue: Coord[] = [king];
  prev.set(key(king), null);

  while (queue.length) {
    const cur = queue.shift()!;
    if (board.isCorner(cur)) {
      // Reconstruct the path from king to this corner.
      const path: Coord[] = [];
      let step: Coord | null = cur;
      while (step) {
        path.unshift(step);
        step = prev.get(key(step)) ?? null;
      }
      return path;
    }
    // Explore king moves from `cur` on a board where the king sits there.
    const probe = board.clone();
    probe.set(king, Piece.Empty);
    probe.set(cur, Piece.King);
    for (const m of movesFrom(probe, cur)) {
      const k = key(m.to);
      if (!prev.has(k)) {
        prev.set(k, cur);
        queue.push(m.to);
      }
    }
  }
  return null;
}

/** True if `c` is on the list (small helper for renderers). */
export function listHas(list: Coord[], c: Coord): boolean {
  return list.some((x) => coordEq(x, c));
}
