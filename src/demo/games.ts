// MOCK game data for the preview: an NFL schedule, game results, and a full
// stat line for every player every week, all seeded so it's the same on every
// load. Fantasy points come from the real scoring engine, so changing the
// league's scoring changes every number in the app, the way it will live.

import { scoreStatLine, seededRandom, type Player, type ScoringRules, type StatLine } from '../engine';
import { NFL_TEAMS } from '../news/sources';

export const NFL_ABBRS = Object.keys(NFL_TEAMS).sort();

export type GameStatus = 'final' | 'live' | 'upcoming';

export type NflGame = {
  week: number;
  team: string;
  opp: string;
  home: boolean;
  teamScore: number;
  oppScore: number;
  status: GameStatus;
  /** Share of the game played, 0–1. */
  played: number;
  /** "Q3 4:12", "Final", "Sun 12:00". */
  clock: string;
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Circle-method pairing so every week has 16 consistent games. */
function opponentOf(team: string, week: number): { opp: string; home: boolean } {
  const n = NFL_ABBRS.length;
  const rest = NFL_ABBRS.slice(1);
  const shift = (week - 1) % (n - 1);
  const rotated = [...rest.slice(shift), ...rest.slice(0, shift)];
  const order = [NFL_ABBRS[0], ...rotated];
  const i = order.indexOf(team);
  const j = n - 1 - i;
  return { opp: order[j], home: (i < j) === (week % 2 === 0) };
}

export function nflGame(team: string, week: number, bye: number, currentWeek: number): NflGame | null {
  if (week === bye) return null;
  const { opp, home } = opponentOf(team, week);
  const key = [team, opp].sort().join('-') + week;
  const rnd = seededRandom(hash(key));
  const a = 10 + Math.floor(rnd() * 25);
  const b = 7 + Math.floor(rnd() * 25);
  const first = [team, opp].sort()[0] === team;
  const slot = rnd();
  let status: GameStatus = week < currentWeek ? 'final' : week > currentWeek ? 'upcoming' : slot < 0.4 ? 'final' : slot < 0.75 ? 'live' : 'upcoming';
  const played = status === 'final' ? 1 : status === 'upcoming' ? 0 : 0.25 + rnd() * 0.6;
  const q = Math.min(4, Math.floor(played * 4) + 1);
  const mins = Math.floor((1 - ((played * 4) % 1)) * 15);
  const clock = status === 'final' ? 'Final' : status === 'live' ? `Q${q} ${mins}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}` : slot < 0.9 ? 'Sun 12:00' : 'Mon 7:15';
  if (status === 'upcoming' && week === currentWeek && slot < 0.75) status = 'upcoming';
  const scale = status === 'final' ? 1 : played;
  return {
    week,
    team,
    opp,
    home,
    teamScore: Math.round((first ? a : b) * scale),
    oppScore: Math.round((first ? b : a) * scale),
    status,
    played,
    clock,
  };
}

// Average game by position, used as the shape of every stat line.
const ARCHETYPE: Record<string, StatLine> = {
  QB: { passAtt: 34, passCmp: 22, passYds: 245, passTd: 1.7, passInt: 0.8, rushAtt: 4, rushYds: 18, rushTd: 0.2, sacked: 2.3, pass1stDown: 11 },
  RB: { rushAtt: 15, rushYds: 68, rushTd: 0.55, recTgt: 3.5, rec: 2.7, recYds: 22, recTd: 0.12, fumLost: 0.08, rush1stDown: 4, rec1stDown: 1 },
  WR: { recTgt: 7.5, rec: 5, recYds: 65, recTd: 0.45, rushAtt: 0.3, rushYds: 2, rec1stDown: 3 },
  TE: { recTgt: 5.5, rec: 3.8, recYds: 40, recTd: 0.35, rec1stDown: 2 },
};
const COUNT_STATS = new Set(['passTd', 'passInt', 'rushTd', 'recTd', 'fumLost']);

function poisson(lambda: number, rnd: () => number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rnd();
  } while (p > L && k < 10);
  return k - 1;
}

/** A believable full-game stat line for a player, scaled to their projection. */
export function fullStatLine(p: Player & { proj: number }, week: number): StatLine {
  const base = ARCHETYPE[p.position];
  if (!base) return {};
  const rnd = seededRandom(hash(`${p.id}:${week}`));
  // How good this player is relative to an average starter at the position.
  const avg = p.position === 'QB' ? 290 : p.position === 'RB' ? 200 : p.position === 'WR' ? 200 : 140;
  const f = Math.max(0.3, p.proj / avg);
  const form = 0.45 + rnd() * 1.15;
  const out: StatLine = {};
  for (const [k, v] of Object.entries(base) as [keyof StatLine, number][]) {
    if (COUNT_STATS.has(k as string)) {
      const lam = k === 'passInt' || k === 'fumLost' ? v : v * f * form;
      (out as Record<string, number>)[k] = poisson(lam, rnd);
    } else {
      const val = v * (k === 'passAtt' || k === 'recTgt' || k === 'rushAtt' ? Math.sqrt(f) : f) * form * (0.85 + rnd() * 0.3);
      (out as Record<string, number>)[k] = Math.max(0, Math.round(val));
    }
  }
  if (out.passCmp !== undefined && out.passAtt !== undefined) out.passCmp = Math.min(out.passCmp, out.passAtt);
  if (out.rec !== undefined && out.recTgt !== undefined) out.recTgt = Math.max(out.recTgt, out.rec);
  if (out.passCmp !== undefined) out.passInc = (out.passAtt ?? 0) - out.passCmp;
  // Spread receiving yards across catches so catch-length bonuses work.
  if (out.rec && out.recYds) {
    const weights = Array.from({ length: out.rec }, () => 0.2 + rnd() * rnd() * 3);
    const sum = weights.reduce((s, w) => s + w, 0);
    out.recYardsEach = weights.map((w) => Math.round((w / sum) * (out.recYds ?? 0)));
    out.rec40 = out.recYardsEach.filter((y) => y >= 40).length;
  }
  const tdLen = () => (rnd() < 0.8 ? 1 + Math.floor(rnd() * 25) : 30 + Math.floor(rnd() * 45));
  if (out.rushTd) out.rushTdYards = Array.from({ length: out.rushTd }, tdLen);
  if (out.recTd) out.recTdYards = Array.from({ length: out.recTd }, tdLen);
  if (out.passTd) out.passTdYards = Array.from({ length: out.passTd }, tdLen);
  return out;
}

/** Part of a stat line, for games still in progress. */
export function partialStatLine(full: StatLine, played: number): StatLine {
  if (played >= 1) return full;
  const out: StatLine = {};
  for (const [k, v] of Object.entries(full)) {
    if (typeof v === 'number') (out as Record<string, number>)[k] = Math.floor(v * played);
    else if (Array.isArray(v)) (out as Record<string, number[]>)[k] = v.slice(0, Math.floor(v.length * played));
  }
  return out;
}

export type PlayerWeek = {
  game: NflGame | null;
  stats: StatLine;
  points: number;
  projected: number;
  /** Live projection: points so far plus the rest of the projection. */
  liveProjected: number;
};

export function playerWeek(rules: ScoringRules, p: Player & { proj: number; bye: number }, week: number, currentWeek: number): PlayerWeek {
  const game = nflGame(p.nflTeam, week, p.bye, currentWeek);
  const mrnd = seededRandom(hash(`proj:${p.id}:${week}`));
  const projected = game ? Math.round((p.proj / 17) * (0.85 + mrnd() * 0.3) * 100) / 100 : 0;
  if (!game || game.status === 'upcoming') return { game, stats: {}, points: 0, projected, liveProjected: projected };
  const inactive = p.status === 'out' || p.status === 'ir' || p.status === 'doubtful';
  if (inactive && week >= currentWeek) return { game, stats: {}, points: 0, projected: 0, liveProjected: 0 };
  const stats = partialStatLine(fullStatLine(p, week), game.played);
  const points = scoreStatLine(rules, p.position, stats).total;
  const liveProjected = Math.round((points + projected * (1 - game.played)) * 100) / 100;
  return { game, stats, points, projected, liveProjected };
}

/** "26 car, 88 yd, 1 td · 3/4 rec, 25 yd" */
export function statSummary(position: string, s: StatLine): string {
  const parts: string[] = [];
  if (position === 'QB' && s.passAtt) parts.push(`${s.passCmp}/${s.passAtt} cmp, ${s.passYds} yd${s.passTd ? `, ${s.passTd} td` : ''}${s.passInt ? `, ${s.passInt} int` : ''}`);
  if (s.rushAtt) parts.push(`${s.rushAtt} car, ${s.rushYds ?? 0} yd${s.rushTd ? `, ${s.rushTd} td` : ''}`);
  if (s.recTgt) parts.push(`${s.rec ?? 0}/${s.recTgt} rec, ${s.recYds ?? 0} yd${s.recTd ? `, ${s.recTd} td` : ''}`);
  if (s.fumLost) parts.push(`${s.fumLost} fum`);
  return parts.join(' · ');
}

/** Share of leagues rostering / starting a player, seeded from ADP for the preview. */
export function ownership(p: { id: string; adp: number }): { rostered: number; started: number; trend: number } {
  const rnd = seededRandom(hash(`own:${p.id}`));
  const rostered = Math.max(3, Math.min(100, Math.round(101 - p.adp * 0.35 - rnd() * 6)));
  const started = Math.max(0, Math.round(rostered * (0.95 - Math.min(0.85, p.adp / 220)) - rnd() * 5));
  return { rostered, started, trend: Math.round((rnd() - 0.4) * 6) };
}

/** Rough win probability from live projections. */
export function winProbability(mine: number, theirs: number, remainingShare: number): number {
  const sd = 4 + 24 * Math.sqrt(Math.max(0, remainingShare));
  const z = (mine - theirs) / sd;
  return 1 / (1 + Math.exp(-1.7 * z));
}

/** Share of offensive snaps played, seeded for the preview. */
export function snapShare(p: Player & { proj: number }, week: number): number {
  const rnd = seededRandom(hash(`snap:${p.id}:${week}`));
  const base = Math.min(0.97, 0.35 + p.proj / 420);
  return Math.round(Math.max(0.05, Math.min(1, base + (rnd() - 0.5) * 0.18)) * 100);
}

/**
 * How tough an NFL defense is against a fantasy position, 1 (allows the
 * fewest points) to 32 (allows the most). Seeded for the preview; the app
 * computes it from points allowed to each position this season.
 */
export function defenseRank(defense: string, position: string): number {
  let h = 7;
  for (const ch of `${defense}:${position}`) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return (h % 32) + 1;
}

/** Red for the hardest matchups, green for the easiest, plain in between. */
export function matchupColor(defense: string, position: string, colors: { hard: string; easy: string; neutral: string }): string {
  const r = defenseRank(defense, position);
  return r <= 10 ? colors.hard : r >= 23 ? colors.easy : colors.neutral;
}
