// Builds a believable demo dynasty league for the preview: 10 teams, a
// drafted roster each, ten weeks of results, future picks (some traded),
// chat history and a news queue. All mock data; seeded so it's the same on
// every load.

import {
  buildDraftOrder,
  computeStandings,
  createFuturePicks,
  roundRobinSchedule,
  seededRandom,
  settingsForFormat,
  transferPicks,
  type ChatMessage,
  type DraftPick,
  type LeagueSettings,
  type Matchup,
  optimalLineup,
  type Player,
  type SlotType,
  type TeamRecord,
  type WeekScores,
} from '../engine';
import type { MatchedStory, NewsSource } from '../news/pipeline';
import { DEFAULT_SOURCES } from '../news/sources';
import { DEMO_PLAYER_ROWS } from './playerRows';
import { playerWeek, type PlayerWeek } from './games';

export type DemoTeam = {
  id: string;
  name: string;
  manager: string;
  emoji: string;
  /** Uploaded team image (data or file URI); falls back to the emoji. */
  imageUri?: string;
  players: string[];
  ir: string[];
  taxi: string[];
  faab: number;
  /** Waiver claims won this season. */
  claims: number;
  waiverPriority: number;
  /** Commissioner lock: no adds, drops or trades. */
  locked?: boolean;
};

/** MOCK bio data for the preview; the live feed supplies the real values. */
export type DemoPlayer = Player & { proj: number; bye: number; adp: number; birthDate: string; heightIn: number; weightLb: number; jersey: number };

const DYNASTY_TEAMS: [string, string, string][] = [
  ['Rattle & Roll', 'You', '🐍'],
  ['Tacos Al Pastor', 'Marisa', '🌮'],
  ['Fourth & Forever', 'Dev', '🏈'],
  ['Hail Marys', 'Grandpa Joe', '🙏'],
  ['Waiver Wire Wizards', 'Priya', '🪄'],
  ['The Bye Week Blues', 'Sam', '🎷'],
  ['Kickers Win Titles', 'Ty', '🦵'],
  ['Pylon Party', 'Andre', '🎉'],
  ['Sunday Scaries', 'Lena', '👻'],
  ['Commish Did It', 'Big Mike', '🧢'],
];

const OFFICE_TEAMS: [string, string, string][] = [
  ['Rattle & Roll', 'You', '🐍'],
  ['Spreadsheet Slingers', 'Karen', '📊'],
  ['Reply All', 'Devin', '📧'],
  ['Out of Office', 'Mo', '🏖️'],
  ['Synergy Squad', 'Jules', '🤝'],
  ['Quarterly Kickers', 'Raj', '📈'],
  ['Casual Fridays', 'Bree', '👕'],
  ['Per My Last Email', 'Tom', '✉️'],
  ['Break Room Ballers', 'Ana', '☕'],
  ['The Interns', 'Chris', '🎒'],
  ['HR Violations', 'Pat', '🚫'],
  ['Circle Back', 'Liz', '🔁'],
];

export const ME = 'T1';
export const CURRENT_WEEK = 11;
export const CURRENT_SEASON = 2026;

const INJURIES: Record<string, { status: Player['status']; note: string }> = {
  p_ch_mccaffrey: { status: 'questionable', note: 'Achilles' },
  p_ma_nabers: { status: 'ir', note: 'Knee' },
  p_jo_taylor: { status: 'doubtful', note: 'Ankle' },
  p_ce_lamb: { status: 'questionable', note: 'Hamstring' },
  p_de_achane: { status: 'out', note: 'Calf' },
};

export function demoPlayers(): Record<string, DemoPlayer> {
  const out: Record<string, DemoPlayer> = {};
  DEMO_PLAYER_ROWS.forEach(([id, name, team, pos, bye, adp, proj], i) => {
    const r = seededRandom(i * 7919 + 13);
    const yearsPro = i % 9 === 4 ? 0 : i % 11 === 3 ? 1 : 3 + (i % 6);
    const ageDays = Math.round((21.6 + yearsPro + r() * 1.6) * 365.25);
    const birth = new Date(Date.UTC(CURRENT_SEASON, 10, 17) - ageDays * 86_400_000).toISOString().slice(0, 10);
    const body = { QB: [75, 220], RB: [70, 212], WR: [73, 198], TE: [77, 248] }[pos];
    out[id] = {
      birthDate: birth,
      heightIn: body[0] + Math.round(r() * 4 - 2),
      weightLb: body[1] + Math.round(r() * 24 - 12),
      jersey: pos === 'QB' ? 1 + Math.floor(r() * 18) : pos === 'TE' ? 80 + Math.floor(r() * 9) : pos === 'RB' ? 20 + Math.floor(r() * 19) : 10 + Math.floor(r() * 9),
      id,
      name,
      position: pos,
      nflTeam: team,
      proj,
      bye,
      adp,
      yearsPro,
      status: INJURIES[id]?.status ?? 'active',
      injuryNote: INJURIES[id]?.note,
    };
  });
  return out;
}

export type DemoLeague = {
  id: string;
  name: string;
  /** Uploaded league image; falls back to the Coil mark. */
  imageUri?: string;
  settings: LeagueSettings;
  teams: DemoTeam[];
  /** Team ids whose managers are commissioners. */
  commissioners: string[];
  players: Record<string, DemoPlayer>;
  schedule: Matchup[];
  weeks: WeekScores[];
  standings: TeamRecord[];
  picks: DraftPick[];
  chat: ChatMessage[];
  /** Dues are collected outside Coil; we only link out and track who paid. */
  dues?: { url: string; amount: number; paid: string[] };
  /** Pinned note from the commissioner, shown to everyone. */
  commishNote?: string;
  /** Past champions, imported or typed in. */
  history: { season: number; champion: string; runnerUp?: string }[];
  /** Notification switches for this manager. */
  notify: Record<string, boolean>;
  /** Commissioner score corrections: week -> team -> score. */
  scoreOverrides?: Record<number, Record<string, number>>;
};

type LeagueSpec = {
  id: string;
  name: string;
  format: 'dynasty' | 'redraft';
  teams: [string, string, string][];
  seed: number;
  commissioners: string[];
};

export const DEMO_LEAGUE_SPECS: LeagueSpec[] = [
  { id: 'L1', name: 'The Rattler Dynasty League', format: 'dynasty', teams: DYNASTY_TEAMS, seed: 7, commissioners: ['T1', 'T10'] },
  { id: 'L2', name: 'Office Redraft', format: 'redraft', teams: OFFICE_TEAMS, seed: 21, commissioners: ['T6'] },
];

export function buildDemoLeague(spec: LeagueSpec = DEMO_LEAGUE_SPECS[0]): DemoLeague {
  const settings = settingsForFormat(spec.format, spec.teams.length);
  settings.name = spec.name;
  if (spec.format === 'dynasty') {
    settings.roster = { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, SUPERFLEX: 1, BN: 8, IR: 2, TAXI: 3 };
    settings.dynasty.taxiSlots = 3;
    settings.draft.rounds = 18;
    settings.matchups.medianGame = true;
  } else {
    settings.roster = { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, BN: 6, IR: 1 };
    settings.draft.rounds = 14;
  }
  settings.regularSeasonWeeks = 14;

  const players = demoPlayers();
  const ids = Object.values(players).sort((a, b) => a.adp - b.adp).map((p) => p.id);
  const teams: DemoTeam[] = spec.teams.map(([name, manager, emoji], i) => ({
    id: `T${i + 1}`,
    name,
    manager,
    emoji,
    players: [],
    ir: [],
    taxi: [],
    faab: 100 - ((i * 17 + spec.seed) % 61),
    claims: (i * 7 + spec.seed) % 9,
    waiverPriority: 0,
  }));

  // Startup draft by ADP with a little noise.
  const rnd = seededRandom(spec.seed);
  const board = buildDraftOrder('snake', teams.map((t) => t.id), settings.draft.rounds);
  const pool = [...ids];
  for (const slot of board) {
    const window = Math.min(4, pool.length);
    const idx = Math.floor(rnd() * rnd() * window);
    const [pid] = pool.splice(idx, 1);
    if (!pid) break;
    teams.find((t) => t.id === slot.teamId)!.players.push(pid);
  }
  // Make sure every team can field a full lineup (one TE and QB at least).
  for (const t of teams) {
    for (const pos of ['TE', 'QB'] as const) {
      if (t.players.some((id) => players[id].position === pos)) continue;
      const free = pool.find((id) => players[id].position === pos);
      if (!free) continue;
      pool.splice(pool.indexOf(free), 1);
      t.players[t.players.length - 1] = free;
    }
  }
  for (const t of teams) {
    for (const pid of [...t.players]) {
      const p = players[pid];
      if (p.status === 'ir' && t.ir.length < (settings.roster.IR ?? 0)) {
        t.ir.push(pid);
      } else if (spec.format === 'dynasty' && p.yearsPro === 0 && t.taxi.length < 2 && t.players.indexOf(pid) > 12) {
        t.taxi.push(pid);
      }
    }
  }

  const schedule = roundRobinSchedule(teams.map((t) => t.id), settings.regularSeasonWeeks);
  const partial: DemoLeague = {
    id: spec.id,
    name: spec.name,
    settings,
    teams,
    commissioners: spec.commissioners,
    players,
    schedule,
    weeks: [],
    standings: [],
    picks: [],
    chat: [],
    history: spec.format === 'dynasty' ? [{ season: 2025, champion: 'Pylon Party', runnerUp: 'Hail Marys' }, { season: 2024, champion: 'Hail Marys', runnerUp: 'Commish Did It' }] : [{ season: 2025, champion: 'Per My Last Email' }],
    notify: { scoring: true, trades: true, waivers: true, chat: true, news: true, injuries: true, lineupReminders: true },
    commishNote: spec.format === 'dynasty' ? 'Rookie draft is May 3. Taxi squads lock at the week 1 kickoff.' : undefined,
    dues: spec.format === 'dynasty' ? { url: 'https://www.leaguesafe.com/join/', amount: 100, paid: ['T1', 'T2', 'T3', 'T5', 'T7', 'T10'] } : undefined,
  };
  const weeks = computeWeeks(partial);
  const standings = computeStandings(settings, teams.map((t) => t.id), schedule, weeks);
  // Waiver priority: reverse standings.
  [...standings].reverse().forEach((r, i) => (teams.find((t) => t.id === r.teamId)!.waiverPriority = i + 1));

  let picks: DraftPick[] = [];
  if (spec.format === 'dynasty') {
    // Future picks, three seasons, four rounds, with a few trades.
    picks = createFuturePicks(teams.map((t) => t.id), CURRENT_SEASON + 1, 3, 4);
    picks = transferPicks(picks, ['2027-1-T4'], 'T4', 'T1');
    picks = transferPicks(picks, ['2028-2-T1'], 'T1', 'T6');
    picks = transferPicks(picks, ['2027-1-T9'], 'T9', 'T2');
    picks = transferPicks(picks, ['2029-1-T7'], 'T7', 'T5');
  }

  return { ...partial, weeks, standings, picks, chat: spec.format === 'dynasty' ? dynastyChat(spec.id) : officeChat(spec.id) };
}

/** Recompute every finished week from player stat lines under the league's current scoring. */
export function computeWeeks(L: DemoLeague): WeekScores[] {
  const weeks: WeekScores[] = [];
  for (let w = 1; w < CURRENT_WEEK; w++) {
    const scores: Record<string, number> = {};
    const maxScores: Record<string, number> = {};
    for (const t of L.teams) {
      const tw = teamWeek(L, t.id, w);
      scores[t.id] = L.scoreOverrides?.[w]?.[t.id] ?? tw.points;
      maxScores[t.id] = tw.maxPoints;
    }
    weeks.push({ week: w, scores, maxScores });
  }
  return weeks;
}

export function withRecomputedScores(L: DemoLeague): DemoLeague {
  const weeks = computeWeeks(L);
  return { ...L, weeks, standings: computeStandings(L.settings, L.teams.map((t) => t.id), L.schedule, weeks) };
}

export type TeamWeek = {
  starters: { slot: SlotType; playerId: string | null; pw: PlayerWeek | null }[];
  bench: { playerId: string; pw: PlayerWeek }[];
  points: number;
  projected: number;
  liveProjected: number;
  maxPoints: number;
  /** Share of starters' game time still to play, 0–1. */
  remaining: number;
};

export function teamWeek(L: DemoLeague, teamId: string, week: number): TeamWeek {
  const t = L.teams.find((x) => x.id === teamId)!;
  const active = t.players.filter((p) => !t.ir.includes(p) && !t.taxi.includes(p)).map((id) => L.players[id]);
  const pws = new Map(active.map((p) => [p.id, playerWeek(L.settings.scoring, p, week, CURRENT_WEEK)]));
  const { lineup } = optimalLineup(L.settings, active, (p) => pws.get(p.id)!.projected, (p) => pws.get(p.id)!.projected > 0);
  const best = optimalLineup(L.settings, active, (p) => pws.get(p.id)!.points);
  const starters = lineup.map((l) => ({ slot: l.slot, playerId: l.playerId, pw: l.playerId ? pws.get(l.playerId)! : null }));
  const ids = new Set(lineup.map((l) => l.playerId));
  const bench = active.filter((p) => !ids.has(p.id)).map((p) => ({ playerId: p.id, pw: pws.get(p.id)! }));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const points = r2(starters.reduce((s, x) => s + (x.pw?.points ?? 0), 0));
  const projected = r2(starters.reduce((s, x) => s + (x.pw?.projected ?? 0), 0));
  const liveProjected = r2(starters.reduce((s, x) => s + (x.pw?.liveProjected ?? 0), 0));
  const left = starters.filter((x) => x.pw?.game);
  const remaining = left.length ? left.reduce((s, x) => s + (x.pw!.game!.status === 'final' ? 0 : 1 - x.pw!.game!.played), 0) / left.length : 0;
  return { starters, bench, points, projected, liveProjected, maxPoints: r2(best.total), remaining };
}

function dynastyChat(leagueId: string): ChatMessage[] {
  const t = (h: number) => new Date(Date.UTC(2026, 10, 16, h, 0)).toISOString();
  return [
    { id: 'c1', leagueId, author: { kind: 'member', userId: 'u10', teamId: 'T10' }, sentAt: t(14), text: 'Rule change vote is up. Do we want a median game next year?', reactions: { '👍': ['u2', 'u3', 'u5'] } },
    { id: 'c2', leagueId, author: { kind: 'coil' }, sentAt: t(15), text: '', event: { type: 'close_win', winner: 'Tacos Al Pastor', loser: 'Hail Marys', margin: 0.42 }, reactions: { '😱': ['u4'], '🌮': ['u2'] } },
    { id: 'c3', leagueId, author: { kind: 'member', userId: 'u4', teamId: 'T4' }, sentAt: t(15), text: 'Forty-two hundredths. I am going to lie down.', reactions: { '😂': ['u1', 'u2', 'u7', 'u9'] } },
    { id: 'c4', leagueId, author: { kind: 'coil' }, sentAt: t(16), text: '', event: { type: 'trade', teams: ['Rattle & Roll', 'Hail Marys'], summary: 'Rattle & Roll gets a 2027 1st; Hail Marys get a running back for the playoff push' }, reactions: { '🔥': ['u3'] } },
    { id: 'c5', leagueId, author: { kind: 'member', userId: 'u2', teamId: 'T2' }, sentAt: t(17), text: 'Grandpa Joe trading future firsts in week 10 is my favorite tradition.', reactions: {} },
    {
      id: 'c6',
      leagueId,
      author: { kind: 'coil' },
      sentAt: t(18),
      text: '',
      event: {
        type: 'waiver_run',
        results: [
          { player: 'Tyjae Spears', winner: 'Waiver Wire Wizards', bid: 23, dropped: 'Jake Elliott', losers: [{ team: 'Rattle & Roll', bid: 19 }, { team: 'Sunday Scaries', bid: 11 }] },
          { player: 'Jalen Tolbert', winner: 'Pylon Party', bid: 4, losers: [{ team: 'Hail Marys', bid: 1 }] },
        ],
      },
      reactions: { '😤': ['u1'] },
    },
    { id: 'c7', leagueId, author: { kind: 'coil' }, sentAt: t(19), text: '', event: { type: 'free_agent', team: 'Kickers Win Titles', added: 'Tank Bigsby', dropped: 'Jordan Mason' }, reactions: {} },
    { id: 'c8', leagueId, author: { kind: 'coil' }, sentAt: t(20), text: '', event: { type: 'free_agent', team: 'Sunday Scaries', added: 'Dalton Kincaid' }, reactions: {} },
  ];
}

function officeChat(leagueId: string): ChatMessage[] {
  const t = (h: number) => new Date(Date.UTC(2026, 10, 16, h, 0)).toISOString();
  return [
    { id: 'o1', leagueId, author: { kind: 'member', userId: 'u6', teamId: 'T6' }, sentAt: t(13), text: 'Reminder: loser of the toilet bowl brings donuts every Friday in January.', reactions: { '🍩': ['u1', 'u2', 'u3'] } },
    { id: 'o2', leagueId, author: { kind: 'member', userId: 'u8', teamId: 'T8' }, sentAt: t(14), text: 'Per my last email, my team is fine.', reactions: { '😂': ['u1', 'u4', 'u9'] } },
    { id: 'o3', leagueId, author: { kind: 'coil' }, sentAt: t(15), text: '', event: { type: 'waiver_run', results: [{ player: 'Rico Dowdle', winner: 'Reply All', bid: 31, losers: [{ team: 'Rattle & Roll', bid: 30 }, { team: 'The Interns', bid: 12 }, { team: 'Circle Back', bid: 5 }] }] }, reactions: { '😭': ['u1'] } },
  ];
}

/** Demo news waiting in the Admin approve queue. */
export function demoNewsQueue(players: Record<string, DemoPlayer>): (MatchedStory & { reach: number })[] {
  const p = (id: string) => players[id];
  const now = new Date(Date.UTC(2026, 10, 17, 1, 30)).toISOString();
  return [
    { rawId: 'n1', sourceId: 'x:profootballtalk', playerId: 'p_ch_mccaffrey', playerName: p('p_ch_mccaffrey').name, status: 'questionable', kind: 'injury', confidence: 0.9, text: `${p('p_ch_mccaffrey').name} was limited at practice and is questionable for Sunday.`, publishedAt: now, reach: 1840 },
    { rawId: 'n2', sourceId: 'team:IND', playerId: 'p_jo_taylor', playerName: p('p_jo_taylor').name, status: 'doubtful', kind: 'injury', confidence: 0.7, text: `Colts list ${p('p_jo_taylor').name} as doubtful with an ankle injury.`, publishedAt: now, reach: 2210 },
    { rawId: 'n3', sourceId: 'x:rapsheet', playerId: 'p_de_achane', playerName: p('p_de_achane').name, status: 'out', kind: 'injury', confidence: 0.6, text: `Dolphins RB ${p('p_de_achane').name.split(' ').pop()} won't play this week, per source.`, publishedAt: now, reach: 1975 },
  ];
}

export function demoSources(): NewsSource[] {
  return DEFAULT_SOURCES.map((s) => ({ ...s }));
}

/** This week's opponent for a team, or null on a bye. */
export function opponentOf(L: DemoLeague, teamId: string, week: number): string | null {
  const m = L.schedule.find((x) => x.week === week && (x.home === teamId || x.away === teamId));
  if (!m) return null;
  return m.home === teamId ? m.away : m.home;
}

/** Age in years to one decimal, the way dynasty managers talk about it. */
export function ageOf(p: { birthDate: string }, on = new Date(Date.UTC(CURRENT_SEASON, 10, 17))): number {
  return Math.floor(((on.getTime() - new Date(p.birthDate).getTime()) / (365.25 * 86_400_000)) * 10) / 10;
}

export const heightLabel = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;
