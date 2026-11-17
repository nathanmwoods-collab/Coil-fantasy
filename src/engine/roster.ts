import { injuryTag } from './injuries';
import type { LeagueSettings } from './settings';
import { STARTER_SLOTS } from './settings';
import type { Player, PlayerId, Position, SlotType } from './types';

/** Positions that can fill each slot. */
export const SLOT_ELIGIBILITY: Record<SlotType, Position[]> = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  K: ['K'],
  DST: ['DST'],
  DL: ['DL'],
  LB: ['LB'],
  DB: ['DB'],
  FLEX: ['RB', 'WR', 'TE'],
  WR_RB: ['WR', 'RB'],
  WR_TE: ['WR', 'TE'],
  SUPERFLEX: ['QB', 'RB', 'WR', 'TE'],
  IDP_FLEX: ['DL', 'LB', 'DB'],
  BN: ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DL', 'LB', 'DB'],
  IR: ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DL', 'LB', 'DB'],
  TAXI: ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DL', 'LB', 'DB'],
};

export const SLOT_LABELS: Record<SlotType, string> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  K: 'K',
  DST: 'D/ST',
  DL: 'DL',
  LB: 'LB',
  DB: 'DB',
  FLEX: 'W/R/T',
  WR_RB: 'W/R',
  WR_TE: 'W/T',
  SUPERFLEX: 'SF',
  IDP_FLEX: 'IDP',
  BN: 'Bench',
  IR: 'IR',
  TAXI: 'Taxi',
};

function positionsOf(p: Player): Position[] {
  return [p.position, ...(p.altPositions ?? [])];
}

export function canFill(slot: SlotType, player: Player): boolean {
  return positionsOf(player).some((pos) => SLOT_ELIGIBILITY[slot].includes(pos));
}

/** Can this player sit in an IR slot under this league's rules? */
export function irEligible(settings: LeagueSettings, player: Player): boolean {
  return settings.irEligible.includes(player.status ?? 'active');
}

/** Can this player sit on the taxi squad? */
export function taxiEligible(settings: LeagueSettings, player: Player): boolean {
  return (player.yearsPro ?? 99) <= settings.dynasty.taxiMaxYearsPro;
}

/** One roster spot: which slot it is and who is in it (null = empty). */
export type RosterSpot = { slot: SlotType; playerId: PlayerId | null };

/** Build an empty lineup with one spot per slot, in display order. */
export function emptySpots(settings: LeagueSettings): RosterSpot[] {
  const order: SlotType[] = [...STARTER_SLOTS, 'BN', 'IR', 'TAXI'];
  const spots: RosterSpot[] = [];
  for (const slot of order) {
    for (let i = 0; i < (settings.roster[slot] ?? 0); i++) spots.push({ slot, playerId: null });
  }
  return spots;
}

export type RosterIssue = { playerId?: PlayerId; slot?: SlotType; message: string };

/**
 * Check a team's roster against league rules. Messages are written for
 * managers, so the app can show them as they are.
 */
export function validateRoster(
  settings: LeagueSettings,
  spots: RosterSpot[],
  players: Record<PlayerId, Player>,
): RosterIssue[] {
  const issues: RosterIssue[] = [];
  const counts: Partial<Record<SlotType, number>> = {};
  const seen = new Set<PlayerId>();
  const positionCounts: Partial<Record<Position, number>> = {};

  for (const spot of spots) {
    counts[spot.slot] = (counts[spot.slot] ?? 0) + 1;
    if (!spot.playerId) continue;
    const p = players[spot.playerId];
    if (!p) {
      issues.push({ playerId: spot.playerId, slot: spot.slot, message: 'Unknown player on roster.' });
      continue;
    }
    if (seen.has(p.id)) issues.push({ playerId: p.id, message: `${p.name} is listed twice.` });
    seen.add(p.id);
    positionCounts[p.position] = (positionCounts[p.position] ?? 0) + 1;

    if (!canFill(spot.slot, p)) {
      issues.push({ playerId: p.id, slot: spot.slot, message: `${p.name} (${p.position}) can't play ${SLOT_LABELS[spot.slot]}.` });
    }
    if (spot.slot === 'IR' && !irEligible(settings, p) && !settings.irAllowHealthy) {
      const tag = injuryTag(p.status);
      issues.push({
        playerId: p.id,
        slot: 'IR',
        message: `${p.name} is ${tag.label.toLowerCase()} and can't stay on IR. Move him to make a move.`,
      });
    }
    if (spot.slot === 'TAXI' && !taxiEligible(settings, p)) {
      issues.push({ playerId: p.id, slot: 'TAXI', message: `${p.name} has too many years in the league for the taxi squad.` });
    }
  }

  for (const [slot, n] of Object.entries(counts) as [SlotType, number][]) {
    const allowed = settings.roster[slot] ?? 0;
    if (n > allowed) issues.push({ slot, message: `Too many ${SLOT_LABELS[slot]} spots (${n} of ${allowed}).` });
  }
  for (const [pos, limit] of Object.entries(settings.positionLimits) as [Position, number][]) {
    if ((positionCounts[pos] ?? 0) > limit)
      issues.push({ message: `Rosters can hold at most ${limit} ${pos}${limit === 1 ? '' : 's'}.` });
  }
  return issues;
}

/** Is the team locked from adds and trades until it fixes its roster (e.g. healthy player on IR)? */
export function isRosterLocked(issues: RosterIssue[]): boolean {
  return issues.length > 0;
}

/**
 * Best possible starting lineup given each player's points (actual for best
 * ball, projected for lineup help). Fills the most restrictive slots first,
 * which is optimal for the usual nested slot rules (RB inside FLEX inside SF).
 */
export function optimalLineup(
  settings: LeagueSettings,
  candidates: Player[],
  pointsOf: (p: Player) => number,
  canStart: (p: Player) => boolean = () => true,
): { lineup: RosterSpot[]; total: number } {
  const slots: SlotType[] = [];
  for (const slot of STARTER_SLOTS) for (let i = 0; i < (settings.roster[slot] ?? 0); i++) slots.push(slot);
  const order = [...slots].sort((a, b) => SLOT_ELIGIBILITY[a].length - SLOT_ELIGIBILITY[b].length);

  const pool = candidates.filter(canStart).sort((a, b) => pointsOf(b) - pointsOf(a));
  const used = new Set<PlayerId>();
  const filled = new Map<number, PlayerId | null>();
  let total = 0;

  order.forEach((slot) => {
    const pick = pool.find((p) => !used.has(p.id) && canFill(slot, p));
    const idx = slots.findIndex((s, i) => s === slot && !filled.has(i));
    filled.set(idx, pick?.id ?? null);
    if (pick) {
      used.add(pick.id);
      total += pointsOf(pick);
    }
  });

  const lineup = slots.map((slot, i) => ({ slot, playerId: filled.get(i) ?? null }));
  return { lineup, total: Math.round(total * 100) / 100 };
}

/**
 * Auto-sub: replace starters who won't play (out, IR, bye) with the best
 * eligible bench player by projection. Returns the new spots and what changed.
 */
export function autoSubInactive(
  spots: RosterSpot[],
  players: Record<PlayerId, Player>,
  projection: (p: Player) => number,
  isOnBye: (p: Player) => boolean = () => false,
  isLocked: (p: Player) => boolean = () => false,
): { spots: RosterSpot[]; swaps: { out: PlayerId; in: PlayerId; slot: SlotType }[] } {
  const next = spots.map((s) => ({ ...s }));
  const swaps: { out: PlayerId; in: PlayerId; slot: SlotType }[] = [];
  const willNotPlay = (p: Player) => injuryTag(p.status).inactive || isOnBye(p);

  for (const spot of next) {
    if (!STARTER_SLOTS.includes(spot.slot) || !spot.playerId) continue;
    const starter = players[spot.playerId];
    if (!starter || !willNotPlay(starter) || isLocked(starter)) continue;
    const bench = next
      .filter((s) => s.slot === 'BN' && s.playerId)
      .map((s) => ({ s, p: players[s.playerId!] }))
      .filter(({ p }) => p && canFill(spot.slot, p) && !willNotPlay(p) && !isLocked(p))
      .sort((a, b) => projection(b.p) - projection(a.p))[0];
    if (!bench) continue;
    swaps.push({ out: starter.id, in: bench.p.id, slot: spot.slot });
    bench.s.playerId = starter.id;
    spot.playerId = bench.p.id;
  }
  return { spots: next, swaps };
}
