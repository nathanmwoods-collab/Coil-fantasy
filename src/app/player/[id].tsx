import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, c, Card, Chip, InjuryBadge, Input, PlayerAvatar, POS_COLORS, Screen, Segmented, T } from '../../components/ui';
import { CURRENT_WEEK, ME } from '../../demo/league';
import { injuryTag, seededRandom } from '../../engine';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

const REACTIONS = ['🔥', '😂', '😱', '🧊'];

export default function PlayerCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const L = useApp((s) => s.league);
  const toast = useApp((s) => s.showToast);
  const p = L.players[id ?? ''];
  const [tab, setTab] = useState<'summary' | 'log' | 'history'>('summary');
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [watching, setWatching] = useState(false);
  const [reacts, setReacts] = useState<Record<string, number>>({ '🔥': 14, '😂': 3 });
  const [mine, setMine] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!p) return null;
    const all = Object.values(L.players);
    const posRank = all.filter((x) => x.position === p.position && x.proj > p.proj).length + 1;
    const overall = all.filter((x) => x.proj > p.proj).length + 1;
    const rnd = seededRandom(p.id.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0));
    const perGame = p.proj / 17;
    const log = Array.from({ length: CURRENT_WEEK - 1 }, (_, i) => {
      const week = i + 1;
      if (week === p.bye) return { week, bye: true as const };
      const proj = Math.round(perGame * (0.85 + rnd() * 0.3) * 100) / 100;
      const pts = Math.round(perGame * (0.3 + rnd() * 1.5) * 100) / 100;
      return { week, bye: false as const, proj, pts };
    });
    const played = log.filter((g) => !g.bye) as { week: number; proj: number; pts: number }[];
    const avg = played.reduce((s, g) => s + g.pts, 0) / Math.max(1, played.length);
    const owner = L.teams.find((t) => t.players.includes(p.id));
    const rostered = Math.round(60 + rnd() * 40);
    return { posRank, overall, log, played, avg, owner, rostered, started: Math.max(0, rostered - Math.round(rnd() * 20)), next: [CURRENT_WEEK, CURRENT_WEEK + 1, CURRENT_WEEK + 2].map((w) => ({ week: w, proj: w === p.bye ? null : Math.round(perGame * (0.9 + rnd() * 0.2) * 100) / 100 })) };
  }, [p, L]);

  if (!p || !data) {
    return (
      <Screen>
        <T>Player not found.</T>
      </Screen>
    );
  }

  const tag = injuryTag(p.status);
  const last = data.played[data.played.length - 1];
  const isMine = data.owner?.id === ME;

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/team'))}>
        <T muted style={type.smallStrong}>‹ Back</T>
      </Pressable>

      <Card style={{ marginTop: 10, backgroundColor: POS_COLORS[p.position] + '1A', borderColor: POS_COLORS[p.position] + '66' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <PlayerAvatar name={p.name} position={p.position} url={p.headshotUrl} size={76} />
          <View style={{ flex: 1 }}>
            {data.owner ? <T style={[type.small, { color: c.accent }]}>→ {data.owner.emoji} {data.owner.name}</T> : <T style={[type.small, { color: c.accent }]}>Free agent</T>}
            <T style={[type.display32, { textTransform: 'uppercase' }]}>{p.name}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T style={[type.bodyStrong, { color: POS_COLORS[p.position] }]}>{p.position}</T>
              <T muted> · {p.nflTeam} · bye {p.bye}</T>
              <InjuryBadge status={p.status} />
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          {[
            ['EXP', p.yearsPro === 0 ? 'Rookie' : `${p.yearsPro} yr`],
            ['ADP', p.adp.toFixed(1)],
            ['STATUS', tag.code || 'Healthy'],
          ].map(([k, v]) => (
            <View key={k}>
              <T muted style={type.label}>{k}</T>
              <T style={type.display24}>{v}</T>
            </View>
          ))}
        </View>
        {p.injuryNote ? <T style={[type.small, { color: c.warning, marginTop: 8 }]}>{tag.label}: {p.injuryNote}</T> : null}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Button label={isMine ? 'Drop' : data.owner ? 'Propose trade' : 'Add'} kind={isMine ? 'ghost' : 'primary'} onPress={() => toast(isMine ? 'In the full app this asks "are you sure?" first.' : data.owner ? 'Trade builder for players is next in the preview.' : 'Claim placed for Wednesday waivers.')} />
          </View>
          <Button label={watching ? '★ Watching' : '☆ Watch'} kind="secondary" onPress={() => { setWatching(!watching); toast(watching ? 'Stopped watching.' : `You'll get news on ${p.name} even when he's not on your team.`); }} />
        </View>
      </Card>

      <Card onPress={() => setEditingNote(true)} style={{ alignItems: editingNote ? 'stretch' : 'center' }}>
        {editingNote ? (
          <>
            <Input value={note} onChangeText={setNote} placeholder="Notes only your league sees (trade talk, keeper cost…)" autoFocus multiline />
            <View style={{ height: 8 }} />
            <Button small label="Save note" onPress={() => { setEditingNote(false); toast('League note saved.'); }} />
          </>
        ) : (
          <T muted style={type.bodyStrong}>{note ? `📝 ${note}` : '＋ League note'}</T>
        )}
      </Card>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'summary', label: 'Summary' },
          { key: 'log', label: 'Game log' },
          { key: 'history', label: 'History' },
        ]}
      />

      {tab === 'summary' && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[
                ['RANK', `#${data.posRank} ${p.position}`, `#${data.overall} overall`],
                ['ROSTERED', `${data.rostered}%`, `${data.started}% start`],
                ['PTS / GAME', data.avg.toFixed(2), 'this league'],
              ].map(([k, v, sub]) => (
                <View key={k}>
                  <T muted style={type.label}>{k}</T>
                  <T style={type.display24}>{v}</T>
                  <T muted style={type.micro}>{sub}</T>
                </View>
              ))}
            </View>
          </Card>

          {last ? (
            <Card>
              <T muted style={type.label}>WEEK {last.week}</T>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
                <T style={type.display32}>{last.pts.toFixed(1)} <T muted style={type.small}>pts</T></T>
                <T muted style={type.small}>proj {last.proj.toFixed(1)}</T>
              </View>
              <T muted style={[type.small, { marginTop: 4 }]}>{last.pts > last.proj * 1.3 ? 'Way over his projection. Somebody owes him an apology.' : last.pts < last.proj * 0.7 ? 'Rough one. Next week is a new week.' : 'Right about where we expected.'}</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
                {REACTIONS.map((e) => (
                  <Chip
                    key={e}
                    label={`${e} ${(reacts[e] ?? 0) + (mine === e ? 1 : 0)}`}
                    active={mine === e}
                    onPress={() => setMine(mine === e ? null : e)}
                  />
                ))}
              </View>
            </Card>
          ) : null}

          <T style={[type.display24, { marginTop: 14, marginBottom: 8 }]}>Projections</T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {data.next.map((n) => (
              <Card key={n.week} style={{ flex: 1, alignItems: 'center' }}>
                <T muted style={type.label}>WK {n.week}</T>
                <T style={type.display24}>{n.proj === null ? 'BYE' : n.proj.toFixed(1)}</T>
              </Card>
            ))}
          </View>
          <T muted style={[type.micro, { textAlign: 'center' }]}>Preview numbers are made up.</T>
        </>
      )}

      {tab === 'log' && (
        <Card style={{ paddingVertical: 4 }}>
          {[...data.log].reverse().map((g) => (
            <View key={g.week} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <T style={[type.num, { width: 50 }]}>Wk {g.week}</T>
              {g.bye ? (
                <T muted>Bye week</T>
              ) : (
                <>
                  <T style={[type.num, { flex: 1 }]}>proj {g.proj.toFixed(1)}</T>
                  <T style={[type.num, { color: g.pts >= g.proj ? c.success : c.text }]}>{g.pts.toFixed(1)}</T>
                </>
              )}
            </View>
          ))}
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <T style={type.bodyStrong}>In this league</T>
          <T muted style={{ marginTop: 4 }}>
            {data.owner ? `Drafted by ${data.owner.name} in the 2026 startup draft.` : 'Never rostered in this league.'}
          </T>
          <T muted style={[type.small, { marginTop: 8 }]}>Every add, drop, trade and keeper decision for this player shows here, including seasons imported from your old platform.</T>
        </Card>
      )}
    </Screen>
  );
}
