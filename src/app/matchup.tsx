import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { TeamAvatar } from '../components/league';
import { c, Card, InjuryBadge, PlayerAvatar, POS_COLORS, Screen, T } from '../components/ui';
import { CURRENT_WEEK, opponentOf, teamWeek } from '../demo/league';
import { winProbability, type PlayerWeek } from '../demo/games';
import { SLOT_LABELS } from '../engine';
import { useApp } from '../store/useApp';
import { type } from '../theme/type';

export default function Matchup() {
  const params = useLocalSearchParams<{ a: string; b?: string; week?: string }>();
  const L = useApp((s) => s.league);
  const [week, setWeek] = useState(Number(params.week ?? CURRENT_WEEK));
  const a = params.a ?? 'T1';
  const b = params.b ?? opponentOf(L, a, week) ?? a;
  const ta = L.teams.find((t) => t.id === a);
  const tb = L.teams.find((t) => t.id === b);
  const wa = useMemo(() => teamWeek(L, a, week), [L, a, week]);
  const wb = useMemo(() => teamWeek(L, b, week), [L, b, week]);
  if (!ta || !tb) return <Screen><T>Matchup not found.</T></Screen>;
  const p = winProbability(wa.liveProjected, wb.liveProjected, (wa.remaining + wb.remaining) / 2);
  const done = week < CURRENT_WEEK;

  const Side = ({ id, pw, right }: { id: string | null; pw: PlayerWeek | null; right?: boolean }) => {
    if (!id) return <View style={{ flex: 1 }}><T muted style={{ textAlign: right ? 'right' : 'left' }}>Empty</T></View>;
    const pl = L.players[id];
    const g = pw?.game;
    const status = !g ? 'Bye' : g.status === 'final' ? `Final ${g.teamScore}-${g.oppScore}` : g.status === 'live' ? `${g.clock} · ${g.teamScore}-${g.oppScore}` : `${g.clock} ${g.home ? 'vs' : '@'} ${g.opp}`;
    return (
      <Pressable onPress={() => router.push(`/player/${id}`)} style={{ flex: 1, flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 }}>
        <PlayerAvatar name={pl.name} position={pl.position} url={pl.headshotUrl} size={30} />
        <View style={{ flex: 1, alignItems: right ? 'flex-end' : 'flex-start' }}>
          <View style={{ flexDirection: right ? 'row-reverse' : 'row', alignItems: 'center' }}>
            <T style={type.smallStrong} numberOfLines={1}>{pl.name.split(' ').slice(-1)[0]}</T>
            <InjuryBadge status={pl.status} />
          </View>
          <T style={[type.micro, { color: POS_COLORS[pl.position] }]}>{pl.position} · {pl.nflTeam}</T>
          <T muted style={[type.micro, { color: g?.status === 'live' ? c.warning : c.textMuted }]} numberOfLines={1}>{status}</T>
        </View>
        <View style={{ alignItems: right ? 'flex-start' : 'flex-end', minWidth: 44 }}>
          <T style={[type.num, { fontSize: 15, color: c.text }]}>{g && g.status !== 'upcoming' ? pw!.points.toFixed(2) : '–'}</T>
          <T muted style={[type.num, { fontSize: 10 }]}>{pw?.projected.toFixed(1)}</T>
        </View>
      </Pressable>
    );
  };

  const benchRows = Math.max(wa.bench.length, wb.bench.length);
  const sortBench = (x: typeof wa.bench) => [...x].sort((m, n) => n.pw.points - m.pw.points || n.pw.projected - m.pw.projected);
  const ba = sortBench(wa.bench);
  const bb = sortBench(wb.bench);

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/league'))}>
        <T muted style={type.smallStrong}>‹ Back</T>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginVertical: 8 }}>
        <Pressable hitSlop={8} onPress={() => setWeek(Math.max(1, week - 1))} style={{ padding: 6 }}><T style={{ color: c.accent }}>‹</T></Pressable>
        <T style={[type.smallStrong, { color: c.accent }]}>Week {week}{week === CURRENT_WEEK ? ' · live' : ''}</T>
        <Pressable hitSlop={8} onPress={() => setWeek(Math.min(CURRENT_WEEK, week + 1))} style={{ padding: 6 }}><T style={{ color: c.accent }}>›</T></Pressable>
      </View>
      <Card highlight>
        <View style={{ flexDirection: 'row' }}>
          {[{ t: ta, w: wa }, { t: tb, w: wb }].map(({ t, w }, i) => (
            <Pressable key={t.id} onPress={() => router.push(`/team/${t.id}`)} style={{ flex: 1, alignItems: i ? 'flex-end' : 'flex-start' }}>
              <TeamAvatar team={t} size={40} />
              <T style={[type.bodyStrong, { marginTop: 6 }]} numberOfLines={1}>{t.name}</T>
              <T style={[type.display32, { color: (i ? wb.points > wa.points : wa.points >= wb.points) ? c.text : c.textMuted }]}>{w.points.toFixed(2)}</T>
              <T muted style={type.micro}>{done ? `proj ${w.projected.toFixed(2)}` : `proj ${w.liveProjected.toFixed(2)}`}</T>
            </Pressable>
          ))}
        </View>
        {!done ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <T muted style={[type.num, { fontSize: 11, width: 34 }]}>{Math.round(p * 100)}%</T>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden' }}>
              <View style={{ width: `${p * 100}%`, height: 6, backgroundColor: c.accent }} />
            </View>
            <T muted style={[type.num, { fontSize: 11, width: 34, textAlign: 'right' }]}>{Math.round((1 - p) * 100)}%</T>
          </View>
        ) : null}
      </Card>

      <T style={[type.display24, { marginTop: 14, marginBottom: 8 }]}>Starters</T>
      <Card style={{ paddingVertical: 2 }}>
        {wa.starters.map((s, i) => (
          <View key={i} style={row}>
            <Side id={s.playerId} pw={s.pw} />
            <View style={{ width: 44, alignItems: 'center' }}>
              <T muted style={[type.label, { fontSize: 10 }]}>{SLOT_LABELS[s.slot]}</T>
            </View>
            <Side id={wb.starters[i]?.playerId ?? null} pw={wb.starters[i]?.pw ?? null} right />
          </View>
        ))}
      </Card>

      <T style={[type.display24, { marginTop: 14, marginBottom: 8 }]}>Bench</T>
      <Card style={{ paddingVertical: 2 }}>
        {Array.from({ length: benchRows }, (_, i) => (
          <View key={i} style={row}>
            {ba[i] ? <Side id={ba[i].playerId} pw={ba[i].pw} /> : <View style={{ flex: 1 }} />}
            <View style={{ width: 44, alignItems: 'center' }}>
              <T muted style={[type.label, { fontSize: 10 }]}>BN</T>
            </View>
            {bb[i] ? <Side id={bb[i].playerId} pw={bb[i].pw} right /> : <View style={{ flex: 1 }} />}
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const row = { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#2C2C4A' };
