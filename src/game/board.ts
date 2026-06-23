import { Piece, type Coord, type Side, type Variant } from "./types";

/**
 * An immutable-ish board state. Squares are stored in a flat array indexed by
 * `row * size + col`. Mutation is allowed internally (clone first for search),
 * but the public surface favors pure helpers.
 */
export class Board {
  readonly size: number;
  readonly variant: Variant;
  private readonly cells: Piece[];

  constructor(variant: Variant, cells?: Piece[]) {
    this.variant = variant;
    this.size = variant.size;
    this.cells = cells ? cells.slice() : new Array(variant.size * variant.size).fill(Piece.Empty);
  }

  /** Build the starting position for a variant. */
  static fromVariant(variant: Variant): Board {
    const board = new Board(variant);
    board.set(variant.king, Piece.King);
    for (const c of variant.defenders) board.set(c, Piece.Defender);
    for (const c of variant.attackers) board.set(c, Piece.Attacker);
    return board;
  }

  clone(): Board {
    return new Board(this.variant, this.cells);
  }

  private idx(c: Coord): number {
    return c.row * this.size + c.col;
  }

  inBounds(c: Coord): boolean {
    return c.col >= 0 && c.col < this.size && c.row >= 0 && c.row < this.size;
  }

  get(c: Coord): Piece {
    return this.cells[this.idx(c)];
  }

  set(c: Coord, p: Piece): void {
    this.cells[this.idx(c)] = p;
  }

  isEmpty(c: Coord): boolean {
    return this.get(c) === Piece.Empty;
  }

  // --- Special-square predicates (data-driven) ---

  isThrone(c: Coord): boolean {
    return c.col === this.variant.throne.col && c.row === this.variant.throne.row;
  }

  isCorner(c: Coord): boolean {
    return this.variant.corners.some((k) => k.col === c.col && k.row === c.row);
  }

  /**
   * Squares only the king may enter or pass through: throne and corners.
   * (The empty throne is restricted for non-kings; corners are king-only.)
   */
  isRestricted(c: Coord): boolean {
    return this.isThrone(c) || this.isCorner(c);
  }

  // --- Side helpers ---

  static sideOf(p: Piece): Side | null {
    if (p === Piece.Attacker) return "attackers";
    if (p === Piece.Defender || p === Piece.King) return "defenders";
    return null;
  }

  /** Find the king's square, or null if captured/off the board. */
  findKing(): Coord | null {
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (this.cells[row * this.size + col] === Piece.King) return { col, row };
      }
    }
    return null;
  }

  /** All squares occupied by a given side. */
  piecesOf(side: Side): Coord[] {
    const out: Coord[] = [];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        const p = this.cells[row * this.size + col];
        if (Board.sideOf(p) === side) out.push({ col, row });
      }
    }
    return out;
  }
}

export const ORTHO: ReadonlyArray<Coord> = [
  { col: 0, row: -1 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
  { col: 1, row: 0 },
];

export function coordEq(a: Coord, b: Coord): boolean {
  return a.col === b.col && a.row === b.row;
}
