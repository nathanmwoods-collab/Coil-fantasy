import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Card, H1, H2, Screen, Segmented, T } from '../../components/ui';
import { CURRENT_WEEK, ME } from '../../demo/league';
import { pickLabel, playoffEndWeek, winPct } from '../../engine';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

export default function League() {
  const L = useApp((s) => s.league);
  const [tab, setTab] = useState<'standings' | 'matchups' | 'picks' | 'rules'>('standings');
  const name = (id: string) => L.teams.find((t) => t.id === id)!;
  const playoffTeams = L.settings.playoffs.teams;

  const thisWeek = L.schedule.filter((m) => m.week === CURRENT_WEEK);
  const mine = thisWeek.find((m) => m.home === ME || m.away === ME);
  const proj = (teamId: string) =>
    Math.round(
      name(teamId)
        .players.filter((p) => !name(teamId).ir.includes(p) && !name(teamId).taxi.includes(p))
        .map((p) => L.players[p].proj / 17)
        .sort((a, b) => b - a)
        .slice(0, 10)
        .reduce((s, x) => s + x, 0) * 10,
    ) / 10;

  return (
    <Screen>
      <H1 kicker={`Week ${CURRENT_WEEK} · Dynasty`}>{L.name}</H1>

      {mine ? (
        <Card highlight>
          <T style={[type.label, { color: '#2EE6C5', textTransform: 'uppercase', letterSpacing: 1 }]}>This week</T>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            {[mine.home, mine.away].map((id, i) => (
              <View key={id} style={{ alignItems: i ? 'flex-end' : 'flex-start', flex: 1 }}>
                <T style={{ fontSize: 26 }}>{name(id).emoji}</T>
                <T style={type.bodyStrong} numberOfLines={1}>{name(id).name}</T>
                <T style={[type.display32, { color: id === ME ? '#7C5CFF' : '#F4F3FF' }]}>{proj(id).toFixed(1)}</T>
                <T muted style={type.micro}>projected</T>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <View style={{ marginTop: 10 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { key: 'standings', label: 'Standings' },
            { key: 'matchups', label: 'Matchups' },
            { key: 'picks', label: 'Picks' },
            { key: 'rules', label: 'Rules' },
          ]}
        />
      </View>

      {tab === 'standings' && (
        <Card style={{ padding: 0 }}>
          {L.standings.map((r, i) => {
            const t = name(r.teamId);
            return (
              <View key={r.teamId}>
                {i === playoffTeams ? <View style={{ height: 2, backgroundColor: '#2EE6C5', opacity: 0.5 }} /> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: r.teamId === ME ? '#7C5CFF22' : undefined }}>
                  <T style={[type.num, { width: 22, color: '#9A98B8' }]}>{i + 1}</T>
                  <T style={{ fontSize: 18, width: 28 }}>{t.emoji}</T>
                  <View style={{ flex: 1 }}>
                    <T style={type.bodyStrong} numberOfLines={1}>{t.name}</T>
                    <T muted style={type.micro}>{t.manager} · all-play {(winPct({ wins: r.allPlayWins, losses: r.allPlayLosses, ties: r.allPlayTies }) * 100).toFixed(0)}%</T>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <T style={type.num}>{r.wins}-{r.losses}{r.ties ? `-${r.ties}` : ''}</T>
                    <T muted style={[type.num, { fontSize: 11 }]}>{r.pointsFor.toFixed(1)} PF</T>
                  </View>
                </View>
              </View>
            );
          })}
          <T muted style={[type.micro, { padding: 12 }]}>Top {playoffTeams} make the playoffs. Records include the weekly median game.</T>
        </Card>
      )}

      {tab === 'matchups' && (
        <>
          {thisWeek.map((m) => (
            <Card key={m.home}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T style={type.bodyStrong}>{name(m.home).emoji} {name(m.home).name}</T>
                <T style={type.num}>{proj(m.home).toFixed(1)}</T>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <T style={type.bodyStrong}>{name(m.away).emoji} {name(m.away).name}</T>
                <T style={type.num}>{proj(m.away).toFixed(1)}</T>
              </View>
            </Card>
          ))}
        </>
      )}

      {tab === 'picks' && (
        <>
          <Button label="Trade draft picks" onPress={() => router.push('/trade')} />
          {[...new Set(L.picks.map((p) => p.season))].map((season) => (
            <View key={season}>
              <H2>{season} rookie draft</H2>
              <Card style={{ padding: 0 }}>
                {L.teams.map((t) => {
                  const owned = L.picks.filter((p) => p.season === season && p.ownerTeamId === t.id).sort((a, b) => a.round - b.round);
                  return (
                    <View key={t.id} style={{ flexDirection: 'row', padding: 12, borderBottomWidth: 1, borderBottomColor: '#2C2C4A', backgroundColor: t.id === ME ? '#7C5CFF22' : undefined }}>
                      <T style={[type.smallStrong, { width: 140 }]} numberOfLines={1}>{t.emoji} {t.name}</T>
                      <T muted style={[type.small, { flex: 1 }]}>
                        {owned.length ? owned.map((p) => pickLabel(p, (id) => name(id).name).replace(`${season} `, '')).join(', ') : 'No picks'}
                      </T>
                    </View>
                  );
                })}
              </Card>
            </View>
          ))}
        </>
      )}

      {tab === 'rules' && (
        <Card>
          {[
            ['Scoring', 'Superflex PPR, 4-pt passing TDs'],
            ['Roster', 'QB, 2 RB, 3 WR, TE, FLEX, SUPERFLEX, 8 bench, 2 IR, 3 taxi'],
            ['IR allows', L.settings.irEligible.map((s) => s.toUpperCase()).join(', ')],
            ['Taxi squad', `Rookies and second-year players`],
            ['Waivers', `FAAB, $${L.settings.waivers.faabBudget} budget, runs Wednesday`],
            ['Trades', `No review, deadline week ${L.settings.trades.deadlineWeek}, picks ${L.settings.trades.futurePickSeasons} seasons out`],
            ['Playoffs', `${playoffTeams} teams, weeks ${L.settings.playoffs.startWeek}–${playoffEndWeek(L.settings)}`],
            ['Rookie draft', `${L.settings.dynasty.rookieDraftRounds} rounds, linear, by max points`],
          ].map(([k, v]) => (
            <View key={k} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#2C2C4A' }}>
              <T muted style={type.small}>{k}</T>
              <T>{v}</T>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
