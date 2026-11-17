// ESPN fantasy football import.
//
// ESPN serves league data from a read API that the ESPN site itself uses:
//   https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{season}/segments/0/leagues/{id}
//     ?view=mTeam&view=mRoster&view=mSettings
// Public leagues answer without signing in. Private leagues need the
// manager's two ESPN cookies (espn_s2 and SWID). Browsers won't let a page
// set a Cookie header, so private leagues go through Coil's server: the app
// opens ESPN's sign-in page in a web view, reads the two cookies after the
// manager signs in, and our server makes the call. Seasons before 2018 live
// at /leagueHistory/{id}?seasonId=YYYY.

import { createFuturePicks } from '../engine/picks';
import { scoringFromPreset } from '../engine/scoring';
import { defaultSettings, type LeagueSettings } from '../engine/settings';
import type { Position, SlotType, StatKey } from '../engine/types';
import type { ImportedLeague, ImportedPlayer, ImportedTeam } from './types';

export type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export const ESPN_API = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl';

/** Pull the league id out of an ESPN league link (…/league?leagueId=123456) or a bare number. */
export function parseEspnLeagueId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/leagueId=(\d+)/i) ?? s.match(/^(\d{4,12})$/);
  return m ? m[1] : null;
}

/** ESPN lineup slot id -> Coil slot. */
export const ESPN_SLOTS: Record<number, SlotType> = {
  0: 'QB', 2: 'RB', 3: 'WR_RB', 4: 'WR', 5: 'WR_TE', 6: 'TE', 7: 'SUPERFLEX', 23: 'FLEX', 16: 'DST', 17: 'K',
  8: 'DL', 9: 'DL', 10: 'LB', 11: 'LB', 12: 'DB', 13: 'DB', 14: 'DB', 15: 'IDP_FLEX', 20: 'BN', 21: 'IR',
};

/** ESPN defaultPositionId -> position. */
const ESPN_POS: Record<number, Position> = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DST', 9: 'DL', 10: 'DL', 11: 'LB', 12: 'DB', 13: 'DB', 14: 'DB', 15: 'LB' };

/** ESPN proTeamId -> NFL abbreviation. */
export const ESPN_TEAMS: Record<number, string> = {
  1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GB', 10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN',
  17: 'NE', 18: 'NO', 19: 'NYG', 20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR', 30: 'JAX', 33: 'BAL', 34: 'HOU',
};

/** ESPN scoring statId -> Coil stat. Values are already per unit (0.04 per passing yard). */
const ESPN_STATS: Record<number, StatKey> = {
  0: 'passAtt', 1: 'passCmp', 2: 'passInc', 3: 'passYds', 4: 'passTd', 19: 'pass2pt', 20: 'passInt',
  23: 'rushAtt', 24: 'rushYds', 25: 'rushTd', 26: 'rush2pt',
  42: 'recYds', 43: 'recTd', 44: 'rec2pt', 53: 'rec', 58: 'recTgt',
  72: 'fumLost', 86: 'xpMade', 88: 'xpMiss',
};

export function mapEspnSettings(raw: any, warnings: string[]): LeagueSettings {
  const st = raw.settings ?? {};
  const keepers = st.draftSettings?.keeperCount ?? 0;
  const s = defaultSettings({ name: st.name ?? 'ESPN league', format: keepers > 0 ? 'keeper' : 'redraft', teams: st.size ?? raw.teams?.length ?? 10 });

  const roster: Partial<Record<SlotType, number>> = {};
  for (const [id, count] of Object.entries<number>(st.rosterSettings?.lineupSlotCounts ?? {})) {
    if (!count) continue;
    const slot = ESPN_SLOTS[Number(id)];
    if (slot) roster[slot] = (roster[slot] ?? 0) + count;
    else warnings.push(`An ESPN roster spot (type ${id}) has no match in Coil and was left out.`);
  }
  if (Object.keys(roster).length) s.roster = roster;

  s.scoring = scoringFromPreset('standard');
  s.scoringPreset = 'standard';
  const skipped = new Set<number>();
  for (const item of st.scoringSettings?.scoringItems ?? []) {
    const key = ESPN_STATS[item.statId];
    if (!key) {
      skipped.add(item.statId);
      continue;
    }
    s.scoring.points[key] = item.points;
    // Overrides are keyed by lineup slot: 0 QB, 2 RB, 4 WR, 6 TE.
    for (const [slotId, pts] of Object.entries<number>(item.pointsOverrides ?? {})) {
      const pos = ({ 0: 'QB', 2: 'RB', 4: 'WR', 6: 'TE' } as Record<number, Position>)[Number(slotId)];
      if (pos) s.scoring.positionOverrides[pos] = { ...s.scoring.positionOverrides[pos], [key]: pts };
    }
  }
  if (s.scoring.points.rec === 1) s.scoringPreset = 'ppr';
  else if (s.scoring.points.rec === 0.5) s.scoringPreset = 'half_ppr';
  if (skipped.size) warnings.push(`${skipped.size} ESPN scoring rule${skipped.size === 1 ? "" : "s"} (mostly kicker and defense) use${skipped.size === 1 ? "s" : ""} Coil's defaults. Check Scoring before week 1.`);

  const acq = st.acquisitionSettings ?? {};
  if (acq.isUsingAcquisitionBudget) {
    s.waivers.type = 'faab';
    s.waivers.faabBudget = acq.acquisitionBudget ?? s.waivers.faabBudget;
  }
  if (st.draftSettings?.type === 'AUCTION') s.draft.type = 'auction';
  const sched = st.scheduleSettings ?? {};
  if (sched.playoffTeamCount) s.playoffs.teams = sched.playoffTeamCount;
  if (sched.matchupPeriodCount) {
    s.regularSeasonWeeks = sched.matchupPeriodCount;
    s.playoffs.startWeek = sched.matchupPeriodCount + 1;
  }
  if (sched.divisions?.length > 1) s.divisions = sched.divisions.length;
  if (keepers) s.keepers.maxPerTeam = keepers;
  return s;
}

export function mapEspnTeams(raw: any, faabBudget: number): ImportedTeam[] {
  const members = new Map<string, any>((raw.members ?? []).map((m: any) => [m.id, m]));
  return (raw.teams ?? []).map((t: any): ImportedTeam => {
    const owner = members.get(t.primaryOwner ?? t.owners?.[0]);
    const players: ImportedPlayer[] = (t.roster?.entries ?? []).map((e: any) => {
      const p = e.playerPoolEntry?.player ?? {};
      const pos = ESPN_POS[p.defaultPositionId] ?? null;
      return {
        sourcePlayerId: String(e.playerId),
        name: p.fullName ?? String(e.playerId),
        position: pos,
        nflTeam: ESPN_TEAMS[p.proTeamId] ?? null,
        slot: e.lineupSlotId === 21 ? 'IR' : 'active',
        keeperRound: e.keeperValue || undefined,
      };
    });
    const overall = t.record?.overall ?? {};
    const spent = t.transactionCounter?.acquisitionBudgetSpent;
    return {
      sourceTeamId: `T${t.id}`,
      name: t.name || `${t.location ?? ''} ${t.nickname ?? ''}`.trim() || `Team ${t.id}`,
      ownerName: owner ? owner.displayName ?? `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() : null,
      ownerSourceUserId: owner?.id ?? null,
      coOwnerNames: (t.owners ?? []).slice(1).map((id: string) => members.get(id)?.displayName).filter(Boolean),
      avatarUrl: t.logo || undefined,
      players,
      faabRemaining: spent !== undefined ? faabBudget - spent : null,
      waiverPosition: t.waiverRank,
      record: { wins: overall.wins ?? 0, losses: overall.losses ?? 0, ties: overall.ties ?? 0, pointsFor: overall.pointsFor ?? 0, pointsAgainst: overall.pointsAgainst ?? 0 },
    };
  });
}

export type EspnImportOptions = {
  fetch?: Fetch;
  season: number;
  /** Only for private leagues; sent by Coil's server, never from the browser. */
  cookies?: { espnS2: string; swid: string };
};

export async function importEspnLeague(input: string, opts: EspnImportOptions): Promise<ImportedLeague> {
  const fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as Fetch);
  const id = parseEspnLeagueId(input);
  if (!id) throw new Error('That doesn’t look like an ESPN league link. It should have leagueId= in it.');
  const url = `${ESPN_API}/seasons/${opts.season}/segments/0/leagues/${id}?view=mTeam&view=mRoster&view=mSettings`;
  const headers = opts.cookies ? { Cookie: `espn_s2=${opts.cookies.espnS2}; SWID=${opts.cookies.swid}` } : undefined;
  const res = await fetchImpl(url, headers ? { headers } : undefined);
  if (res.status === 401 || res.status === 403) throw new Error('This ESPN league is private. Sign in to ESPN once so we can read it.');
  if (!res.ok) throw new Error(`ESPN returned ${res.status}. Check the league link.`);
  const raw = await res.json();

  const warnings: string[] = [];
  const settings = mapEspnSettings(raw, warnings);
  const teams = mapEspnTeams(raw, settings.waivers.faabBudget);
  warnings.push('ESPN doesn’t track traded future picks, so every team starts with its own picks.');
  const picks = settings.format === 'keeper' ? createFuturePicks(teams.map((t) => t.sourceTeamId), opts.season + 1, 1, settings.draft.rounds) : [];
  return { source: 'espn', sourceLeagueId: id, season: opts.season, name: settings.name, settings, teams, picks, history: [], warnings };
}
