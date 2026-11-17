import type { DraftPick } from './picks';
import { transferPicks } from './picks';
import type { LeagueSettings } from './settings';
import type { PlayerId, TeamId } from './types';

/** What one team sends in a trade. A trade has 2 to N of these. */
export type TradeSide = {
  teamId: TeamId;
  /** Each player goes to a named team (needed for 3+ team trades). */
  players: { playerId: PlayerId; to: TeamId }[];
  picks: { pickId: string; to: TeamId }[];
  faab: { amount: number; to: TeamId }[];
  /** Players this team drops to make room. */
  drops: PlayerId[];
};

export type Trade = { id: string; sides: TradeSide[]; proposedBy: TeamId; week: number };

export type TradeTeamState = { teamId: TeamId; roster: PlayerId[]; rosterLimit: number; faab: number };

export type TradeIssue = { teamId?: TeamId; message: string };

/** Check a proposed trade against league rules. Messages are written for managers. */
export function validateTrade(
  settings: LeagueSettings,
  trade: Trade,
  teams: Record<TeamId, TradeTeamState>,
  picks: DraftPick[],
  currentSeason: number,
): TradeIssue[] {
  const issues: TradeIssue[] = [];
  const t = settings.trades;
  const teamIds = new Set(trade.sides.map((s) => s.teamId));

  if (trade.sides.length < 2) issues.push({ message: 'A trade needs at least two teams.' });
  if (trade.sides.length > t.maxTeamsPerTrade) issues.push({ message: `This league allows trades of up to ${t.maxTeamsPerTrade} teams.` });
  if (t.deadlineWeek !== null && trade.week > t.deadlineWeek) issues.push({ message: `The trade deadline was week ${t.deadlineWeek}.` });

  const incoming = new Map<TeamId, number>();
  const outgoing = new Map<TeamId, number>();

  for (const side of trade.sides) {
    const team = teams[side.teamId];
    if (!team) {
      issues.push({ teamId: side.teamId, message: 'Team not found.' });
      continue;
    }
    for (const p of side.players) {
      if (!team.roster.includes(p.playerId)) issues.push({ teamId: side.teamId, message: `Player ${p.playerId} isn't on this roster anymore.` });
      if (!teamIds.has(p.to) || p.to === side.teamId) issues.push({ teamId: side.teamId, message: 'A player is going to a team not in this trade.' });
      incoming.set(p.to, (incoming.get(p.to) ?? 0) + 1);
      outgoing.set(side.teamId, (outgoing.get(side.teamId) ?? 0) + 1);
    }
    for (const d of side.drops) {
      if (!team.roster.includes(d)) issues.push({ teamId: side.teamId, message: `Can't drop ${d}: not on the roster.` });
      outgoing.set(side.teamId, (outgoing.get(side.teamId) ?? 0) + 1);
    }
    for (const pk of side.picks) {
      const pick = picks.find((p) => p.id === pk.pickId);
      if (!pick) issues.push({ teamId: side.teamId, message: `Pick ${pk.pickId} doesn't exist.` });
      else if (pick.ownerTeamId !== side.teamId) issues.push({ teamId: side.teamId, message: 'One of these picks was already traded away.' });
      else if (pick.used) issues.push({ teamId: side.teamId, message: 'That pick has already been used.' });
      else if (pick.season > currentSeason + t.futurePickSeasons)
        issues.push({ teamId: side.teamId, message: `Picks can only be traded ${t.futurePickSeasons} season${t.futurePickSeasons === 1 ? '' : 's'} out.` });
    }
    const faabOut = side.faab.reduce((s, f) => s + f.amount, 0);
    if (faabOut > 0 && settings.waivers.type !== 'faab') issues.push({ teamId: side.teamId, message: 'This league doesn’t use FAAB.' });
    if (faabOut > team.faab) issues.push({ teamId: side.teamId, message: `Only $${team.faab} of FAAB left to trade.` });
  }

  for (const side of trade.sides) {
    const team = teams[side.teamId];
    if (!team) continue;
    const after = team.roster.length + (incoming.get(side.teamId) ?? 0) - (outgoing.get(side.teamId) ?? 0);
    if (after > team.rosterLimit) issues.push({ teamId: side.teamId, message: `This would put the roster at ${after} of ${team.rosterLimit}. Add a drop.` });
  }
  return issues;
}

/** Apply an accepted trade. Assumes validateTrade returned no issues. */
export function applyTrade(
  trade: Trade,
  teams: Record<TeamId, TradeTeamState>,
  picks: DraftPick[],
): { teams: Record<TeamId, TradeTeamState>; picks: DraftPick[] } {
  const next: Record<TeamId, TradeTeamState> = {};
  for (const [id, t] of Object.entries(teams)) next[id] = { ...t, roster: [...t.roster] };
  let nextPicks = picks;
  for (const side of trade.sides) {
    const from = next[side.teamId];
    for (const p of side.players) {
      from.roster = from.roster.filter((x) => x !== p.playerId);
      next[p.to].roster.push(p.playerId);
    }
    from.roster = from.roster.filter((x) => !side.drops.includes(x));
    for (const f of side.faab) {
      from.faab -= f.amount;
      next[f.to].faab += f.amount;
    }
    for (const pk of side.picks) nextPicks = transferPicks(nextPicks, [pk.pickId], side.teamId, pk.to);
  }
  return { teams: next, picks: nextPicks };
}

export type TradeReviewState = { approvals: TeamId[]; vetoes: TeamId[]; commissionerDecision?: 'approve' | 'veto' };

/** Where a trade stands under the league's review rule. */
export function tradeReviewOutcome(
  settings: LeagueSettings,
  review: TradeReviewState,
  leagueTeams: number,
  hoursSinceAccepted: number,
): 'processed' | 'vetoed' | 'pending' {
  const t = settings.trades;
  if (t.review === 'none') return 'processed';
  if (t.review === 'commissioner') {
    if (review.commissionerDecision === 'veto') return 'vetoed';
    if (review.commissionerDecision === 'approve') return 'processed';
    return hoursSinceAccepted >= t.reviewHours ? 'processed' : 'pending';
  }
  if (review.vetoes.length >= Math.ceil(leagueTeams * t.vetoShare)) return 'vetoed';
  return hoursSinceAccepted >= t.reviewHours ? 'processed' : 'pending';
}
