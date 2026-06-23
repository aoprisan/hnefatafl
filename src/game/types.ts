/**
 * Core types for the tafl game-logic module.
 *
 * This module is intentionally free of any DOM / rendering dependencies so the
 * rules engine can be unit-tested in isolation and reused across variants.
 */

/** A board square referenced by column and row, both 0-indexed, origin top-left. */
export interface Coord {
  col: number;
  row: number;
}

/** The two sides in a tafl game. */
export type Side = "attackers" | "defenders";

/** What occupies a square. */
export enum Piece {
  Empty = 0,
  Attacker = 1,
  Defender = 2,
  King = 3,
}

/** A single move from one square to another. */
export interface Move {
  from: Coord;
  to: Coord;
}

/** A move that has been applied, enriched with what it captured (for history/undo/UI). */
export interface AppliedMove extends Move {
  /** The side that made the move. */
  side: Side;
  /** The piece that moved. */
  piece: Piece;
  /** Squares whose pieces were captured as a result of this move. */
  captures: Coord[];
}

export type GameStatus =
  | { kind: "playing" }
  | { kind: "win"; winner: Side; reason: "king-escaped" | "king-captured" };

/**
 * A data-driven description of a tafl variant. Keeping the layout and special
 * squares here means new variants (Brandub 7×7, 13×13, …) are pure config.
 */
export interface Variant {
  id: string;
  name: string;
  size: number;
  /** The throne square (king's start). Also the center restricted square. */
  throne: Coord;
  /** Restricted/escape squares — reaching one wins for the defenders. */
  corners: Coord[];
  king: Coord;
  defenders: Coord[];
  attackers: Coord[];
  /**
   * Whether the throne is hostile to a piece while empty (can act as the
   * second flank of a capture). Standard Fetlar rules: yes.
   */
  hostileThrone: boolean;
}
