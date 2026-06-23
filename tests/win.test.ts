import { describe, it, expect } from "vitest";
import { Piece } from "../src/game/types";
import { isKingCaptured, isKingEscaped, statusOf, applyMove } from "../src/game/rules";
import { emptyBoard, at } from "./helpers";

describe("king capture", () => {
  it("is captured when surrounded on all four sides by attackers", () => {
    const b = emptyBoard();
    b.set(at(3, 3), Piece.King);
    b.set(at(3, 2), Piece.Attacker);
    b.set(at(3, 4), Piece.Attacker);
    b.set(at(2, 3), Piece.Attacker);
    b.set(at(4, 3), Piece.Attacker);

    expect(isKingCaptured(b)).toBe(true);
    expect(statusOf(b)).toEqual({
      kind: "win",
      winner: "attackers",
      reason: "king-captured",
    });
  });

  it("is NOT captured with only three attackers around it (open square)", () => {
    const b = emptyBoard();
    b.set(at(3, 3), Piece.King);
    b.set(at(3, 2), Piece.Attacker);
    b.set(at(3, 4), Piece.Attacker);
    b.set(at(2, 3), Piece.Attacker);
    // (4,3) left open

    expect(isKingCaptured(b)).toBe(false);
  });

  it("counts the board edge as a surrounding side", () => {
    const b = emptyBoard();
    b.set(at(0, 3), Piece.King); // left edge
    b.set(at(0, 2), Piece.Attacker);
    b.set(at(0, 4), Piece.Attacker);
    b.set(at(1, 3), Piece.Attacker);
    // left side is the board edge -> counts

    expect(isKingCaptured(b)).toBe(true);
  });

  it("counts an adjacent throne as a surrounding side", () => {
    const b = emptyBoard();
    b.set(at(5, 4), Piece.King); // directly above the throne (5,5)
    b.set(at(5, 3), Piece.Attacker);
    b.set(at(4, 4), Piece.Attacker);
    b.set(at(6, 4), Piece.Attacker);
    // throne (5,5) counts as the fourth side

    expect(isKingCaptured(b)).toBe(true);
  });

  it("is triggered by the attacker's closing move", () => {
    const b = emptyBoard();
    b.set(at(3, 3), Piece.King);
    b.set(at(3, 2), Piece.Attacker);
    b.set(at(2, 3), Piece.Attacker);
    b.set(at(4, 3), Piece.Attacker);
    b.set(at(3, 8), Piece.Attacker); // moves up to (3,4) to close the trap

    const { board } = applyMove(b, { from: at(3, 8), to: at(3, 4) });
    expect(statusOf(board)).toEqual({
      kind: "win",
      winner: "attackers",
      reason: "king-captured",
    });
  });
});

describe("king escape", () => {
  it("defenders win when the king reaches a corner", () => {
    const b = emptyBoard();
    b.set(at(0, 0), Piece.King);

    expect(isKingEscaped(b)).toBe(true);
    expect(statusOf(b)).toEqual({
      kind: "win",
      winner: "defenders",
      reason: "king-escaped",
    });
  });

  it("defenders win when the king slides into a corner on its move", () => {
    const b = emptyBoard();
    b.set(at(0, 3), Piece.King); // clear path up the left edge to (0,0)

    const { board } = applyMove(b, { from: at(0, 3), to: at(0, 0) });
    expect(statusOf(board)).toEqual({
      kind: "win",
      winner: "defenders",
      reason: "king-escaped",
    });
  });

  it("reports an ongoing game as playing", () => {
    const b = emptyBoard();
    b.set(at(5, 5), Piece.King);
    expect(statusOf(b)).toEqual({ kind: "playing" });
  });
});
