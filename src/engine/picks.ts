import type { TeamId } from './types';

/**
 * A draft pick as a tradable asset. A pick belongs to the team whose slot it
 * originally was (`originalTeamId`) and can be owned by anyone after trades.
 * Future picks have no slot yet (`pickInRound` is null) until the order is set.
 */
export type DraftPick = {
  id: string;
  season: number;
  round: number;
  originalTeamId: TeamId;
  ownerTeamId: TeamId;
  /** Known once the draft order is set. */
  pickInRound: number | null;
  /** Used up in a draft. */
  used: boolean;
};

export function pickId(season: number, round: number, originalTeamId: TeamId): string {
  return `${season}-${round}-${originalTeamId}`;
}

/**
 * Create every team's picks for the next `seasons` drafts. In dynasty this is
 * what lets managers trade picks years out.
 */
export function createFuturePicks(teamIds: TeamId[], firstSeason: number, seasons: number, rounds: number): DraftPick[] {
  const picks: DraftPick[] = [];
  for (let s = 0; s < seasons; s++) {
    for (let r = 1; r <= rounds; r++) {
      for (const t of teamIds) {
        picks.push({
          id: pickId(firstSeason + s, r, t),
          season: firstSeason + s,
          round: r,
          originalTeamId: t,
          ownerTeamId: t,
          pickInRound: null,
          used: false,
        });
      }
    }
  }
  return picks;
}

/** Roll the pick window forward after a draft: drop used picks, add a new final season. */
export function rollPickWindow(picks: DraftPick[], teamIds: TeamId[], rounds: number): DraftPick[] {
  const remaining = picks.filter((p) => !p.used);
  const lastSeason = Math.max(...picks.map((p) => p.season));
  return [...remaining, ...createFuturePicks(teamIds, lastSeason + 1, 1, rounds)];
}

/** Friendly label: "2028 1st (via Tacos)" or "2027 2.04". */
export function pickLabel(pick: DraftPick, teamName: (id: TeamId) => string = (id) => id): string {
  const ord = ordinal(pick.round);
  const base =
    pick.pickInRound !== null
      ? `${pick.season} ${pick.round}.${String(pick.pickInRound).padStart(2, '0')}`
      : `${pick.season} ${ord}`;
  return pick.ownerTeamId !== pick.originalTeamId ? `${base} (via ${teamName(pick.originalTeamId)})` : base;
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function picksOwnedBy(picks: DraftPick[], teamId: TeamId): DraftPick[] {
  return picks
    .filter((p) => p.ownerTeamId === teamId && !p.used)
    .sort((a, b) => a.season - b.season || a.round - b.round || (a.pickInRound ?? 99) - (b.pickInRound ?? 99));
}

/** Set slots for one season's picks once the draft order is known (slot 1 = first pick). */
export function assignPickSlots(picks: DraftPick[], season: number, orderByOriginalTeam: TeamId[]): DraftPick[] {
  return picks.map((p) =>
    p.season === season ? { ...p, pickInRound: orderByOriginalTeam.indexOf(p.originalTeamId) + 1 || null } : p,
  );
}

/** Move picks to a new owner (a trade). Throws if a pick is not owned by `from`. */
export function transferPicks(picks: DraftPick[], pickIds: string[], from: TeamId, to: TeamId): DraftPick[] {
  const ids = new Set(pickIds);
  for (const id of ids) {
    const p = picks.find((x) => x.id === id);
    if (!p) throw new Error(`Pick ${id} doesn't exist.`);
    if (p.ownerTeamId !== from) throw new Error(`Pick ${id} isn't owned by ${from}.`);
    if (p.used) throw new Error(`Pick ${id} has already been used.`);
  }
  return picks.map((p) => (ids.has(p.id) ? { ...p, ownerTeamId: to } : p));
}
