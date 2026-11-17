import { describe, expect, it } from 'vitest';

import { defaultSettings, describeSettingsChanges } from '../../engine';
import { SLEEPER_DEMO_USERNAME, sleeperDemoFetch } from '../../import/fixtures/sleeperDemo';
import { findSleeperLeagues } from '../../import/sleeper';
import { ageOf, buildDemoLeague, CURRENT_WEEK, DEMO_LEAGUE_SPECS, teamWeek, withRecomputedScores } from '../league';

describe('demo league', () => {
  const L = buildDemoLeague();

  it('scores every finished week from player stat lines', () => {
    expect(L.weeks).toHaveLength(CURRENT_WEEK - 1);
    const tw = teamWeek(L, 'T1', 3);
    expect(L.weeks[2].scores.T1).toBeCloseTo(tw.points, 2);
    expect(tw.maxPoints).toBeGreaterThanOrEqual(tw.points);
  });

  it('recalculates the season when scoring changes', () => {
    const before = L.standings.find((r) => r.teamId === 'T1')!.pointsFor;
    const ppr2 = { ...L, settings: { ...L.settings, scoring: { ...L.settings.scoring, points: { ...L.settings.scoring.points, rec: 2 } } } };
    const after = withRecomputedScores(ppr2).standings.find((r) => r.teamId === 'T1')!.pointsFor;
    expect(after).toBeGreaterThan(before);
  });

  it('only dynasty leagues have picks', () => {
    const office = buildDemoLeague(DEMO_LEAGUE_SPECS[1]);
    expect(L.picks.length).toBeGreaterThan(0);
    expect(office.picks).toHaveLength(0);
  });

  it('shows age to one decimal', () => {
    const p = Object.values(L.players)[0];
    expect(String(ageOf(p))).toMatch(/^\d{2}(\.\d)?$/);
  });
});

describe('settings notices', () => {
  it('describes changes in plain words', () => {
    const a = defaultSettings();
    const b = structuredClone(a);
    b.playoffs.teams = 4;
    b.matchups.medianGame = !a.matchups.medianGame;
    const out = describeSettingsChanges(a, b);
    expect(out).toContain(`Playoff teams: ${a.playoffs.teams} → 4`);
    expect(out.some((x) => x.startsWith('Median game'))).toBe(true);
  });
});

describe('sleeper username lookup', () => {
  it('finds a manager’s leagues', async () => {
    const res = await findSleeperLeagues(SLEEPER_DEMO_USERNAME, 2026, { fetch: sleeperDemoFetch });
    expect(res.leagues.map((l) => l.format)).toEqual(['Dynasty', 'Redraft']);
  });
  it('explains a bad username', async () => {
    await expect(findSleeperLeagues('nobody_here', 2026, { fetch: sleeperDemoFetch })).rejects.toThrow(/couldn't find/);
  });
});
