import { Game } from "./game";
import { VARIANTS, DEFAULT_VARIANT } from "./variants";
import type { Move } from "./types";

/**
 * Compact, URL-safe serialization of a standard game so two players can play
 * by passing a link back and forth — correspondence tafl with no backend.
 *
 * Format (then base64url-encoded): `${variantId}|${m0}${m1}…` where each move
 * is four base-36 digits (fromCol fromRow toCol toRow). Saga games (custom
 * terrain / boons) are intentionally not shareable.
 */
interface Serialized {
  variantId: string;
  moves: Move[];
}

function b36(n: number): string {
  return n.toString(36);
}

function encodeState(s: Serialized): string {
  const moves = s.moves
    .map((m) => `${b36(m.from.col)}${b36(m.from.row)}${b36(m.to.col)}${b36(m.to.row)}`)
    .join("");
  const raw = `${s.variantId}|${moves}`;
  return base64UrlEncode(raw);
}

function decodeState(token: string): Serialized | null {
  try {
    const raw = base64UrlDecode(token);
    const [variantId, moveStr = ""] = raw.split("|");
    if (!VARIANTS[variantId]) return null;
    const moves: Move[] = [];
    for (let i = 0; i + 4 <= moveStr.length; i += 4) {
      moves.push({
        from: { col: parseInt(moveStr[i], 36), row: parseInt(moveStr[i + 1], 36) },
        to: { col: parseInt(moveStr[i + 2], 36), row: parseInt(moveStr[i + 3], 36) },
      });
    }
    return { variantId, moves };
  } catch {
    return null;
  }
}

function base64UrlEncode(s: string): string {
  // `btoa` is available in browsers and Node 18+. Input is ASCII (ids + base36).
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): string {
  return atob(s.replace(/-/g, "+").replace(/_/g, "/"));
}

/** Encode a game's full move list into a share token. */
export function encodeGame(game: Game): string {
  return encodeState({
    variantId: game.variant.id,
    moves: game.moves.map((m) => ({ from: m.from, to: m.to })),
  });
}

/**
 * Rebuild a game from a share token by replaying every move through the rules
 * engine. Returns null if the token is malformed or contains an illegal move.
 */
export function decodeGame(token: string): Game | null {
  const state = decodeState(token);
  if (!state) return null;
  const variant = VARIANTS[state.variantId] ?? DEFAULT_VARIANT;
  const game = new Game(variant);
  for (const m of state.moves) {
    if (!game.play(m)) return null; // illegal/forged token
  }
  return game;
}
