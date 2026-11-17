// Sleeper importer. Sleeper's read API is public (no sign-in), so a
// commissioner pastes a league link or ID and we pull everything:
// settings, scoring, rosters, IR, taxi, FAAB, future and traded picks, and
// every past season by following previous_league_id.
//
// Field names follow Sleeper's public API docs (docs.sleeper.com). Mapping of
// rarely used settings should be re-checked against live leagues before launch.

import { createFuturePicks, pickId, type DraftPick } from '../engine/picks';
import { scoringFromPreset, type ScoringRules } from '../engine/scoring';
import { defaultSettings, type LeagueFormat, type LeagueSettings } from '../engine/settings';
import type { InjuryStatus, Position, SlotType, StatKey } from '../engine/types';
import type { ImportedLeague, ImportedPlayer, ImportedSeason, ImportedTeam } from './types';

type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

const API = 'https://api.sleeper.app/v1';

/** Pull a league ID out of anything a commissioner might paste. */
export function parseSleeperLeagueId(input: string): string | null {
  const m = input.match(/(\d{15,20})/);
  return m ? m[1] : null;
}

const SLOT_MAP: Record<string, SlotType> = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  K: 'K',
  DEF: 'DST',
  DL: 'DL',
  LB: 'LB',
  DB: 'DB',
  FLEX: 'FLEX',
  WRRB_FLEX: 'WR_RB',
  REC_FLEX: 'WR_TE',
  SUPER_FLEX: 'SUPERFLEX',
  IDP_FLEX: 'IDP_FLEX',
  BN: 'BN',
};

/** Sleeper scoring key -> Coil stat key. */
const SCORING_MAP: Record<string, StatKey> = {
  pass_yd: 'passYds',
  pass_td: 'passTd',
  pass_int: 'passInt',
  pass_cmp: 'passCmp',
  pass_inc: 'passInc',
  pass_att: 'passAtt',
  pass_2pt: 'pass2pt',
  pass_fd: 'pass1stDown',
  pass_sack: 'sacked',
  rush_yd: 'rushYds',
  rush_td: 'rushTd',
  rush_att: 'rushAtt',
  rush_2pt: 'rush2pt',
  rush_fd: 'rush1stDown',
  rec: 'rec',
  rec_yd: 'recYds',
  rec_td: 'recTd',
  rec_tgt: 'recTgt',
  rec_2pt: 'rec2pt',
  rec_fd: 'rec1stDown',
  fum_lost: 'fumLost',
  fum: 'fum',
  kr_td: 'krTd',
  pr_td: 'prTd',
  kr_yd: 'krYds',
  pr_yd: 'prYds',
  fgmiss: 'fgMiss',
  xpm: 'xpMade',
  xpmiss: 'xpMiss',
  sack: 'defSack',
  int: 'defInt',
  fum_rec: 'defFumRec',
  def_td: 'defTd',
  safe: 'defSafety',
  blk_kick: 'defBlkKick',
  def_st_td: 'stTd',
  st_td: 'stTd',
  idp_tkl_solo: 'idpSoloTkl',
  idp_tkl_ast: 'idpAstTkl',
  idp_sack: 'idpSack',
  idp_tkl_loss: 'idpTfl',
  idp_qb_hit: 'idpQbHit',
  idp_int: 'idpInt',
  idp_pass_def: 'idpPassDef',
  idp_ff: 'idpFf',
  idp_fum_rec: 'idpFumRec',
  idp_def_td: 'idpTd',
  idp_safe: 'idpSafety',
};

export function mapSleeperScoring(raw: Record<string, number>, warnings: string[]): ScoringRules {
  const rules = scoringFromPreset('standard');
  rules.points = {};
  for (const [key, value] of Object.entries(raw)) {
    const stat = SCORING_MAP[key];
    if (stat) rules.points[stat] = value;
  }
  // Position premiums
  const prem: [string, Position][] = [
    ['bonus_rec_te', 'TE'],
    ['bonus_rec_rb', 'RB'],
    ['bonus_rec_wr', 'WR'],
  ];
  for (const [key, pos] of prem) {
    if (raw[key]) rules.positionOverrides[pos] = { ...rules.positionOverrides[pos], rec: (raw.rec ?? 0) + raw[key] };
  }
  // Yardage bonuses like bonus_rush_yd_100, bonus_pass_yd_300
  for (const [key, value] of Object.entries(raw)) {
    const m = key.match(/^bonus_(pass|rush|rec)_yd_(\d+)$/);
    if (m && value) {
      const stat: StatKey = m[1] === 'pass' ? 'passYds' : m[1] === 'rush' ? 'rushYds' : 'recYds';
      rules.bonuses.push({ stat, threshold: Number(m[2]), points: value });
    }
  }
  // Field goals by distance
  const fg: [string, number][] = [
    ['fgm_0_19', 0],
    ['fgm_20_29', 20],
    ['fgm_30_39', 30],
    ['fgm_40_49', 40],
    ['fgm_50p', 50],
  ];
  if (fg.some(([k]) => raw[k] !== undefined)) {
    rules.fieldGoalTiers = fg.filter(([k]) => raw[k] !== undefined).map(([k, minYards]) => ({ minYards, points: raw[k] }));
  }
  // Points allowed tiers
  const pa: [string, number][] = [
    ['pts_allow_0', 0],
    ['pts_allow_1_6', 6],
    ['pts_allow_7_13', 13],
    ['pts_allow_14_20', 20],
    ['pts_allow_21_27', 27],
    ['pts_allow_28_34', 34],
    ['pts_allow_35p', Number.MAX_SAFE_INTEGER],
  ];
  if (pa.some(([k]) => raw[k] !== undefined)) {
    rules.pointsAllowedTiers = pa.filter(([k]) => raw[k] !== undefined).map(([k, max]) => ({ max, points: raw[k] }));
  }
  const unknown = Object.keys(raw).filter(
    (k) => raw[k] && !SCORING_MAP[k] && !/^bonus_(rec_(te|rb|wr)|(pass|rush|rec)_yd_\d+)$/.test(k) && !/^(fgm_|pts_allow_)/.test(k),
  );
  if (unknown.length) {
    warnings.push(`We couldn't match ${unknown.length} scoring rule${unknown.length === 1 ? '' : 's'} (${unknown.slice(0, 5).join(', ')}${unknown.length > 5 ? '…' : ''}). Check scoring before the season.`);
  }
  return rules;
}

function formatOf(type: number | undefined, bestBall: number | undefined): LeagueFormat {
  if (bestBall) return 'bestball';
  return type === 2 ? 'dynasty' : type === 1 ? 'keeper' : 'redraft';
}

export function mapSleeperSettings(league: any, warnings: string[]): LeagueSettings {
  const st = league.settings ?? {};
  const s = defaultSettings({ name: league.name, format: formatOf(st.type, st.best_ball), teams: league.total_rosters ?? st.num_teams ?? 12 });

  const roster: Partial<Record<SlotType, number>> = {};
  for (const pos of league.roster_positions ?? []) {
    const slot = SLOT_MAP[pos];
    if (slot) roster[slot] = (roster[slot] ?? 0) + 1;
    else warnings.push(`Unknown roster spot "${pos}" was left out.`);
  }
  if (st.reserve_slots) roster.IR = st.reserve_slots;
  if (st.taxi_slots) roster.TAXI = st.taxi_slots;
  s.roster = roster;

  s.scoringPreset = 'ppr';
  s.scoring = mapSleeperScoring(league.scoring_settings ?? {}, warnings);

  const ir: InjuryStatus[] = ['ir'];
  if (st.reserve_allow_out) ir.push('out');
  if (st.reserve_allow_doubtful) ir.push('doubtful');
  if (st.reserve_allow_sus) ir.push('suspended');
  if (st.reserve_allow_cov) ir.push('covid');
  if (st.reserve_allow_na) ir.push('nfi', 'pup');
  s.irEligible = ir;

  s.waivers.type = st.waiver_type === 2 ? 'faab' : st.waiver_type === 1 ? 'reverse_standings' : 'rolling';
  if (st.waiver_budget !== undefined) s.waivers.faabBudget = st.waiver_budget;
  if (st.waiver_clear_days !== undefined) s.waivers.holdDays = st.waiver_clear_days;

  if (st.trade_deadline !== undefined) s.trades.deadlineWeek = st.trade_deadline >= 99 ? null : st.trade_deadline;
  if (st.playoff_teams !== undefined) s.playoffs.teams = st.playoff_teams;
  if (st.playoff_week_start) {
    s.playoffs.startWeek = st.playoff_week_start;
    s.regularSeasonWeeks = st.playoff_week_start - 1;
  }
  // playoff_round_type: 0 one week per round, 1 two-week championship, 2 two weeks every round
  if (st.playoff_round_type === 2) s.playoffs.weeksPerRound = 2;
  if (st.playoff_round_type === 1) warnings.push('Your Sleeper league uses a two-week championship only. Coil set one-week rounds; adjust if needed.');
  if (st.divisions) s.divisions = st.divisions;
  if (st.draft_rounds) s.draft.rounds = st.draft_rounds;
  if (st.max_keepers) s.keepers.maxPerTeam = st.max_keepers;
  if (st.league_average_match) s.matchups.medianGame = true;
  s.dynasty.taxiSlots = st.taxi_slots ?? 0;
  if (st.taxi_years !== undefined) s.dynasty.taxiMaxYearsPro = Math.max(0, st.taxi_years - 1);
  if (s.format === 'dynasty') s.trades.futurePickSeasons = 3;
  return s;
}

function teamIdOf(rosterId: number | string): string {
  return `sleeper:${rosterId}`;
}

export function mapSleeperTeams(
  rosters: any[],
  users: any[],
  playerDb: Record<string, any> | null,
  faabBudget: number,
): ImportedTeam[] {
  const userById = new Map(users.map((u) => [u.user_id, u]));
  return rosters.map((r) => {
    const owner = userById.get(r.owner_id);
    const reserve = new Set<string>(r.reserve ?? []);
    const taxi = new Set<string>(r.taxi ?? []);
    const players: ImportedPlayer[] = (r.players ?? []).map((id: string) => {
      const p = playerDb?.[id];
      const pos = p?.position === 'DEF' ? 'DST' : p?.position;
      return {
        sourcePlayerId: id,
        name: p ? (p.position === 'DEF' ? `${p.team ?? id} D/ST` : `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()) : id,
        position: (pos as Position) ?? null,
        nflTeam: p?.team ?? (p?.position === 'DEF' ? id : null),
        slot: reserve.has(id) ? 'IR' : taxi.has(id) ? 'TAXI' : 'active',
      } satisfies ImportedPlayer;
    });
    const settings = r.settings ?? {};
    return {
      sourceTeamId: teamIdOf(r.roster_id),
      name: owner?.metadata?.team_name || owner?.display_name || `Team ${r.roster_id}`,
      ownerName: owner?.display_name ?? null,
      ownerSourceUserId: r.owner_id ?? null,
      coOwnerNames: (r.co_owners ?? []).map((id: string) => userById.get(id)?.display_name).filter(Boolean),
      avatarUrl: owner?.avatar ? `https://sleepercdn.com/avatars/thumbs/${owner.avatar}` : undefined,
      players,
      faabRemaining: settings.waiver_budget_used !== undefined ? faabBudget - settings.waiver_budget_used : null,
      waiverPosition: settings.waiver_position,
      record: {
        wins: settings.wins ?? 0,
        losses: settings.losses ?? 0,
        ties: settings.ties ?? 0,
        pointsFor: (settings.fpts ?? 0) + (settings.fpts_decimal ?? 0) / 100,
        pointsAgainst: (settings.fpts_against ?? 0) + (settings.fpts_against_decimal ?? 0) / 100,
      },
    };
  });
}

/**
 * Future picks with trades applied. Sleeper only lists picks that moved, so
 * we build the full set and then re-own the traded ones.
 */
export function mapSleeperPicks(
  rosterIds: number[],
  tradedPicks: any[],
  firstSeason: number,
  seasons: number,
  rounds: number,
): DraftPick[] {
  let picks = createFuturePicks(rosterIds.map(teamIdOf), firstSeason, seasons, rounds);
  for (const tp of tradedPicks) {
    const id = pickId(Number(tp.season), tp.round, teamIdOf(tp.roster_id));
    picks = picks.map((p) => (p.id === id ? { ...p, ownerTeamId: teamIdOf(tp.owner_id) } : p));
  }
  return picks;
}

function seasonFromBracket(league: any, rosters: any[], users: any[], bracket: any[] | null): ImportedSeason {
  const teams = mapSleeperTeams(rosters, users, null, 0);
  const byRoster = new Map(teams.map((t) => [t.sourceTeamId, t]));
  const final = (bracket ?? []).find((m) => m.p === 1);
  const champ = final?.w ? byRoster.get(teamIdOf(final.w)) : undefined;
  const runner = final?.l ? byRoster.get(teamIdOf(final.l)) : undefined;
  return {
    season: Number(league.season),
    leagueName: league.name,
    championTeamId: champ?.sourceTeamId ?? null,
    championName: champ?.name ?? null,
    runnerUpName: runner?.name ?? null,
    standings: teams
      .map((t) => ({ teamName: t.name, ownerName: t.ownerName, wins: t.record!.wins, losses: t.record!.losses, ties: t.record!.ties, pointsFor: t.record!.pointsFor }))
      .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor),
  };
}

export type SleeperImportOptions = {
  fetch?: Fetch;
  /** Sleeper's full player list (/players/nfl, ~5 MB). Cache it server-side daily. */
  playerDb?: Record<string, any> | null;
  /** How many past seasons to pull. */
  maxHistorySeasons?: number;
};

export async function importSleeperLeague(input: string, opts: SleeperImportOptions = {}): Promise<ImportedLeague> {
  const fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as Fetch);
  const leagueId = parseSleeperLeagueId(input);
  if (!leagueId) throw new Error('That doesn’t look like a Sleeper league link or ID.');

  const get = async (path: string) => {
    const res = await fetchImpl(`${API}${path}`);
    if (!res.ok) throw new Error(`Sleeper returned ${res.status} for ${path}`);
    return res.json();
  };

  const league = await get(`/league/${leagueId}`);
  if (!league) throw new Error('We couldn’t find that Sleeper league. Is the ID right?');
  const [rosters, users, traded] = await Promise.all([
    get(`/league/${leagueId}/rosters`),
    get(`/league/${leagueId}/users`),
    get(`/league/${leagueId}/traded_picks`),
  ]);

  const warnings: string[] = [];
  const settings = mapSleeperSettings(league, warnings);
  const season = Number(league.season);
  const teams = mapSleeperTeams(rosters, users, opts.playerDb ?? null, settings.waivers.faabBudget);

  // Picks: if this season's draft hasn't happened, include it.
  const preDraft = league.status === 'pre_draft' || league.status === 'drafting';
  const firstPickSeason = preDraft ? season : season + 1;
  const rounds = settings.format === 'dynasty' ? settings.dynasty.rookieDraftRounds : settings.draft.rounds;
  const pickSeasons = settings.format === 'dynasty' || settings.format === 'keeper' ? 3 : preDraft ? 1 : 0;
  const picks = pickSeasons
    ? mapSleeperPicks(rosters.map((r: any) => r.roster_id), traded ?? [], firstPickSeason, pickSeasons, rounds)
    : [];
  const rosteredTradedPicks = (traded ?? []).filter((t: any) => Number(t.season) >= firstPickSeason + pickSeasons);
  if (rosteredTradedPicks.length) warnings.push(`${rosteredTradedPicks.length} traded pick(s) are further out than ${pickSeasons} seasons; we added the window to cover them.`);

  // History: follow previous_league_id back.
  const history: ImportedSeason[] = [];
  let prevId: string | null = league.previous_league_id && league.previous_league_id !== '0' ? league.previous_league_id : null;
  const max = opts.maxHistorySeasons ?? 15;
  while (prevId && history.length < max) {
    try {
      const prev = await get(`/league/${prevId}`);
      if (!prev) break;
      const [pr, pu, bracket] = await Promise.all([
        get(`/league/${prevId}/rosters`),
        get(`/league/${prevId}/users`),
        get(`/league/${prevId}/winners_bracket`).catch(() => null),
      ]);
      history.push(seasonFromBracket(prev, pr, pu, bracket));
      prevId = prev.previous_league_id && prev.previous_league_id !== '0' ? prev.previous_league_id : null;
    } catch {
      warnings.push('Some older seasons could not be loaded. You can add them later.');
      break;
    }
  }

  if (!opts.playerDb) warnings.push('Player names will fill in once the player list loads.');
  const unowned = teams.filter((t) => !t.ownerSourceUserId);
  if (unowned.length) warnings.push(`${unowned.length} team(s) have no manager. Invite someone or leave them for the commissioner.`);

  return {
    source: 'sleeper',
    sourceLeagueId: leagueId,
    season,
    name: league.name,
    settings,
    teams,
    picks,
    history,
    warnings,
  };
}
