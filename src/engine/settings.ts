import { scoringFromPreset, type ScoringPresetKey, type ScoringRules } from './scoring';
import type { InjuryStatus, Position, SlotType } from './types';

export type LeagueFormat = 'redraft' | 'keeper' | 'dynasty' | 'bestball';
export type DraftType = 'snake' | 'linear' | 'third_round_reversal' | 'auction';
export type DraftOrderMethod = 'random' | 'manual' | 'reverse_standings' | 'lottery';
export type WaiverType = 'faab' | 'rolling' | 'reverse_standings';
export type TradeReview = 'none' | 'commissioner' | 'league_vote';
export type Tiebreaker = 'points_for' | 'head_to_head' | 'all_play' | 'points_against' | 'division_record';
export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export type LeagueSettings = {
  name: string;
  format: LeagueFormat;
  /** 2 to 32 teams. Odd counts get a bye each week (or play the median only). */
  teams: number;
  /** 0 = no divisions, else 2 to 4. */
  divisions: number;
  /** How many of each slot every team has. */
  roster: Partial<Record<SlotType, number>>;
  /** Max players of a position on one roster, e.g. { QB: 4 }. */
  positionLimits: Partial<Record<Position, number>>;
  scoringPreset: ScoringPresetKey;
  scoring: ScoringRules;
  matchups: {
    type: 'head_to_head' | 'total_points';
    /** Every team also plays the league median each week (a second W or L). */
    medianGame: boolean;
  };
  tiebreakers: Tiebreaker[];
  regularSeasonWeeks: number;
  lineupLock: 'game_start' | 'week_start';
  /** Swap an inactive or bye-week starter for the best eligible bench player. */
  autoSubInactive: boolean;
  /** Which designations let a player sit in an IR slot. Slot count lives in roster.IR. */
  irEligible: InjuryStatus[];
  /** Let healthy players stay in IR after returning (otherwise the team is locked until fixed). */
  irAllowHealthy: boolean;
  draft: {
    type: DraftType;
    rounds: number;
    /** Seconds per pick; null = no timer. */
    pickTimerSec: number | null;
    orderMethod: DraftOrderMethod;
    /** Slow drafts: pause the clock overnight in the commissioner's time zone. */
    overnightPause: { enabled: boolean; startHour: number; endHour: number };
    auction: { budget: number; minBid: number; nominationTimerSec: number };
    /** Commissioner types picks in from an in-person draft. */
    offline: boolean;
  };
  waivers: {
    type: WaiverType;
    faabBudget: number;
    allowZeroBids: boolean;
    /** FAAB tie: higher waiver priority wins, or worse record wins. */
    faabTiebreak: 'waiver_priority' | 'reverse_standings';
    /** Days a dropped player sits on waivers. */
    holdDays: number;
    runDay: Weekday;
    runHour: number;
    /** Players lock once their game starts until the next waiver run. */
    lockAfterGameStart: boolean;
    maxAddsPerWeek: number | null;
    maxAddsPerSeason: number | null;
  };
  trades: {
    review: TradeReview;
    reviewHours: number;
    /** Share of the league needed to veto when review = league_vote. */
    vetoShare: number;
    /** Last week trades are allowed; null = no deadline. */
    deadlineWeek: number | null;
    /** How many seasons ahead draft picks can be traded. */
    futurePickSeasons: number;
    maxTeamsPerTrade: number;
  };
  playoffs: {
    teams: number;
    startWeek: number;
    /** Weeks each round lasts; 2 = two-week matchups. */
    weeksPerRound: 1 | 2;
    reseed: boolean;
    /** Division winners take the top seeds. */
    divisionWinnersFirst: boolean;
    consolation: boolean;
    /** Losers' bracket where the "winner" earns the league's punishment. */
    toiletBowl: boolean;
  };
  keepers: {
    maxPerTeam: number;
    /** Keeper costs the round he was drafted in, minus this many each year kept. */
    roundEscalation: number;
    /** Undrafted players cost this round. */
    undraftedRound: number;
  };
  dynasty: {
    taxiSlots: number;
    /** Players with yearsPro at or below this can sit on the taxi squad. */
    taxiMaxYearsPro: number;
    rookieDraftRounds: number;
    rookieDraftType: Extract<DraftType, 'linear' | 'snake'>;
    rookieDraftOrder: 'reverse_standings' | 'reverse_max_points' | 'lottery';
  };
};

export type SettingsIssue = { field: string; message: string; severity: 'error' | 'warning' };

export const STARTER_SLOTS: SlotType[] = [
  'QB',
  'RB',
  'WR',
  'TE',
  'FLEX',
  'WR_RB',
  'WR_TE',
  'SUPERFLEX',
  'K',
  'DST',
  'DL',
  'LB',
  'DB',
  'IDP_FLEX',
];

const DEFAULT_ROSTER: Partial<Record<SlotType, number>> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DST: 1,
  BN: 6,
  IR: 1,
};

/** Sensible defaults. A casual league can accept these and be done. */
export function defaultSettings(overrides: Partial<LeagueSettings> = {}): LeagueSettings {
  const base: LeagueSettings = {
    name: 'My League',
    format: 'redraft',
    teams: 12,
    divisions: 0,
    roster: { ...DEFAULT_ROSTER },
    positionLimits: {},
    scoringPreset: 'half_ppr',
    scoring: scoringFromPreset('half_ppr'),
    matchups: { type: 'head_to_head', medianGame: false },
    tiebreakers: ['points_for', 'head_to_head', 'all_play'],
    regularSeasonWeeks: 14,
    lineupLock: 'game_start',
    autoSubInactive: false,
    irEligible: ['ir', 'out', 'pup', 'nfi', 'covid'],
    irAllowHealthy: false,
    draft: {
      type: 'snake',
      rounds: 15,
      pickTimerSec: 90,
      orderMethod: 'random',
      overnightPause: { enabled: false, startHour: 23, endHour: 8 },
      auction: { budget: 200, minBid: 1, nominationTimerSec: 30 },
      offline: false,
    },
    waivers: {
      type: 'faab',
      faabBudget: 100,
      allowZeroBids: true,
      faabTiebreak: 'waiver_priority',
      holdDays: 1,
      runDay: 'wed',
      runHour: 3,
      lockAfterGameStart: true,
      maxAddsPerWeek: null,
      maxAddsPerSeason: null,
    },
    trades: {
      review: 'commissioner',
      reviewHours: 24,
      vetoShare: 0.5,
      deadlineWeek: 11,
      futurePickSeasons: 0,
      maxTeamsPerTrade: 3,
    },
    playoffs: {
      teams: 6,
      startWeek: 15,
      weeksPerRound: 1,
      reseed: false,
      divisionWinnersFirst: false,
      consolation: true,
      toiletBowl: false,
    },
    keepers: { maxPerTeam: 0, roundEscalation: 1, undraftedRound: 10 },
    dynasty: {
      taxiSlots: 0,
      taxiMaxYearsPro: 1,
      rookieDraftRounds: 4,
      rookieDraftType: 'linear',
      rookieDraftOrder: 'reverse_max_points',
    },
  };
  return { ...base, ...overrides };
}

/**
 * Starting settings for each format, so commissioners pick a format and get
 * rules that already make sense for it.
 */
export function settingsForFormat(format: LeagueFormat, teams = 12): LeagueSettings {
  const s = defaultSettings({ format, teams });
  switch (format) {
    case 'keeper':
      s.keepers = { maxPerTeam: 2, roundEscalation: 1, undraftedRound: 10 };
      break;
    case 'dynasty':
      s.scoringPreset = 'superflex_ppr';
      s.scoring = scoringFromPreset('superflex_ppr');
      s.roster = { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 2, SUPERFLEX: 1, BN: 15, IR: 3, TAXI: 4 };
      s.draft.rounds = 26;
      s.trades.futurePickSeasons = 3;
      s.trades.review = 'none';
      s.trades.deadlineWeek = 12;
      s.dynasty.taxiSlots = 4;
      break;
    case 'bestball':
      s.scoringPreset = 'half_ppr';
      s.roster = { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, BN: 10 };
      s.draft.rounds = 18;
      // Best ball has no waivers or trades in its classic form.
      s.waivers.maxAddsPerSeason = 0;
      s.trades.deadlineWeek = 0;
      s.autoSubInactive = false;
      break;
    case 'redraft':
      break;
  }
  s.draft.rounds = Math.max(s.draft.rounds, rosterSize(s.roster) - (s.roster.IR ?? 0) - (s.roster.TAXI ?? 0));
  return s;
}

/** Total roster spots excluding IR and taxi. */
export function rosterSize(roster: Partial<Record<SlotType, number>>): number {
  return Object.entries(roster)
    .filter(([slot]) => slot !== 'IR' && slot !== 'TAXI')
    .reduce((sum, [, n]) => sum + (n ?? 0), 0);
}

export function starterCount(roster: Partial<Record<SlotType, number>>): number {
  return STARTER_SLOTS.reduce((sum, slot) => sum + (roster[slot] ?? 0), 0);
}

/** Playoff rounds needed for a bracket of n teams. */
export function playoffRounds(teams: number): number {
  return teams <= 1 ? 0 : Math.ceil(Math.log2(teams));
}

/** The last week the playoffs use. */
export function playoffEndWeek(s: LeagueSettings): number {
  return s.playoffs.startWeek + playoffRounds(s.playoffs.teams) * s.playoffs.weeksPerRound - 1;
}

/** NFL regular season has 18 weeks; fantasy seasons should end by then. */
export const LAST_NFL_WEEK = 18;

/**
 * Check settings and explain problems in plain language. Errors block saving;
 * warnings are shown but allowed (commissioners know their league).
 */
export function validateSettings(s: LeagueSettings): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  const err = (field: string, message: string) => issues.push({ field, message, severity: 'error' });
  const warn = (field: string, message: string) => issues.push({ field, message, severity: 'warning' });

  if (s.teams < 2 || s.teams > 32) err('teams', 'Leagues can have 2 to 32 teams.');
  if (s.divisions !== 0 && (s.divisions < 2 || s.divisions > 4))
    err('divisions', 'Use 2, 3 or 4 divisions, or none.');
  if (s.divisions && s.teams % s.divisions !== 0)
    warn('divisions', `${s.teams} teams don't split evenly into ${s.divisions} divisions.`);

  if (starterCount(s.roster) === 0) err('roster', 'Teams need at least one starting spot.');
  if (s.dynasty.taxiSlots !== (s.roster.TAXI ?? 0))
    warn('dynasty.taxiSlots', 'Taxi squad size and taxi roster spots don’t match.');
  if ((s.roster.TAXI ?? 0) > 0 && s.format === 'redraft')
    warn('roster.TAXI', 'Taxi squads usually only make sense in keeper or dynasty leagues.');

  if (s.draft.rounds < 1) err('draft.rounds', 'The draft needs at least one round.');
  if (s.draft.rounds > rosterSize(s.roster) + (s.roster.TAXI ?? 0))
    err('draft.rounds', 'There are more draft rounds than roster spots to fill.');
  if (s.draft.pickTimerSec !== null && (s.draft.pickTimerSec < 10 || s.draft.pickTimerSec > 86400))
    err('draft.pickTimerSec', 'Pick timers run from 10 seconds to 24 hours.');
  if (s.draft.type === 'auction') {
    const spots = rosterSize(s.roster);
    if (s.draft.auction.budget < spots * s.draft.auction.minBid)
      err('draft.auction.budget', `A $${s.draft.auction.budget} budget can't fill ${spots} spots at the $${s.draft.auction.minBid} minimum bid.`);
  }

  if (s.regularSeasonWeeks < 1) err('regularSeasonWeeks', 'The regular season needs at least one week.');
  if (s.playoffs.teams > s.teams) err('playoffs.teams', 'More playoff spots than teams.');
  if (s.playoffs.teams > 16) err('playoffs.teams', 'Playoffs can have up to 16 teams.');
  if (s.playoffs.teams > 0 && s.playoffs.startWeek <= s.regularSeasonWeeks)
    err('playoffs.startWeek', `Playoffs start in week ${s.playoffs.startWeek}, but the regular season runs through week ${s.regularSeasonWeeks}.`);
  if (s.playoffs.teams > 0 && playoffEndWeek(s) > LAST_NFL_WEEK)
    err('playoffs.startWeek', `The championship would land in week ${playoffEndWeek(s)}, after the NFL season ends in week ${LAST_NFL_WEEK}.`);
  else if (s.playoffs.teams > 0 && playoffEndWeek(s) === LAST_NFL_WEEK)
    warn('playoffs.startWeek', 'Week 18 championships can be messy: some NFL teams rest starters.');

  if (s.waivers.type === 'faab' && s.waivers.faabBudget < 0) err('waivers.faabBudget', 'FAAB budget can’t be negative.');
  if (s.waivers.holdDays < 0 || s.waivers.holdDays > 7) err('waivers.holdDays', 'Waiver holds run 0 to 7 days.');

  if (s.trades.deadlineWeek !== null && s.trades.deadlineWeek > s.regularSeasonWeeks)
    warn('trades.deadlineWeek', 'The trade deadline is after the regular season ends.');
  if (s.trades.futurePickSeasons < 0 || s.trades.futurePickSeasons > 5)
    err('trades.futurePickSeasons', 'Future picks can be traded up to 5 seasons out.');
  if (s.trades.review === 'league_vote' && (s.trades.vetoShare <= 0 || s.trades.vetoShare > 1))
    err('trades.vetoShare', 'Veto share must be between 0 and 100%.');

  if ((s.roster.IR ?? 0) > 0 && s.irEligible.length === 0)
    err('irEligible', 'Pick at least one designation (like IR or Out) that can use an IR spot.');

  if (s.format === 'keeper' && s.keepers.maxPerTeam < 1)
    warn('keepers.maxPerTeam', 'Keeper league with zero keepers allowed.');

  return issues;
}

const SETTING_LABELS: Record<string, string> = {
  name: 'League name',
  teams: 'Teams',
  divisions: 'Divisions',
  regularSeasonWeeks: 'Regular season weeks',
  lineupLock: 'Lineup lock',
  autoSubInactive: 'Auto-sub inactive starters',
  irEligible: 'Who can go on IR',
  irAllowHealthy: 'Healthy players can stay on IR',
  'matchups.medianGame': 'Median game',
  'matchups.type': 'Matchup type',
  'draft.type': 'Draft type',
  'draft.rounds': 'Draft rounds',
  'draft.pickTimerSec': 'Pick timer (seconds)',
  'draft.orderMethod': 'Draft order',
  'waivers.type': 'Waiver type',
  'waivers.faabBudget': 'FAAB budget',
  'waivers.runDay': 'Waivers run on',
  'waivers.holdDays': 'Days on waivers',
  'trades.review': 'Trade review',
  'trades.deadlineWeek': 'Trade deadline week',
  'trades.futurePickSeasons': 'Seasons of tradable picks',
  'playoffs.teams': 'Playoff teams',
  'playoffs.startWeek': 'Playoffs start week',
  'playoffs.weeksPerRound': 'Weeks per playoff round',
  'playoffs.reseed': 'Reseed each round',
  'playoffs.consolation': 'Consolation bracket',
  'playoffs.toiletBowl': 'Toilet bowl',
  'dynasty.taxiSlots': 'Taxi squad spots',
  'dynasty.rookieDraftRounds': 'Rookie draft rounds',
  'keepers.maxPerTeam': 'Keepers per team',
};

/** Every non-scoring setting that changed, in plain words, for the league notice. */
export function describeSettingsChanges(before: LeagueSettings, after: LeagueSettings): string[] {
  const out: string[] = [];
  const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') || 'none' : v === null ? 'none' : typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v));
  const walk = (a: unknown, b: unknown, path: string) => {
    if (path === 'scoring' || path === 'scoringPreset') return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of keys) walk((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], path ? `${path}.${k}` : k);
      return;
    }
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    const label = SETTING_LABELS[path] ?? (path.startsWith('roster.') ? `${path.slice(7)} spots` : path);
    out.push(`${label}: ${show(a ?? 0)} → ${show(b ?? 0)}`);
  };
  walk(before, after, '');
  return out;
}
