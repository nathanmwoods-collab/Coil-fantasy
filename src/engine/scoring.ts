import type { Position, StatKey, StatLine } from './types';

/** A bonus paid once a stat reaches a threshold (e.g. +3 at 100 rushing yards). Tiers stack. */
export type ThresholdBonus = {
  stat: StatKey;
  threshold: number;
  points: number;
  /** Limit the bonus to some positions; empty or missing = everyone. */
  positions?: Position[];
};

/** A bonus for a long touchdown (e.g. +2 for a 40+ yard TD). Tiers stack. */
export type BigPlayBonus = { kind: 'pass' | 'rush' | 'rec'; minYards: number; points: number };

/** Points per catch by length of the catch (tiered PPR). Highest matching tier wins. */
export type ReceptionTier = { minYards: number; points: number };

/** Points per made field goal by distance. Highest matching tier wins. */
export type FieldGoalTier = { minYards: number; points: number };

/** D/ST points by points or yards allowed. First tier whose `max` covers the value wins. */
export type AllowedTier = { max: number; points: number };

export type ScoringRules = {
  /** Points per unit of each stat. Yardage stats are per yard (0.04 = 1 per 25). */
  points: Partial<Record<StatKey, number>>;
  /** Overrides for one position, e.g. TE premium: { TE: { rec: 1.5 } }. */
  positionOverrides: Partial<Record<Position, Partial<Record<StatKey, number>>>>;
  bonuses: ThresholdBonus[];
  bigPlays: BigPlayBonus[];
  /** When set, replaces the flat `rec` value with per-catch tiers. */
  receptionTiers?: ReceptionTier[];
  fieldGoalTiers: FieldGoalTier[];
  pointsAllowedTiers: AllowedTier[];
  yardsAllowedTiers: AllowedTier[];
  /** Decimal places kept on each player's score. */
  decimals: 0 | 1 | 2;
};

export type ScoreLine = { label: string; points: number };
export type ScoreResult = { total: number; lines: ScoreLine[] };

const STAT_LABELS: Record<StatKey, string> = {
  passYds: 'Passing yards',
  passTd: 'Passing TDs',
  passInt: 'Interceptions thrown',
  passCmp: 'Completions',
  passInc: 'Incompletions',
  passAtt: 'Pass attempts',
  pass2pt: 'Passing 2-pt',
  pass1stDown: 'Passing first downs',
  sacked: 'Times sacked',
  rushYds: 'Rushing yards',
  rushTd: 'Rushing TDs',
  rushAtt: 'Carries',
  rush2pt: 'Rushing 2-pt',
  rush1stDown: 'Rushing first downs',
  rec: 'Catches',
  recYds: 'Receiving yards',
  recTd: 'Receiving TDs',
  recTgt: 'Targets',
  rec2pt: 'Receiving 2-pt',
  rec1stDown: 'Receiving first downs',
  fumLost: 'Fumbles lost',
  fum: 'Fumbles',
  krTd: 'Kick return TDs',
  prTd: 'Punt return TDs',
  krYds: 'Kick return yards',
  prYds: 'Punt return yards',
  fgMiss: 'Missed field goals',
  xpMade: 'Extra points',
  xpMiss: 'Missed extra points',
  defSack: 'Sacks',
  defInt: 'Interceptions',
  defFumRec: 'Fumble recoveries',
  defTd: 'Defensive TDs',
  defSafety: 'Safeties',
  defBlkKick: 'Blocked kicks',
  stTd: 'Special teams TDs',
  pointsAllowed: 'Points allowed',
  yardsAllowed: 'Yards allowed',
  idpSoloTkl: 'Solo tackles',
  idpAstTkl: 'Assisted tackles',
  idpSack: 'Sacks',
  idpTfl: 'Tackles for loss',
  idpQbHit: 'QB hits',
  idpInt: 'Interceptions',
  idpPassDef: 'Passes defended',
  idpFf: 'Forced fumbles',
  idpFumRec: 'Fumble recoveries',
  idpTd: 'Defensive TDs',
  idpSafety: 'Safeties',
};

export function statLabel(stat: StatKey): string {
  return STAT_LABELS[stat];
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Value of one unit of a stat for a position, after position overrides. */
export function pointsFor(rules: ScoringRules, stat: StatKey, position: Position): number {
  const override = rules.positionOverrides[position]?.[stat];
  return override ?? rules.points[stat] ?? 0;
}

/**
 * Score one player's stat line. Returns the total and a line-by-line breakdown,
 * so the app can always show managers exactly where every point came from.
 */
export function scoreStatLine(rules: ScoringRules, position: Position, stats: StatLine): ScoreResult {
  const lines: ScoreLine[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) lines.push({ label, points: round(points, 4) });
  };

  for (const key of Object.keys(STAT_LABELS) as StatKey[]) {
    const value = stats[key];
    if (!value) continue;
    // D/ST allowed stats are scored by tiers below, not per unit.
    if (key === 'pointsAllowed' || key === 'yardsAllowed') continue;
    // Tiered PPR replaces the flat per-catch value.
    if (key === 'rec' && rules.receptionTiers?.length && stats.recYardsEach) continue;
    add(STAT_LABELS[key], value * pointsFor(rules, key, position));
  }

  if (rules.receptionTiers?.length && stats.recYardsEach) {
    const tiers = [...rules.receptionTiers].sort((a, b) => b.minYards - a.minYards);
    let tiered = 0;
    for (const yds of stats.recYardsEach) {
      tiered += tiers.find((t) => yds >= t.minYards)?.points ?? 0;
    }
    add('Catches (tiered)', tiered);
  }

  if (stats.fgMadeYards?.length) {
    const tiers = [...rules.fieldGoalTiers].sort((a, b) => b.minYards - a.minYards);
    let fg = 0;
    for (const yds of stats.fgMadeYards) fg += tiers.find((t) => yds >= t.minYards)?.points ?? 0;
    add('Field goals', fg);
  }

  if (position === 'DST') {
    if (stats.pointsAllowed !== undefined) {
      add('Points allowed', tierValue(rules.pointsAllowedTiers, stats.pointsAllowed));
    }
    if (stats.yardsAllowed !== undefined) {
      add('Yards allowed', tierValue(rules.yardsAllowedTiers, stats.yardsAllowed));
    }
  }

  for (const b of rules.bonuses) {
    if (b.positions?.length && !b.positions.includes(position)) continue;
    const value = stats[b.stat] ?? 0;
    if (value >= b.threshold) add(`Bonus: ${b.threshold}+ ${STAT_LABELS[b.stat].toLowerCase()}`, b.points);
  }

  for (const b of rules.bigPlays) {
    const lengths =
      b.kind === 'pass' ? stats.passTdYards : b.kind === 'rush' ? stats.rushTdYards : stats.recTdYards;
    const count = (lengths ?? []).filter((y) => y >= b.minYards).length;
    if (count) add(`Bonus: ${b.minYards}+ yd ${b.kind === 'rec' ? 'receiving' : b.kind === 'rush' ? 'rushing' : 'passing'} TD`, count * b.points);
  }

  const total = round(
    lines.reduce((s, l) => s + l.points, 0),
    rules.decimals,
  );
  return { total, lines };
}

function tierValue(tiers: AllowedTier[], value: number): number {
  const sorted = [...tiers].sort((a, b) => a.max - b.max);
  return sorted.find((t) => value <= t.max)?.points ?? sorted[sorted.length - 1]?.points ?? 0;
}

// ---------------------------------------------------------------------------
// Presets. Every preset is a starting point; commissioners can edit any value.
// ---------------------------------------------------------------------------

export type ScoringPresetKey = 'standard' | 'half_ppr' | 'ppr' | 'superflex_ppr' | 'te_premium' | 'six_pt_pass_td' | 'idp';

const BASE_POINTS: Partial<Record<StatKey, number>> = {
  passYds: 0.04,
  passTd: 4,
  passInt: -2,
  pass2pt: 2,
  rushYds: 0.1,
  rushTd: 6,
  rush2pt: 2,
  rec: 0,
  recYds: 0.1,
  recTd: 6,
  rec2pt: 2,
  fumLost: -2,
  krTd: 6,
  prTd: 6,
  fgMiss: -1,
  xpMade: 1,
  xpMiss: -1,
  defSack: 1,
  defInt: 2,
  defFumRec: 2,
  defTd: 6,
  defSafety: 2,
  defBlkKick: 2,
  stTd: 6,
};

const IDP_POINTS: Partial<Record<StatKey, number>> = {
  idpSoloTkl: 1,
  idpAstTkl: 0.5,
  idpSack: 4,
  idpTfl: 1,
  idpQbHit: 0.5,
  idpInt: 4,
  idpPassDef: 1,
  idpFf: 3,
  idpFumRec: 3,
  idpTd: 6,
  idpSafety: 2,
};

const BASE_RULES: Omit<ScoringRules, 'points'> = {
  positionOverrides: {},
  bonuses: [],
  bigPlays: [],
  fieldGoalTiers: [
    { minYards: 0, points: 3 },
    { minYards: 40, points: 4 },
    { minYards: 50, points: 5 },
    { minYards: 60, points: 6 },
  ],
  pointsAllowedTiers: [
    { max: 0, points: 10 },
    { max: 6, points: 7 },
    { max: 13, points: 4 },
    { max: 20, points: 1 },
    { max: 27, points: 0 },
    { max: 34, points: -1 },
    { max: Number.MAX_SAFE_INTEGER, points: -4 },
  ],
  yardsAllowedTiers: [],
  decimals: 2,
};

export const SCORING_PRESETS: Record<ScoringPresetKey, { label: string; blurb: string; rules: ScoringRules }> = {
  standard: {
    label: 'Standard',
    blurb: 'No points for catches. Old school, touchdown heavy.',
    rules: { ...BASE_RULES, points: { ...BASE_POINTS } },
  },
  half_ppr: {
    label: 'Half PPR',
    blurb: 'Half a point per catch. The most common middle ground.',
    rules: { ...BASE_RULES, points: { ...BASE_POINTS, rec: 0.5 } },
  },
  ppr: {
    label: 'PPR',
    blurb: 'A full point per catch. Receivers matter a lot.',
    rules: { ...BASE_RULES, points: { ...BASE_POINTS, rec: 1 } },
  },
  superflex_ppr: {
    label: 'Superflex PPR',
    blurb: 'PPR scoring; pair it with a Superflex slot so a second QB can start.',
    rules: { ...BASE_RULES, points: { ...BASE_POINTS, rec: 1 } },
  },
  te_premium: {
    label: 'TE Premium',
    blurb: 'PPR, and tight ends get 1.5 per catch, so the position is worth drafting.',
    rules: { ...BASE_RULES, points: { ...BASE_POINTS, rec: 1 }, positionOverrides: { TE: { rec: 1.5 } } },
  },
  six_pt_pass_td: {
    label: '6-pt passing TDs',
    blurb: 'PPR, and quarterbacks get 6 per touchdown pass like everyone else.',
    rules: { ...BASE_RULES, points: { ...BASE_POINTS, rec: 1, passTd: 6 } },
  },
  idp: {
    label: 'IDP',
    blurb: 'PPR plus individual defensive players: tackles, sacks and picks.',
    rules: { ...BASE_RULES, points: { ...BASE_POINTS, rec: 1, ...IDP_POINTS } },
  },
};

/** A deep copy of a preset's rules, safe to edit. */
export function scoringFromPreset(key: ScoringPresetKey): ScoringRules {
  return structuredClone(SCORING_PRESETS[key].rules);
}
