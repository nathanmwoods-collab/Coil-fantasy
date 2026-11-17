import { describe, expect, it } from 'vitest';

import { claimTeam, migrationMessage, migrationProgress, startMigration } from '../migrate';
import { importSleeperLeague, parseSleeperLeagueId } from '../sleeper';
import { createPlayerMatcher, importFromText, parseRosterText } from '../text';
import { SLEEPER_DEMO_LEAGUE_ID, SLEEPER_DEMO_PLAYER_DB, sleeperDemoFetch } from '../fixtures/sleeperDemo';
import { seededRandom, scoreStatLine, type Player } from '../../engine';

describe('Sleeper import', () => {
  it('parses IDs from links', () => {
    expect(parseSleeperLeagueId('https://sleeper.com/leagues/1180000000000000001/team')).toBe('1180000000000000001');
    expect(parseSleeperLeagueId('nope')).toBeNull();
  });

  it('imports settings, rosters, IR, taxi, FAAB, traded picks and history', async () => {
    const l = await importSleeperLeague(SLEEPER_DEMO_LEAGUE_ID, { fetch: sleeperDemoFetch, playerDb: SLEEPER_DEMO_PLAYER_DB });
    expect(l.settings.format).toBe('dynasty');
    expect(l.settings.roster).toMatchObject({ QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 1, BN: 4, IR: 2, TAXI: 2 });
    expect(l.settings.irEligible).toEqual(['ir', 'out']);
    expect(l.settings.waivers.type).toBe('faab');
    expect(l.settings.trades.deadlineWeek).toBe(11);
    expect(l.settings.playoffs).toMatchObject({ teams: 2, startWeek: 15 });

    const me = l.teams[0];
    expect(me.name).toBe('Rattle & Roll');
    expect(me.faabRemaining).toBe(77);
    expect(me.players.find((p) => p.sourcePlayerId === 'p_ma_nabers')?.slot).toBe('IR');
    expect(me.players.find((p) => p.sourcePlayerId === 'p_rookie1')?.slot).toBe('TAXI');
    expect(me.players[0].name).toBe("Ja'Marr Chase");

    expect(l.picks.find((p) => p.id === '2027-1-sleeper:4')?.ownerTeamId).toBe('sleeper:1');
    expect(l.picks.find((p) => p.id === '2028-2-sleeper:1')?.ownerTeamId).toBe('sleeper:3');
    expect(l.picks).toHaveLength(3 * 4 * 4);

    expect(l.history).toHaveLength(1);
    expect(l.history[0]).toMatchObject({ season: 2025, championName: 'Fourth & Forever', runnerUpName: 'Rattle & Roll' });

    // Scoring: TE premium and 100-yard bonus came across; unknown rules are flagged.
    expect(scoreStatLine(l.settings.scoring, 'TE', { rec: 4 }).total).toBe(6);
    expect(scoreStatLine(l.settings.scoring, 'RB', { rushYds: 100 }).total).toBe(13);
    expect(l.warnings.join(' ')).toMatch(/idp_mystery_stat/);
  });

  it('explains a bad link in plain words', async () => {
    await expect(importSleeperLeague('hello', { fetch: sleeperDemoFetch })).rejects.toThrow(/doesn’t look like/);
  });
});

const players: Player[] = [
  { id: 'a', name: "Ja'Marr Chase", position: 'WR', nflTeam: 'CIN' },
  { id: 'b', name: 'Josh Allen', position: 'QB', nflTeam: 'BUF' },
  { id: 'c', name: 'Josh Allen', position: 'LB', nflTeam: 'JAX' },
  { id: 'd', name: 'Kenneth Walker III', position: 'RB', nflTeam: 'SEA' },
  { id: 'e', name: 'Bills D/ST', position: 'DST', nflTeam: 'BUF' },
  { id: 'f', name: 'Travis Kelce', position: 'TE', nflTeam: 'KC' },
];

describe('paste import', () => {
  it('matches typos, suffixes, nicknames and defenses', () => {
    const m = createPlayerMatcher(players);
    expect(m('Jamarr Chase').player?.id).toBe('a');
    expect(m('Kenneth Walker').player?.id).toBe('d');
    expect(m('BUF DST').player?.id).toBe('e');
    expect(m('Travis Kelse').confidence).toBe('close');
    expect(m('Josh Allen').confidence).toBe('ambiguous');
    expect(m('Josh Allen', { position: 'QB' }).player?.id).toBe('b');
  });

  it('parses teams, IR, taxi, keepers, picks and FAAB', () => {
    const [t] = parseRosterText('Tacos (Marisa)\n1. Jamarr Chase\nKenneth Walker (IR)\nTravis Kelce - keeper rd 3\n2027 1st\n2028 2nd (via Hail Marys)\nFAAB: $41');
    expect(t).toMatchObject({ name: 'Tacos', ownerName: 'Marisa', faab: 41 });
    expect(t.players.map((p) => [p.name, p.slot, p.keeperRound])).toEqual([
      ['Jamarr Chase', 'active', undefined],
      ['Kenneth Walker', 'IR', undefined],
      ['Travis Kelce', 'active', 3],
    ]);
    expect(t.picks).toEqual([
      { season: 2027, round: 1, viaTeamName: null },
      { season: 2028, round: 2, viaTeamName: 'Hail Marys' },
    ]);
  });

  it('builds teams and moves traded picks', () => {
    const res = importFromText('Tacos\nJamarr Chase\n2028 2nd (via Hail Marys)\n\nHail Marys\nJosh Allen\nTravis Kelce', players, { firstPickSeason: 2027, pickSeasons: 2, rounds: 3 });
    expect(res.teams).toHaveLength(2);
    expect(res.needsReview.map((n) => n.raw)).toEqual(['Josh Allen']);
    expect(res.picks.find((p) => p.id === '2028-2-text:2')?.ownerTeamId).toBe('text:1');
  });
});

describe('migration', () => {
  it('makes claim links and lets each manager claim once', async () => {
    const l = await importSleeperLeague(SLEEPER_DEMO_LEAGUE_ID, { fetch: sleeperDemoFetch, playerDb: SLEEPER_DEMO_PLAYER_DB });
    let m = startMigration(l, 'L9', 'commish', 'sleeper:1', seededRandom(1));
    expect(migrationProgress(m)).toMatchObject({ claimed: 1, total: 4 });
    expect(migrationMessage(m, l.name, 'https://example.test/join').split('\n')).toHaveLength(2 + 3);
    const code = m.claims[1].code;
    const r1 = claimTeam(m, code.toLowerCase(), 'marisa');
    expect(r1.error).toBeUndefined();
    m = r1.migration;
    expect(claimTeam(m, code, 'someone_else').error).toBe('already_claimed');
    expect(claimTeam(m, m.claims[2].code, 'marisa').error).toBe('user_has_team');
    expect(claimTeam(m, 'ZZZZZZ', 'x').error).toBe('bad_code');
  });
});
