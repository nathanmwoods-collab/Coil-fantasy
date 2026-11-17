import type { LeagueSettings, Tiebreaker } from './settings';
import type { TeamId } from './types';

export const BYE = '__bye__';

export type Matchup = { week: number; home: TeamId; away: TeamId };

/**
 * Round-robin schedule (circle method), repeated until the season is full.
 * Odd team counts get a bye each week.
 */
export function roundRobinSchedule(teamIds: TeamId[], weeks: number): Matchup[] {
  const teams = teamIds.length % 2 ? [...teamIds, BYE] : [...teamIds];
  const n = teams.length;
  const rounds: [TeamId, TeamId][][] = [];
  const rot = teams.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const circle = [teams[0], ...rot];
    const pairs: [TeamId, TeamId][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i];
      const b = circle[n - 1 - i];
      pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    rot.unshift(rot.pop()!);
  }
  const out: Matchup[] = [];
  for (let w = 1; w <= weeks; w++) {
    for (const [home, away] of rounds[(w - 1) % rounds.length]) {
      if (home === BYE || away === BYE) continue;
      out.push({ week: w, home, away });
    }
  }
  return out;
}

export type TeamRecord = {
  teamId: TeamId;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  allPlayWins: number;
  allPlayLosses: number;
  allPlayTies: number;
  /** Highest possible score each week, summed (used for rookie draft order). */
  maxPointsFor: number;
  division?: number;
};

export type WeekScores = { week: number; scores: Record<TeamId, number>; maxScores?: Record<TeamId, number> };

const emptyRecord = (teamId: TeamId, division?: number): TeamRecord => ({
  teamId,
  wins: 0,
  losses: 0,
  ties: 0,
  pointsFor: 0,
  pointsAgainst: 0,
  allPlayWins: 0,
  allPlayLosses: 0,
  allPlayTies: 0,
  maxPointsFor: 0,
  division,
});

export function winPct(r: Pick<TeamRecord, 'wins' | 'losses' | 'ties'>): number {
  const g = r.wins + r.losses + r.ties;
  return g ? (r.wins + r.ties / 2) / g : 0;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Standings from the schedule and weekly scores. Handles head-to-head,
 * total-points leagues, the median game and all-play records.
 */
export function computeStandings(
  settings: LeagueSettings,
  teamIds: TeamId[],
  schedule: Matchup[],
  weeks: WeekScores[],
  divisions: Record<TeamId, number> = {},
): TeamRecord[] {
  const rec = new Map(teamIds.map((t) => [t, emptyRecord(t, divisions[t])]));
  const h2h = new Map<string, number>(); // "a|b" -> a's net wins vs b

  for (const wk of weeks) {
    const scores = wk.scores;
    const played = teamIds.filter((t) => scores[t] !== undefined);
    for (const t of played) {
      const r = rec.get(t)!;
      r.pointsFor += scores[t];
      r.maxPointsFor += wk.maxScores?.[t] ?? scores[t];
      for (const o of played) {
        if (o === t) continue;
        if (scores[t] > scores[o]) r.allPlayWins++;
        else if (scores[t] < scores[o]) r.allPlayLosses++;
        else r.allPlayTies++;
      }
    }

    if (settings.matchups.type === 'head_to_head') {
      for (const m of schedule.filter((x) => x.week === wk.week)) {
        const a = scores[m.home];
        const b = scores[m.away];
        if (a === undefined || b === undefined) continue;
        const ra = rec.get(m.home)!;
        const rb = rec.get(m.away)!;
        ra.pointsAgainst += b;
        rb.pointsAgainst += a;
        if (a > b) {
          ra.wins++;
          rb.losses++;
        } else if (b > a) {
          rb.wins++;
          ra.losses++;
        } else {
          ra.ties++;
          rb.ties++;
        }
        const sign = Math.sign(a - b);
        h2h.set(`${m.home}|${m.away}`, (h2h.get(`${m.home}|${m.away}`) ?? 0) + sign);
        h2h.set(`${m.away}|${m.home}`, (h2h.get(`${m.away}|${m.home}`) ?? 0) - sign);
      }
    }

    if (settings.matchups.medianGame || settings.matchups.type === 'total_points') {
      if (settings.matchups.medianGame && played.length > 1) {
        const med = median(played.map((t) => scores[t]));
        for (const t of played) {
          const r = rec.get(t)!;
          if (scores[t] > med) r.wins++;
          else if (scores[t] < med) r.losses++;
          else r.ties++;
        }
      }
    }
  }

  const list = [...rec.values()];
  return sortStandings(settings, list, (a, b) => h2h.get(`${a}|${b}`) ?? 0);
}

export function sortStandings(
  settings: LeagueSettings,
  records: TeamRecord[],
  headToHead: (a: TeamId, b: TeamId) => number = () => 0,
): TeamRecord[] {
  const cmp: Record<Tiebreaker, (a: TeamRecord, b: TeamRecord) => number> = {
    points_for: (a, b) => b.pointsFor - a.pointsFor,
    points_against: (a, b) => a.pointsAgainst - b.pointsAgainst,
    head_to_head: (a, b) => -headToHead(a.teamId, b.teamId),
    all_play: (a, b) => winPct({ wins: b.allPlayWins, losses: b.allPlayLosses, ties: b.allPlayTies }) -
      winPct({ wins: a.allPlayWins, losses: a.allPlayLosses, ties: a.allPlayTies }),
    division_record: () => 0,
  };
  return [...records].sort((a, b) => {
    const primary =
      settings.matchups.type === 'total_points' && !settings.matchups.medianGame
        ? b.pointsFor - a.pointsFor
        : winPct(b) - winPct(a);
    if (primary) return primary;
    for (const t of settings.tiebreakers) {
      const d = cmp[t](a, b);
      if (d) return d;
    }
    return a.teamId.localeCompare(b.teamId);
  });
}

// ---------------------------------------------------------------------------
// Playoffs
// ---------------------------------------------------------------------------

/** Playoff seeds from sorted standings; division winners first if the league wants it. */
export function seedPlayoffs(settings: LeagueSettings, standings: TeamRecord[]): TeamId[] {
  const n = settings.playoffs.teams;
  if (!settings.playoffs.divisionWinnersFirst || !settings.divisions) {
    return standings.slice(0, n).map((r) => r.teamId);
  }
  const winners: TeamId[] = [];
  const seen = new Set<number>();
  for (const r of standings) {
    if (r.division !== undefined && !seen.has(r.division)) {
      seen.add(r.division);
      winners.push(r.teamId);
    }
  }
  const rest = standings.map((r) => r.teamId).filter((t) => !winners.includes(t));
  return [...winners, ...rest].slice(0, n);
}

export type PlayoffGame = { round: number; weeks: number[]; high: TeamId; low: TeamId | null };

/**
 * First-round bracket. Top seeds get byes when the field isn't a power of 2:
 * 6 teams = seeds 1 and 2 on bye, 3 v 6, 4 v 5.
 */
export function firstRound(settings: LeagueSettings, seeds: TeamId[]): PlayoffGame[] {
  const n = seeds.length;
  const size = 2 ** Math.ceil(Math.log2(Math.max(n, 2)));
  const byes = size - n;
  const weeks = roundWeeks(settings, 1);
  const games: PlayoffGame[] = [];
  for (let i = 0; i < byes; i++) games.push({ round: 1, weeks, high: seeds[i], low: null });
  const playing = seeds.slice(byes);
  for (let i = 0; i < playing.length / 2; i++) {
    games.push({ round: 1, weeks, high: playing[i], low: playing[playing.length - 1 - i] });
  }
  return games;
}

export function roundWeeks(settings: LeagueSettings, round: number): number[] {
  const start = settings.playoffs.startWeek + (round - 1) * settings.playoffs.weeksPerRound;
  return Array.from({ length: settings.playoffs.weeksPerRound }, (_, i) => start + i);
}

/**
 * Next round from the teams still alive. With reseeding, the best seed left
 * plays the worst; without it, bracket position holds (winners of adjacent
 * games meet).
 */
export function nextRound(settings: LeagueSettings, round: number, aliveInBracketOrder: TeamId[], seeds: TeamId[]): PlayoffGame[] {
  const weeks = roundWeeks(settings, round);
  const order = settings.playoffs.reseed
    ? [...aliveInBracketOrder].sort((a, b) => seeds.indexOf(a) - seeds.indexOf(b))
    : aliveInBracketOrder;
  const games: PlayoffGame[] = [];
  if (settings.playoffs.reseed) {
    for (let i = 0; i < order.length / 2; i++) games.push({ round, weeks, high: order[i], low: order[order.length - 1 - i] });
  } else {
    for (let i = 0; i < order.length; i += 2) {
      const [a, b] = [order[i], order[i + 1]];
      const [high, low] = seeds.indexOf(a) <= seeds.indexOf(b) ? [a, b] : [b, a];
      games.push({ round, weeks, high, low });
    }
  }
  return games;
}

/**
 * Order winners of a round for a non-reseeded next round so the 1 seed's side
 * meets the 4/5 side, and the 2 seed's side meets the 3/6 side.
 */
export function bracketOrder(games: PlayoffGame[], seeds: TeamId[]): PlayoffGame[] {
  const sorted = [...games].sort((a, b) => seeds.indexOf(a.high) - seeds.indexOf(b.high));
  const out: PlayoffGame[] = [];
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    out.push(sorted[lo++]);
    if (lo <= hi) out.push(sorted[hi--]);
  }
  return out;
}
