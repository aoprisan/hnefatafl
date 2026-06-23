import { Board } from "../src/game/board";
import { FETLAR_11 } from "../src/game/variants";
import { Piece, type Coord } from "../src/game/types";

/** An empty 11×11 Fetlar board (no pieces placed). */
export function emptyBoard(): Board {
  return new Board(FETLAR_11);
}

export function place(board: Board, c: Coord, p: Piece): void {
  board.set(c, p);
}

export const at = (col: number, row: number): Coord => ({ col, row });
