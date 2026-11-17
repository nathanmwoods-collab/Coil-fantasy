// Sleeper importer. Sleeper's read API is public (no sign-in), so a
// commissioner pastes a league link or ID and we pull everything:
// settings, scoring, rosters, IR, taxi, FAAB, future and traded picks, and
// every past season by following previous_league_id.
//
// Field names follow Sleeper's public API docs (docs.sleeper.com). Mapping of
// rarely used settings should be re-checked against live leagues before launch.

import { createFuturePicks, pickId, type DraftPick } from '../engine/picks';
import { scoringFromPreset, type BigPlayBonus, type MilestoneStat, type ScoringRules } from '../engine/scoring';
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
  pass_int_td: 'passIntTd',
  pass_cmp_40p: 'pass40',
  rush_40p: 'rush40',
  rec_40p: 'rec40',
  fum_rec_td: 'fumRecTd',
  fgm: 'fgMade',
  fgm_yds: 'fgYds',
  fgm_yds_over_30: 'fgYdsOver30',
  pts_allow: 'pointsAllowed',
  yds_allow: 'yardsAllowed',
  int_ret_yd: 'defIntYds',
  fum_ret_yd: 'defFumRetYds',
  blk_kick_ret_yd: 'defBlkKickYds',
  def_2pt: 'def2ptRet',
  tkl: 'defTkl',
  tkl_loss: 'defTfl',
  sack_yd: 'defSackYds',
  qb_hit: 'defQbHit',
  def_pass_def: 'defPassDef',
  ff: 'defFf',
  def_3_and_out: 'def3AndOut',
  def_4_and_stop: 'def4thStop',
  def_forced_punts: 'defForcedPunt',
  fg_ret_yd: 'defMissedFgRetYds',
  def_kr_yd: 'defKrYds',
  def_pr_yd: 'defPrYds',
  st_ff: 'stFf',
  def_st_ff: 'stFf',
  st_fum_rec: 'stFumRec',
  def_st_fum_rec: 'stFumRec',
  st_tkl_solo: 'stSoloTkl',
  def_st_tkl_solo: 'stSoloTkl',
  idp_tkl: 'idpTkl',
  idp_sack_yd: 'idpSackYds',
  idp_int_ret_yd: 'idpIntYds',
  idp_fum_ret_yd: 'idpFumRetYds',
  idp_blk_kick: 'idpBlkKick',
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

const REVERSE = Object.fromEntries(Object.entries(SCORING_MAP).map(([k, v]) => [v, k])) as Record<StatKey, string>;

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
  // Big games: bonus_rush_yd_100 + bonus_rush_yd_200 become ranges (100–199, 200+).
  const handled = new Set<string>();
  const yardStat: Record<string, MilestoneStat> = { pass: 'passYds', rush: 'rushYds', rec: 'recYds', rush_rec: 'rushRecYds' };
  for (const kind of Object.keys(yardStat)) {
    const steps = Object.keys(raw)
      .map((k) => k.match(new RegExp(`^bonus_${kind}_yd_(\\d+)$`)))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => ({ key: m[0], min: Number(m[1]) }))
      .sort((a, b) => a.min - b.min);
    steps.forEach((st, i) => {
      handled.add(st.key);
      if (raw[st.key]) rules.milestones.push({ stat: yardStat[kind], min: st.min, max: steps[i + 1] ? steps[i + 1].min - 1 : undefined, points: raw[st.key] });
    });
  }
  // Volume and defensive bonuses.
  const thresholds: [string, MilestoneStat, number][] = [
    ['bonus_pass_cmp_25', 'passCmp', 25],
    ['bonus_rush_att_20', 'rushAtt', 20],
    ['bonus_tkl_10p', 'idpTkl', 10],
    ['bonus_sack_2p', 'idpSack', 2],
    ['bonus_def_pass_def_3p', 'idpPassDef', 3],
  ];
  for (const [key, stat, threshold] of thresholds) {
    handled.add(key);
    if (raw[key]) rules.bonuses.push({ stat, threshold, points: raw[key] });
  }
  // First downs by position.
  for (const pos of ['QB', 'RB', 'WR', 'TE'] as Position[]) {
    const key = `bonus_fd_${pos.toLowerCase()}`;
    handled.add(key);
    if (raw[key]) {
      const o = { ...rules.positionOverrides[pos] };
      for (const stat of ['pass1stDown', 'rush1stDown', 'rec1stDown'] as StatKey[]) o[stat] = (raw[REVERSE[stat]] ?? 0) + raw[key];
      rules.positionOverrides[pos] = o;
    }
  }
  // Big-play TDs.
  const big: [string, BigPlayBonus['kind'], number][] = [
    ['pass_td_40p', 'pass', 40],
    ['pass_td_50p', 'pass', 50],
    ['rush_td_40p', 'rush', 40],
    ['rush_td_50p', 'rush', 50],
    ['rec_td_40p', 'rec', 40],
    ['rec_td_50p', 'rec', 50],
    ['bonus_def_int_td_50p', 'intRet', 50],
    ['bonus_def_fum_td_50p', 'fumRet', 50],
  ];
  for (const [key, kind, minYards] of big) {
    handled.add(key);
    if (raw[key]) rules.bigPlays.push({ kind, minYards, points: raw[key], on: 'td' });
  }
  // Catch length.
  const catchLen: [string, number][] = [
    ['rec_0_4', 0],
    ['rec_5_9', 5],
    ['rec_10_19', 10],
    ['rec_20_29', 20],
    ['rec_30_39', 30],
  ];
  for (const [key, minYards] of catchLen) {
    handled.add(key);
    if (raw[key]) rules.catchLengthBonuses.push({ minYards, points: raw[key] });
  }
  // Field goals by distance
  const fg: [string, number][] = [
    ['fgm_0_19', 0],
    ['fgm_20_29', 20],
    ['fgm_30_39', 30],
    ['fgm_40_49', 40],
    ['fgm_50_59', 50],
    ['fgm_50p', 50],
    ['fgm_60p', 60],
  ];
  fg.forEach(([k]) => handled.add(k));
  if (fg.some(([k]) => raw[k] !== undefined)) {
    rules.fieldGoalTiers = fg.filter(([k]) => raw[k] !== undefined).map(([k, minYards]) => ({ minYards, points: raw[k] }));
  }
  const miss: [string, number][] = [
    ['fgmiss_0_19', 0],
    ['fgmiss_20_29', 20],
    ['fgmiss_30_39', 30],
    ['fgmiss_40_49', 40],
    ['fgmiss_50p', 50],
  ];
  miss.forEach(([k]) => handled.add(k));
  rules.fieldGoalMissTiers = miss.filter(([k]) => raw[k]).map(([k, minYards]) => ({ minYards, points: raw[k] }));
  // Points and yards allowed tiers
  const pa: [string, number][] = [
    ['pts_allow_0', 0],
    ['pts_allow_1_6', 6],
    ['pts_allow_7_13', 13],
    ['pts_allow_14_20', 20],
    ['pts_allow_21_27', 27],
    ['pts_allow_28_34', 34],
    ['pts_allow_35p', Number.MAX_SAFE_INTEGER],
  ];
  pa.forEach(([k]) => handled.add(k));
  if (pa.some(([k]) => raw[k] !== undefined)) {
    rules.pointsAllowedTiers = pa.filter(([k]) => raw[k] !== undefined).map(([k, max]) => ({ max, points: raw[k] }));
  }
  const ya: [string, number][] = [
    ['yds_allow_0_100', 99],
    ['yds_allow_100_199', 199],
    ['yds_allow_200_299', 299],
    ['yds_allow_300_349', 349],
    ['yds_allow_350_399', 399],
    ['yds_allow_400_449', 449],
    ['yds_allow_450_499', 499],
    ['yds_allow_500_549', 549],
    ['yds_allow_550p', Number.MAX_SAFE_INTEGER],
  ];
  ya.forEach(([k]) => handled.add(k));
  if (ya.some(([k]) => raw[k])) {
    rules.yardsAllowedTiers = ya.map(([k, max]) => ({ max, points: raw[k] ?? 0 }));
  }
  const unknown = Object.keys(raw).filter((k) => raw[k] && !SCORING_MAP[k] && !handled.has(k) && !/^bonus_rec_(te|rb|wr)$/.test(k));
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

export type SleeperLeagueSummary = { leagueId: string; name: string; season: string; teams: number; format: string; avatar: string | null };

/**
 * Find a manager's leagues from their Sleeper username, so nobody has to dig
 * up a league link. Uses Sleeper's public read-only API (no sign-in needed).
 */
export async function findSleeperLeagues(username: string, season: number, opts: { fetch?: Fetch } = {}): Promise<{ displayName: string; leagues: SleeperLeagueSummary[] }> {
  const fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as Fetch);
  const name = username.trim().replace(/^@/, '');
  if (!name) throw new Error('Type your Sleeper username.');
  const userRes = await fetchImpl(`${API}/user/${encodeURIComponent(name)}`);
  const user = userRes.ok ? await userRes.json() : null;
  if (!user?.user_id) throw new Error(`We couldn't find a Sleeper user called ${name}. Check the spelling.`);
  const leagues: SleeperLeagueSummary[] = [];
  for (const yr of [season, season - 1]) {
    const res = await fetchImpl(`${API}/user/${user.user_id}/leagues/nfl/${yr}`);
    const list = res.ok ? ((await res.json()) as any[]) ?? [] : [];
    for (const l of list) {
      if (leagues.some((x) => x.name === l.name)) continue;
      const type = l.settings?.type;
      leagues.push({ leagueId: String(l.league_id), name: l.name, season: String(l.season ?? yr), teams: l.total_rosters ?? 0, format: type === 2 ? 'Dynasty' : type === 1 ? 'Keeper' : l.settings?.best_ball ? 'Best ball' : 'Redraft', avatar: l.avatar ?? null });
    }
    if (leagues.length) break;
  }
  return { displayName: user.display_name ?? name, leagues };
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
