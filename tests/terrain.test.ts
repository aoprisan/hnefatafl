import { describe, it, expect } from "vitest";
import { Board } from "../src/game/board";
import { Piece, defaultRules } from "../src/game/types";
import { applyMove, movesFrom, isKingCaptured } from "../src/game/rules";
import { FETLAR_11 } from "../src/game/variants";
import { at } from "./helpers";

describe("terrain: blocked squares (rivers)", () => {
  const variant = { ...FETLAR_11, blocked: [at(3, 5)] };

  it("a soldier cannot stop on or pass through a blocked square", () => {
    const b = new Board(variant);
    b.set(at(1, 5), Piece.Attacker); // slides right toward the river at (3,5)

    const dests = movesFrom(b, at(1, 5)).map((m) => m.to);
    expect(dests.some((c) => c.col === 2 && c.row === 5)).toBe(true);
    expect(dests.some((c) => c.col === 3 && c.row === 5)).toBe(false);
    expect(dests.some((c) => c.col === 4 && c.row === 5)).toBe(false);
  });

  it("a blocked square counts as a wall for king capture", () => {
    const b = new Board(variant);
    b.set(at(4, 5), Piece.King); // river is immediately to the left at (3,5)
    b.set(at(4, 4), Piece.Attacker);
    b.set(at(4, 6), Piece.Attacker);
    b.set(at(5, 5), Piece.Attacker);
    expect(isKingCaptured(b)).toBe(true);
  });
});

describe("terrain: sanctuaries (sacred groves)", () => {
  const variant = { ...FETLAR_11, sanctuaries: [at(3, 3)] };

  it("acts as a hostile capture anchor while empty", () => {
    const b = new Board(variant);
    b.set(at(3, 4), Piece.Defender); // victim just below the grove (3,3)
    b.set(at(6, 5), Piece.Attacker); // mover lands at (3,5)

    const { applied, board } = applyMove(b, { from: at(6, 5), to: at(3, 5) });
    expect(applied.captures).toEqual([at(3, 4)]);
    expect(board.get(at(3, 4))).toBe(Piece.Empty);
  });

  it("is passable by any piece (unlike the throne)", () => {
    const b = new Board(variant);
    b.set(at(3, 6), Piece.Attacker);
    const dests = movesFrom(b, at(3, 6)).map((m) => m.to);
    expect(dests.some((c) => c.col === 3 && c.row === 3)).toBe(true);
  });
});

describe("rule flags: shieldwall boon", () => {
  it("stops hostile squares from helping the attackers capture a defender", () => {
    const rules = { ...defaultRules(FETLAR_11), defenderShieldwall: true };
    const b = new Board(FETLAR_11, undefined, rules);
    b.set(at(0, 1), Piece.Defender); // adjacent to corner (0,0)
    b.set(at(3, 2), Piece.Attacker); // would normally capture against the corner

    const { applied } = applyMove(b, { from: at(3, 2), to: at(0, 2) });
    expect(applied.captures).toEqual([]); // shieldwall protects the defender
  });
});
