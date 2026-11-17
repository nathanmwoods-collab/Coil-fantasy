import { describe, expect, it } from 'vitest';

import { importEspnLeague, parseEspnLeagueId } from '../espn';
import { importMflLeague, mflName, parseMflLeagueId } from '../mfl';
import { ESPN_SAMPLE, MFL_SAMPLE } from '../fixtures/platformSamples';
import { importYahooLeague, parseYahooLeagues, yahooAuthUrl } from '../yahoo';

const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });

describe('ESPN import', () => {
  const raw = ESPN_SAMPLE;

  it('reads league links', () => {
    expect(parseEspnLeagueId('https://fantasy.espn.com/football/league?leagueId=123456&seasonId=2026')).toBe('123456');
    expect(parseEspnLeagueId('nope')).toBeNull();
  });

  it('maps settings, scoring, rosters and FAAB', async () => {
    const L = await importEspnLeague('123456', { season: 2026, fetch: () => ok(raw) });
    expect(L.name).toBe('Group Chat ESPN');
    expect(L.settings.roster).toMatchObject({ QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1, BN: 6, IR: 1 });
    expect(L.settings.scoring.points.rec).toBe(1);
    expect(L.settings.scoring.positionOverrides.TE?.rec).toBe(1.5);
    expect(L.settings.waivers.type).toBe('faab');
    expect(L.settings.playoffs.teams).toBe(4);
    const me = L.teams[0];
    expect(me).toMatchObject({ name: 'Rattle & Roll', ownerName: 'nate', faabRemaining: 163, waiverPosition: 3 });
    expect(me.players[0]).toMatchObject({ name: "Ja'Marr Chase", position: 'WR', nflTeam: 'CIN', slot: 'active' });
    expect(me.players[1].slot).toBe('IR');
    expect(L.teams[1].name).toBe('Tacos Al Pastor');
    expect(L.warnings.some((w) => w.includes('scoring rules'))).toBe(true);
  });

  it('explains a private league', async () => {
    await expect(importEspnLeague('123456', { season: 2026, fetch: () => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }) })).rejects.toThrow(/private/);
  });
});

describe('MFL import', () => {
  const responses = MFL_SAMPLE;
  const fetch = (url: string) => ok(responses[new URL(url).searchParams.get('TYPE')!]);

  it('reads links and names', () => {
    expect(parseMflLeagueId('https://www44.myfantasyleague.com/2026/home/38211')).toBe('38211');
    expect(mflName("Chase, Ja'Marr")).toBe("Ja'Marr Chase");
  });

  it('maps rosters, taxi, IR, contracts, superflex and traded picks', async () => {
    const L = await importMflLeague('38211', { season: 2026, fetch });
    expect(L.settings.format).toBe('dynasty');
    expect(L.settings.roster).toMatchObject({ QB: 1, RB: 2, WR: 3, TE: 1, SUPERFLEX: 1, FLEX: 2, BN: 15, IR: 2, TAXI: 3 });
    const me = L.teams[0];
    expect(me.players[0]).toMatchObject({ name: "Ja'Marr Chase", position: 'WR', contractYears: 2 });
    expect(me.players[1]).toMatchObject({ slot: 'TAXI', nflTeam: null });
    expect(L.teams[1].players[0]).toMatchObject({ slot: 'IR', position: 'K' });
    expect(me.faabRemaining).toBe(88);
    const traded = L.picks.find((p) => p.originalTeamId === 'F0002' && p.round === 1);
    expect(traded?.ownerTeamId).toBe('F0001');
  });
});

describe('Yahoo import', () => {
  it('builds a read-only sign-in link', () => {
    const u = new URL(yahooAuthUrl('abc', 'https://coil.app/yahoo', 's1'));
    expect(u.searchParams.get('scope')).toBe('fspt-r');
    expect(u.searchParams.get('response_type')).toBe('code');
  });

  it('lists leagues from the nested response', () => {
    const body = { fantasy_content: { users: { 0: { user: [{ guid: 'G' }, { games: { 0: { game: [{ game_key: '461', code: 'nfl' }, { leagues: { 0: { league: [{ league_key: '461.l.777', name: 'Yahoo Keepers', season: '2026', num_teams: 12, is_keeper: '1' }] }, count: 1 } }] }, count: 1 } }] }, count: 1 } } };
    expect(parseYahooLeagues(body)).toEqual([{ leagueKey: '461.l.777', name: 'Yahoo Keepers', season: '2026', teams: 12, format: 'Keeper' }]);
  });

  it('maps teams and rosters', async () => {
    const settings = { fantasy_content: { league: [[{ name: 'Yahoo Keepers' }, { num_teams: 12 }], { settings: [{ uses_faab: '1', num_playoff_teams: '6', roster_positions: [{ roster_position: { position: 'QB', count: 1 } }, { roster_position: { position: 'W/R/T', count: 1 } }, { roster_position: { position: 'BN', count: 6 } }] }] }] } };
    const roster = { fantasy_content: { league: [[{ name: 'Yahoo Keepers' }], { teams: { 0: { team: [[{ team_key: '461.l.777.t.1' }, { team_id: '1' }, { name: 'Rattle & Roll' }, [], { faab_balance: 50 }, { managers: [{ manager: { nickname: 'Nate', guid: 'G' } }] }], { roster: { 0: { players: { 0: { player: [[{ player_key: '461.p.1' }, { name: { full: 'Josh Allen' } }, { editorial_team_abbr: 'Buf' }, { display_position: 'QB' }], { selected_position: [{ coverage_type: 'week' }, { position: 'QB' }] }] }, count: 1 } } } }] }, count: 1 } }] } };
    const L = await importYahooLeague('461.l.777', 2026, async (path) => (path.includes('settings') ? settings : roster));
    expect(L.settings.roster).toMatchObject({ QB: 1, FLEX: 1, BN: 6 });
    expect(L.settings.waivers.type).toBe('faab');
    expect(L.teams[0]).toMatchObject({ name: 'Rattle & Roll', ownerName: 'Nate', faabRemaining: 50 });
    expect(L.teams[0].players[0]).toMatchObject({ name: 'Josh Allen', position: 'QB', nflTeam: 'BUF' });
  });
});
