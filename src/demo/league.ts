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
  type Player,
  type TeamRecord,
  type WeekScores,
} from '../engine';
import type { MatchedStory, NewsSource } from '../news/pipeline';
import { DEFAULT_SOURCES } from '../news/sources';
import { DEMO_PLAYER_ROWS } from './playerRows';

export type DemoTeam = {
  id: string;
  name: string;
  manager: string;
  emoji: string;
  players: string[];
  ir: string[];
  taxi: string[];
  faab: number;
};

export type DemoPlayer = Player & { proj: number; bye: number; adp: number };

const TEAMS: [string, string, string][] = [
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
    out[id] = {
      id,
      name,
      position: pos,
      nflTeam: team,
      proj,
      bye,
      adp,
      yearsPro: i % 9 === 4 ? 0 : i % 11 === 3 ? 1 : 3 + (i % 6),
      status: INJURIES[id]?.status ?? 'active',
      injuryNote: INJURIES[id]?.note,
    };
  });
  return out;
}

export type DemoLeague = {
  id: string;
  name: string;
  settings: LeagueSettings;
  teams: DemoTeam[];
  players: Record<string, DemoPlayer>;
  schedule: Matchup[];
  weeks: WeekScores[];
  standings: TeamRecord[];
  picks: DraftPick[];
  chat: ChatMessage[];
};

export function buildDemoLeague(): DemoLeague {
  const settings = settingsForFormat('dynasty', 10);
  settings.name = 'The Rattler Dynasty League';
  settings.roster = { QB: 1, RB: 2, WR: 3, TE: 1, FLEX: 1, SUPERFLEX: 1, BN: 8, IR: 2, TAXI: 3 };
  settings.dynasty.taxiSlots = 3;
  settings.draft.rounds = 18;
  settings.regularSeasonWeeks = 14;
  settings.matchups.medianGame = true;

  const players = demoPlayers();
  const ids = Object.values(players).sort((a, b) => a.adp - b.adp).map((p) => p.id);
  const teams: DemoTeam[] = TEAMS.map(([name, manager, emoji], i) => ({
    id: `T${i + 1}`,
    name,
    manager,
    emoji,
    players: [],
    ir: [],
    taxi: [],
    faab: 100 - ((i * 17) % 61),
  }));

  // Startup draft by ADP with a little noise.
  const rnd = seededRandom(7);
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
      if (p.status === 'ir' && t.ir.length < 2) {
        t.ir.push(pid);
      } else if (p.yearsPro === 0 && t.taxi.length < 2 && t.players.indexOf(pid) > 12) {
        t.taxi.push(pid);
      }
    }
  }

  // Ten weeks of results from projections plus seeded noise.
  const schedule = roundRobinSchedule(teams.map((t) => t.id), settings.regularSeasonWeeks);
  const weeks: WeekScores[] = [];
  for (let w = 1; w < CURRENT_WEEK; w++) {
    const scores: Record<string, number> = {};
    for (const t of teams) {
      const starters = t.players
        .filter((p) => !t.ir.includes(p) && !t.taxi.includes(p))
        .map((p) => players[p].proj / 17)
        .sort((a, b) => b - a)
        .slice(0, 10);
      const base = starters.reduce((s, x) => s + x, 0);
      scores[t.id] = Math.round((base * (0.75 + rnd() * 0.5)) * 100) / 100;
    }
    weeks.push({ week: w, scores });
  }
  const standings = computeStandings(settings, teams.map((t) => t.id), schedule, weeks);

  // Future picks, three seasons, four rounds, with a few trades.
  let picks = createFuturePicks(teams.map((t) => t.id), CURRENT_SEASON + 1, 3, 4);
  picks = transferPicks(picks, ['2027-1-T4'], 'T4', 'T1');
  picks = transferPicks(picks, ['2028-2-T1'], 'T1', 'T6');
  picks = transferPicks(picks, ['2027-1-T9'], 'T9', 'T2');
  picks = transferPicks(picks, ['2029-1-T7'], 'T7', 'T5');

  const t = (h: number) => new Date(Date.UTC(2026, 10, 16, h, 0)).toISOString();
  const chat: ChatMessage[] = [
    { id: 'c1', leagueId: 'L1', author: { kind: 'member', userId: 'u10', teamId: 'T10' }, sentAt: t(14), text: 'Rule change vote is up. Do we want a median game next year?', reactions: { '👍': ['u2', 'u3', 'u5'] } },
    { id: 'c2', leagueId: 'L1', author: { kind: 'coil' }, sentAt: t(15), text: '', event: { type: 'close_win', winner: 'Tacos Al Pastor', loser: 'Hail Marys', margin: 0.42 }, reactions: { '😱': ['u4'], '🌮': ['u2'] } },
    { id: 'c3', leagueId: 'L1', author: { kind: 'member', userId: 'u4', teamId: 'T4' }, sentAt: t(15), text: 'Forty-two hundredths. I am going to lie down.', reactions: { '😂': ['u1', 'u2', 'u7', 'u9'] } },
    { id: 'c4', leagueId: 'L1', author: { kind: 'coil' }, sentAt: t(16), text: '', event: { type: 'trade', teams: ['Rattle & Roll', 'Hail Marys'], summary: 'Rattle & Roll gets a 2027 1st; Hail Marys get a running back for the playoff push' }, reactions: { '🔥': ['u3'] } },
    { id: 'c5', leagueId: 'L1', author: { kind: 'member', userId: 'u2', teamId: 'T2' }, sentAt: t(17), text: 'Grandpa Joe trading future firsts in week 10 is my favorite tradition.', reactions: {} },
    { id: 'c6', leagueId: 'L1', author: { kind: 'coil' }, sentAt: t(18), text: '', event: { type: 'waiver', team: 'Waiver Wire Wizards', added: 'a backup RB', dropped: 'a kicker', bid: 23 }, reactions: {} },
  ];

  return { id: 'L1', name: settings.name, settings, teams, players, schedule, weeks, standings, picks, chat };
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
