// Every scoring rule the settings screen shows, grouped the way managers think
// about them. Each row knows how to read and write its value on ScoringRules,
// so the screen is just a list and new rules are a one-line addition here.

import { statLabel, type BigPlayBonus, type MilestoneStat, type ScoringRules } from './scoring';
import type { Position, StatKey } from './types';

export type CatalogRow =
  | { kind: 'per'; stat: StatKey; label?: string; hint?: string; yards?: boolean }
  | { kind: 'pos'; stat: StatKey; position: Position; label: string; hint?: string }
  | { kind: 'range'; stat: MilestoneStat; min: number; max?: number; label: string; positions?: Position[] }
  | { kind: 'threshold'; stat: MilestoneStat; threshold: number; label: string; positions?: Position[] }
  | { kind: 'bigPlay'; play: BigPlayBonus['kind']; minYards: number; on: 'td' | 'any'; label: string }
  | { kind: 'fg'; minYards: number; label: string }
  | { kind: 'fgMiss'; minYards: number; label: string }
  | { kind: 'catchLen'; minYards: number; label: string }
  | { kind: 'pa'; max: number; label: string }
  | { kind: 'ya'; max: number; label: string };

export type CatalogSection = { title: string; subtitle?: string; rows: CatalogRow[] };
export type CatalogCategory = { key: string; label: string; sections: CatalogSection[] };

const per = (stat: StatKey, extra: Partial<Extract<CatalogRow, { kind: 'per' }>> = {}): CatalogRow => ({ kind: 'per', stat, ...extra });
const yds = (stat: StatKey, hint?: string): CatalogRow => ({ kind: 'per', stat, yards: true, hint });

export const SCORING_CATALOG: CatalogCategory[] = [
  {
    key: 'passing',
    label: 'Passing',
    sections: [
      { title: 'Every throw', rows: [yds('passYds'), per('passTd'), per('pass2pt'), per('passInt'), per('passIntTd', { hint: 'On top of the interception' }), per('passCmp'), per('passInc'), per('passAtt'), per('pass1stDown'), per('sacked'), yds('sackedYds')] },
      {
        title: 'Big plays',
        subtitle: 'Stack on top of the normal points',
        rows: [
          per('pass40', { label: '40+ yard completion' }),
          { kind: 'bigPlay', play: 'pass', minYards: 40, on: 'td', label: '40+ yard TD pass' },
          { kind: 'bigPlay', play: 'pass', minYards: 50, on: 'td', label: '50+ yard TD pass' },
        ],
      },
      {
        title: 'Big games',
        subtitle: 'One bonus for the range they land in',
        rows: [
          { kind: 'range', stat: 'passYds', min: 300, max: 399, label: '300–399 passing yards' },
          { kind: 'range', stat: 'passYds', min: 400, label: '400+ passing yards' },
          { kind: 'threshold', stat: 'passCmp', threshold: 25, label: '25+ completions' },
          { kind: 'threshold', stat: 'passTd', threshold: 4, label: '4+ TD passes' },
        ],
      },
    ],
  },
  {
    key: 'rushing',
    label: 'Rushing',
    sections: [
      {
        title: 'Every carry',
        rows: [
          yds('rushYds'),
          per('rushTd'),
          { kind: 'pos', stat: 'rushTd', position: 'QB', label: 'Rushing TD by a QB', hint: 'Leave blank to use the normal value' },
          per('rush2pt'),
          per('rushAtt'),
          per('rush1stDown'),
        ],
      },
      {
        title: 'Big plays',
        subtitle: 'Stack on top of the normal points',
        rows: [
          per('rush40', { label: '40+ yard run' }),
          { kind: 'bigPlay', play: 'rush', minYards: 40, on: 'td', label: '40+ yard TD run' },
          { kind: 'bigPlay', play: 'rush', minYards: 50, on: 'td', label: '50+ yard TD run' },
        ],
      },
      {
        title: 'Big games',
        subtitle: 'One bonus for the range they land in',
        rows: [
          { kind: 'range', stat: 'rushYds', min: 100, max: 199, label: '100–199 rushing yards' },
          { kind: 'range', stat: 'rushYds', min: 200, label: '200+ rushing yards' },
          { kind: 'range', stat: 'rushRecYds', min: 100, max: 199, label: '100–199 rushing + receiving yards' },
          { kind: 'range', stat: 'rushRecYds', min: 200, label: '200+ rushing + receiving yards' },
          { kind: 'threshold', stat: 'rushAtt', threshold: 20, label: '20+ carries' },
        ],
      },
    ],
  },
  {
    key: 'receiving',
    label: 'Receiving',
    sections: [
      {
        title: 'Every catch',
        rows: [
          per('rec', { label: 'Catch (PPR)' }),
          { kind: 'pos', stat: 'rec', position: 'RB', label: 'Catch by an RB' },
          { kind: 'pos', stat: 'rec', position: 'WR', label: 'Catch by a WR' },
          { kind: 'pos', stat: 'rec', position: 'TE', label: 'Catch by a TE', hint: 'TE premium lives here' },
          yds('recYds'),
          per('recTd'),
          per('rec2pt'),
          per('recTgt'),
          per('rec1stDown'),
          { kind: 'pos', stat: 'rec1stDown', position: 'TE', label: 'First down catch by a TE' },
        ],
      },
      {
        title: 'Catch length',
        subtitle: 'Extra points per catch, on top of PPR',
        rows: [
          { kind: 'catchLen', minYards: 0, label: '0–4 yard catch' },
          { kind: 'catchLen', minYards: 5, label: '5–9 yard catch' },
          { kind: 'catchLen', minYards: 10, label: '10–19 yard catch' },
          { kind: 'catchLen', minYards: 20, label: '20–29 yard catch' },
          { kind: 'catchLen', minYards: 30, label: '30–39 yard catch' },
          { kind: 'catchLen', minYards: 40, label: '40+ yard catch' },
        ],
      },
      {
        title: 'Big plays',
        subtitle: 'Stack on top of the normal points',
        rows: [
          per('rec40', { label: '40+ yard catch (any)' }),
          { kind: 'bigPlay', play: 'rec', minYards: 40, on: 'td', label: '40+ yard TD catch' },
          { kind: 'bigPlay', play: 'rec', minYards: 50, on: 'td', label: '50+ yard TD catch' },
        ],
      },
      {
        title: 'Big games',
        subtitle: 'One bonus for the range they land in',
        rows: [
          { kind: 'range', stat: 'recYds', min: 100, max: 199, label: '100–199 receiving yards' },
          { kind: 'range', stat: 'recYds', min: 200, label: '200+ receiving yards' },
          { kind: 'threshold', stat: 'rec', threshold: 10, label: '10+ catches' },
        ],
      },
    ],
  },
  {
    key: 'kicking',
    label: 'Kicking',
    sections: [
      {
        title: 'Made field goals',
        subtitle: 'Points by distance',
        rows: [
          { kind: 'fg', minYards: 0, label: '0–19 yards' },
          { kind: 'fg', minYards: 20, label: '20–29 yards' },
          { kind: 'fg', minYards: 30, label: '30–39 yards' },
          { kind: 'fg', minYards: 40, label: '40–49 yards' },
          { kind: 'fg', minYards: 50, label: '50–59 yards' },
          { kind: 'fg', minYards: 60, label: '60+ yards' },
          per('fgMade', { label: 'Any made field goal', hint: 'Flat points, on top of distance' }),
          per('fgYds', { label: 'Per field goal yard' }),
          per('fgYdsOver30', { label: 'Per yard past 30' }),
        ],
      },
      {
        title: 'Misses',
        rows: [
          per('fgMiss', { label: 'Any missed field goal' }),
          { kind: 'fgMiss', minYards: 0, label: 'Missed 0–39 yards' },
          { kind: 'fgMiss', minYards: 40, label: 'Missed 40–49 yards' },
          { kind: 'fgMiss', minYards: 50, label: 'Missed 50+ yards' },
        ],
      },
      { title: 'Extra points', rows: [per('xpMade', { label: 'PAT made' }), per('xpMiss', { label: 'PAT missed' })] },
    ],
  },
  {
    key: 'defense',
    label: 'Team defense',
    sections: [
      {
        title: 'Points allowed',
        rows: [
          { kind: 'pa', max: 0, label: 'Shutout' },
          { kind: 'pa', max: 6, label: '1–6 points' },
          { kind: 'pa', max: 13, label: '7–13 points' },
          { kind: 'pa', max: 20, label: '14–20 points' },
          { kind: 'pa', max: 27, label: '21–27 points' },
          { kind: 'pa', max: 34, label: '28–34 points' },
          { kind: 'pa', max: Number.MAX_SAFE_INTEGER, label: '35+ points' },
          per('pointsAllowed', { label: 'Per point allowed' }),
        ],
      },
      {
        title: 'Yards allowed',
        rows: [
          { kind: 'ya', max: 99, label: 'Under 100 yards' },
          { kind: 'ya', max: 199, label: '100–199 yards' },
          { kind: 'ya', max: 299, label: '200–299 yards' },
          { kind: 'ya', max: 349, label: '300–349 yards' },
          { kind: 'ya', max: 399, label: '350–399 yards' },
          { kind: 'ya', max: 449, label: '400–449 yards' },
          { kind: 'ya', max: 499, label: '450–499 yards' },
          { kind: 'ya', max: 549, label: '500–549 yards' },
          { kind: 'ya', max: Number.MAX_SAFE_INTEGER, label: '550+ yards' },
          per('yardsAllowed', { label: 'Per yard allowed' }),
        ],
      },
      {
        title: 'Takeaways and pressure',
        rows: [per('defTd'), per('defSack'), yds('defSackYds'), per('defInt'), yds('defIntYds'), per('defFumRec'), yds('defFumRetYds'), per('defFf'), per('defSafety'), per('defBlkKick'), yds('defBlkKickYds'), per('def2ptRet')],
      },
      {
        title: 'Stops',
        subtitle: 'Reward a defense for winning the down, not just the turnover',
        rows: [per('defTkl'), per('defTfl'), per('defQbHit'), per('defPassDef'), per('def3AndOut'), per('def4thStop'), per('defForcedPunt')],
      },
    ],
  },
  {
    key: 'special',
    label: 'Special teams',
    sections: [
      { title: 'Returns', rows: [per('stTd', { label: 'Return TD (team)' }), per('krTd', { label: 'Kick return TD (player)' }), per('prTd', { label: 'Punt return TD (player)' }), yds('krYds', 'Player'), yds('prYds', 'Player'), yds('defKrYds', 'Team'), yds('defPrYds', 'Team'), yds('defMissedFgRetYds')] },
      { title: 'Coverage', rows: [per('stFf'), per('stFumRec'), per('stSoloTkl'), per('stTkl')] },
    ],
  },
  {
    key: 'idp',
    label: 'IDP',
    sections: [
      { title: 'Tackles', rows: [per('idpTkl', { label: 'Any tackle', hint: 'Use this or solo/assisted, not both' }), per('idpSoloTkl'), per('idpAstTkl'), per('idpTfl'), per('idpQbHit')] },
      { title: 'Big plays', rows: [per('idpSack'), yds('idpSackYds'), per('idpInt'), yds('idpIntYds'), per('idpFf'), per('idpFumRec'), yds('idpFumRetYds'), per('idpPassDef'), per('idpBlkKick'), per('idpTd'), per('idpSafety')] },
      {
        title: 'Bonuses',
        rows: [
          { kind: 'threshold', stat: 'idpTkl', threshold: 10, label: '10+ tackles' },
          { kind: 'threshold', stat: 'idpSack', threshold: 2, label: '2+ sacks' },
          { kind: 'threshold', stat: 'idpPassDef', threshold: 3, label: '3+ passes defended' },
          { kind: 'bigPlay', play: 'intRet', minYards: 50, on: 'td', label: '50+ yard pick-six' },
          { kind: 'bigPlay', play: 'fumRet', minYards: 50, on: 'td', label: '50+ yard fumble return TD' },
        ],
      },
    ],
  },
  {
    key: 'misc',
    label: 'Misc',
    sections: [{ title: 'Ball security', rows: [per('fumLost'), per('fum', { label: 'Any fumble', hint: 'On top of fumble lost' }), per('fumRecTd'), per('ownFumRec')] }],
  },
];

export function rowLabel(row: CatalogRow): string {
  if (row.kind === 'per') return row.label ?? statLabel(row.stat);
  return row.label;
}

/** Current value of a row on these rules. */
export function getRowValue(r: ScoringRules, row: CatalogRow): number {
  switch (row.kind) {
    case 'per':
      return r.points[row.stat] ?? 0;
    case 'pos':
      return r.positionOverrides[row.position]?.[row.stat] ?? r.points[row.stat] ?? 0;
    case 'range':
      return r.milestones.find((m) => m.stat === row.stat && m.min === row.min && m.max === row.max)?.points ?? 0;
    case 'threshold':
      return r.bonuses.find((b) => b.stat === row.stat && b.threshold === row.threshold)?.points ?? 0;
    case 'bigPlay':
      return r.bigPlays.find((b) => b.kind === row.play && b.minYards === row.minYards && (b.on ?? 'td') === row.on)?.points ?? 0;
    case 'fg':
      return r.fieldGoalTiers.find((t) => t.minYards === row.minYards)?.points ?? 0;
    case 'fgMiss':
      return r.fieldGoalMissTiers.find((t) => t.minYards === row.minYards)?.points ?? 0;
    case 'catchLen':
      return r.catchLengthBonuses.find((t) => t.minYards === row.minYards)?.points ?? 0;
    case 'pa':
      return r.pointsAllowedTiers.find((t) => t.max === row.max)?.points ?? 0;
    case 'ya':
      return r.yardsAllowedTiers.find((t) => t.max === row.max)?.points ?? 0;
  }
}

/** Whether a position row has its own value (vs. inheriting the league value). */
export function isOverridden(r: ScoringRules, row: CatalogRow): boolean {
  return row.kind === 'pos' && r.positionOverrides[row.position]?.[row.stat] !== undefined;
}

/** Set a row's value in place. Zero removes bonus rows so rules stay tidy. */
export function setRowValue(r: ScoringRules, row: CatalogRow, value: number): void {
  const v = Math.round(value * 10000) / 10000;
  const upsert = <T extends { points: number }>(list: T[], match: (x: T) => boolean, make: () => T) => {
    const i = list.findIndex(match);
    if (v === 0) {
      if (i >= 0) list.splice(i, 1);
    } else if (i >= 0) list[i] = { ...list[i], points: v };
    else list.push({ ...make(), points: v });
  };
  switch (row.kind) {
    case 'per':
      if (v === 0) delete r.points[row.stat];
      else r.points[row.stat] = v;
      return;
    case 'pos':
      r.positionOverrides[row.position] = { ...r.positionOverrides[row.position], [row.stat]: v };
      return;
    case 'range':
      upsert(r.milestones, (m) => m.stat === row.stat && m.min === row.min && m.max === row.max, () => ({ stat: row.stat, min: row.min, max: row.max, points: v, positions: row.positions }));
      return;
    case 'threshold':
      upsert(r.bonuses, (b) => b.stat === row.stat && b.threshold === row.threshold, () => ({ stat: row.stat, threshold: row.threshold, points: v, positions: row.positions }));
      return;
    case 'bigPlay':
      upsert(r.bigPlays, (b) => b.kind === row.play && b.minYards === row.minYards && (b.on ?? 'td') === row.on, () => ({ kind: row.play, minYards: row.minYards, on: row.on, points: v }));
      return;
    case 'fg':
      upsert(r.fieldGoalTiers, (t) => t.minYards === row.minYards, () => ({ minYards: row.minYards, points: v }));
      return;
    case 'fgMiss':
      upsert(r.fieldGoalMissTiers, (t) => t.minYards === row.minYards, () => ({ minYards: row.minYards, points: v }));
      return;
    case 'catchLen':
      upsert(r.catchLengthBonuses, (t) => t.minYards === row.minYards, () => ({ minYards: row.minYards, points: v }));
      return;
    case 'pa':
    case 'ya': {
      // Tiers keep every slot, even at 0, so a value never falls through to the wrong tier.
      const list = row.kind === 'pa' ? r.pointsAllowedTiers : r.yardsAllowedTiers;
      if (!list.length) for (const max of tierMaxes(row.kind)) list.push({ max, points: 0 });
      setTier(list, row.max, v);
      return;
    }
  }
}

function tierMaxes(kind: 'pa' | 'ya'): number[] {
  return SCORING_CATALOG.flatMap((c) => c.sections.flatMap((s) => s.rows)).flatMap((r) => (r.kind === kind ? [r.max] : []));
}

function setTier(list: { max: number; points: number }[], max: number, v: number) {
  const i = list.findIndex((t) => t.max === max);
  if (i >= 0) list[i] = { max, points: v };
  else list.push({ max, points: v });
  list.sort((a, b) => a.max - b.max);
}

/** Clear a position override so it follows the league value again. */
export function clearOverride(r: ScoringRules, row: CatalogRow): void {
  if (row.kind !== 'pos') return;
  const o = { ...r.positionOverrides[row.position] };
  delete o[row.stat];
  r.positionOverrides[row.position] = o;
}

/** Yardage rows read better as "1 point per N yards". */
export function yardsPerPoint(value: number): number | null {
  if (!value) return null;
  return Math.round((1 / value) * 100) / 100;
}

