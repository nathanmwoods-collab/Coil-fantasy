import type { LeagueSettings } from './settings';
import type { PlayerId, TeamId } from './types';

export type WaiverClaim = {
  id: string;
  teamId: TeamId;
  addPlayerId: PlayerId;
  /** Player to drop if the claim wins. Null = needs an open roster spot. */
  dropPlayerId: PlayerId | null;
  /** FAAB bid. Ignored in rolling and reverse-standings leagues. */
  bid: number;
  /** The team's own preference order, 1 = most wanted. */
  rank: number;
};

export type WaiverTeamState = {
  teamId: TeamId;
  roster: PlayerId[];
  rosterLimit: number;
  faab: number;
  addsThisWeek: number;
  addsThisSeason: number;
};

export type ClaimResult = {
  claimId: string;
  teamId: TeamId;
  addPlayerId: PlayerId;
  status: 'won' | 'lost';
  /** Plain-language reason, shown to the manager. */
  reason: string;
  bid?: number;
};

export type WaiverRunResult = {
  results: ClaimResult[];
  teams: Record<TeamId, WaiverTeamState>;
  /** Priority order after the run (rolling leagues move winners to the back). */
  priority: TeamId[];
};

/**
 * Process one waiver run.
 *
 * FAAB: highest bid on a player wins; ties go to waiver priority (or worse
 * record). Claims are resolved player by player from the biggest bid down,
 * so a team that loses its first choice still gets a shot at its next one.
 *
 * Rolling / reverse standings: the team at the top of the order gets its
 * best still-valid claim, then moves to the back; repeat until no claims are left.
 */
export function processWaivers(
  settings: LeagueSettings,
  claims: WaiverClaim[],
  teamsIn: WaiverTeamState[],
  priorityIn: TeamId[],
  teamName: (id: TeamId) => string = (id) => id,
): WaiverRunResult {
  const teams: Record<TeamId, WaiverTeamState> = {};
  for (const t of teamsIn) teams[t.teamId] = { ...t, roster: [...t.roster] };
  const owned = new Set(teamsIn.flatMap((t) => t.roster));
  const results: ClaimResult[] = [];
  const done = new Set<string>();
  let priority = [...priorityIn];
  const w = settings.waivers;

  const invalidReason = (c: WaiverClaim): string | null => {
    const t = teams[c.teamId];
    if (!t) return 'Team not found.';
    if (owned.has(c.addPlayerId)) return 'Another team already got him.';
    if (c.dropPlayerId && !t.roster.includes(c.dropPlayerId)) return 'The player you were dropping is already gone.';
    if (!c.dropPlayerId && t.roster.length >= t.rosterLimit) return 'Your roster is full. Pick someone to drop.';
    if (w.maxAddsPerWeek !== null && t.addsThisWeek >= w.maxAddsPerWeek) return 'You hit the weekly add limit.';
    if (w.maxAddsPerSeason !== null && t.addsThisSeason >= w.maxAddsPerSeason) return 'You hit the season add limit.';
    if (w.type === 'faab') {
      if (c.bid > t.faab) return `You only have $${t.faab} left.`;
      if (c.bid === 0 && !w.allowZeroBids) return 'This league needs bids of at least $1.';
    }
    return null;
  };

  const award = (c: WaiverClaim) => {
    const t = teams[c.teamId];
    if (c.dropPlayerId) {
      t.roster = t.roster.filter((p) => p !== c.dropPlayerId);
      owned.delete(c.dropPlayerId);
    }
    t.roster.push(c.addPlayerId);
    owned.add(c.addPlayerId);
    t.addsThisWeek++;
    t.addsThisSeason++;
    if (w.type === 'faab') t.faab -= c.bid;
    done.add(c.id);
  };

  const prioIndex = (id: TeamId) => {
    const i = priority.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  if (w.type === 'faab') {
    // Repeatedly take each team's best remaining valid claim, then award the
    // single strongest of those. This respects each team's ranking while
    // letting bids decide contested players.
    for (;;) {
      const tops: WaiverClaim[] = [];
      for (const teamId of Object.keys(teams)) {
        const mine = claims.filter((c) => c.teamId === teamId && !done.has(c.id)).sort((a, b) => a.rank - b.rank);
        for (const c of mine) {
          const why = invalidReason(c);
          if (why) {
            done.add(c.id);
            results.push({ claimId: c.id, teamId, addPlayerId: c.addPlayerId, status: 'lost', reason: why, bid: c.bid });
            continue;
          }
          tops.push(c);
          break;
        }
      }
      if (!tops.length) break;
      tops.sort((a, b) => b.bid - a.bid || prioIndex(a.teamId) - prioIndex(b.teamId));
      const winner = tops[0];
      award(winner);
      results.push({ claimId: winner.id, teamId: winner.teamId, addPlayerId: winner.addPlayerId, status: 'won', reason: `Won for $${winner.bid}.`, bid: winner.bid });
      // Everyone else who wanted this player loses it now, with the reason.
      for (const c of claims) {
        if (done.has(c.id) || c.addPlayerId !== winner.addPlayerId) continue;
        done.add(c.id);
        const tiedBid = c.bid === winner.bid;
        results.push({
          claimId: c.id,
          teamId: c.teamId,
          addPlayerId: c.addPlayerId,
          status: 'lost',
          bid: c.bid,
          reason: tiedBid
            ? `${teamName(winner.teamId)} also bid $${winner.bid} and had higher waiver priority.`
            : `Outbid by ${teamName(winner.teamId)} ($${winner.bid}).`,
        });
      }
      // FAAB ties use priority; the winner drops to the back like rolling.
      if (tops.length > 1 && tops[1].bid === winner.bid) {
        priority = [...priority.filter((t) => t !== winner.teamId), winner.teamId];
      }
    }
  } else {
    let progress = true;
    while (progress) {
      progress = false;
      for (const teamId of priority) {
        const mine = claims.filter((c) => c.teamId === teamId && !done.has(c.id)).sort((a, b) => a.rank - b.rank);
        let won: WaiverClaim | null = null;
        for (const c of mine) {
          const why = invalidReason(c);
          if (why) {
            done.add(c.id);
            results.push({ claimId: c.id, teamId, addPlayerId: c.addPlayerId, status: 'lost', reason: why });
            continue;
          }
          won = c;
          break;
        }
        if (!won) continue;
        award(won);
        results.push({ claimId: won.id, teamId, addPlayerId: won.addPlayerId, status: 'won', reason: 'Won on waiver priority.' });
        for (const c of claims) {
          if (done.has(c.id) || c.addPlayerId !== won.addPlayerId) continue;
          done.add(c.id);
          results.push({ claimId: c.id, teamId: c.teamId, addPlayerId: c.addPlayerId, status: 'lost', reason: `${teamName(teamId)} had higher waiver priority.` });
        }
        priority = [...priority.filter((t) => t !== teamId), teamId];
        progress = true;
        break; // restart from the new top of the order
      }
    }
  }

  return { results, teams, priority };
}
