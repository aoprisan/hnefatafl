import { Board } from "./board";
import { applyMove, isLegalMove, statusOf } from "./rules";
import {
  type AppliedMove,
  type GameStatus,
  type Move,
  type RuleFlags,
  type Side,
  type Variant,
} from "./types";

interface HistoryEntry {
  board: Board;
  turn: Side;
  status: GameStatus;
  applied: AppliedMove | null;
}

/**
 * Stateful game controller wrapping the pure rules engine. Tracks the current
 * board, whose turn it is, move history (for undo and the move list), and the
 * terminal status. Defenders move first, as in standard tafl.
 */
export class Game {
  private history: HistoryEntry[] = [];
  readonly variant: Variant;
  readonly rules: RuleFlags | undefined;

  constructor(variant: Variant, rules?: RuleFlags) {
    this.variant = variant;
    this.rules = rules;
    this.history.push({
      board: Board.fromVariant(variant, rules),
      turn: "defenders",
      status: { kind: "playing" },
      applied: null,
    });
  }

  private get current(): HistoryEntry {
    return this.history[this.history.length - 1];
  }

  get board(): Board {
    return this.current.board;
  }

  get turn(): Side {
    return this.current.turn;
  }

  get status(): GameStatus {
    return this.current.status;
  }

  get isOver(): boolean {
    return this.current.status.kind !== "playing";
  }

  get lastMove(): AppliedMove | null {
    return this.current.applied;
  }

  /** The sequence of applied moves so far, oldest first. */
  get moves(): AppliedMove[] {
    return this.history.map((h) => h.applied).filter((m): m is AppliedMove => m !== null);
  }

  /**
   * Attempt to play a move. Returns the applied move (with captures) on success,
   * or null if it is illegal / the game is over / it is not that side's turn.
   */
  play(move: Move): AppliedMove | null {
    if (this.isOver) return null;

    const side = Board.sideOf(this.board.get(move.from));
    if (side !== this.turn) return null;
    if (!isLegalMove(this.board, move)) return null;

    const { board, applied } = applyMove(this.board, move);
    const status = statusOf(board);
    const nextTurn: Side = side === "defenders" ? "attackers" : "defenders";
    this.history.push({ board, turn: nextTurn, status, applied });
    return applied;
  }

  /** Undo the most recent move. Returns false if at the initial position. */
  undo(): boolean {
    if (this.history.length <= 1) return false;
    this.history.pop();
    return true;
  }

  /** Undo back to the start of the game. */
  reset(): void {
    this.history = this.history.slice(0, 1);
  }
}
