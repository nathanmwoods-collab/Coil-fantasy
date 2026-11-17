// A made-up Sleeper league in Sleeper's public API shape. Used by tests and
// by the preview (which can't reach Sleeper), so the import flow can be tapped
// through end to end. IDs and names are fictional.

const LEAGUE_ID = '1180000000000000001';
const PREV_ID = '1050000000000000001';

const users = [
  ['u1', 'nate_rattles', 'Rattle & Roll'],
  ['u2', 'marisa', 'Tacos Al Pastor'],
  ['u3', 'devd', 'Fourth & Forever'],
  ['u4', 'grandpajoe', 'Hail Marys'],
].map(([user_id, display_name, team_name]) => ({ user_id, display_name, metadata: { team_name } }));

const rosters = [
  { roster_id: 1, owner_id: 'u1', players: ['p_ja_chase', 'p_jo_taylor', 'p_ma_nabers', 'p_rookie1'], reserve: ['p_ma_nabers'], taxi: ['p_rookie1'], settings: { wins: 7, losses: 3, fpts: 1290, fpts_decimal: 40, waiver_budget_used: 23 } },
  { roster_id: 2, owner_id: 'u2', players: ['p_bi_robinson', 'p_ce_lamb'], reserve: [], taxi: [], settings: { wins: 6, losses: 4, fpts: 1201, waiver_budget_used: 61 } },
  { roster_id: 3, owner_id: 'u3', players: ['p_ja_gibbs', 'p_pu_nacua'], reserve: [], taxi: [], settings: { wins: 4, losses: 6, fpts: 1105, waiver_budget_used: 0 } },
  { roster_id: 4, owner_id: 'u4', players: ['p_ch_mccaffrey', 'p_ju_jefferson'], reserve: [], taxi: [], settings: { wins: 3, losses: 7, fpts: 1012, waiver_budget_used: 100 } },
];

export const SLEEPER_DEMO_RESPONSES: Record<string, unknown> = {
  [`/league/${LEAGUE_ID}`]: {
    league_id: LEAGUE_ID,
    previous_league_id: PREV_ID,
    name: 'Group Chat Dynasty',
    season: '2026',
    status: 'in_season',
    total_rosters: 4,
    roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'BN', 'BN', 'BN', 'BN'],
    scoring_settings: { pass_yd: 0.04, pass_td: 4, pass_int: -2, rush_yd: 0.1, rush_td: 6, rec: 1, rec_yd: 0.1, rec_td: 6, fum_lost: -2, bonus_rec_te: 0.5, bonus_rush_yd_100: 3, pts_allow_0: 10, fgm_50p: 5, idp_mystery_stat: 1 },
    settings: { type: 2, num_teams: 4, playoff_teams: 2, playoff_week_start: 15, waiver_type: 2, waiver_budget: 100, trade_deadline: 11, taxi_slots: 2, taxi_years: 2, reserve_slots: 2, reserve_allow_out: 1, draft_rounds: 4 },
  },
  [`/league/${LEAGUE_ID}/rosters`]: rosters,
  [`/league/${LEAGUE_ID}/users`]: users,
  [`/league/${LEAGUE_ID}/traded_picks`]: [
    { season: '2027', round: 1, roster_id: 4, previous_owner_id: 4, owner_id: 1 },
    { season: '2028', round: 2, roster_id: 1, previous_owner_id: 1, owner_id: 3 },
  ],
  [`/league/${PREV_ID}`]: { league_id: PREV_ID, previous_league_id: null, name: 'Group Chat Dynasty', season: '2025' },
  [`/league/${PREV_ID}/rosters`]: rosters.map((r, i) => ({ ...r, settings: { wins: [9, 5, 8, 2][i], losses: [5, 9, 6, 12][i], fpts: [1700, 1500, 1650, 1300][i] } })),
  [`/league/${PREV_ID}/users`]: users,
  [`/league/${PREV_ID}/winners_bracket`]: [{ r: 2, m: 3, t1: 3, t2: 1, w: 3, l: 1, p: 1 }],
};

export const SLEEPER_DEMO_PLAYER_DB: Record<string, unknown> = {
  p_ja_chase: { first_name: "Ja'Marr", last_name: 'Chase', position: 'WR', team: 'CIN' },
  p_jo_taylor: { first_name: 'Jonathan', last_name: 'Taylor', position: 'RB', team: 'IND' },
  p_ma_nabers: { first_name: 'Malik', last_name: 'Nabers', position: 'WR', team: 'NYG' },
  p_rookie1: { first_name: 'Rookie', last_name: 'Stash', position: 'WR', team: 'FA' },
  p_bi_robinson: { first_name: 'Bijan', last_name: 'Robinson', position: 'RB', team: 'ATL' },
  p_ce_lamb: { first_name: 'CeeDee', last_name: 'Lamb', position: 'WR', team: 'DAL' },
  p_ja_gibbs: { first_name: 'Jahmyr', last_name: 'Gibbs', position: 'RB', team: 'DET' },
  p_pu_nacua: { first_name: 'Puka', last_name: 'Nacua', position: 'WR', team: 'LAR' },
  p_ch_mccaffrey: { first_name: 'Christian', last_name: 'McCaffrey', position: 'RB', team: 'SF' },
  p_ju_jefferson: { first_name: 'Justin', last_name: 'Jefferson', position: 'WR', team: 'MIN' },
};

export const SLEEPER_DEMO_LEAGUE_ID = LEAGUE_ID;
export const SLEEPER_DEMO_USERNAME = 'rattleandroll';

// User lookup and league list, in Sleeper's response shape.
SLEEPER_DEMO_RESPONSES[`/user/${SLEEPER_DEMO_USERNAME}`] = { user_id: 'u_demo_1', username: SLEEPER_DEMO_USERNAME, display_name: 'RattleAndRoll', avatar: null };
SLEEPER_DEMO_RESPONSES['/user/u_demo_1/leagues/nfl/2026'] = [
  { league_id: LEAGUE_ID, name: 'Group Chat Dynasty', season: '2026', total_rosters: 4, settings: { type: 2 }, avatar: null },
  { league_id: '999000111222', name: 'Work League (redraft)', season: '2026', total_rosters: 12, settings: { type: 0 }, avatar: null },
];

/** A fetch that answers from the fixture, so imports work offline. */
export const sleeperDemoFetch = async (url: string) => {
  const path = url.replace('https://api.sleeper.app/v1', '');
  const body = SLEEPER_DEMO_RESPONSES[path];
  return { ok: body !== undefined, status: body !== undefined ? 200 : 404, json: async () => body ?? null };
};
