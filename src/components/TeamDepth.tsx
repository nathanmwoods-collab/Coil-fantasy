import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ageOf, type DemoLeague, type DemoPlayer } from '../demo/league';
import { useApp } from '../store/useApp';
import { type } from '../theme/type';
import { TeamAvatar } from './league';
import { c, Card, InjuryBadge, POS_COLORS, T } from './ui';

const GROUPS = ['QB', 'RB', 'WR', 'TE'] as const;
const METRICS = ['Points', 'Total yards', 'Passing', 'Rushing', 'Red zone', 'Plays per game'];

/** Seeded 1 to 32 rank per team and metric (preview data). */
function seededRank(team: string, metric: string): number {
  let h = 0;
  for (const ch of team + metric) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 32) + 1;
}

const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const tone = (rank: number) => (rank <= 10 ? c.success : rank <= 22 ? c.warning : c.danger);

/**
 * The player's NFL team, framed for fantasy: how the offense is producing,
 * who is next up behind this player, and who in your league owns each spot
 * on the depth chart.
 */
export function TeamDepth({ L, player }: { L: DemoLeague; player: DemoPlayer }) {
  const claim = useApp((s) => s.showToast);
  const roster = Object.values(L.players).filter((x) => x.nflTeam === player.nflTeam);
  const ownerOf = (id: string) => L.teams.find((t) => t.players.includes(id));
  const depth = Object.fromEntries(GROUPS.map((g) => [g, roster.filter((x) => x.position === g).sort((a, b) => b.proj - a.proj)]));
  const mine = depth[player.position] ?? [];
  const idx = mine.findIndex((x) => x.id === player.id);
  const nextUp = idx >= 0 ? mine[idx + 1] ?? (idx > 0 ? mine[0] : undefined) : undefined;
  const nextOwner = nextUp ? ownerOf(nextUp.id) : undefined;

  return (
    <>
      <Card>
        <T style={[type.label, { color: c.textMuted, letterSpacing: 1 }]}>OFFENSE THIS SEASON · RANK OF 32</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 10 }}>
          {METRICS.map((m) => {
            const r = seededRank(player.nflTeam, m);
            return (
              <View key={m} style={{ width: '50%', paddingRight: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <T muted style={type.micro}>{m}</T>
                  <T style={[type.smallStrong, { color: tone(r) }]}>{ord(r)}</T>
                </View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: c.surfaceAlt, marginTop: 4 }}>
                  <View style={{ width: `${((33 - r) / 32) * 100}%`, height: 5, borderRadius: 3, backgroundColor: tone(r) }} />
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {nextUp ? (
        <Card style={{ borderColor: nextOwner ? c.border : c.accent }}>
          <T style={[type.label, { color: c.accent, letterSpacing: 1 }]}>{idx === 0 ? 'IF HE SITS, NEXT UP' : 'AHEAD OF HIM'}</T>
          <Pressable onPress={() => router.push(`/player/${nextUp.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <T style={type.bodyStrong}>{nextUp.name}</T>
              <T muted style={type.small}>{nextOwner ? `On ${nextOwner.name}` : 'Nobody has him. Grab him before someone else does.'}</T>
            </View>
            {nextOwner ? (
              <TeamAvatar team={nextOwner} size={28} />
            ) : (
              <Pressable onPress={() => claim(`Claim for ${nextUp.name} is in. It runs with waivers.`)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: c.accent }}>
                <T style={[type.smallStrong, { color: c.bg }]}>Claim</T>
              </Pressable>
            )}
          </Pressable>
        </Card>
      ) : null}

      <Card style={{ paddingVertical: 6 }}>
        <T style={[type.label, { color: c.textMuted, letterSpacing: 1, paddingTop: 6 }]}>DEPTH CHART · WHO HAS WHO</T>
        {GROUPS.filter((g) => depth[g].length).map((g) => (
          <View key={g} style={{ flexDirection: 'row', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border, gap: 10 }}>
            <T style={[type.smallStrong, { color: POS_COLORS[g], width: 28, paddingTop: 6 }]}>{g}</T>
            <View style={{ flex: 1, gap: 6 }}>
              {depth[g].map((x, i) => {
                const own = ownerOf(x.id);
                const me = x.id === player.id;
                return (
                  <Pressable
                    key={x.id}
                    disabled={me}
                    onPress={() => router.push(`/player/${x.id}`)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: me ? '#2EE6C522' : i === 0 ? c.surfaceAlt : 'transparent', borderWidth: me ? 1 : 0, borderColor: c.accent }}
                  >
                    <T muted style={[type.micro, { width: 14 }]}>{i + 1}</T>
                    <View style={{ flex: 1 }}>
                      <T style={type.smallStrong} numberOfLines={1}>{x.name}</T>
                      <T muted style={type.micro}>{ageOf(x)} yrs</T>
                    </View>
                    <InjuryBadge status={x.status} />
                    {own ? <TeamAvatar team={own} size={22} /> : <T style={[type.label, { color: c.accent }]}>FREE</T>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <T muted style={[type.micro, { paddingVertical: 8 }]}>Fantasy positions only. Team avatars show who rosters each player in {L.name}.</T>
      </Card>
    </>
  );
}
