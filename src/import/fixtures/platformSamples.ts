// Sample responses in ESPN's and MFL's exact shapes. Used by tests and by the preview's "try a sample" link.

export const ESPN_SAMPLE_LEAGUE_ID = '123456';
export const MFL_SAMPLE_LEAGUE_ID = '38211';

export const ESPN_SAMPLE = {
  id: 123456,
  seasonId: 2026,
  members: [{ id: '{A}', displayName: 'nate' }, { id: '{B}', displayName: 'marisa' }],
  settings: {
    name: 'Group Chat ESPN',
    size: 2,
    rosterSettings: { lineupSlotCounts: { 0: 1, 2: 2, 4: 2, 6: 1, 23: 1, 16: 1, 17: 1, 20: 6, 21: 1 } },
    scoringSettings: { scoringItems: [{ statId: 3, points: 0.04 }, { statId: 4, points: 4 }, { statId: 53, points: 1, pointsOverrides: { 6: 1.5 } }, { statId: 99, points: 3 }] },
    acquisitionSettings: { isUsingAcquisitionBudget: true, acquisitionBudget: 200 },
    scheduleSettings: { playoffTeamCount: 4, matchupPeriodCount: 14 },
    draftSettings: { type: 'SNAKE', keeperCount: 0 },
  },
  teams: [
    { id: 1, name: 'Rattle & Roll', primaryOwner: '{A}', owners: ['{A}'], record: { overall: { wins: 7, losses: 3, ties: 0, pointsFor: 1201.5, pointsAgainst: 1100 } }, transactionCounter: { acquisitionBudgetSpent: 37 }, waiverRank: 3,
      roster: { entries: [{ playerId: 4362628, lineupSlotId: 4, playerPoolEntry: { player: { fullName: "Ja'Marr Chase", defaultPositionId: 3, proTeamId: 4 } } }, { playerId: 1, lineupSlotId: 21, playerPoolEntry: { player: { fullName: 'Hurt Guy', defaultPositionId: 2, proTeamId: 33 } } }] } },
    { id: 2, location: 'Tacos', nickname: 'Al Pastor', primaryOwner: '{B}', owners: ['{B}'], roster: { entries: [] } },
  ],
};


export const MFL_SAMPLE: Record<string, unknown> = {
  league: { league: { name: 'Salary Dynasty', taxiSquad: '3', injuredReserve: '2', rosterSize: '25', lastRegularSeasonWeek: '14',
    starters: { count: '10', position: [{ name: 'QB', limit: '1-2' }, { name: 'RB', limit: '2-4' }, { name: 'WR', limit: '3-5' }, { name: 'TE', limit: '1-3' }] },
    franchises: { count: '2', franchise: [{ id: '0001', name: 'Rattle & Roll', owner_name: 'Nate', bbidAvailableBalance: '88' }, { id: '0002', name: 'Tacos', owner_name: 'Marisa', bbidAvailableBalance: '100' }] } } },
  rosters: { rosters: { franchise: [{ id: '0001', player: [{ id: '13604', status: 'ROSTER', contractYear: '2' }, { id: '15000', status: 'TAXI_SQUAD' }] }, { id: '0002', player: { id: '14000', status: 'INJURED_RESERVE' } }] } },
  players: { players: { player: [{ id: '13604', name: "Chase, Ja'Marr", position: 'WR', team: 'CIN' }, { id: '15000', name: 'Rookie, Young', position: 'RB', team: 'FA' }, { id: '14000', name: 'Hurt, Guy', position: 'PK', team: 'BAL' }] } },
  futureDraftPicks: { futureDraftPicks: { franchise: [{ id: '0001', futureDraftPick: [{ year: '2027', round: '1', originalPickFor: '0001' }, { year: '2027', round: '1', originalPickFor: '0002' }] }, { id: '0002', futureDraftPick: { year: '2027', round: '2', originalPickFor: '0002' } }] } },
};

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
export const espnSampleFetch = () => ok(ESPN_SAMPLE);
export const mflSampleFetch = (url: string) => ok(MFL_SAMPLE[new URL(url).searchParams.get('TYPE') ?? '']);
