import type { DraftPick } from './picks';
import type { DraftType } from './settings';
import type { TeamId } from './types';

export type DraftSlot = {
  overall: number;
  round: number;
  pickInRound: number;
  /** The team whose original slot this is. */
  originalTeamId: TeamId;
  /** Who actually picks (after trades). */
  teamId: TeamId;
  /** Filled by a keeper before the draft starts. */
  keeperPlayerId?: string;
};

/** Does this round run in reverse of round 1? */
export function isReversedRound(type: DraftType, round: number): boolean {
  switch (type) {
    case 'linear':
    case 'auction':
      return false;
    case 'snake':
      return round % 2 === 0;
    case 'third_round_reversal':
      // 1 forward, 2 reverse, 3 reverse, then alternate: 4 forward, 5 reverse...
      if (round === 1) return false;
      if (round === 2 || round === 3) return true;
      return round % 2 === 1;
  }
}

/**
 * Full pick order for a draft. `order` is round-1 order by original team.
 * Pass the season's tradable picks to apply trades.
 */
export function buildDraftOrder(
  type: DraftType,
  order: TeamId[],
  rounds: number,
  tradedPicks: Pick<DraftPick, 'round' | 'originalTeamId' | 'ownerTeamId'>[] = [],
): DraftSlot[] {
  const owner = new Map<string, TeamId>();
  for (const p of tradedPicks) owner.set(`${p.round}:${p.originalTeamId}`, p.ownerTeamId);

  const slots: DraftSlot[] = [];
  let overall = 1;
  for (let round = 1; round <= rounds; round++) {
    const roundOrder = isReversedRound(type, round) ? [...order].reverse() : order;
    roundOrder.forEach((originalTeamId, i) => {
      slots.push({
        overall: overall++,
        round,
        pickInRound: i + 1,
        originalTeamId,
        teamId: owner.get(`${round}:${originalTeamId}`) ?? originalTeamId,
      });
    });
  }
  return slots;
}

export type KeeperAssignment = { teamId: TeamId; playerId: string; round: number };

/**
 * Put keepers on the board in the round they cost, so the draft skips those
 * picks. If a team doesn't own a pick in that round, the keeper takes their
 * next earlier pick (the most common house rule); if none, the next later one.
 * Returns the board and any keepers that couldn't be placed.
 */
export function placeKeepers(
  board: DraftSlot[],
  keepers: KeeperAssignment[],
): { board: DraftSlot[]; unplaced: KeeperAssignment[] } {
  const next = board.map((s) => ({ ...s }));
  const unplaced: KeeperAssignment[] = [];
  // Place the most expensive keepers (earliest rounds) first.
  for (const k of [...keepers].sort((a, b) => a.round - b.round)) {
    const own = next.filter((s) => s.teamId === k.teamId && !s.keeperPlayerId);
    const exact = own.find((s) => s.round === k.round);
    const earlier = own.filter((s) => s.round < k.round).sort((a, b) => b.round - a.round)[0];
    const later = own.filter((s) => s.round > k.round).sort((a, b) => a.round - b.round)[0];
    const slot = exact ?? earlier ?? later;
    if (slot) slot.keeperPlayerId = k.playerId;
    else unplaced.push(k);
  }
  return { board: next, unplaced };
}

/** Keeper cost next season: drafted round minus escalation per year kept, never below round 1. */
export function keeperCost(draftedRound: number | null, yearsKept: number, escalation: number, undraftedRound: number): number {
  const base = draftedRound ?? undraftedRound;
  return Math.max(1, base - escalation * (yearsKept + 1));
}

/** Small seeded RNG so lotteries and random orders can be replayed and audited. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomOrder(teamIds: TeamId[], seed: number): TeamId[] {
  const rnd = seededRandom(seed);
  const a = [...teamIds];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Weighted draft lottery (NBA style). `teams` are ordered worst to best;
 * each gets `weights[i]` balls. The first `lotteryPicks` are drawn; the rest
 * follow in reverse standings. Seeded so the reveal can be replayed.
 */
export function draftLottery(teams: TeamId[], weights: number[], lotteryPicks: number, seed: number): TeamId[] {
  const rnd = seededRandom(seed);
  const pool = teams.map((t, i) => ({ t, w: weights[i] ?? 1 }));
  const drawn: TeamId[] = [];
  for (let i = 0; i < Math.min(lotteryPicks, pool.length); i++) {
    const total = pool.reduce((s, p) => s + p.w, 0);
    let r = rnd() * total;
    const idx = pool.findIndex((p) => (r -= p.w) < 0);
    drawn.push(pool.splice(idx === -1 ? pool.length - 1 : idx, 1)[0].t);
  }
  return [...drawn, ...pool.map((p) => p.t)];
}
