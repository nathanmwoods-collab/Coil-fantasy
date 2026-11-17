import { router } from 'expo-router';
import { Image, Pressable, Switch, View } from 'react-native';

import { LeagueAvatar, leagueKicker, TeamAvatar } from '../../components/league';
import { Button, c, Card, H1, H2, Screen, T } from '../../components/ui';
import { CURRENT_WEEK, ME, opponentOf, teamWeek } from '../../demo/league';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

export default function Home() {
  const leagues = useApp((s) => s.leagues);
  const switchLeague = useApp((s) => s.switchLeague);
  const created = useApp((s) => s.createdLeagues);
  const lastImport = useApp((s) => s.lastImport);
  const isAdmin = useApp((s) => s.isAppAdmin);
  const setAdmin = useApp((s) => s.setAppAdmin);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
        <Image source={require('../../../assets/logo-mark.png')} style={{ width: 34, height: 34 }} />
        <T style={type.display24}>Coil</T>
      </View>
      <H1 kicker={`Week ${CURRENT_WEEK}`}>Your league, nothing else.</H1>
      <T muted style={{ marginTop: -6, marginBottom: 14 }}>No ads. No picks. Just fantasy.</T>

      <H2>Your leagues</H2>
      {leagues.map((L) => {
        const me = L.teams.find((t) => t.id === ME)!;
        const rank = L.standings.findIndex((r) => r.teamId === ME) + 1;
        const rec = L.standings.find((r) => r.teamId === ME)!;
        const oppId = opponentOf(L, ME, CURRENT_WEEK);
        const mine = teamWeek(L, ME, CURRENT_WEEK);
        const opp = oppId ? L.teams.find((t) => t.id === oppId)! : null;
        const theirs = oppId ? teamWeek(L, oppId, CURRENT_WEEK) : null;
        return (
          <Card key={L.id} onPress={() => { switchLeague(L.id); router.push('/league'); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <LeagueAvatar league={L} size={40} />
              <View style={{ flex: 1 }}>
                <T style={[type.label, { color: c.primary, textTransform: 'uppercase', letterSpacing: 1 }]}>{leagueKicker(L)}</T>
                <T style={type.title} numberOfLines={1}>{L.name}</T>
                <T muted style={type.small}>
                  {me.name} · {rec.wins}-{rec.losses}{rec.ties ? `-${rec.ties}` : ''} · {ordinal(rank)}
                </T>
              </View>
            </View>
            {opp && theirs ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.border }}>
                <TeamAvatar team={me} size={26} />
                <View style={{ marginLeft: 8 }}>
                  <T style={[type.num, { fontSize: 18, color: mine.points >= theirs.points ? c.text : c.textMuted }]}>{mine.points.toFixed(2)}</T>
                  <T muted style={type.micro}>proj {mine.liveProjected.toFixed(1)}</T>
                </View>
                <T muted style={[type.small, { flex: 1, textAlign: 'center' }]}>vs</T>
                <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                  <T style={[type.num, { fontSize: 18, color: theirs.points > mine.points ? c.text : c.textMuted }]}>{theirs.points.toFixed(2)}</T>
                  <T muted style={type.micro}>proj {theirs.liveProjected.toFixed(1)}</T>
                </View>
                <TeamAvatar team={opp} size={26} />
              </View>
            ) : null}
          </Card>
        );
      })}
      {created.map((s, i) => (
        <Card key={i}>
          <T style={[type.label, { color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1 }]}>
            {s.format} · {s.teams} teams · waiting for invites
          </T>
          <T style={[type.title, { marginTop: 4 }]}>{s.name}</T>
        </Card>
      ))}
      {lastImport ? (
        <Card onPress={() => router.push('/import')}>
          <T style={[type.label, { color: c.accent, textTransform: 'uppercase', letterSpacing: 1 }]}>Moving over · {lastImport.migration.claims.filter((x) => x.claimedByUserId).length} of {lastImport.migration.claims.length} claimed</T>
          <T style={[type.title, { marginTop: 4 }]}>{lastImport.league.name}</T>
        </Card>
      ) : null}

      <H2>Start something</H2>
      <Card>
        <T style={type.title}>Bring your league over</T>
        <T muted style={{ marginTop: 4, marginBottom: 12 }}>Every roster, pick, keeper and grudge comes with you. Done before your coffee gets cold.</T>
        <Button label="Move a league to Coil" onPress={() => router.push('/import')} />
      </Card>
      <Card>
        <T style={type.title}>Start a new league</T>
        <T muted style={{ marginTop: 4, marginBottom: 12 }}>Redraft, keeper, dynasty or best ball. Customize anything, down to the decimal.</T>
        <Button label="Create a league" kind="secondary" onPress={() => router.push('/create')} />
      </Card>

      <H2>Preview controls</H2>
      <Card>
        <Pressable onPress={() => setAdmin(!isAdmin)} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <T style={type.bodyStrong}>See the app as Coil staff</T>
            <T muted style={type.small}>Staff get the news desk tab. Regular managers never see it. Turn this off to see what they see.</T>
          </View>
          <Switch value={isAdmin} onValueChange={setAdmin} trackColor={{ true: c.primary, false: c.surfaceAlt }} />
        </Pressable>
      </Card>
      <T muted style={[type.micro, { textAlign: 'center', marginTop: 8 }]}>Preview build · demo data only</T>
    </Screen>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
