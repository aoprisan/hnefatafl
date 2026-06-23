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

  // --- Optional terrain (used by the Saga campaign; empty by default) ---

  /**
   * Impassable squares (rivers / mountains). No piece may stop on or pass
   * through them, they are never a capture anchor, but they count as a wall
   * when surrounding the king.
   */
  blocked?: Coord[];
  /**
   * Sacred groves: extra hostile squares. Any piece may stop on or pass
   * through them; while empty they act as a capture anchor for both sides and
   * count as a king-surround wall. They are NOT escape squares.
   */
  sanctuaries?: Coord[];
}

/**
 * Tunable rule flags. Standard play uses the defaults derived from a variant;
 * the Saga campaign's boons flip these to bend the rules.
 */
export interface RuleFlags {
  /** Empty throne acts as a capture anchor. */
  hostileThrone: boolean;
  /** Corners act as capture anchors. */
  hostileCorners: boolean;
  /**
   * "Shieldwall" boon: hostile squares (throne/corner/sanctuary) do not help
   * the attackers capture a defender. Defenders can still be captured between
   * two attacker pieces.
   */
  defenderShieldwall: boolean;
}

export function defaultRules(variant: Variant): RuleFlags {
  return {
    hostileThrone: variant.hostileThrone,
    hostileCorners: true,
    defenderShieldwall: false,
  };
}
