import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, c, Card, Chip, H1, H2, Input, Row, Screen, Segmented, Stepper, T } from '../components/ui';
import {
  injuryTag,
  playoffEndWeek,
  rosterSize,
  SCORING_PRESETS,
  scoringFromPreset,
  settingsForFormat,
  SLOT_LABELS,
  validateSettings,
  type InjuryStatus,
  type LeagueFormat,
  type LeagueSettings,
  type ScoringPresetKey,
  type SlotType,
  type StatKey,
} from '../engine';
import { useApp } from '../store/useApp';
import { type } from '../theme/type';

const FORMATS: { key: LeagueFormat; label: string; blurb: string }[] = [
  { key: 'redraft', label: 'Redraft', blurb: 'Fresh draft every year. The classic.' },
  { key: 'keeper', label: 'Keeper', blurb: 'Keep a few players, pay for them with a draft pick.' },
  { key: 'dynasty', label: 'Dynasty', blurb: 'Keep everyone forever. Rookie drafts, taxi squads, picks years out.' },
  { key: 'bestball', label: 'Best ball', blurb: 'Draft and done. Your best lineup scores itself every week.' },
];

const SLOTS: SlotType[] = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX', 'WR_TE', 'WR_RB', 'K', 'DST', 'DL', 'LB', 'DB', 'IDP_FLEX', 'BN', 'IR', 'TAXI'];

const SCORING_ROWS: { stat: StatKey; label: string; hint: string; step: number; perYard?: number }[] = [
  { stat: 'rec', label: 'Per catch', hint: '1 = full PPR, 0.5 = half', step: 0.25 },
  { stat: 'passTd', label: 'Passing TD', hint: '4 or 6 are common', step: 1 },
  { stat: 'passYds', label: 'Passing yards', hint: 'Yards per point', step: 5, perYard: 1 },
  { stat: 'passInt', label: 'Interception thrown', hint: 'Usually -1 or -2', step: 1 },
  { stat: 'rushYds', label: 'Rushing yards', hint: 'Yards per point', step: 1, perYard: 1 },
  { stat: 'recYds', label: 'Receiving yards', hint: 'Yards per point', step: 1, perYard: 1 },
  { stat: 'rushTd', label: 'Rushing TD', hint: '', step: 1 },
  { stat: 'recTd', label: 'Receiving TD', hint: '', step: 1 },
  { stat: 'fumLost', label: 'Fumble lost', hint: '', step: 1 },
  { stat: 'rush1stDown', label: 'Rushing first down', hint: 'Popular in deeper leagues', step: 0.25 },
  { stat: 'rec1stDown', label: 'Receiving first down', hint: '', step: 0.25 },
];

const IR_OPTIONS: InjuryStatus[] = ['ir', 'out', 'doubtful', 'questionable', 'pup', 'nfi', 'suspended', 'covid'];

export default function Create() {
  const save = useApp((s) => s.saveLeague);
  const toast = useApp((s) => s.showToast);
  const [step, setStep] = useState<1 | 2>(1);
  const [s, setS] = useState<LeagueSettings>(() => settingsForFormat('redraft'));
  const [section, setSection] = useState<'scoring' | 'roster' | 'draft' | 'moves' | 'playoffs'>('scoring');
  const issues = useMemo(() => validateSettings(s), [s]);
  const errors = issues.filter((i) => i.severity === 'error');

  const patch = (fn: (d: LeagueSettings) => void) =>
    setS((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });

  if (step === 1) {
    return (
      <Screen>
        <Back />
        <H1 kicker="New league · 1 of 2">What kind of league?</H1>
        {FORMATS.map((f) => (
          <Card key={f.key} highlight={s.format === f.key} onPress={() => setS({ ...settingsForFormat(f.key, s.teams), name: s.name })}>
            <T style={type.title}>{f.label}</T>
            <T muted style={{ marginTop: 2 }}>{f.blurb}</T>
          </Card>
        ))}
        <H2>Name and size</H2>
        <Input value={s.name} onChangeText={(name) => setS({ ...s, name })} placeholder="League name" />
        <Card style={{ marginTop: 10 }}>
          <Row label="Teams" hint="2 to 32. Odd numbers are fine.">
            <Stepper value={s.teams} min={2} max={32} onChange={(teams) => patch((d) => { d.teams = teams; d.playoffs.teams = Math.min(d.playoffs.teams, teams); })} />
          </Row>
          <View style={{ paddingTop: 12 }}>
            <T style={type.bodyStrong}>Scoring</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
              {(Object.keys(SCORING_PRESETS) as ScoringPresetKey[]).map((k) => (
                <Chip key={k} label={SCORING_PRESETS[k].label} active={s.scoringPreset === k} onPress={() => patch((d) => { d.scoringPreset = k; d.scoring = scoringFromPreset(k); if (k === 'superflex_ppr') d.roster.SUPERFLEX = Math.max(1, d.roster.SUPERFLEX ?? 0); if (k === 'idp') { d.roster.DL = 2; d.roster.LB = 2; d.roster.DB = 2; } })} />
              ))}
            </View>
            <T muted style={type.small}>{SCORING_PRESETS[s.scoringPreset].blurb}</T>
          </View>
        </Card>
        <View style={{ height: 12 }} />
        <Button label="Looks good, next" onPress={() => setStep(2)} />
        <T muted style={[type.small, { textAlign: 'center', marginTop: 10 }]}>Everything else has a sensible default. You can change any of it next.</T>
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => setStep(1)}>
        <T muted style={type.smallStrong}>‹ Back</T>
      </Pressable>
      <H1 kicker="New league · 2 of 2">Make it yours</H1>
      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { key: 'scoring', label: 'Scoring' },
          { key: 'roster', label: 'Roster' },
          { key: 'draft', label: 'Draft' },
          { key: 'moves', label: 'Moves' },
          { key: 'playoffs', label: 'Playoffs' },
        ]}
      />

      {section === 'scoring' && (
        <Card>
          {SCORING_ROWS.map((r) => {
            const v = s.scoring.points[r.stat] ?? 0;
            if (r.perYard) {
              const yardsPerPoint = v ? Math.round(1 / v) : 0;
              return (
                <Row key={r.stat} label={r.label} hint={`${yardsPerPoint} yards = 1 point`}>
                  <Stepper value={yardsPerPoint} min={1} max={100} step={r.step} onChange={(y) => patch((d) => { d.scoring.points[r.stat] = Math.round((1 / y) * 10000) / 10000; })} />
                </Row>
              );
            }
            return (
              <Row key={r.stat} label={r.label} hint={r.hint}>
                <Stepper value={v} min={-10} max={12} step={r.step} onChange={(n) => patch((d) => { d.scoring.points[r.stat] = n; })} />
              </Row>
            );
          })}
          <Row label="TE premium" hint="Extra per catch for tight ends only">
            <Stepper
              value={(s.scoring.positionOverrides.TE?.rec ?? s.scoring.points.rec ?? 0) - (s.scoring.points.rec ?? 0)}
              min={0}
              max={2}
              step={0.25}
              onChange={(n) => patch((d) => { d.scoring.positionOverrides.TE = { ...d.scoring.positionOverrides.TE, rec: (d.scoring.points.rec ?? 0) + n }; })}
            />
          </Row>
          <Row label="100-yard bonus" hint="Rushing or receiving">
            <Stepper
              value={s.scoring.bonuses.find((b) => b.stat === 'rushYds' && b.threshold === 100)?.points ?? 0}
              min={0}
              max={10}
              onChange={(n) =>
                patch((d) => {
                  d.scoring.bonuses = d.scoring.bonuses.filter((b) => !(b.threshold === 100 && (b.stat === 'rushYds' || b.stat === 'recYds')));
                  if (n) d.scoring.bonuses.push({ stat: 'rushYds', threshold: 100, points: n }, { stat: 'recYds', threshold: 100, points: n });
                })
              }
            />
          </Row>
          <Row label="Median game" hint="Everyone also plays the league median each week">
            <Chip label={s.matchups.medianGame ? 'On' : 'Off'} active={s.matchups.medianGame} onPress={() => patch((d) => { d.matchups.medianGame = !d.matchups.medianGame; })} />
          </Row>
          <T muted style={[type.small, { marginTop: 10 }]}>Need more? Every stat, bonus tier, kicker distance and defense tier is editable in league settings.</T>
        </Card>
      )}

      {section === 'roster' && (
        <Card>
          {SLOTS.map((slot) => (
            <Row key={slot} label={slot === 'BN' ? 'Bench' : slot === 'IR' ? 'Injured reserve' : slot === 'TAXI' ? 'Taxi squad' : SLOT_LABELS[slot]}>
              <Stepper value={s.roster[slot] ?? 0} min={0} max={slot === 'BN' ? 30 : 10} onChange={(n) => patch((d) => { d.roster[slot] = n; if (slot === 'TAXI') d.dynasty.taxiSlots = n; })} />
            </Row>
          ))}
          {(s.roster.IR ?? 0) > 0 ? (
            <View style={{ marginTop: 12 }}>
              <T style={type.bodyStrong}>Who can go on IR?</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                {IR_OPTIONS.map((st) => (
                  <Chip key={st} label={`${injuryTag(st).code} · ${injuryTag(st).label}`} active={s.irEligible.includes(st)} onPress={() => patch((d) => { d.irEligible = d.irEligible.includes(st) ? d.irEligible.filter((x) => x !== st) : [...d.irEligible, st]; })} />
                ))}
              </View>
            </View>
          ) : null}
          <T muted style={[type.small, { marginTop: 10 }]}>{rosterSize(s.roster)} roster spots plus IR and taxi.</T>
        </Card>
      )}

      {section === 'draft' && (
        <Card>
          <T style={type.bodyStrong}>Draft type</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 6 }}>
            {(['snake', 'linear', 'third_round_reversal', 'auction'] as const).map((t) => (
              <Chip key={t} label={{ snake: 'Snake', linear: 'Linear', third_round_reversal: '3rd-round reversal', auction: 'Auction' }[t]} active={s.draft.type === t} onPress={() => patch((d) => { d.draft.type = t; })} />
            ))}
          </View>
          <Row label="Rounds">
            <Stepper value={s.draft.rounds} min={1} max={40} onChange={(n) => patch((d) => { d.draft.rounds = n; })} />
          </Row>
          <Row label="Pick timer" hint={s.draft.pickTimerSec === null ? 'No timer' : undefined}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
              {[
                [30, '30s'],
                [60, '1m'],
                [90, '90s'],
                [3600, '1h'],
                [28800, '8h'],
                [null, 'None'],
              ].map(([v, l]) => (
                <Chip key={String(l)} label={String(l)} active={s.draft.pickTimerSec === v} onPress={() => patch((d) => { d.draft.pickTimerSec = v as number | null; })} />
              ))}
            </View>
          </Row>
          <Row label="Draft order">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 220 }}>
              {(['random', 'manual', 'lottery'] as const).map((o) => (
                <Chip key={o} label={o === 'random' ? 'Random reveal' : o === 'manual' ? 'Set it myself' : 'Lottery'} active={s.draft.orderMethod === o} onPress={() => patch((d) => { d.draft.orderMethod = o; })} />
              ))}
            </View>
          </Row>
          {s.draft.type === 'auction' ? (
            <Row label="Auction budget">
              <Stepper value={s.draft.auction.budget} min={10} max={1000} step={10} format={(v) => `$${v}`} onChange={(n) => patch((d) => { d.draft.auction.budget = n; })} />
            </Row>
          ) : null}
          <Row label="Pause overnight" hint="For slow drafts">
            <Chip label={s.draft.overnightPause.enabled ? 'On' : 'Off'} active={s.draft.overnightPause.enabled} onPress={() => patch((d) => { d.draft.overnightPause.enabled = !d.draft.overnightPause.enabled; })} />
          </Row>
          <Row label="In-person draft" hint="Commish types the picks in">
            <Chip label={s.draft.offline ? 'On' : 'Off'} active={s.draft.offline} onPress={() => patch((d) => { d.draft.offline = !d.draft.offline; })} />
          </Row>
        </Card>
      )}

      {section === 'moves' && (
        <Card>
          <T style={type.bodyStrong}>Waivers</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {(['faab', 'rolling', 'reverse_standings'] as const).map((w) => (
              <Chip key={w} label={w === 'faab' ? 'FAAB bidding' : w === 'rolling' ? 'Rolling' : 'Reverse standings'} active={s.waivers.type === w} onPress={() => patch((d) => { d.waivers.type = w; })} />
            ))}
          </View>
          {s.waivers.type === 'faab' ? (
            <>
              <Row label="FAAB budget">
                <Stepper value={s.waivers.faabBudget} min={0} max={1000} step={10} format={(v) => `$${v}`} onChange={(n) => patch((d) => { d.waivers.faabBudget = n; })} />
              </Row>
              <Row label="$0 bids allowed">
                <Chip label={s.waivers.allowZeroBids ? 'Yes' : 'No'} active={s.waivers.allowZeroBids} onPress={() => patch((d) => { d.waivers.allowZeroBids = !d.waivers.allowZeroBids; })} />
              </Row>
            </>
          ) : null}
          <Row label="Waiver period" hint="Days a dropped player waits">
            <Stepper value={s.waivers.holdDays} min={0} max={7} onChange={(n) => patch((d) => { d.waivers.holdDays = n; })} />
          </Row>
          <View style={{ height: 14 }} />
          <T style={type.bodyStrong}>Trades</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
            {(['none', 'commissioner', 'league_vote'] as const).map((r) => (
              <Chip key={r} label={r === 'none' ? 'No review' : r === 'commissioner' ? 'Commish approves' : 'League vote'} active={s.trades.review === r} onPress={() => patch((d) => { d.trades.review = r; })} />
            ))}
          </View>
          <Row label="Trade deadline" hint={s.trades.deadlineWeek === null ? 'No deadline' : `After week ${s.trades.deadlineWeek}`}>
            <Stepper value={s.trades.deadlineWeek ?? 0} min={0} max={17} onChange={(n) => patch((d) => { d.trades.deadlineWeek = n || null; })} />
          </Row>
          <Row label="Trade future picks" hint="Seasons ahead">
            <Stepper value={s.trades.futurePickSeasons} min={0} max={5} onChange={(n) => patch((d) => { d.trades.futurePickSeasons = n; })} />
          </Row>
        </Card>
      )}

      {section === 'playoffs' && (
        <Card>
          <Row label="Playoff teams">
            <Stepper value={s.playoffs.teams} min={0} max={Math.min(16, s.teams)} onChange={(n) => patch((d) => { d.playoffs.teams = n; })} />
          </Row>
          <Row label="Playoffs start" hint={s.playoffs.teams ? `Final in week ${playoffEndWeek(s)}` : undefined}>
            <Stepper value={s.playoffs.startWeek} min={2} max={18} format={(v) => `Wk ${v}`} onChange={(n) => patch((d) => { d.playoffs.startWeek = n; d.regularSeasonWeeks = n - 1; })} />
          </Row>
          <Row label="Two-week rounds">
            <Chip label={s.playoffs.weeksPerRound === 2 ? 'On' : 'Off'} active={s.playoffs.weeksPerRound === 2} onPress={() => patch((d) => { d.playoffs.weeksPerRound = d.playoffs.weeksPerRound === 2 ? 1 : 2; })} />
          </Row>
          <Row label="Reseed each round">
            <Chip label={s.playoffs.reseed ? 'On' : 'Off'} active={s.playoffs.reseed} onPress={() => patch((d) => { d.playoffs.reseed = !d.playoffs.reseed; })} />
          </Row>
          <Row label="Toilet bowl" hint="Last place earns the league punishment">
            <Chip label={s.playoffs.toiletBowl ? 'On' : 'Off'} active={s.playoffs.toiletBowl} onPress={() => patch((d) => { d.playoffs.toiletBowl = !d.playoffs.toiletBowl; })} />
          </Row>
        </Card>
      )}

      {issues.length ? (
        <Card style={{ borderColor: errors.length ? c.danger : '#FFB547' }}>
          {issues.map((i, k) => (
            <T key={k} style={{ color: i.severity === 'error' ? c.danger : '#FFB547', marginBottom: 4 }}>
              {i.severity === 'error' ? '✕ ' : '! '}
              {i.message}
            </T>
          ))}
        </Card>
      ) : null}

      <View style={{ height: 8 }} />
      <Button
        label={errors.length ? 'Fix the red items to continue' : 'Create league and invite friends'}
        disabled={errors.length > 0}
        onPress={() => {
          save(s);
          toast(`${s.name} is ready. Invite link copied.`);
          router.replace('/');
        }}
      />
    </Screen>
  );
}

function Back() {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
      <T muted style={type.smallStrong}>‹ Home</T>
    </Pressable>
  );
}
