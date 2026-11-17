import type { Position, StatKey, StatLine } from './types';


/** A bonus paid once a stat reaches a threshold (e.g. +3 at 100 rushing yards). Tiers stack. */
export type ThresholdBonus = {
  stat: MilestoneStat;
  threshold: number;
  points: number;
  /** Limit the bonus to some positions; empty or missing = everyone. */
  positions?: Position[];
};

/**
 * A bonus for a long play. With `on: 'td'` (the default) only touchdowns count,
 * e.g. +2 for a 40+ yard TD run; with `on: 'any'` every play that long counts.
 * Tiers stack, so a 55-yard TD can earn both the 40+ and 50+ bonus.
 */
export type BigPlayBonus = {
  kind: 'pass' | 'rush' | 'rec' | 'intRet' | 'fumRet';
  minYards: number;
  points: number;
  on?: 'td' | 'any';
  positions?: Position[];
};

/** Points per catch by length of the catch (tiered PPR). Highest matching tier wins. */
export type ReceptionTier = { minYards: number; points: number };

/** Points per made (or missed) field goal by distance. Highest matching tier wins. */
export type FieldGoalTier = { minYards: number; points: number };

/** D/ST points by points or yards allowed. First tier whose `max` covers the value wins. */
export type AllowedTier = { max: number; points: number };

/** Stats a milestone can watch: any stat, or a combined total. */
export type MilestoneStat = StatKey | 'rushRecYds' | 'passRushYds' | 'scrimmageTd';

/**
 * A one-time bonus for landing in a range, e.g. +3 for 100–199 rushing yards
 * and +6 for 200+. Unlike `bonuses`, ranges don't stack: only the matching range pays.
 */
export type RangeBonus = {
  stat: MilestoneStat;
  min: number;
  /** Inclusive top of the range; missing = no ceiling. */
  max?: number;
  points: number;
  positions?: Position[];
};

export type ScoringRules = {
  /** Points per unit of each stat. Yardage stats are per yard (0.04 = 1 per 25). */
  points: Partial<Record<StatKey, number>>;
  /** Overrides for one position, e.g. TE premium: { TE: { rec: 1.5 } }. */
  positionOverrides: Partial<Record<Position, Partial<Record<StatKey, number>>>>;
  /** Stacking threshold bonuses (every threshold reached pays). */
  bonuses: ThresholdBonus[];
  /** Non-stacking range bonuses (only the matching range pays). */
  milestones: RangeBonus[];
  bigPlays: BigPlayBonus[];
  /** When set, replaces the flat `rec` value with per-catch tiers. */
  receptionTiers?: ReceptionTier[];
  /** Extra points on top of the per-catch value by catch length (0-4, 5-9, 10-19…). */
  catchLengthBonuses: ReceptionTier[];
  fieldGoalTiers: FieldGoalTier[];
  /** Points per missed field goal by distance; overrides the flat `fgMiss` when set. */
  fieldGoalMissTiers: FieldGoalTier[];
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
  passIntTd: 'Pick-sixes thrown',
  passCmp: 'Completions',
  passInc: 'Incompletions',
  passAtt: 'Pass attempts',
  pass2pt: 'Passing 2-pt',
  pass1stDown: 'Passing first downs',
  pass40: '40+ yard completions',
  sacked: 'Times sacked',
  sackedYds: 'Yards lost to sacks',
  rushYds: 'Rushing yards',
  rushTd: 'Rushing TDs',
  rushAtt: 'Carries',
  rush2pt: 'Rushing 2-pt',
  rush1stDown: 'Rushing first downs',
  rush40: '40+ yard runs',
  rec: 'Catches',
  recYds: 'Receiving yards',
  recTd: 'Receiving TDs',
  recTgt: 'Targets',
  rec2pt: 'Receiving 2-pt',
  rec1stDown: 'Receiving first downs',
  rec40: '40+ yard catches',
  fumLost: 'Fumbles lost',
  fum: 'Fumbles',
  fumRecTd: 'Fumble recovery TDs',
  ownFumRec: 'Own fumble recoveries',
  krTd: 'Kick return TDs',
  prTd: 'Punt return TDs',
  krYds: 'Kick return yards',
  prYds: 'Punt return yards',
  fgMade: 'Field goals made',
  fgYds: 'Field goal yards',
  fgYdsOver30: 'Field goal yards past 30',
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
  defIntYds: 'Interception return yards',
  defFumRetYds: 'Fumble return yards',
  defBlkKickYds: 'Blocked kick return yards',
  def2ptRet: '2-pt returns',
  defTkl: 'Tackles',
  defTfl: 'Tackles for loss',
  defSackYds: 'Sack yards',
  defQbHit: 'QB hits',
  defPassDef: 'Passes defended',
  defFf: 'Forced fumbles',
  def3AndOut: 'Three-and-outs',
  def4thStop: 'Fourth-down stops',
  defForcedPunt: 'Forced punts',
  defMissedFgRetYds: 'Missed FG return yards',
  defKrYds: 'Kick return yards',
  defPrYds: 'Punt return yards',
  stFf: 'Special teams forced fumbles',
  stFumRec: 'Special teams fumble recoveries',
  stSoloTkl: 'Special teams solo tackles',
  stTkl: 'Special teams tackles',
  idpSoloTkl: 'Solo tackles',
  idpAstTkl: 'Assisted tackles',
  idpTkl: 'Tackles',
  idpSack: 'Sacks',
  idpSackYds: 'Sack yards',
  idpTfl: 'Tackles for loss',
  idpQbHit: 'QB hits',
  idpInt: 'Interceptions',
  idpIntYds: 'Interception return yards',
  idpPassDef: 'Passes defended',
  idpFf: 'Forced fumbles',
  idpFumRec: 'Fumble recoveries',
  idpFumRetYds: 'Fumble return yards',
  idpBlkKick: 'Blocked kicks',
  idpTd: 'Defensive TDs',
  idpSafety: 'Safeties',
};

const MILESTONE_LABELS: Record<Exclude<MilestoneStat, StatKey>, string> = {
  rushRecYds: 'Rushing + receiving yards',
  passRushYds: 'Passing + rushing yards',
  scrimmageTd: 'Total TDs',
};

export function statLabel(stat: MilestoneStat): string {
  return (STAT_LABELS as Record<string, string>)[stat] ?? MILESTONE_LABELS[stat as keyof typeof MILESTONE_LABELS];
}

export const ALL_STATS = Object.keys(STAT_LABELS) as StatKey[];

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Value of one unit of a stat for a position, after position overrides. */
export function pointsFor(rules: ScoringRules, stat: StatKey, position: Position): number {
  const override = rules.positionOverrides[position]?.[stat];
  return override ?? rules.points[stat] ?? 0;
}

/** Fill in stats the feed may leave out but that we can work out. */
function withDerived(stats: StatLine): StatLine & Record<string, number | number[] | undefined> {
  const s: StatLine & Record<string, number | number[] | undefined> = { ...stats };
  if (s.idpTkl === undefined && (s.idpSoloTkl || s.idpAstTkl)) s.idpTkl = (s.idpSoloTkl ?? 0) + (s.idpAstTkl ?? 0);
  if (s.fgMade === undefined && s.fgMadeYards) s.fgMade = s.fgMadeYards.length;
  if (s.fgYds === undefined && s.fgMadeYards) s.fgYds = s.fgMadeYards.reduce((a, b) => a + b, 0);
  if (s.fgYdsOver30 === undefined && s.fgMadeYards) s.fgYdsOver30 = s.fgMadeYards.reduce((a, b) => a + Math.max(0, b - 30), 0);
  if (s.fgMiss === undefined && s.fgMissYards) s.fgMiss = s.fgMissYards.length;
  if (s.rush40 === undefined && s.rushYardsEach) s.rush40 = s.rushYardsEach.filter((y) => y >= 40).length;
  if (s.rec40 === undefined && s.recYardsEach) s.rec40 = s.recYardsEach.filter((y) => y >= 40).length;
  if (s.pass40 === undefined && s.passCmpYardsEach) s.pass40 = s.passCmpYardsEach.filter((y) => y >= 40).length;
  s.rushRecYds = (s.rushYds ?? 0) + (s.recYds ?? 0);
  s.passRushYds = (s.passYds ?? 0) + (s.rushYds ?? 0);
  s.scrimmageTd = (s.passTd ?? 0) + (s.rushTd ?? 0) + (s.recTd ?? 0);
  return s;
}

const applies = (positions: Position[] | undefined, position: Position) => !positions?.length || positions.includes(position);

/**
 * Score one player's stat line. Returns the total and a line-by-line breakdown,
 * so the app can always show managers exactly where every point came from.
 */
export function scoreStatLine(rules: ScoringRules, position: Position, raw: StatLine): ScoreResult {
  const stats = withDerived(raw);
  const lines: ScoreLine[] = [];
  const add = (label: string, points: number) => {
    if (points !== 0) lines.push({ label, points: round(points, 4) });
  };

  for (const key of ALL_STATS) {
    const value = stats[key];
    if (!value) continue;
    // Tiered PPR replaces the flat per-catch value.
    if (key === 'rec' && rules.receptionTiers?.length && stats.recYardsEach) continue;
    // Distance tiers for misses replace the flat miss value.
    if (key === 'fgMiss' && rules.fieldGoalMissTiers?.length && stats.fgMissYards) continue;
    // Points/yards allowed are per unit here (rarely used); tiers are added below.
    if ((key === 'pointsAllowed' || key === 'yardsAllowed') && position !== 'DST') continue;
    add(STAT_LABELS[key], value * pointsFor(rules, key, position));
  }

  if (rules.receptionTiers?.length && stats.recYardsEach) {
    const tiers = [...rules.receptionTiers].sort((a, b) => b.minYards - a.minYards);
    let tiered = 0;
    for (const yds of stats.recYardsEach) tiered += tiers.find((t) => yds >= t.minYards)?.points ?? 0;
    add('Catches (tiered)', tiered);
  }

  if (rules.catchLengthBonuses?.length && stats.recYardsEach) {
    const tiers = [...rules.catchLengthBonuses].sort((a, b) => b.minYards - a.minYards);
    let extra = 0;
    for (const yds of stats.recYardsEach) extra += tiers.find((t) => yds >= t.minYards)?.points ?? 0;
    add('Catch length bonus', extra);
  }

  if (stats.fgMadeYards?.length) {
    const tiers = [...rules.fieldGoalTiers].sort((a, b) => b.minYards - a.minYards);
    let fg = 0;
    for (const yds of stats.fgMadeYards) fg += tiers.find((t) => yds >= t.minYards)?.points ?? 0;
    add('Field goals by distance', fg);
  }

  if (rules.fieldGoalMissTiers?.length && stats.fgMissYards?.length) {
    const tiers = [...rules.fieldGoalMissTiers].sort((a, b) => b.minYards - a.minYards);
    let miss = 0;
    for (const yds of stats.fgMissYards) miss += tiers.find((t) => yds >= t.minYards)?.points ?? 0;
    add('Missed field goals by distance', miss);
  }

  if (position === 'DST') {
    if (stats.pointsAllowed !== undefined && rules.pointsAllowedTiers.length) {
      add(`Allowed ${stats.pointsAllowed} points`, tierValue(rules.pointsAllowedTiers, stats.pointsAllowed));
    }
    if (stats.yardsAllowed !== undefined && rules.yardsAllowedTiers.length) {
      add(`Allowed ${stats.yardsAllowed} yards`, tierValue(rules.yardsAllowedTiers, stats.yardsAllowed));
    }
  }

  for (const b of rules.bonuses) {
    if (!applies(b.positions, position)) continue;
    const value = (stats[b.stat] as number | undefined) ?? 0;
    if (value >= b.threshold) add(`Bonus: ${b.threshold}+ ${statLabel(b.stat).toLowerCase()}`, b.points);
  }

  for (const m of rules.milestones ?? []) {
    if (!applies(m.positions, position)) continue;
    const value = (stats[m.stat] as number | undefined) ?? 0;
    if (value >= m.min && (m.max === undefined || value <= m.max)) {
      add(`Bonus: ${m.min}${m.max === undefined ? '+' : `–${m.max}`} ${statLabel(m.stat).toLowerCase()}`, m.points);
    }
  }

  for (const b of rules.bigPlays) {
    if (!applies(b.positions, position)) continue;
    const lengths = bigPlayLengths(stats, b);
    const count = lengths.filter((y) => y >= b.minYards).length;
    if (count) add(`Bonus: ${b.minYards}+ yd ${BIG_PLAY_NOUN[b.kind]}${b.on === 'any' ? '' : ' TD'}`, count * b.points);
  }

  const total = round(
    lines.reduce((s, l) => s + l.points, 0),
    rules.decimals,
  );
  return { total, lines };
}

const BIG_PLAY_NOUN: Record<BigPlayBonus['kind'], string> = {
  pass: 'passing',
  rush: 'rushing',
  rec: 'receiving',
  intRet: 'interception return',
  fumRet: 'fumble return',
};

function bigPlayLengths(stats: StatLine, b: BigPlayBonus): number[] {
  if (b.on === 'any') {
    if (b.kind === 'rush') return stats.rushYardsEach ?? [];
    if (b.kind === 'rec') return stats.recYardsEach ?? [];
    if (b.kind === 'pass') return stats.passCmpYardsEach ?? [];
  }
  switch (b.kind) {
    case 'pass':
      return stats.passTdYards ?? [];
    case 'rush':
      return stats.rushTdYards ?? [];
    case 'rec':
      return stats.recTdYards ?? [];
    case 'intRet':
      return stats.intRetTdYards ?? [];
    case 'fumRet':
      return stats.fumRetTdYards ?? [];
  }
}

/** Every rule that differs between two rule sets, in plain words. Used for league notices. */
export function describeScoringChanges(before: ScoringRules, after: ScoringRules): string[] {
  const out: string[] = [];
  const fmt = (n: number | undefined) => (n === undefined ? '0' : `${n > 0 ? '+' : ''}${Math.round(n * 10000) / 10000}`);
  for (const k of ALL_STATS) {
    if ((before.points[k] ?? 0) !== (after.points[k] ?? 0)) out.push(`${STAT_LABELS[k]}: ${fmt(before.points[k])} → ${fmt(after.points[k])}`);
  }
  const positions = new Set([...Object.keys(before.positionOverrides), ...Object.keys(after.positionOverrides)]) as Set<Position>;
  for (const pos of positions) {
    for (const k of ALL_STATS) {
      const a = before.positionOverrides[pos]?.[k];
      const b = after.positionOverrides[pos]?.[k];
      if (a !== b) out.push(`${pos} ${STAT_LABELS[k].toLowerCase()}: ${a === undefined ? 'league default' : fmt(a)} → ${b === undefined ? 'league default' : fmt(b)}`);
    }
  }
  const same = (x: unknown, y: unknown) => JSON.stringify(x ?? []) === JSON.stringify(y ?? []);
  if (!same(before.bonuses, after.bonuses)) out.push('Yardage and volume bonuses changed');
  if (!same(before.milestones, after.milestones)) out.push('Milestone bonuses changed');
  if (!same(before.bigPlays, after.bigPlays)) out.push('Big-play bonuses changed');
  if (!same(before.receptionTiers, after.receptionTiers) || !same(before.catchLengthBonuses, after.catchLengthBonuses)) out.push('Catch scoring by length changed');
  if (!same(before.fieldGoalTiers, after.fieldGoalTiers) || !same(before.fieldGoalMissTiers, after.fieldGoalMissTiers)) out.push('Field goal distances changed');
  if (!same(before.pointsAllowedTiers, after.pointsAllowedTiers) || !same(before.yardsAllowedTiers, after.yardsAllowedTiers)) out.push('Defense points/yards allowed tiers changed');
  if (before.decimals !== after.decimals) out.push(`Decimal places: ${before.decimals} → ${after.decimals}`);
  return out;
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
  milestones: [],
  bigPlays: [],
  catchLengthBonuses: [],
  fieldGoalMissTiers: [],
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
