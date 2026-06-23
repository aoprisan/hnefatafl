import { FETLAR_11, BRANDUB_7 } from "./variants";
import { defaultRules, type Coord, type RuleFlags, type Variant } from "./types";
import { JARLS, type Jarl } from "./ai";

/**
 * The Saga roguelike campaign. The player commands the king's party (defenders)
 * through a series of escalating battles. Between battles they draft a boon that
 * persists for the rest of the run. Everything here is data — the rules engine
 * is unchanged.
 */

/** A combined variant + rule-flags loadout for a single battle. */
export interface Loadout {
  variant: Variant;
  rules: RuleFlags;
}

export interface Boon {
  id: string;
  name: string;
  desc: string;
  /** Mutates the loadout in place when the boon is active. */
  apply: (l: Loadout) => void;
}

const near = (c: Coord, dc: number, dr: number): Coord => ({ col: c.col + dc, row: c.row + dr });

/** Find the `n` empty, non-special squares closest to the throne (for placing pieces). */
function nearestEmptySquares(v: Variant, n: number): Coord[] {
  const occupied = new Set<string>();
  const key = (c: Coord) => `${c.col},${c.row}`;
  occupied.add(key(v.king));
  for (const c of [...v.defenders, ...v.attackers, ...v.corners]) occupied.add(key(c));
  occupied.add(key(v.throne));
  for (const c of v.blocked ?? []) occupied.add(key(c));

  const candidates: Coord[] = [];
  for (let row = 0; row < v.size; row++) {
    for (let col = 0; col < v.size; col++) {
      const c = { col, row };
      if (!occupied.has(key(c))) candidates.push(c);
    }
  }
  candidates.sort(
    (a, b) =>
      Math.abs(a.col - v.throne.col) + Math.abs(a.row - v.throne.row) -
      (Math.abs(b.col - v.throne.col) + Math.abs(b.row - v.throne.row)),
  );
  return candidates.slice(0, n);
}

export const BOONS: Boon[] = [
  {
    id: "shieldwall",
    name: "Shieldwall",
    desc: "Hostile squares (throne, corners, groves) can no longer help the enemy capture your men.",
    apply: (l) => {
      l.rules.defenderShieldwall = true;
    },
  },
  {
    id: "huscarls",
    name: "Two Huscarls",
    desc: "Two extra defenders join the king's guard, posted as near the throne as room allows.",
    apply: (l) => {
      for (const c of nearestEmptySquares(l.variant, 2)) l.variant.defenders.push(c);
    },
  },
  {
    id: "groves",
    name: "Sacred Groves",
    desc: "Four sacred groves appear — extra hostile squares you can use to flank raiders.",
    apply: (l) => {
      const t = l.variant.throne;
      const groves = [near(t, -2, -2), near(t, 2, -2), near(t, -2, 2), near(t, 2, 2)];
      l.variant.sanctuaries = [...(l.variant.sanctuaries ?? []), ...groves];
    },
  },
  {
    id: "thinned-ranks",
    name: "Thinned Ranks",
    desc: "Disease thins the enemy — the four inward 'spike' raiders are removed.",
    apply: (l) => {
      const t = l.variant.throne;
      // Remove attackers sitting one step in from each edge midpoint.
      const spikes = [
        { col: t.col, row: 1 },
        { col: t.col, row: l.variant.size - 2 },
        { col: 1, row: t.row },
        { col: l.variant.size - 2, row: t.row },
      ];
      l.variant.attackers = l.variant.attackers.filter(
        (a) => !spikes.some((s) => s.col === a.col && s.row === a.row),
      );
    },
  },
  {
    id: "farsight",
    name: "Raven's Sight",
    desc: "Odin's ravens reveal danger — the threat overlay is always on this run.",
    apply: () => {
      /* UI-only boon; handled by the app via boon presence. */
    },
  },
];

export function boonById(id: string): Boon | undefined {
  return BOONS.find((b) => b.id === id);
}

export interface Battle {
  id: string;
  name: string;
  intro: string;
  base: Variant;
  /** Extra terrain layered onto the base variant for this battle. */
  blocked?: Coord[];
  sanctuaries?: Coord[];
  aiJarlId: string;
  aiDepth: number;
}

/** A river of impassable squares cutting across the 11×11 board (Fetlar coords). */
const FJORD: Coord[] = [
  { col: 2, row: 2 }, { col: 8, row: 8 }, { col: 2, row: 8 }, { col: 8, row: 2 },
];

export const SAGA: Battle[] = [
  {
    id: "raid-on-the-hamlet",
    name: "Raid on the Hamlet",
    intro: "A small warband tests your guard. Lead the king to freedom.",
    base: BRANDUB_7,
    aiJarlId: "ragnar",
    aiDepth: 2,
  },
  {
    id: "siege-of-the-hall",
    name: "Siege of the Hall",
    intro: "The full host surrounds your hall. Cut a path to a corner.",
    base: FETLAR_11,
    aiJarlId: "hilda",
    aiDepth: 2,
  },
  {
    id: "the-frozen-fjord",
    name: "The Frozen Fjord",
    intro: "Ice and sacred groves break the field. Björn means to box you in.",
    base: FETLAR_11,
    blocked: FJORD,
    sanctuaries: [
      { col: 3, row: 3 }, { col: 7, row: 3 }, { col: 3, row: 7 }, { col: 7, row: 7 },
    ],
    aiJarlId: "bjorn",
    aiDepth: 3,
  },
];

/** Build the loadout for a battle with the run's accumulated boons applied. */
export function buildLoadout(battle: Battle, boonIds: string[]): Loadout {
  const variant: Variant = structuredClone(battle.base);
  variant.id = `${battle.base.id}:${battle.id}`;
  variant.name = battle.name;
  if (battle.blocked) variant.blocked = [...(variant.blocked ?? []), ...battle.blocked];
  if (battle.sanctuaries) {
    variant.sanctuaries = [...(variant.sanctuaries ?? []), ...battle.sanctuaries];
  }
  const loadout: Loadout = { variant, rules: defaultRules(variant) };
  for (const id of boonIds) boonById(id)?.apply(loadout);
  return loadout;
}

export function battleJarl(battle: Battle): Jarl {
  return JARLS.find((j) => j.id === battle.aiJarlId) ?? JARLS[2];
}

// --- Persistence ---

export interface SagaProgress {
  battleIndex: number;
  boons: string[];
  wins: number;
  losses: number;
}

const STORAGE_KEY = "hnefatafl.saga.v1";

export function freshProgress(): SagaProgress {
  return { battleIndex: 0, boons: [], wins: 0, losses: 0 };
}

export function loadProgress(): SagaProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...freshProgress(), ...JSON.parse(raw) };
  } catch {
    /* ignore unavailable storage */
  }
  return freshProgress();
}

export function saveProgress(p: SagaProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore unavailable storage */
  }
}

/** Offer up to `n` boons the player has not yet taken. */
export function offerBoons(taken: string[], n = 3): Boon[] {
  return BOONS.filter((b) => !taken.includes(b.id)).slice(0, n);
}
