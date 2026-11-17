import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, c, Card, H1, H2, Input, Screen, T } from '../components/ui';
import { CURRENT_SEASON } from '../demo/league';
import { pickLabel } from '../engine';
import { SLEEPER_DEMO_PLAYER_DB, SLEEPER_DEMO_USERNAME, sleeperDemoFetch } from '../import/fixtures/sleeperDemo';
import { claimTeam, migrationMessage, migrationProgress, startMigration } from '../import/migrate';
import { findSleeperLeagues, importSleeperLeague, type SleeperLeagueSummary } from '../import/sleeper';
import { importFromText } from '../import/text';
import type { ImportedLeague } from '../import/types';
import { settingsForFormat } from '../engine';
import { useApp } from '../store/useApp';
import { type } from '../theme/type';

type Source = 'sleeper' | 'paste' | 'espn' | 'yahoo' | 'mfl' | 'fleaflicker';

const SOURCES: { key: Source; label: string; how: string; ready: boolean }[] = [
  { key: 'sleeper', label: 'Sleeper', how: 'Type your Sleeper username and pick the league.', ready: true },
  { key: 'paste', label: 'Anywhere else', how: 'Paste rosters from any site or spreadsheet. We match every name.', ready: true },
  { key: 'espn', label: 'ESPN', how: 'Sign in to ESPN once so we can read your private league.', ready: false },
  { key: 'yahoo', label: 'Yahoo', how: 'Approve Coil in Yahoo and pick your league.', ready: false },
  { key: 'mfl', label: 'MyFantasyLeague', how: 'Paste your league link. Contracts and salaries included.', ready: false },
  { key: 'fleaflicker', label: 'Fleaflicker', how: 'Paste your league link.', ready: false },
];

const SAMPLE = `Rattle & Roll (You)
Ja'Marr Chase
Jonathan Taylor
Malik Nabers (IR)
Travis Hunter (Taxi)
2027 1st (via Hail Marys)
FAAB: 77

Tacos Al Pastor (Marisa)
Bijan Robinson
CeeDee Lamb - keeper rd 2
FAAB: 39

Hail Marys (Grandpa Joe)
Christian McCaffery
Justin Jefferson
FAAB: 0`;

export default function Import() {
  const playerMap = useApp((s) => s.league.players);
  const players = useMemo(() => Object.values(playerMap), [playerMap]);
  const setImport = useApp((s) => s.setImport);
  const last = useApp((s) => s.lastImport);
  const toast = useApp((s) => s.showToast);
  const [source, setSource] = useState<Source | null>(null);
  const [username, setUsername] = useState(SLEEPER_DEMO_USERNAME);
  const [found, setFound] = useState<{ displayName: string; leagues: SleeperLeagueSummary[] } | null>(null);
  const [text, setText] = useState(SAMPLE);
  const [result, setResult] = useState<{ league: ImportedLeague; review: { teamName: string; raw: string; suggestion?: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [migration, setMigration] = useState(last?.migration ?? null);

  const lookup = async () => {
    setBusy(true);
    setError(null);
    try {
      // The preview can't reach Sleeper, so it answers with sample data in Sleeper's exact format.
      setFound(await findSleeperLeagues(username, CURRENT_SEASON, { fetch: sleeperDemoFetch }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runSleeper = async (leagueId: string) => {
    setBusy(true);
    setError(null);
    try {
      const league = await importSleeperLeague(leagueId, { fetch: sleeperDemoFetch, playerDb: SLEEPER_DEMO_PLAYER_DB });
      setResult({ league, review: [] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runPaste = () => {
    const res = importFromText(text, players, { firstPickSeason: CURRENT_SEASON + 1, pickSeasons: 3, rounds: 4 });
    const settings = settingsForFormat('dynasty', res.teams.length);
    settings.name = 'My Imported League';
    setResult({
      league: { source: 'text', sourceLeagueId: 'paste', season: CURRENT_SEASON, name: settings.name, settings, teams: res.teams, picks: res.picks, history: [], warnings: res.warnings },
      review: res.needsReview.map((n) => ({ teamName: n.teamName, raw: n.raw, suggestion: n.alternatives[0]?.name })),
    });
  };

  if (migration && result) {
    const progress = migrationProgress(migration);
    return (
      <Screen>
        <H1 kicker={`${progress.claimed} of ${progress.total} teams claimed`}>Invite your league</H1>
        <T muted style={{ marginBottom: 12 }}>Paste this in your old group chat. Each manager taps their own team and they're in.</T>
        <Card>
          <T style={[type.small, { fontFamily: type.num.fontFamily }]}>{migrationMessage(migration, result.league.name, 'https://coil.example/join')}</T>
        </Card>
        <Button label="Copy message" onPress={() => toast('Copied. Paste it in your group chat.')} />
        <H2>Who's in</H2>
        {migration.claims.map((cl) => (
          <Card key={cl.code} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T style={type.bodyStrong}>{cl.teamName}</T>
              <T muted style={type.small}>{cl.ownerName ?? 'No manager yet'}</T>
            </View>
            {cl.claimedByUserId ? (
              <T style={{ color: c.success }}>✓ In</T>
            ) : (
              <Button
                small
                kind="ghost"
                label="Simulate claim"
                onPress={() => {
                  const r = claimTeam(migration, cl.code, `user-${cl.code}`);
                  setMigration(r.migration);
                  setImport(result.league, r.migration);
                  toast(`${cl.ownerName ?? cl.teamName} claimed ${cl.teamName}.`);
                }}
              />
            )}
          </Card>
        ))}
        <View style={{ height: 8 }} />
        <Button label="Done" kind="secondary" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (result) {
    const L = result.league;
    const teamName = (id: string) => L.teams.find((t) => t.sourceTeamId === id)?.name ?? id;
    const traded = L.picks.filter((p) => p.ownerTeamId !== p.originalTeamId);
    return (
      <Screen>
        <Pressable onPress={() => setResult(null)}>
          <T muted style={type.smallStrong}>‹ Back</T>
        </Pressable>
        <H1 kicker="Here's what we found">{L.name}</H1>
        <Card>
          {[
            ['Format', `${L.settings.format}, ${L.teams.length} teams`],
            ['Players', `${L.teams.reduce((s, t) => s + t.players.length, 0)} on rosters, ${L.teams.reduce((s, t) => s + t.players.filter((p) => p.slot === 'IR').length, 0)} on IR, ${L.teams.reduce((s, t) => s + t.players.filter((p) => p.slot === 'TAXI').length, 0)} on taxi`],
            ['Draft picks', `${L.picks.length} future picks, ${traded.length} already traded`],
            ['FAAB', L.teams.map((t) => (t.faabRemaining !== null ? `$${t.faabRemaining}` : '?')).join(' · ')],
            ['History', L.history.length ? L.history.map((h) => `${h.season}: ${h.championName ?? '?'}`).join(' · ') : 'Add past champions any time'],
          ].map(([k, v]) => (
            <View key={k} style={{ paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <T muted style={type.small}>{k}</T>
              <T>{v}</T>
            </View>
          ))}
        </Card>

        {traded.length ? (
          <>
            <H2>Traded picks</H2>
            <Card>
              {traded.map((p) => (
                <T key={p.id} style={{ marginBottom: 4 }}>
                  {teamName(p.ownerTeamId)} owns {pickLabel(p, teamName)}
                </T>
              ))}
            </Card>
          </>
        ) : null}

        {result.review.length || L.warnings.length ? (
          <>
            <H2>Double-check these</H2>
            <Card style={{ borderColor: '#FFB547' }}>
              {result.review.map((r, i) => (
                <T key={i} style={{ marginBottom: 6 }}>
                  {r.teamName}: "{r.raw}"{r.suggestion ? ` → did you mean ${r.suggestion}?` : ' → not found'}
                </T>
              ))}
              {L.warnings.map((w, i) => (
                <T key={`w${i}`} muted style={{ marginBottom: 6 }}>
                  {w}
                </T>
              ))}
            </Card>
          </>
        ) : null}

        <H2>Teams</H2>
        {L.teams.map((t) => (
          <Card key={t.sourceTeamId}>
            <T style={type.title}>{t.name}</T>
            <T muted style={type.small}>{t.ownerName ?? 'No manager'}{t.faabRemaining !== null ? ` · $${t.faabRemaining} FAAB` : ''}</T>
            <T style={[type.small, { marginTop: 6 }]}>
              {t.players.map((p) => `${p.name}${p.slot === 'IR' ? ' (IR)' : p.slot === 'TAXI' ? ' (taxi)' : ''}${p.keeperRound ? ` (keeper rd ${p.keeperRound})` : ''}`).join(', ')}
            </T>
          </Card>
        ))}
        <View style={{ height: 8 }} />
        <Button
          label="Looks right. Move us to Coil"
          onPress={() => {
            const m = startMigration(L, `L-${Date.now()}`, 'you', L.teams[0]?.sourceTeamId ?? null);
            setMigration(m);
            setImport(L, m);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <T muted style={type.smallStrong}>‹ Home</T>
      </Pressable>
      <H1>Bring your league over</H1>
      <T muted style={{ marginBottom: 12 }}>You keep everything. Your league just taps a link.</T>
      {SOURCES.map((s) => (
        <Card key={s.key} highlight={source === s.key} onPress={() => (s.ready ? setSource(s.key) : toast(`${s.label} import is next on the list. Paste rosters works today.`))}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T style={type.title}>{s.label}</T>
            {!s.ready ? <T muted style={type.small}>Coming soon</T> : null}
          </View>
          <T muted style={{ marginTop: 2 }}>{s.how}</T>
          {source === 'sleeper' && s.key === 'sleeper' ? (
            <View style={{ marginTop: 12 }}>
              <Input value={username} onChangeText={(v) => { setUsername(v); setFound(null); }} autoCapitalize="none" autoCorrect={false} placeholder="Sleeper username" onSubmitEditing={lookup} />
              {error ? <T style={{ color: c.danger, marginTop: 6 }}>{error}</T> : null}
              <View style={{ height: 8 }} />
              {!found ? <Button label={busy ? 'Looking you up…' : 'Find my leagues'} disabled={busy || !username.trim()} onPress={lookup} /> : null}
              {found ? (
                <>
                  <T muted style={[type.small, { marginBottom: 6 }]}>{found.displayName}'s leagues. Tap one to bring it over.</T>
                  {found.leagues.map((lg) => (
                    <Pressable key={lg.leagueId} disabled={busy} onPress={() => runSleeper(lg.leagueId)} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: c.border, marginBottom: 6, backgroundColor: c.surfaceAlt }}>
                      <View style={{ flex: 1 }}>
                        <T style={type.bodyStrong}>{lg.name}</T>
                        <T muted style={type.small}>{lg.format} · {lg.teams} teams · {lg.season}</T>
                      </View>
                      <T style={{ color: c.accent }}>{busy ? '…' : 'Import ›'}</T>
                    </Pressable>
                  ))}
                  {!found.leagues.length ? <T muted>No leagues found for this season.</T> : null}
                </>
              ) : null}
              <T muted style={[type.micro, { marginTop: 6 }]}>Preview uses sample data. Only "Group Chat Dynasty" imports.</T>
            </View>
          ) : null}
          {source === 'paste' && s.key === 'paste' ? (
            <View style={{ marginTop: 12 }}>
              <Input value={text} onChangeText={setText} multiline style={{ minHeight: 220, textAlignVertical: 'top' }} />
              <T muted style={[type.micro, { marginTop: 6 }]}>One team per block: team name (manager), then players. Add (IR), (Taxi), "keeper rd 3", picks like "2027 1st (via Team)", and "FAAB: 50".</T>
              <View style={{ height: 8 }} />
              <Button label="Match my rosters" onPress={runPaste} />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
