import { describe, it, expect } from "vitest";
import { Piece } from "../src/game/types";
import { applyMove, resolveCaptures } from "../src/game/rules";
import { emptyBoard, at } from "./helpers";

describe("custodial capture", () => {
  it("captures an enemy flanked between two friendly pieces", () => {
    const b = emptyBoard();
    b.set(at(4, 3), Piece.Attacker); // right wall
    b.set(at(3, 3), Piece.Defender); // victim
    b.set(at(2, 7), Piece.Attacker); // mover

    const { board, applied } = applyMove(b, { from: at(2, 7), to: at(2, 3) });

    expect(applied.captures).toEqual([at(3, 3)]);
    expect(board.get(at(3, 3))).toBe(Piece.Empty);
  });

  it("does NOT capture when a piece moves INTO a sandwich (safe)", () => {
    const b = emptyBoard();
    b.set(at(2, 3), Piece.Attacker);
    b.set(at(4, 3), Piece.Attacker);
    b.set(at(3, 7), Piece.Defender); // mover steps between the two attackers

    const { board, applied } = applyMove(b, { from: at(3, 7), to: at(3, 3) });

    expect(applied.captures).toEqual([]);
    expect(board.get(at(3, 3))).toBe(Piece.Defender);
    expect(board.get(at(2, 3))).toBe(Piece.Attacker);
    expect(board.get(at(4, 3))).toBe(Piece.Attacker);
  });

  it("captures multiple pieces in a single move", () => {
    const b = emptyBoard();
    b.set(at(2, 3), Piece.Attacker); // left anchor
    b.set(at(3, 3), Piece.Defender); // victim A
    b.set(at(5, 3), Piece.Defender); // victim B
    b.set(at(6, 3), Piece.Attacker); // right anchor
    b.set(at(4, 7), Piece.Attacker); // mover lands at (4,3) between the victims

    const { board, applied } = applyMove(b, { from: at(4, 7), to: at(4, 3) });

    expect(applied.captures).toHaveLength(2);
    expect(board.get(at(3, 3))).toBe(Piece.Empty);
    expect(board.get(at(5, 3))).toBe(Piece.Empty);
  });

  it("never captures the king by simple flanking", () => {
    const b = emptyBoard();
    b.set(at(4, 3), Piece.Attacker);
    b.set(at(3, 3), Piece.King);
    b.set(at(2, 7), Piece.Attacker);

    const { board, applied } = applyMove(b, { from: at(2, 7), to: at(2, 3) });

    expect(applied.captures).toEqual([]);
    expect(board.get(at(3, 3))).toBe(Piece.King);
  });
});

describe("hostile-square capture", () => {
  it("captures against the empty throne", () => {
    const b = emptyBoard(); // throne (5,5) is empty
    b.set(at(4, 5), Piece.Defender); // victim, just left of the throne
    b.set(at(3, 8), Piece.Attacker); // mover lands at (3,5)

    const { board, applied } = applyMove(b, { from: at(3, 8), to: at(3, 5) });

    expect(applied.captures).toEqual([at(4, 5)]);
    expect(board.get(at(4, 5))).toBe(Piece.Empty);
  });

  it("captures against a corner square", () => {
    const b = emptyBoard(); // corner (0,0)
    b.set(at(0, 1), Piece.Defender); // victim adjacent to the corner
    b.set(at(3, 2), Piece.Attacker); // mover lands at (0,2)

    const { board, applied } = applyMove(b, { from: at(3, 2), to: at(0, 2) });

    expect(applied.captures).toEqual([at(0, 1)]);
    expect(board.get(at(0, 1))).toBe(Piece.Empty);
  });

  it("does not treat an OCCUPIED throne as a capturing anchor", () => {
    const b = emptyBoard();
    b.set(at(5, 5), Piece.King); // throne occupied
    b.set(at(4, 5), Piece.Defender);
    b.set(at(3, 8), Piece.Attacker);

    // mover lands at (3,5); beyond the defender is the OCCUPIED throne.
    const captured = resolveCaptures(
      (() => {
        const nb = b.clone();
        nb.set(at(3, 8), Piece.Empty);
        nb.set(at(3, 5), Piece.Attacker);
        return nb;
      })(),
      at(3, 5),
      "attackers",
    );

    expect(captured).toEqual([]);
  });
});
