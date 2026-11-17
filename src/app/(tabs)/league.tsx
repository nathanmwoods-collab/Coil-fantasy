import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { LeagueHeader, TeamAvatar } from '../../components/league';
import { draftSummary, irSummary, playoffSummary, rosterSummary, scoringSummary, tradeSummary, waiverSummary } from '../../components/summaries';
import { Button, c, Card, H2, Screen, Segmented, T } from '../../components/ui';
import { CURRENT_WEEK, ME, teamWeek, type TeamWeek } from '../../demo/league';
import { winProbability } from '../../demo/games';
import { pickLabel } from '../../engine';
import { isCommish, useApp } from '../../store/useApp';
import { type } from '../../theme/type';

type Tab = 'standings' | 'matchups' | 'picks' | 'rules';

export default function League() {
  const L = useApp((s) => s.league);
  const [tab, setTab] = useState<Tab>('standings');
  const dynasty = L.settings.format === 'dynasty';
  const commish = isCommish(L);
  const team = (id: string) => L.teams.find((t) => t.id === id)!;
  const playoffTeams = L.settings.playoffs.teams;

  const thisWeek = useMemo(() => L.schedule.filter((m) => m.week === CURRENT_WEEK), [L]);
  const weekly = useMemo(() => Object.fromEntries(L.teams.map((t) => [t.id, teamWeek(L, t.id, CURRENT_WEEK)])) as Record<string, TeamWeek>, [L]);
  const mine = thisWeek.find((m) => m.home === ME || m.away === ME);
  const shownTab: Tab = tab === 'picks' && !dynasty ? 'standings' : tab;

  const options: { key: Tab; label: string }[] = [
    { key: 'standings', label: 'Standings' },
    { key: 'matchups', label: 'Matchups' },
    ...(dynasty ? [{ key: 'picks' as Tab, label: 'Picks' }] : []),
    { key: 'rules', label: 'Rules' },
  ];

  return (
    <Screen>
      <LeagueHeader sub={`Week ${CURRENT_WEEK}`} />

      {mine ? <MatchupCard L={L} home={mine.home === ME ? mine.home : mine.away} away={mine.home === ME ? mine.away : mine.home} weekly={weekly} big /> : null}

      <View style={{ marginTop: 10 }}>
        <Segmented value={shownTab} onChange={setTab} options={options} />
      </View>

      {shownTab === 'standings' && <Standings />}

      {shownTab === 'matchups' && thisWeek.map((m) => <MatchupCard key={m.home} L={L} home={m.home} away={m.away} weekly={weekly} />)}

      {shownTab === 'picks' && (
        <>
          <Button label="Build a trade" onPress={() => router.push('/trade')} />
          {[...new Set(L.picks.map((p) => p.season))].map((season) => (
            <View key={season}>
              <H2>{season} rookie draft</H2>
              <Card style={{ padding: 0 }}>
                {L.teams.map((t) => {
                  const owned = L.picks.filter((p) => p.season === season && p.ownerTeamId === t.id).sort((a, b) => a.round - b.round);
                  return (
                    <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: t.id === ME ? '#7C5CFF22' : undefined }}>
                      <TeamAvatar team={t} size={24} />
                      <T style={[type.smallStrong, { width: 120 }]} numberOfLines={1}>{t.name}</T>
                      <T muted style={[type.small, { flex: 1 }]}>
                        {owned.length ? owned.map((p) => pickLabel(p, (id) => team(id).name).replace(`${season} `, '')).join(', ') : 'No picks'}
                      </T>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}
        </>
      )}

      {shownTab === 'rules' && (
        <>
          <Card style={{ paddingVertical: 4 }}>
            {(
              [
                ['Scoring', scoringSummary(L.settings.scoring), '/settings/scoring'],
                ['Roster', rosterSummary(L.settings), '/settings/roster'],
                ['Injured reserve', irSummary(L.settings), '/settings/roster'],
                ...(dynasty ? [['Taxi squad', `${L.settings.dynasty.taxiSlots} spots, players in their first ${L.settings.dynasty.taxiMaxYearsPro + 1} seasons`, '/settings/roster']] : []),
                ['Waivers', waiverSummary(L.settings), '/settings/moves'],
                ['Trades', tradeSummary(L.settings), '/settings/moves'],
                ['Playoffs', playoffSummary(L.settings), '/settings/playoffs'],
                ['Draft', draftSummary(L.settings), '/settings/draft'],
              ] as [string, string, string][]
            ).map(([k, v, href]) => (
              <Pressable key={k} onPress={() => router.push(href as never)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <View style={{ flex: 1 }}>
                  <T muted style={type.small}>{k}</T>
                  <T>{v}</T>
                </View>
                <T muted style={type.smallStrong}>{commish ? 'Edit ›' : '›'}</T>
              </Pressable>
            ))}
          </Card>
          <T muted style={[type.micro, { textAlign: 'center' }]}>
            {commish ? "You're a commissioner. Any change you save is posted in league chat so nobody is surprised." : 'Only commissioners can change rules. Every change shows up in league chat.'}
          </T>
        </>
      )}
    </Screen>
  );
}

function MatchupCard({ L, home, away, weekly, big }: { L: ReturnType<typeof useApp.getState>['league']; home: string; away: string; weekly: Record<string, TeamWeek>; big?: boolean }) {
  const a = weekly[home];
  const b = weekly[away];
  const ta = L.teams.find((t) => t.id === home)!;
  const tb = L.teams.find((t) => t.id === away)!;
  const p = winProbability(a.liveProjected, b.liveProjected, (a.remaining + b.remaining) / 2);
  const side = (t: typeof ta, w: TeamWeek, right: boolean, leading: boolean) => (
    <View style={{ flex: 1, alignItems: right ? 'flex-end' : 'flex-start' }}>
      <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <TeamAvatar team={t} size={big ? 36 : 28} />
        <View style={{ alignItems: right ? 'flex-end' : 'flex-start', flexShrink: 1 }}>
          <T style={type.bodyStrong} numberOfLines={1}>{t.name}</T>
          <T muted style={type.micro}>{t.manager}</T>
        </View>
      </View>
      <T style={[big ? type.display32 : [type.num, { fontSize: 20 }], { color: leading ? (t.id === ME ? c.primary : c.text) : c.textMuted, marginTop: 6 }]}>{w.points.toFixed(2)}</T>
      <T muted style={type.micro}>proj {w.liveProjected.toFixed(2)}</T>
    </View>
  );
  return (
    <Card highlight={big} onPress={() => router.push({ pathname: '/matchup', params: { a: home, b: away } })}>
      {big ? <T style={[type.label, { color: c.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }]}>Your matchup · live</T> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {side(ta, a, false, a.points >= b.points)}
        {side(tb, b, true, b.points > a.points)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <T style={[type.num, { fontSize: 11, color: c.textMuted, width: 34 }]}>{Math.round(p * 100)}%</T>
        <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ width: `${p * 100}%`, backgroundColor: c.accent }} />
        </View>
        <T style={[type.num, { fontSize: 11, color: c.textMuted, width: 34, textAlign: 'right' }]}>{Math.round((1 - p) * 100)}%</T>
      </View>
      <T muted style={[type.micro, { textAlign: 'center', marginTop: 6 }]}>Tap for every player, live</T>
    </Card>
  );
}

const COLS: { key: string; label: string; w: number }[] = [
  { key: 'rec', label: 'W-L', w: 56 },
  { key: 'pf', label: 'PF', w: 70 },
  { key: 'pa', label: 'PA', w: 70 },
  { key: 'max', label: 'MAX PF', w: 74 },
  { key: 'faab', label: 'FAAB', w: 54 },
  { key: 'claims', label: 'CLAIMS', w: 60 },
  { key: 'wp', label: 'WAIVER', w: 60 },
];

function Standings() {
  const L = useApp((s) => s.league);
  const playoffTeams = L.settings.playoffs.teams;
  const rows = L.standings.map((r, i) => ({ r, i, t: L.teams.find((t) => t.id === r.teamId)! }));
  const cell = (key: string, r: (typeof rows)[number]) => {
    switch (key) {
      case 'rec':
        return `${r.r.wins}-${r.r.losses}${r.r.ties ? `-${r.r.ties}` : ''}`;
      case 'pf':
        return r.r.pointsFor.toFixed(1);
      case 'pa':
        return r.r.pointsAgainst.toFixed(1);
      case 'max':
        return r.r.maxPointsFor.toFixed(1);
      case 'faab':
        return L.settings.waivers.type === 'faab' ? `$${r.t.faab}` : '–';
      case 'claims':
        return String(r.t.claims);
      case 'wp':
        return `#${r.t.waiverPriority}`;
    }
    return '';
  };
  const ROW_H = 52;
  const line = (i: number) => (i === playoffTeams - 1 ? { borderBottomWidth: 2, borderBottomColor: c.accent } : { borderBottomWidth: 1, borderBottomColor: c.border });
  return (
    <Card style={{ padding: 0, flexDirection: 'row', overflow: 'hidden' }}>
      <View style={{ width: 168 }}>
        <View style={{ height: 30, justifyContent: 'center', paddingLeft: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <T muted style={type.label}>TEAM</T>
        </View>
        {rows.map((row) => (
          <Pressable key={row.t.id} onPress={() => router.push(`/team/${row.t.id}`)} style={[{ height: ROW_H, flexDirection: 'row', alignItems: 'center', paddingLeft: 10, gap: 8, backgroundColor: row.t.id === ME ? '#7C5CFF22' : undefined }, line(row.i)]}>
            <T style={[type.num, { width: 18, color: c.textMuted, fontSize: 12 }]}>{row.i + 1}</T>
            <TeamAvatar team={row.t} size={26} />
            <View style={{ flex: 1 }}>
              <T style={type.smallStrong} numberOfLines={1}>{row.t.name}</T>
              <T muted style={type.micro} numberOfLines={1}>{row.t.manager}</T>
            </View>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ height: 30, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: c.border }}>
            {COLS.map((col) => (
              <T key={col.key} muted style={[type.label, { width: col.w, textAlign: 'right', paddingRight: 10 }]}>{col.label}</T>
            ))}
          </View>
          {rows.map((row) => (
            <View key={row.t.id} style={[{ height: ROW_H, flexDirection: 'row', alignItems: 'center', backgroundColor: row.t.id === ME ? '#7C5CFF22' : undefined }, line(row.i)]}>
              {COLS.map((col) => (
                <T key={col.key} style={[type.num, { width: col.w, textAlign: 'right', paddingRight: 10, fontSize: 13, color: col.key === 'rec' ? c.text : c.textMuted }]}>{cell(col.key, row)}</T>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Card>
  );
}
