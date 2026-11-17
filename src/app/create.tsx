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
import { ScoringEditor } from '../components/ScoringEditor';
import { SettingsEditor } from '../components/SettingsEditor';
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

      {section === 'scoring' ? (
        <ScoringEditor rules={s.scoring} baseline={SCORING_PRESETS[s.scoringPreset].rules} onChange={(r) => patch((d) => { d.scoring = r; })} />
      ) : null}

      {section !== 'scoring' ? <SettingsEditor section={section} s={s} patch={patch} /> : null}

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
