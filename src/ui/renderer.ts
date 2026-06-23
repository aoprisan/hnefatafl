import { Board, coordEq } from "../game/board";
import { Piece, type AppliedMove, type Coord } from "../game/types";

export interface RenderState {
  board: Board;
  selected: Coord | null;
  legalTargets: Coord[];
  lastMove: AppliedMove | null;
}

/**
 * Canvas renderer for a tafl board. Pure presentation: it draws a {@link RenderState}
 * and translates pointer coordinates into board squares. It holds no game rules.
 */
export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private cell = 0;
  private dpr = 1;

  constructor(
    private canvas: HTMLCanvasElement,
    private onSquareTap: (c: Coord) => void,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    canvas.addEventListener("pointerdown", (e) => this.handlePointer(e));
  }

  /** Size the backing store to the CSS box for crisp rendering. */
  resize(size: number): void {
    this.dpr = window.devicePixelRatio || 1;
    const px = Math.max(1, Math.floor(this.canvas.clientWidth));
    this.canvas.width = px * this.dpr;
    this.canvas.height = px * this.dpr;
    this.cell = px / size;
  }

  private handlePointer(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / this.cell);
    const row = Math.floor(y / this.cell);
    this.onSquareTap({ col, row });
  }

  draw(state: RenderState): void {
    const { board } = state;
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    const cell = this.cell;
    const size = board.size;

    // Board background (wood gradient).
    const grad = ctx.createLinearGradient(0, 0, cell * size, cell * size);
    grad.addColorStop(0, "#42301f");
    grad.addColorStop(1, "#2c2014");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cell * size, cell * size);

    // Squares + special markers.
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const c = { col, row };
        const x = col * cell;
        const y = row * cell;

        if ((col + row) % 2 === 0) {
          ctx.fillStyle = "rgba(255,255,255,0.025)";
          ctx.fillRect(x, y, cell, cell);
        }
        if (board.isCorner(c) || board.isThrone(c)) {
          ctx.fillStyle = "rgba(214,168,74,0.12)";
          ctx.fillRect(x, y, cell, cell);
          this.drawSpecialGlyph(c, board.isThrone(c));
        }
      }
    }

    // Grid lines.
    ctx.strokeStyle = "rgba(107,80,52,0.6)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i++) {
      const p = Math.round(i * cell) + 0.5;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, cell * size);
      ctx.moveTo(0, p);
      ctx.lineTo(cell * size, p);
      ctx.stroke();
    }

    // Last-move highlight.
    if (state.lastMove) {
      this.highlightSquare(state.lastMove.from, "var-last");
      this.highlightSquare(state.lastMove.to, "var-last");
      for (const cap of state.lastMove.captures) this.markCapture(cap);
    }

    // Selection + legal targets.
    if (state.selected) this.highlightSquare(state.selected, "sel");
    for (const t of state.legalTargets) this.drawTarget(t, board);

    // Pieces.
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        const p = board.get({ col, row });
        if (p !== Piece.Empty) this.drawPiece(col, row, p);
      }
    }

    ctx.restore();
  }

  private highlightSquare(c: Coord, kind: "sel" | "var-last"): void {
    const ctx = this.ctx;
    const cell = this.cell;
    ctx.fillStyle =
      kind === "sel" ? "rgba(214,168,74,0.28)" : "rgba(91,156,214,0.30)";
    ctx.fillRect(c.col * cell, c.row * cell, cell, cell);
  }

  private drawTarget(c: Coord, board: Board): void {
    const ctx = this.ctx;
    const cell = this.cell;
    const cx = c.col * cell + cell / 2;
    const cy = c.row * cell + cell / 2;
    const occupied = !board.isEmpty(c);
    ctx.save();
    ctx.fillStyle = "rgba(214,168,74,0.55)";
    ctx.strokeStyle = "rgba(214,168,74,0.9)";
    ctx.lineWidth = 2;
    if (occupied) {
      // Ring around a capturable destination square.
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, cell * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private markCapture(c: Coord): void {
    const ctx = this.ctx;
    const cell = this.cell;
    const cx = c.col * cell + cell / 2;
    const cy = c.row * cell + cell / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(214,80,74,0.9)";
    ctx.lineWidth = 3;
    const r = cell * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy + r);
    ctx.moveTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy + r);
    ctx.stroke();
    ctx.restore();
  }

  private drawSpecialGlyph(c: Coord, isThrone: boolean): void {
    const ctx = this.ctx;
    const cell = this.cell;
    const cx = c.col * cell + cell / 2;
    const cy = c.row * cell + cell / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(214,168,74,0.35)";
    ctx.lineWidth = 1.5;
    const r = cell * 0.3;
    if (isThrone) {
      ctx.strokeRect(cx - r, cy - r, r * 2, r * 2);
    } else {
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPiece(col: number, row: number, piece: Piece): void {
    const ctx = this.ctx;
    const cell = this.cell;
    const cx = col * cell + cell / 2;
    const cy = row * cell + cell / 2;
    const r = cell * 0.36;

    ctx.save();
    // Drop shadow.
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.22, r * 1.02, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();

    let fill = "#e9e0cf";
    let edge = "#b6a988";
    if (piece === Piece.Attacker) {
      fill = "#222831";
      edge = "#4a5562";
    } else if (piece === Piece.King) {
      fill = "#d6a84a";
      edge = "#8a6a22";
    }

    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
    g.addColorStop(0, this.lighten(fill));
    g.addColorStop(1, fill);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = edge;
    ctx.stroke();

    if (piece === Piece.King) {
      // Simple crown mark.
      ctx.fillStyle = "#3a2c0e";
      ctx.font = `${Math.floor(r * 1.1)}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("♚", cx, cy + r * 0.06);
    }
    ctx.restore();
  }

  private lighten(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 40);
    const g = Math.min(255, ((n >> 8) & 255) + 40);
    const b = Math.min(255, (n & 255) + 40);
    return `rgb(${r},${g},${b})`;
  }

  /** Utility re-export for callers that need square equality. */
  static eq = coordEq;
}
