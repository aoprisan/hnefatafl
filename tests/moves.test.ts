import { describe, it, expect } from "vitest";
import { Piece } from "../src/game/types";
import { movesFrom, allMoves } from "../src/game/rules";
import { Game } from "../src/game/game";
import { FETLAR_11, BRANDUB_7 } from "../src/game/variants";
import { coordEq } from "../src/game/board";
import { emptyBoard, at } from "./helpers";

describe("move generation", () => {
  it("slides a soldier orthogonally until blocked, no jumping", () => {
    const b = emptyBoard();
    b.set(at(2, 2), Piece.Attacker);
    b.set(at(2, 5), Piece.Defender); // blocker below

    const dests = movesFrom(b, at(2, 2)).map((m) => m.to);
    // Down direction stops at (2,3),(2,4) (blocked before (2,5)).
    expect(dests.some((c) => coordEq(c, at(2, 3)))).toBe(true);
    expect(dests.some((c) => coordEq(c, at(2, 4)))).toBe(true);
    expect(dests.some((c) => coordEq(c, at(2, 5)))).toBe(false);
    expect(dests.some((c) => coordEq(c, at(2, 6)))).toBe(false);
  });

  it("forbids a soldier from entering the throne or corners", () => {
    const b = emptyBoard();
    b.set(at(5, 2), Piece.Attacker); // can slide down toward throne (5,5)

    const dests = movesFrom(b, at(5, 2)).map((m) => m.to);
    // Stops before the throne; cannot pass through it.
    expect(dests.some((c) => coordEq(c, at(5, 4)))).toBe(true);
    expect(dests.some((c) => coordEq(c, at(5, 5)))).toBe(false);
    expect(dests.some((c) => coordEq(c, at(5, 6)))).toBe(false);
  });

  it("lets the king enter the throne and corners", () => {
    const b = emptyBoard();
    b.set(at(0, 3), Piece.King);

    const dests = movesFrom(b, at(0, 3)).map((m) => m.to);
    expect(dests.some((c) => coordEq(c, at(0, 0)))).toBe(true); // corner
  });
});

describe("Game controller", () => {
  it("starts with defenders to move and the right piece counts", () => {
    const g = new Game(FETLAR_11);
    expect(g.turn).toBe("defenders");
    expect(g.board.piecesOf("attackers")).toHaveLength(24);
    // 12 defenders + king
    expect(g.board.piecesOf("defenders")).toHaveLength(13);
  });

  it("rejects moving the wrong side and illegal moves", () => {
    const g = new Game(FETLAR_11);
    // Attacker tries to move first (not their turn).
    expect(g.play({ from: at(3, 0), to: at(2, 0) })).toBeNull();
    // Defender makes a legal move.
    const ok = g.play({ from: at(5, 3), to: at(5, 2) });
    expect(ok).not.toBeNull();
    expect(g.turn).toBe("attackers");
  });

  it("supports undo back to the initial position", () => {
    const g = new Game(FETLAR_11);
    g.play({ from: at(5, 3), to: at(5, 2) });
    expect(g.moves).toHaveLength(1);
    expect(g.undo()).toBe(true);
    expect(g.moves).toHaveLength(0);
    expect(g.turn).toBe("defenders");
    expect(g.undo()).toBe(false); // nothing left to undo
  });

  it("is fully data-driven: Brandub 7×7 sets up correctly", () => {
    const g = new Game(BRANDUB_7);
    expect(g.board.size).toBe(7);
    expect(g.board.piecesOf("attackers")).toHaveLength(8);
    expect(g.board.piecesOf("defenders")).toHaveLength(5); // 4 + king
    expect(allMoves(g.board, "defenders").length).toBeGreaterThan(0);
  });
});
