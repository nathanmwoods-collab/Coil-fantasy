import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { TeamAvatar } from '../../components/league';
import { Button, c, Card, Chip, H1, Input, PlayerAvatar, Screen, Stepper, T } from '../../components/ui';
import { CURRENT_WEEK } from '../../demo/league';
import { firstRound, pickLabel } from '../../engine';
import { isCommish, useApp } from '../../store/useApp';
import { type } from '../../theme/type';

const TITLES: Record<string, [string, string]> = {
  bracket: ['Playoff bracket', 'Seeds come from the standings; adjust if you have to'],
  commissioners: ['Commissioners', 'Share the load'],
  rosters: ['Rosters and picks', 'Force a move when a manager can’t'],
  lock: ['Lock a roster', 'Freeze adds, drops and trades for a team'],
  scores: ['Fix a score', 'Records and standings update right away'],
  waivers: ['Waiver order and FAAB', 'Priority and budget for every team'],
  lineups: ['Set a lineup', 'For a manager who forgot'],
  schedule: ['Change matchups', 'Swap two teams’ opponents for a week'],
  reset: ['Clear all rosters', 'Settings stay, players go back to the pool'],
  delete: ['Delete league', 'This cannot be undone'],
};

export default function CommishTool() {
  const { tool = 'scores' } = useLocalSearchParams<{ tool: string }>();
  const L = useApp((s) => s.league);
  const st = useApp();
  const [teamId, setTeamId] = useState(L.teams[0].id);
  const [week, setWeek] = useState(CURRENT_WEEK - 1);
  const [pick, setPick] = useState<string | null>(null);
  const [swapA, setSwapA] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [seeds, setSeeds] = useState(() => L.standings.slice(0, L.settings.playoffs.teams).map((r) => r.teamId));
  const ws = L.weeks.find((w) => w.week === week);
  const [scores, setScores] = useState<Record<string, string>>({});
  const team = (id: string) => L.teams.find((t) => t.id === id)!;
  const freeAgents = useMemo(() => {
    const owned = new Set(L.teams.flatMap((t) => t.players));
    return Object.values(L.players).filter((p) => !owned.has(p.id)).sort((a, b) => b.proj - a.proj).slice(0, 12);
  }, [L]);

  if (!isCommish(L)) {
    return (
      <Screen>
        <Back />
        <H1 kicker="Commish only">Not your call</H1>
        <T muted>Only commissioners can use this. Ask one of them in chat.</T>
      </Screen>
    );
  }

  const [title, sub] = TITLES[tool] ?? ['Commish tools', ''];
  const TeamPicker = () => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
      {L.teams.map((t) => (
        <Pressable key={t.id} onPress={() => setTeamId(t.id)} style={{ opacity: t.id === teamId ? 1 : 0.5, borderWidth: t.id === teamId ? 2 : 0, borderColor: c.primary, borderRadius: 12 }}>
          <TeamAvatar team={t} size={34} />
        </Pressable>
      ))}
    </View>
  );

  let body: React.ReactNode = null;
  switch (tool) {
    case 'commissioners':
      body = (
        <Card style={{ paddingVertical: 4 }}>
          {L.teams.map((t) => (
            <View key={t.id} style={rowS}>
              <TeamAvatar team={t} size={30} />
              <View style={{ flex: 1 }}>
                <T style={type.bodyStrong}>{t.manager}</T>
                <T muted style={type.small}>{t.name}</T>
              </View>
              <Switch value={L.commissioners.includes(t.id)} onValueChange={() => (L.commissioners.length === 1 && L.commissioners.includes(t.id) ? st.showToast('A league needs at least one commish.') : st.toggleCommissioner(t.id))} trackColor={{ true: c.primary, false: c.surfaceAlt }} />
            </View>
          ))}
        </Card>
      );
      break;
    case 'lock':
      body = (
        <Card style={{ paddingVertical: 4 }}>
          {L.teams.map((t) => (
            <View key={t.id} style={rowS}>
              <TeamAvatar team={t} size={30} />
              <T style={[type.bodyStrong, { flex: 1 }]}>{t.name}</T>
              <T muted style={[type.small, { marginRight: 8 }]}>{t.locked ? '🔒 Locked' : 'Open'}</T>
              <Switch value={!!t.locked} onValueChange={() => st.toggleLock(t.id)} trackColor={{ true: c.danger, false: c.surfaceAlt }} />
            </View>
          ))}
        </Card>
      );
      break;
    case 'waivers':
      body = (
        <Card style={{ paddingVertical: 4 }}>
          <View style={[rowS, { borderBottomColor: c.border }]}>
            <T muted style={[type.label, { flex: 1 }]}>TEAM</T>
            <T muted style={[type.label, { width: 120, textAlign: 'center' }]}>PRIORITY</T>
            <T muted style={[type.label, { width: 130, textAlign: 'center' }]}>FAAB</T>
          </View>
          {[...L.teams].sort((a, b) => a.waiverPriority - b.waiverPriority).map((t) => {
            const r = L.standings.find((x) => x.teamId === t.id)!;
            return (
              <View key={t.id} style={rowS}>
                <TeamAvatar team={t} size={28} />
                <View style={{ flex: 1 }}>
                  <T style={type.smallStrong} numberOfLines={1}>{t.name}</T>
                  <T muted style={type.micro}>{r.wins}-{r.losses}</T>
                </View>
                <View style={{ width: 120, alignItems: 'center' }}>
                  <Stepper value={t.waiverPriority} min={1} max={L.teams.length} onChange={(n) => st.setWaiverPriority(t.id, n)} />
                </View>
                <View style={{ width: 130, alignItems: 'center' }}>
                  <Stepper value={t.faab} min={0} max={L.settings.waivers.faabBudget * 2} step={5} format={(v) => `$${v}`} onChange={(n) => st.setFaab(t.id, n)} />
                </View>
              </View>
            );
          })}
        </Card>
      );
      break;
    case 'scores':
      body = (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Stepper value={week} min={1} max={CURRENT_WEEK - 1} format={(v) => `Week ${v}`} onChange={(n) => { setWeek(n); setScores({}); }} />
          </View>
          {L.schedule.filter((m) => m.week === week).map((m) => (
            <Card key={m.home}>
              {[m.home, m.away].map((id) => (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <TeamAvatar team={team(id)} size={26} />
                  <T style={[type.smallStrong, { flex: 1 }]} numberOfLines={1}>{team(id).name}</T>
                  <Input value={scores[id] ?? ws?.scores[id]?.toFixed(2) ?? ''} onChangeText={(v) => setScores({ ...scores, [id]: v })} keyboardType="decimal-pad" style={{ width: 96, textAlign: 'right', paddingVertical: 8 }} />
                </View>
              ))}
            </Card>
          ))}
          <Button
            label="Save scores and update records"
            disabled={!Object.keys(scores).length}
            onPress={() => {
              for (const [id, v] of Object.entries(scores)) if (!Number.isNaN(Number(v))) st.editScore(week, id, Number(v));
              setScores({});
              st.showToast('Scores fixed. Standings updated and the league was told.');
            }}
          />
        </>
      );
      break;
    case 'rosters': {
      const t = team(teamId);
      body = (
        <>
          <TeamPicker />
          <Card style={{ paddingVertical: 4 }}>
            <T style={[type.title, { paddingVertical: 8 }]}>{t.name}</T>
            {t.players.map((pid) => {
              const p = L.players[pid];
              return (
                <View key={pid}>
                  <Pressable onPress={() => setPick(pick === pid ? null : pid)} style={rowS}>
                    <PlayerAvatar name={p.name} position={p.position} size={28} />
                    <T style={[type.smallStrong, { flex: 1 }]}>{p.name} <T muted style={type.micro}>{p.position} · {p.nflTeam}</T></T>
                    <T muted style={type.small}>Move ›</T>
                  </Pressable>
                  {pick === pid ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 }}>
                      {L.teams.filter((x) => x.id !== teamId).map((x) => <Chip key={x.id} label={`→ ${x.name}`} onPress={() => { st.forceMove(pid, x.id); setPick(null); st.showToast(`${p.name} moved to ${x.name}.`); }} />)}
                      <Chip label="Drop to free agency" color={c.danger} active onPress={() => { st.forceMove(pid, null); setPick(null); st.showToast(`${p.name} dropped.`); }} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
          <T muted style={[type.label, { marginTop: 10 }]}>FORCE-ADD A FREE AGENT TO {t.name.toUpperCase()}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
            {freeAgents.map((p) => <Chip key={p.id} label={`＋ ${p.name}`} onPress={() => { st.forceMove(p.id, teamId); st.showToast(`${p.name} added to ${t.name}.`); }} />)}
          </View>
          {L.settings.format === 'dynasty' ? (
            <>
              <T muted style={[type.label, { marginTop: 14 }]}>{t.name.toUpperCase()}'S DRAFT PICKS · TAP TO REASSIGN</T>
              <Card style={{ paddingVertical: 4, marginTop: 6 }}>
                {L.picks.filter((p) => p.ownerTeamId === teamId).map((p) => (
                  <View key={p.id}>
                    <Pressable onPress={() => setPick(pick === p.id ? null : p.id)} style={rowS}>
                      <T style={[type.smallStrong, { flex: 1 }]}>{pickLabel(p, (id) => team(id).name)}</T>
                      <T muted style={type.small}>Move ›</T>
                    </Pressable>
                    {pick === p.id ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 }}>
                        {L.teams.filter((x) => x.id !== teamId).map((x) => <Chip key={x.id} label={`→ ${x.name}`} onPress={() => { st.movePick(p.id, x.id); setPick(null); }} />)}
                      </View>
                    ) : null}
                  </View>
                ))}
              </Card>
            </>
          ) : null}
        </>
      );
      break;
    }
    case 'schedule':
      body = (
        <>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 8 }}>
            <Stepper value={week} min={CURRENT_WEEK} max={L.settings.regularSeasonWeeks} format={(v) => `Week ${v}`} onChange={(n) => { setWeek(n); setSwapA(null); }} />
          </View>
          <T muted style={[type.small, { textAlign: 'center', marginBottom: 8 }]}>{swapA ? `Now tap the team ${team(swapA).name} should trade opponents with.` : 'Tap a team, then another, to swap their opponents.'}</T>
          {L.schedule.filter((m) => m.week === Math.max(week, CURRENT_WEEK)).map((m) => (
            <Card key={m.home + m.away}>
              {[m.home, m.away].map((id) => (
                <Pressable
                  key={id}
                  onPress={() => {
                    if (!swapA) return setSwapA(id);
                    if (swapA !== id) {
                      st.swapOpponents(Math.max(week, CURRENT_WEEK), swapA, id);
                      st.showToast('Matchups swapped. The league was told.');
                    }
                    setSwapA(null);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, backgroundColor: swapA === id ? '#7C5CFF33' : undefined, borderRadius: 8 }}
                >
                  <TeamAvatar team={team(id)} size={26} />
                  <T style={type.smallStrong}>{team(id).name}</T>
                </Pressable>
              ))}
            </Card>
          ))}
        </>
      );
      break;
    case 'bracket': {
      const round = firstRound(L.settings, seeds);
      const seedOf = (id: string | null) => (id ? seeds.indexOf(id) + 1 : 0);
      body = (
        <>
          <Card style={{ paddingVertical: 4 }}>
            {seeds.map((id, i) => (
              <View key={id} style={rowS}>
                <T style={[type.num, { width: 26, color: c.accent }]}>{i + 1}</T>
                <TeamAvatar team={team(id)} size={26} />
                <T style={[type.smallStrong, { flex: 1 }]}>{team(id).name}</T>
                <Pressable disabled={i === 0} onPress={() => { const n = [...seeds]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setSeeds(n); }} style={{ padding: 6, opacity: i === 0 ? 0.3 : 1 }}><T>▲</T></Pressable>
                <Pressable disabled={i === seeds.length - 1} onPress={() => { const n = [...seeds]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setSeeds(n); }} style={{ padding: 6, opacity: i === seeds.length - 1 ? 0.3 : 1 }}><T>▼</T></Pressable>
              </View>
            ))}
          </Card>
          <T muted style={[type.label, { marginTop: 8 }]}>FIRST ROUND</T>
          <Card>
            {round.map((g) =>
              g.low ? (
                <T key={g.high} style={[type.small, { marginTop: 4 }]}>#{seedOf(g.high)} {team(g.high).name} vs #{seedOf(g.low)} {team(g.low).name}</T>
              ) : (
                <T key={g.high} muted style={[type.small, { marginTop: 4 }]}>#{seedOf(g.high)} {team(g.high).name} gets a bye</T>
              ),
            )}
          </Card>
          <Button label="Save seeds and tell the league" onPress={() => { st.postNotice(`playoff seeds set: ${seeds.map((id, i) => `${i + 1}. ${team(id).name}`).join(', ')}`); st.showToast('Seeds saved.'); router.back(); }} />
        </>
      );
      break;
    }
    case 'lineups':
      body = (
        <>
          <TeamPicker />
          <Card>
            <T style={type.bodyStrong}>{team(teamId).name}</T>
            <T muted style={[type.small, { marginTop: 4 }]}>Open their team to see the lineup. In the full build you swap starters here exactly the way the manager would, and the league sees "Lineup set by the commish" on that team for the week.</T>
            <View style={{ height: 8 }} />
            <Button small kind="secondary" label="Open their team" onPress={() => router.push(`/team/${teamId}`)} />
          </Card>
        </>
      );
      break;
    case 'reset':
    case 'delete':
      body = (
        <Card style={{ borderColor: c.danger }}>
          <T>{tool === 'reset' ? 'Every player goes back to the pool so you can draft again. Scoring, roster spots and every other setting stay as they are.' : `${L.name} disappears for every manager, chat and history included.`}</T>
          <T muted style={[type.small, { marginTop: 10 }]}>Type the league name to confirm.</T>
          <Input value={confirm} onChangeText={setConfirm} placeholder={L.name} style={{ marginTop: 6 }} />
          <View style={{ height: 10 }} />
          <Button
            kind="danger"
            label={tool === 'reset' ? 'Clear every roster' : 'Delete this league'}
            disabled={confirm.trim() !== L.name}
            onPress={() => {
              if (tool === 'reset') {
                st.clearRosters();
                st.showToast('Rosters cleared. Time to draft.');
                router.back();
              } else if (st.leagues.length < 2) {
                st.showToast('The preview needs at least one league, so this one stays.');
              } else {
                st.removeLeague();
                st.showToast('League deleted.');
                router.replace('/');
              }
            }}
          />
        </Card>
      );
      break;
  }

  return (
    <Screen>
      <Back />
      <H1 kicker={sub}>{title}</H1>
      {body}
      <T muted style={[type.micro, { textAlign: 'center', marginTop: 10 }]}>Every change here is posted in league chat.</T>
    </Screen>
  );
}

function Back() {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}>
      <T muted style={type.smallStrong}>‹ Commish tools</T>
    </Pressable>
  );
}

const rowS = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2C2C4A' };
