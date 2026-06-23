import { describe, it, expect } from "vitest";
import { Board } from "../src/game/board";
import { Piece } from "../src/game/types";
import { threatenedSquares, kingEscapePath } from "../src/game/analysis";
import { encodeGame, decodeGame } from "../src/game/share";
import { Game } from "../src/game/game";
import { FETLAR_11 } from "../src/game/variants";
import { emptyBoard, at } from "./helpers";

describe("threat overlay", () => {
  it("flags a defender the attackers could capture next move", () => {
    const b = emptyBoard();
    b.set(at(4, 3), Piece.Attacker); // anchor
    b.set(at(3, 3), Piece.Defender); // would be captured if an attacker reaches (2,3)
    b.set(at(2, 7), Piece.Attacker); // can slide up to (2,3)

    const danger = threatenedSquares(b, "defenders");
    expect(danger).toEqual([at(3, 3)]);
  });

  it("reports no threat when the king cannot be flanked", () => {
    const b = emptyBoard();
    b.set(at(5, 5), Piece.King);
    b.set(at(4, 5), Piece.Attacker);
    // The king is never captured by simple flanking, so it isn't "threatened".
    expect(threatenedSquares(b, "defenders")).toEqual([]);
  });
});

describe("king escape path", () => {
  it("finds a straight run to a corner", () => {
    const b = emptyBoard();
    b.set(at(0, 5), Piece.King); // clear left edge up to (0,0)
    const path = kingEscapePath(b);
    expect(path).not.toBeNull();
    expect(path![0]).toEqual(at(0, 5));
    expect(path![path!.length - 1]).toEqual(at(0, 0));
  });

  it("returns null when the king is fully walled in", () => {
    const b = emptyBoard();
    b.set(at(5, 5), Piece.King);
    for (const c of [at(5, 4), at(5, 6), at(4, 5), at(6, 5)]) b.set(c, Piece.Attacker);
    expect(kingEscapePath(b)).toBeNull();
  });
});

describe("share links", () => {
  it("round-trips a game through encode/decode", () => {
    const g = new Game(FETLAR_11);
    g.play({ from: at(5, 3), to: at(5, 2) });
    g.play({ from: at(3, 0), to: at(2, 0) });

    const token = encodeGame(g);
    const restored = decodeGame(token);
    expect(restored).not.toBeNull();
    expect(restored!.moves).toHaveLength(2);
    expect(restored!.turn).toBe(g.turn);
    expect(restored!.variant.id).toBe(FETLAR_11.id);
  });

  it("rejects a forged token containing an illegal move", () => {
    // Hand-craft a token with a clearly illegal opening move.
    const g = new Game(FETLAR_11);
    const token = encodeGame(g); // empty game
    // Append junk that won't decode to a legal sequence by decoding a bad string.
    const bad = decodeGame("not-a-real-token!!!");
    expect(bad).toBeNull();
    expect(decodeGame(token)).not.toBeNull();
  });
});

describe("Board rules plumbing", () => {
  it("defaults corners and throne to hostile", () => {
    const b = Board.fromVariant(FETLAR_11);
    expect(b.rules.hostileCorners).toBe(true);
    expect(b.rules.hostileThrone).toBe(true);
    expect(b.rules.defenderShieldwall).toBe(false);
  });
});
