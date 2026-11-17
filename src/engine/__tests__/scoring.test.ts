import { describe, expect, it } from 'vitest';

import { describeScoringChanges, getRowValue, isOverridden, SCORING_CATALOG, scoreStatLine, scoringFromPreset, setRowValue, clearOverride } from '..';
import { mapSleeperScoring } from '../../import/sleeper';

const rows = SCORING_CATALOG.flatMap((c) => c.sections.flatMap((s) => s.rows));

describe('scoring parity', () => {
  it('pays only the matching yardage range', () => {
    const r = scoringFromPreset('ppr');
    r.milestones.push({ stat: 'rushYds', min: 100, max: 199, points: 3 }, { stat: 'rushYds', min: 200, points: 6 });
    expect(scoreStatLine(r, 'RB', { rushYds: 150 }).total).toBe(18);
    expect(scoreStatLine(r, 'RB', { rushYds: 210 }).total).toBe(27);
  });

  it('scores combined rushing + receiving yard milestones', () => {
    const r = scoringFromPreset('standard');
    r.milestones.push({ stat: 'rushRecYds', min: 100, points: 2 });
    expect(scoreStatLine(r, 'RB', { rushYds: 60, recYds: 45 }).total).toBe(12.5);
  });

  it('pays big plays on any play or TDs only', () => {
    const r = scoringFromPreset('standard');
    r.bigPlays.push({ kind: 'rush', minYards: 40, points: 1, on: 'any' }, { kind: 'rush', minYards: 50, points: 2, on: 'td' });
    const res = scoreStatLine(r, 'RB', { rushYds: 100, rushTd: 1, rushYardsEach: [45, 55, 3], rushTdYards: [55] });
    expect(res.total).toBe(10 + 6 + 2 + 2);
  });

  it('adds catch-length bonuses on top of PPR', () => {
    const r = scoringFromPreset('ppr');
    r.catchLengthBonuses.push({ minYards: 0, points: 0 }, { minYards: 10, points: 0.5 }, { minYards: 20, points: 1 });
    expect(scoreStatLine(r, 'WR', { rec: 3, recYds: 37, recYardsEach: [4, 12, 21] }).total).toBe(3 + 3.7 + 1.5);
  });

  it('scores kickers by distance, per yard, and misses by distance', () => {
    const r = scoringFromPreset('standard');
    r.points.fgYdsOver30 = 0.1;
    r.fieldGoalMissTiers = [{ minYards: 0, points: -2 }, { minYards: 50, points: 0 }];
    // 3 (25) + 5 (52) + 2.2 past-30 yards, -2 for a 35-yard miss, 0 for a 55-yard miss.
    expect(scoreStatLine(r, 'K', { fgMadeYards: [25, 52], fgMissYards: [35, 55] }).total).toBe(8.2);
  });

  it('scores defenses on yards allowed and stops', () => {
    const r = scoringFromPreset('standard');
    const ya = rows.find((x) => x.kind === 'ya' && x.max === 299)!;
    setRowValue(r, ya, 2);
    r.points.def3AndOut = 0.5;
    // 14 points allowed = 1, 250 yards = 2, four three-and-outs = 2. Higher tiers stay 0, not 2.
    expect(scoreStatLine(r, 'DST', { pointsAllowed: 14, yardsAllowed: 250, def3AndOut: 4 }).total).toBe(5);
    expect(scoreStatLine(r, 'DST', { pointsAllowed: 14, yardsAllowed: 420 }).total).toBe(1);
  });

  it('derives total tackles for IDP bonuses', () => {
    const r = scoringFromPreset('idp');
    r.bonuses.push({ stat: 'idpTkl', threshold: 10, points: 2 });
    expect(scoreStatLine(r, 'LB', { idpSoloTkl: 7, idpAstTkl: 4 }).total).toBe(7 + 2 + 2);
  });

  it('reads and writes every catalog row', () => {
    const r = scoringFromPreset('ppr');
    for (const row of rows) {
      setRowValue(r, row, 1.5);
      expect(getRowValue(r, row)).toBe(1.5);
    }
    const te = rows.find((x) => x.kind === 'pos' && x.position === 'TE' && x.stat === 'rec')!;
    expect(isOverridden(r, te)).toBe(true);
    clearOverride(r, te);
    expect(isOverridden(r, te)).toBe(false);
  });

  it('describes what changed for the league notice', () => {
    const a = scoringFromPreset('half_ppr');
    const b = scoringFromPreset('ppr');
    b.positionOverrides.TE = { rec: 1.5 };
    expect(describeScoringChanges(a, b)).toEqual(['Catches: +0.5 → +1', 'TE catches: league default → +1.5']);
  });

  it('imports the full range of Sleeper scoring keys without warnings', () => {
    const warnings: string[] = [];
    const r = mapSleeperScoring(
      {
        pass_yd: 0.04, pass_td: 4, pass_int: -1, pass_int_td: -2, pass_cmp_40p: 1, pass_td_40p: 1, pass_td_50p: 1,
        rush_yd: 0.1, rush_td: 6, rush_40p: 1, rush_td_40p: 1, rec: 0.5, rec_yd: 0.1, rec_td: 6, rec_0_4: 0, rec_10_19: 0.25,
        bonus_rush_yd_100: 3, bonus_rush_yd_200: 6, bonus_rush_rec_yd_100: 1, bonus_pass_cmp_25: 1, bonus_rush_att_20: 1,
        bonus_fd_te: 0.5, rec_fd: 0.25, fgm_0_19: 3, fgm_50_59: 5, fgm_60p: 6, fgmiss_0_19: -2, fgm_yds_over_30: 0.1,
        pts_allow_0: 10, yds_allow_0_100: 5, yds_allow_550p: -5, tkl: 0.5, def_3_and_out: 0.5, def_4_and_stop: 1,
        idp_tkl: 1, bonus_tkl_10p: 2, bonus_def_int_td_50p: 2, st_ff: 1, def_st_tkl_solo: 0.5, fum_rec_td: 6,
      },
      warnings,
    );
    expect(warnings).toEqual([]);
    // 15 yards + 3 (100–199 range) + 1 (100+ rushing and receiving).
    expect(scoreStatLine(r, 'RB', { rushYds: 150 }).total).toBe(19);
    expect(scoreStatLine(r, 'RB', { rushYds: 250 }).total).toBe(25 + 6 + 1);
    expect(r.positionOverrides.TE?.rec1stDown).toBe(0.75);
    expect(r.yardsAllowedTiers.find((t) => t.max === 99)?.points).toBe(5);
  });
});
