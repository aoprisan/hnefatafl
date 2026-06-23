import type { Variant } from "./types";

/**
 * Fetlar / standard 11×11 Hnefatafl.
 *
 * Throne at center (5,5); four corners are the escape squares. Defenders form a
 * diamond/cross around the throne (12 + king); attackers are 24 pieces in four
 * groups of 6 at the edge midpoints.
 */
export const FETLAR_11: Variant = {
  id: "fetlar-11",
  name: "Hnefatafl (Fetlar 11×11)",
  size: 11,
  throne: { col: 5, row: 5 },
  corners: [
    { col: 0, row: 0 },
    { col: 10, row: 0 },
    { col: 0, row: 10 },
    { col: 10, row: 10 },
  ],
  king: { col: 5, row: 5 },
  defenders: [
    { col: 5, row: 3 }, { col: 5, row: 4 }, { col: 5, row: 6 }, { col: 5, row: 7 },
    { col: 3, row: 5 }, { col: 4, row: 5 }, { col: 6, row: 5 }, { col: 7, row: 5 },
    { col: 4, row: 4 }, { col: 6, row: 4 }, { col: 4, row: 6 }, { col: 6, row: 6 },
  ],
  attackers: [
    { col: 3, row: 0 }, { col: 4, row: 0 }, { col: 5, row: 0 }, { col: 6, row: 0 }, { col: 7, row: 0 }, { col: 5, row: 1 },
    { col: 3, row: 10 }, { col: 4, row: 10 }, { col: 5, row: 10 }, { col: 6, row: 10 }, { col: 7, row: 10 }, { col: 5, row: 9 },
    { col: 0, row: 3 }, { col: 0, row: 4 }, { col: 0, row: 5 }, { col: 0, row: 6 }, { col: 0, row: 7 }, { col: 1, row: 5 },
    { col: 10, row: 3 }, { col: 10, row: 4 }, { col: 10, row: 5 }, { col: 10, row: 6 }, { col: 10, row: 7 }, { col: 9, row: 5 },
  ],
  hostileThrone: true,
};

/**
 * Brandub — a small 7×7 tafl variant. Included to demonstrate that the engine
 * is fully data-driven; new variants are config only.
 */
export const BRANDUB_7: Variant = {
  id: "brandub-7",
  name: "Brandub (7×7)",
  size: 7,
  throne: { col: 3, row: 3 },
  corners: [
    { col: 0, row: 0 },
    { col: 6, row: 0 },
    { col: 0, row: 6 },
    { col: 6, row: 6 },
  ],
  king: { col: 3, row: 3 },
  defenders: [
    { col: 3, row: 2 }, { col: 2, row: 3 }, { col: 4, row: 3 }, { col: 3, row: 4 },
  ],
  attackers: [
    { col: 3, row: 0 }, { col: 3, row: 1 },
    { col: 0, row: 3 }, { col: 1, row: 3 },
    { col: 5, row: 3 }, { col: 6, row: 3 },
    { col: 3, row: 5 }, { col: 3, row: 6 },
  ],
  hostileThrone: true,
};

export const VARIANTS: Record<string, Variant> = {
  [FETLAR_11.id]: FETLAR_11,
  [BRANDUB_7.id]: BRANDUB_7,
};

export const DEFAULT_VARIANT = FETLAR_11;
