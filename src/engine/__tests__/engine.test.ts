import { describe, expect, it } from 'vitest';

import {
  applyTrade,
  autoSubInactive,
  buildDraftOrder,
  computeStandings,
  createFuturePicks,
  defaultSettings,
  draftLottery,
  emptySpots,
  firstRound,
  bracketOrder,
  nextRound,
  isReversedRound,
  keeperCost,
  normalizeInjuryStatus,
  optimalLineup,
  pickLabel,
  placeKeepers,
  playoffEndWeek,
  processWaivers,
  projectStatLine,
  roundRobinSchedule,
  scoreStatLine,
  scoringFromPreset,
  seedPlayoffs,
  settingsForFormat,
  toggleReaction,
  tradeReviewOutcome,
  transferPicks,
  validateRoster,
  validateSettings,
  validateTrade,
  eventCopy,
  type ChatMessage,
  type Player,
  type Trade,
} from '..';

const P = (id: string, position: Player['position'], extra: Partial<Player> = {}): Player => ({ id, name: id, position, nflTeam: 'BUF', ...extra });

describe('scoring', () => {
  it('scores a half PPR line with a breakdown', () => {
    const rules = scoringFromPreset('half_ppr');
    const r = scoreStatLine(rules, 'WR', { rec: 8, recYds: 112, recTd: 1 });
    expect(r.total).toBe(4 + 11.2 + 6);
    expect(r.lines.map((l) => l.label)).toContain('Catches');
  });

  it('applies TE premium only to tight ends', () => {
    const rules = scoringFromPreset('te_premium');
    expect(scoreStatLine(rules, 'TE', { rec: 6 }).total).toBe(9);
    expect(scoreStatLine(rules, 'WR', { rec: 6 }).total).toBe(6);
  });

  it('stacks yardage bonuses and big-play TDs', () => {
    const rules = scoringFromPreset('ppr');
    rules.bonuses.push({ stat: 'rushYds', threshold: 100, points: 3 }, { stat: 'rushYds', threshold: 200, points: 3 });
    rules.bigPlays.push({ kind: 'rush', minYards: 40, points: 2 });
    const r = scoreStatLine(rules, 'RB', { rushYds: 205, rushTd: 2, rushTdYards: [3, 55] });
    expect(r.total).toBe(20.5 + 12 + 6 + 2);
  });

  it('uses tiered PPR instead of flat catches when set', () => {
    const rules = scoringFromPreset('ppr');
    rules.receptionTiers = [
      { minYards: 0, points: 0.5 },
      { minYards: 10, points: 1 },
      { minYards: 20, points: 1.5 },
    ];
    const r = scoreStatLine(rules, 'WR', { rec: 3, recYds: 35, recYardsEach: [4, 11, 20] });
    expect(r.total).toBe(3 + 3.5);
  });

  it('scores kickers by distance and D/ST by points allowed', () => {
    const rules = scoringFromPreset('standard');
    expect(scoreStatLine(rules, 'K', { fgMadeYards: [25, 44, 53], xpMade: 2, fgMiss: 1 }).total).toBe(3 + 4 + 5 + 2 - 1);
    expect(scoreStatLine(rules, 'DST', { pointsAllowed: 0, defSack: 4, defInt: 1 }).total).toBe(10 + 4 + 2);
    expect(scoreStatLine(rules, 'DST', { pointsAllowed: 38 }).total).toBe(-4);
  });
});

describe('settings', () => {
  it('defaults are valid', () => {
    expect(validateSettings(defaultSettings()).filter((i) => i.severity === 'error')).toEqual([]);
    for (const f of ['redraft', 'keeper', 'dynasty', 'bestball'] as const) {
      expect(validateSettings(settingsForFormat(f)).filter((i) => i.severity === 'error')).toEqual([]);
    }
  });

  it('catches a championship after week 18 in plain words', () => {
    const s = defaultSettings();
    s.playoffs = { ...s.playoffs, teams: 8, startWeek: 16, weeksPerRound: 2 };
    expect(playoffEndWeek(s)).toBe(21);
    expect(validateSettings(s).some((i) => i.field === 'playoffs.startWeek' && i.severity === 'error')).toBe(true);
  });

  it('rejects an auction budget that cannot fill a roster', () => {
    const s = defaultSettings();
    s.draft.type = 'auction';
    s.draft.auction.budget = 10;
    expect(validateSettings(s).some((i) => i.field === 'draft.auction.budget')).toBe(true);
  });

  it('requires IR designations when IR slots exist', () => {
    const s = defaultSettings();
    s.irEligible = [];
    expect(validateSettings(s).some((i) => i.field === 'irEligible')).toBe(true);
  });
});

describe('injuries and IR', () => {
  it('normalizes feed spellings', () => {
    expect(normalizeInjuryStatus('Q')).toBe('questionable');
    expect(normalizeInjuryStatus('Injured Reserve')).toBe('ir');
    expect(normalizeInjuryStatus('OUT')).toBe('out');
    expect(normalizeInjuryStatus('PUP-R')).toBe('pup');
    expect(normalizeInjuryStatus(null)).toBe('active');
  });

  it('only lets eligible designations sit in IR, per league settings', () => {
    const s = defaultSettings();
    const healthy = P('h', 'RB', { status: 'questionable' });
    const out = P('o', 'RB', { status: 'out' });
    const spots = [
      { slot: 'IR' as const, playerId: 'h' },
    ];
    expect(validateRoster(s, spots, { h: healthy, o: out })).toHaveLength(1);
    s.irEligible = ['ir', 'out', 'doubtful', 'questionable'];
    expect(validateRoster(s, spots, { h: healthy, o: out })).toHaveLength(0);
  });

  it('checks taxi eligibility by years in the league', () => {
    const s = settingsForFormat('dynasty');
    const vet = P('v', 'WR', { yearsPro: 5 });
    expect(validateRoster(s, [{ slot: 'TAXI', playerId: 'v' }], { v: vet })[0].message).toMatch(/taxi/);
  });
});

describe('lineups', () => {
  it('builds the best lineup with flex and superflex', () => {
    const s = defaultSettings({ roster: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 1, BN: 5 } });
    const pts: Record<string, number> = { qb1: 25, qb2: 20, rb1: 18, rb2: 15, rb3: 14, wr1: 22, wr2: 12, wr3: 11, te1: 9 };
    const players = Object.keys(pts).map((id) => P(id, id.replace(/\d/, '').toUpperCase() as Player['position']));
    const { total, lineup } = optimalLineup(s, players, (p) => pts[p.id]);
    expect(total).toBe(25 + 20 + 18 + 15 + 22 + 12 + 9 + 14);
    expect(lineup.find((l) => l.slot === 'SUPERFLEX')?.playerId).toBe('qb2');
  });

  it('auto-subs an inactive starter for the best eligible bench player', () => {
    const s = defaultSettings();
    const spots = emptySpots(s);
    spots[0].playerId = 'rbOut'; // first spot is QB in display order; use RB spot instead
    spots[0].playerId = null;
    const rbSpot = spots.find((x) => x.slot === 'RB')!;
    rbSpot.playerId = 'rbOut';
    const bench = spots.filter((x) => x.slot === 'BN');
    bench[0].playerId = 'rbA';
    bench[1].playerId = 'rbB';
    const players = { rbOut: P('rbOut', 'RB', { status: 'out' }), rbA: P('rbA', 'RB'), rbB: P('rbB', 'RB') };
    const { swaps } = autoSubInactive(spots, players, (p) => (p.id === 'rbB' ? 12 : 8));
    expect(swaps).toEqual([{ out: 'rbOut', in: 'rbB', slot: 'RB' }]);
  });
});

describe('drafts and picks', () => {
  const order = ['A', 'B', 'C', 'D'];

  it('builds snake, linear and third-round reversal orders', () => {
    const r3 = (type: Parameters<typeof buildDraftOrder>[0]) =>
      buildDraftOrder(type, order, 5, []).filter((s) => s.pickInRound === 1).map((s) => s.teamId);
    expect(r3('snake')).toEqual(['A', 'D', 'A', 'D', 'A']);
    expect(r3('linear')).toEqual(['A', 'A', 'A', 'A', 'A']);
    expect(r3('third_round_reversal')).toEqual(['A', 'D', 'D', 'A', 'D']);
    expect(isReversedRound('third_round_reversal', 6)).toBe(false);
  });

  it('applies traded picks to the board', () => {
    const board = buildDraftOrder('linear', order, 2, [{ round: 1, originalTeamId: 'A', ownerTeamId: 'C' }]);
    expect(board[0]).toMatchObject({ originalTeamId: 'A', teamId: 'C' });
  });

  it('trades future picks years out and labels them', () => {
    let picks = createFuturePicks(order, 2027, 3, 4);
    expect(picks).toHaveLength(48);
    picks = transferPicks(picks, ['2029-1-A'], 'A', 'B');
    const p = picks.find((x) => x.id === '2029-1-A')!;
    expect(pickLabel(p, (id) => `Team ${id}`)).toBe('2029 1st (via Team A)');
    expect(() => transferPicks(picks, ['2029-1-A'], 'A', 'C')).toThrow();
  });

  it('places keepers in their cost round, or the next earlier pick', () => {
    const board = buildDraftOrder('snake', order, 4, [{ round: 3, originalTeamId: 'B', ownerTeamId: 'C' }]);
    const { board: b, unplaced } = placeKeepers(board, [
      { teamId: 'A', playerId: 'k1', round: 2 },
      { teamId: 'B', playerId: 'k2', round: 3 },
    ]);
    expect(b.find((s) => s.keeperPlayerId === 'k1')).toMatchObject({ teamId: 'A', round: 2 });
    expect(b.find((s) => s.keeperPlayerId === 'k2')).toMatchObject({ teamId: 'B', round: 2 });
    expect(unplaced).toEqual([]);
    expect(keeperCost(8, 0, 1, 10)).toBe(7);
    expect(keeperCost(null, 1, 2, 10)).toBe(6);
  });

  it('runs a seeded lottery that can be replayed', () => {
    const a = draftLottery(['W', 'X', 'Y', 'Z'], [4, 3, 2, 1], 2, 42);
    expect(draftLottery(['W', 'X', 'Y', 'Z'], [4, 3, 2, 1], 2, 42)).toEqual(a);
    expect(new Set(a).size).toBe(4);
  });
});

describe('season', () => {
  const teams = ['A', 'B', 'C', 'D', 'E'];

  it('schedules everyone once per cycle with byes for odd leagues', () => {
    const sched = roundRobinSchedule(teams, 5);
    const games = new Map(teams.map((t) => [t, 0]));
    for (const m of sched) {
      games.set(m.home, games.get(m.home)! + 1);
      games.set(m.away, games.get(m.away)! + 1);
    }
    expect([...games.values()]).toEqual([4, 4, 4, 4, 4]);
    const pairs = new Set(sched.map((m) => [m.home, m.away].sort().join('')));
    expect(pairs.size).toBe(10);
  });

  it('counts median games and all-play', () => {
    const s = defaultSettings({ matchups: { type: 'head_to_head', medianGame: true } });
    const sched = [
      { week: 1, home: 'A', away: 'B' },
      { week: 1, home: 'C', away: 'D' },
    ];
    const st = computeStandings(s, ['A', 'B', 'C', 'D'], sched, [{ week: 1, scores: { A: 120, B: 100, C: 90, D: 80 } }]);
    const a = st.find((r) => r.teamId === 'A')!;
    const c = st.find((r) => r.teamId === 'C')!;
    expect([a.wins, a.losses]).toEqual([2, 0]);
    expect([c.wins, c.losses]).toEqual([1, 1]);
    expect(a.allPlayWins).toBe(3);
    expect(st[0].teamId).toBe('A');
  });

  it('gives top seeds byes and keeps the bracket', () => {
    const s = defaultSettings();
    const seeds = ['1', '2', '3', '4', '5', '6'];
    const r1 = firstRound(s, seeds);
    expect(r1.filter((g) => g.low === null).map((g) => g.high)).toEqual(['1', '2']);
    expect(r1.filter((g) => g.low).map((g) => [g.high, g.low])).toEqual([
      ['3', '6'],
      ['4', '5'],
    ]);
    const ordered = bracketOrder(r1, seeds).map((g) => g.high);
    expect(ordered).toEqual(['1', '4', '2', '3']);
    // 4 and 6 win
    const r2 = nextRound(s, 2, ['1', '4', '2', '6'], seeds);
    expect(r2.map((g) => [g.high, g.low])).toEqual([
      ['1', '4'],
      ['2', '6'],
    ]);
    const re = nextRound({ ...s, playoffs: { ...s.playoffs, reseed: true } }, 2, ['1', '4', '2', '6'], seeds);
    expect(re.map((g) => [g.high, g.low])).toEqual([
      ['1', '6'],
      ['2', '4'],
    ]);
  });

  it('puts division winners first when asked', () => {
    const s = defaultSettings({ divisions: 2, playoffs: { ...defaultSettings().playoffs, teams: 4, divisionWinnersFirst: true } });
    const standings = ['A', 'B', 'C', 'D', 'E'].map((t, i) => ({
      teamId: t, wins: 10 - i, losses: i, ties: 0, pointsFor: 0, pointsAgainst: 0, allPlayWins: 0, allPlayLosses: 0, allPlayTies: 0, maxPointsFor: 0,
      division: t === 'E' ? 1 : 0,
    }));
    expect(seedPlayoffs(s, standings)).toEqual(['A', 'E', 'B', 'C']);
  });
});

describe('waivers', () => {
  const team = (teamId: string, roster: string[], faab = 100) => ({ teamId, roster, rosterLimit: 3, faab, addsThisWeek: 0, addsThisSeason: 0 });

  it('FAAB: highest bid wins, loser falls to their next claim', () => {
    const s = defaultSettings();
    const res = processWaivers(
      s,
      [
        { id: '1', teamId: 'A', addPlayerId: 'X', dropPlayerId: 'a1', bid: 30, rank: 1 },
        { id: '2', teamId: 'B', addPlayerId: 'X', dropPlayerId: 'b1', bid: 41, rank: 1 },
        { id: '3', teamId: 'A', addPlayerId: 'Y', dropPlayerId: 'a1', bid: 5, rank: 2 },
      ],
      [team('A', ['a1', 'a2', 'a3']), team('B', ['b1', 'b2', 'b3'])],
      ['A', 'B'],
    );
    expect(res.teams.B.roster).toContain('X');
    expect(res.teams.B.faab).toBe(59);
    expect(res.teams.A.roster).toContain('Y');
    expect(res.results.find((r) => r.claimId === '1')?.reason).toMatch(/Outbid by B \(\$41\)/);
  });

  it('FAAB: ties go to waiver priority', () => {
    const res = processWaivers(
      defaultSettings(),
      [
        { id: '1', teamId: 'A', addPlayerId: 'X', dropPlayerId: 'a1', bid: 10, rank: 1 },
        { id: '2', teamId: 'B', addPlayerId: 'X', dropPlayerId: 'b1', bid: 10, rank: 1 },
      ],
      [team('A', ['a1']), team('B', ['b1'])],
      ['B', 'A'],
    );
    expect(res.teams.B.roster).toContain('X');
    expect(res.priority).toEqual(['A', 'B']);
  });

  it('skips a claim whose drop player is already gone', () => {
    const res = processWaivers(
      defaultSettings(),
      [
        { id: '1', teamId: 'A', addPlayerId: 'X', dropPlayerId: 'a1', bid: 10, rank: 1 },
        { id: '2', teamId: 'A', addPlayerId: 'Y', dropPlayerId: 'a1', bid: 5, rank: 2 },
      ],
      [team('A', ['a1', 'a2', 'a3'])],
      ['A'],
    );
    expect(res.results.find((r) => r.claimId === '2')?.reason).toMatch(/already gone/);
  });

  it('rolling: top priority wins and moves to the back', () => {
    const s = defaultSettings();
    s.waivers.type = 'rolling';
    const res = processWaivers(
      s,
      [
        { id: '1', teamId: 'A', addPlayerId: 'X', dropPlayerId: 'a1', bid: 0, rank: 1 },
        { id: '2', teamId: 'B', addPlayerId: 'X', dropPlayerId: 'b1', bid: 0, rank: 1 },
        { id: '3', teamId: 'B', addPlayerId: 'Y', dropPlayerId: 'b1', bid: 0, rank: 2 },
      ],
      [team('A', ['a1']), team('B', ['b1'])],
      ['B', 'A'],
    );
    expect(res.teams.B.roster).toEqual(['X']);
    expect(res.priority).toEqual(['A', 'B']);
  });
});

describe('trades', () => {
  const s = settingsForFormat('dynasty');
  const teams = {
    A: { teamId: 'A', roster: ['a1', 'a2'], rosterLimit: 3, faab: 50 },
    B: { teamId: 'B', roster: ['b1', 'b2', 'b3'], rosterLimit: 3, faab: 20 },
  };
  const picks = createFuturePicks(['A', 'B'], 2027, 5, 4);

  it('validates and applies a player + pick + FAAB trade', () => {
    const trade: Trade = {
      id: 't1',
      week: 5,
      proposedBy: 'A',
      sides: [
        { teamId: 'A', players: [{ playerId: 'a1', to: 'B' }], picks: [{ pickId: '2028-1-A', to: 'B' }], faab: [{ amount: 10, to: 'B' }], drops: [] },
        { teamId: 'B', players: [{ playerId: 'b1', to: 'A' }], picks: [], faab: [], drops: [] },
      ],
    };
    expect(validateTrade(s, trade, teams, picks, 2026)).toEqual([]);
    const out = applyTrade(trade, teams, picks);
    expect(out.teams.A.roster).toEqual(['a2', 'b1']);
    expect(out.teams.B.faab).toBe(30);
    expect(out.picks.find((p) => p.id === '2028-1-A')?.ownerTeamId).toBe('B');
  });

  it('blocks picks past the future window, deadline and roster overflow', () => {
    const trade: Trade = {
      id: 't2',
      week: 13,
      proposedBy: 'A',
      sides: [
        { teamId: 'A', players: [], picks: [{ pickId: '2031-1-A', to: 'B' }], faab: [], drops: [] },
        { teamId: 'B', players: [{ playerId: 'b1', to: 'A' }, { playerId: 'b2', to: 'A' }], picks: [], faab: [], drops: [] },
      ],
    };
    const msgs = validateTrade(s, trade, teams, picks, 2026).map((i) => i.message).join(' | ');
    expect(msgs).toMatch(/deadline/);
    expect(msgs).toMatch(/3 seasons out/);
    expect(msgs).toMatch(/4 of 3/);
  });

  it('resolves review rules', () => {
    const c = defaultSettings();
    expect(tradeReviewOutcome(c, { approvals: [], vetoes: [] }, 12, 1)).toBe('pending');
    expect(tradeReviewOutcome(c, { approvals: [], vetoes: [], commissionerDecision: 'veto' }, 12, 1)).toBe('vetoed');
    const v = defaultSettings();
    v.trades.review = 'league_vote';
    expect(tradeReviewOutcome(v, { approvals: [], vetoes: ['1', '2', '3', '4', '5', '6'] }, 12, 1)).toBe('vetoed');
    expect(tradeReviewOutcome(v, { approvals: [], vetoes: ['1'] }, 12, 30)).toBe('processed');
  });
});

describe('projections and chat', () => {
  it('weights recent games more and blends last season', () => {
    const p = projectStatLine([{ rushYds: 100 }, { rushYds: 50 }], null);
    expect(p.rushYds).toBeGreaterThan(75);
    const q = projectStatLine([], { rushYds: 60 });
    expect(q.rushYds).toBe(60);
  });

  it('toggles reactions and writes event copy', () => {
    let m: ChatMessage = { id: '1', leagueId: 'L', author: { kind: 'coil' }, sentAt: '', text: 'hi', reactions: {} };
    m = toggleReaction(m, '🔥', 'u1');
    expect(m.reactions['🔥']).toEqual(['u1']);
    m = toggleReaction(m, '🔥', 'u1');
    expect(m.reactions['🔥']).toBeUndefined();
    expect(eventCopy({ type: 'close_win', winner: 'A', loser: 'B', margin: 0.32 })).toMatch(/0.32/);
  });
});
