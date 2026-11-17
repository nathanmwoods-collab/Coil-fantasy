import { View } from 'react-native';

import {
  injuryTag,
  playoffEndWeek,
  rosterSize,
  SLOT_LABELS,
  type InjuryStatus,
  type LeagueSettings,
  type SlotType,
} from '../engine';
import { type } from '../theme/type';
import { Chip, Card, Row, Stepper, T } from './ui';

export type SettingsSection = 'roster' | 'draft' | 'moves' | 'playoffs';

const SLOTS: SlotType[] = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX', 'WR_TE', 'WR_RB', 'K', 'DST', 'DL', 'LB', 'DB', 'IDP_FLEX', 'BN', 'IR', 'TAXI'];
const IR_OPTIONS: InjuryStatus[] = ['ir', 'out', 'doubtful', 'questionable', 'pup', 'nfi', 'suspended', 'covid'];

/** The editable settings cards, shared by league creation and league settings. */
export function SettingsEditor({ section, s, patch }: { section: SettingsSection; s: LeagueSettings; patch: (fn: (d: LeagueSettings) => void) => void }) {
  return (
    <>
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

    </>
  );
}
