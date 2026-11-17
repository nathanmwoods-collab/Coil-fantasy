import { router } from 'expo-router';
import { Image, View } from 'react-native';

import { Button, Card, H1, H2, Screen, T } from '../../components/ui';
import { CURRENT_WEEK, ME } from '../../demo/league';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

export default function Home() {
  const league = useApp((s) => s.league);
  const created = useApp((s) => s.createdLeagues);
  const lastImport = useApp((s) => s.lastImport);
  const me = league.teams.find((t) => t.id === ME)!;
  const rank = league.standings.findIndex((r) => r.teamId === ME) + 1;
  const rec = league.standings.find((r) => r.teamId === ME)!;

  return (
    <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
          <Image source={require('../../../assets/logo-mark.png')} style={{ width: 34, height: 34 }} />
          <T style={type.display24}>Coil</T>
        </View>
        <H1 kicker={`Week ${CURRENT_WEEK}`}>Your league, nothing else.</H1>
        <T muted style={{ marginTop: -6, marginBottom: 14 }}>
          As deep as MFL, as easy as Sleeper. No picks, no ads, no deposits.
        </T>

        <H2>Your leagues</H2>
        <Card onPress={() => router.push('/league')} highlight>
          <T style={[type.label, { color: '#7C5CFF', textTransform: 'uppercase', letterSpacing: 1 }]}>Dynasty · 10 teams · Superflex</T>
          <T style={[type.title, { marginTop: 4 }]}>{league.name}</T>
          <T muted style={{ marginTop: 2 }}>
            {me.emoji} {me.name} · {rec.wins}-{rec.losses}
            {rec.ties ? `-${rec.ties}` : ''} · {ordinal(rank)} place
          </T>
        </Card>
        {created.map((s, i) => (
          <Card key={i}>
            <T style={[type.label, { color: '#9A98B8', textTransform: 'uppercase', letterSpacing: 1 }]}>
              {s.format} · {s.teams} teams · waiting for invites
            </T>
            <T style={[type.title, { marginTop: 4 }]}>{s.name}</T>
          </Card>
        ))}
        {lastImport ? (
          <Card onPress={() => router.push('/import')}>
            <T style={[type.label, { color: '#2EE6C5', textTransform: 'uppercase', letterSpacing: 1 }]}>Moving over · {lastImport.migration.claims.filter((c) => c.claimedByUserId).length} of {lastImport.migration.claims.length} claimed</T>
            <T style={[type.title, { marginTop: 4 }]}>{lastImport.league.name}</T>
          </Card>
        ) : null}

        <H2>Start something</H2>
        <Card>
          <T style={type.title}>Bring your league over</T>
          <T muted style={{ marginTop: 4, marginBottom: 12 }}>
            Rosters, future picks, keepers, taxi, IR, FAAB and every past champion. About a minute for the commish, 20 seconds for everyone else.
          </T>
          <Button label="Move a league to Coil" onPress={() => router.push('/import')} />
        </Card>
        <Card>
          <T style={type.title}>Start a new league</T>
          <T muted style={{ marginTop: 4, marginBottom: 12 }}>Redraft, keeper, dynasty or best ball. Three questions, then tweak anything you like.</T>
          <Button label="Create a league" kind="secondary" onPress={() => router.push('/create')} />
        </Card>
        <T muted style={[type.micro, { textAlign: 'center', marginTop: 16 }]}>Preview build · demo data only</T>
    </Screen>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

