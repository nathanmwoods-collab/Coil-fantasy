import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';

import { pickImage, TeamAvatar } from '../../components/league';
import { SettingsEditor, type SettingsSection } from '../../components/SettingsEditor';
import { Button, c, Card, Chip, H1, InjuryBadge, Input, Row, Screen, Stepper, T } from '../../components/ui';
import { CURRENT_SEASON, ME } from '../../demo/league';
import { buildDraftOrder, describeSettingsChanges, injuryTag, type InjuryStatus, type LeagueSettings } from '../../engine';
import { isCommish, useApp } from '../../store/useApp';
import { type } from '../../theme/type';

const TITLES: Record<string, [string, string]> = {
  myteam: ['My team', 'How you show up in the league'],
  notifications: ['Notifications', 'Only what you care about'],
  league: ['League', 'The basics'],
  roster: ['Roster and IR', 'Spots, limits and who can sit on IR'],
  draft: ['Draft', 'Type, order and timer'],
  moves: ['Waivers and trades', 'How players change hands'],
  playoffs: ['Playoffs', 'Who gets in and when'],
  divisions: ['Divisions', 'Rivalries, organized'],
  members: ['Members', 'Who runs which team'],
  dues: ['League dues', 'Collected outside Coil'],
  note: ['Commish note', 'Pinned for everyone'],
  history: ['League history', 'Banners forever'],
  draftresults: ['Draft results', 'Every pick'],
  corrections: ['Stat corrections', 'After the final whistle'],
  legend: ['What the icons mean', 'A quick key'],
};

const NOTIFY: [string, string, string][] = [
  ['scoring', 'Big plays and close finishes', 'When your players score, and when a matchup is coming down to the wire'],
  ['injuries', 'Injuries and inactives', 'The moment a player of yours is Q, D, O or ruled out'],
  ['news', 'Player news', 'Approved news on players you roster or watch'],
  ['trades', 'Trades', 'Offers, counters and trades across the league'],
  ['waivers', 'Waivers', 'Results of every run, including bids you lost'],
  ['chat', 'League chat', 'Messages and mentions'],
  ['lineupReminders', 'Lineup reminders', 'A nudge before kickoff if a starter is out or on bye'],
];

export default function SettingsSectionScreen() {
  const { section = 'league' } = useLocalSearchParams<{ section: string }>();
  const L = useApp((s) => s.league);
  const st = useApp();
  const commish = isCommish(L);
  const me = L.teams.find((t) => t.id === ME)!;
  const [draft, setDraft] = useState<LeagueSettings>(() => structuredClone(L.settings));
  const [teamName, setTeamName] = useState(me.name);
  const [note, setNote] = useState(L.commishNote ?? '');
  const [duesUrl, setDuesUrl] = useState(L.dues?.url ?? '');
  const [duesAmt, setDuesAmt] = useState(L.dues?.amount ?? 50);
  const [season, setSeason] = useState(CURRENT_SEASON - 1);
  const [champ, setChamp] = useState('');
  const [title, sub] = TITLES[section] ?? ['Settings', ''];
  const editable = ['roster', 'draft', 'moves', 'playoffs', 'league', 'divisions'].includes(section);
  const changes = editable ? describeSettingsChanges(L.settings, draft) : [];

  const patch = (fn: (d: LeagueSettings) => void) => {
    if (!commish) return;
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  const save = () => {
    const n = st.updateSettings(draft).length;
    st.showToast(n ? `Saved. The league got a note about ${n === 1 ? 'the change' : `all ${n} changes`}.` : 'Nothing changed.');
    if (n) router.back();
  };

  let body: React.ReactNode = null;
  switch (section) {
    case 'myteam':
      body = (
        <>
          <Card style={{ alignItems: 'center' }}>
            <Pressable
              onPress={async () => {
                const uri = await pickImage();
                if (uri) {
                  st.updateMyTeam({ imageUri: uri });
                  st.showToast('New team image. Looking sharp.');
                }
              }}
            >
              <TeamAvatar team={me} size={96} />
            </Pressable>
            <T style={[type.smallStrong, { color: c.accent, marginTop: 8 }]}>{me.imageUri ? 'Change image' : 'Upload a team image'}</T>
            {me.imageUri ? (
              <Pressable onPress={() => st.updateMyTeam({ imageUri: undefined })}>
                <T muted style={[type.small, { marginTop: 4 }]}>Use the emoji instead</T>
              </Pressable>
            ) : null}
          </Card>
          <Card>
            <T muted style={type.label}>TEAM NAME</T>
            <Input value={teamName} onChangeText={setTeamName} style={{ marginTop: 6 }} />
            <T muted style={[type.label, { marginTop: 12 }]}>EMOJI</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
              {['🐍', '🔥', '🦅', '🐐', '🍕', '🦖', '⚡️', '🧊', '🌮', '👑'].map((e) => <Chip key={e} label={e} active={me.emoji === e} onPress={() => st.updateMyTeam({ emoji: e })} />)}
            </View>
            <View style={{ height: 10 }} />
            <Button label="Save name" disabled={!teamName.trim() || teamName === me.name} onPress={() => { st.renameTeam(ME, teamName.trim()); st.showToast('Renamed. The league will see it in chat.'); }} />
          </Card>
          <T muted style={[type.micro, { textAlign: 'center' }]}>Player nicknames are coming next: rename anyone on your roster, only your league sees it.</T>
        </>
      );
      break;
    case 'notifications':
      body = (
        <Card style={{ paddingVertical: 4 }}>
          {NOTIFY.map(([k, label, hint]) => (
            <Row key={k} label={label} hint={hint}>
              <Switch value={L.notify[k] ?? true} onValueChange={(v) => st.setNotify(k, v)} trackColor={{ true: c.primary, false: c.surfaceAlt }} />
            </Row>
          ))}
        </Card>
      );
      break;
    case 'league':
      body = (
        <Card>
          <T muted style={type.label}>LEAGUE NAME</T>
          <Input value={draft.name} editable={commish} onChangeText={(name) => patch((d) => { d.name = name; })} style={{ marginTop: 6 }} />
          <Row label="Format" hint="Changing format after the draft is a commissioner call; we keep rosters as they are">
            <T style={type.bodyStrong}>{{ redraft: 'Redraft', keeper: 'Keeper', dynasty: 'Dynasty', bestball: 'Best ball' }[draft.format]}</T>
          </Row>
          <Row label="Teams">
            <T style={type.bodyStrong}>{draft.teams}</T>
          </Row>
          <Row label="Regular season" hint="Weeks before the playoffs">
            <Stepper value={draft.regularSeasonWeeks} min={4} max={17} onChange={(n) => patch((d) => { d.regularSeasonWeeks = n; d.playoffs.startWeek = n + 1; })} />
          </Row>
          <Row label="Median game" hint="Everyone also plays the league median each week">
            <Chip label={draft.matchups.medianGame ? 'On' : 'Off'} active={draft.matchups.medianGame} onPress={() => patch((d) => { d.matchups.medianGame = !d.matchups.medianGame; })} />
          </Row>
          <Row label="Lineups lock" hint={draft.lineupLock === 'game_start' ? 'Each player locks at his own kickoff' : 'Everyone locks at the first kickoff'}>
            <Chip label={draft.lineupLock === 'game_start' ? 'Per game' : 'Weekly'} active onPress={() => patch((d) => { d.lineupLock = d.lineupLock === 'game_start' ? 'week_start' : 'game_start'; })} />
          </Row>
          <Row label="Auto-sub inactive starters" hint="Swap in the best bench player if a starter is ruled out">
            <Chip label={draft.autoSubInactive ? 'On' : 'Off'} active={draft.autoSubInactive} onPress={() => patch((d) => { d.autoSubInactive = !d.autoSubInactive; })} />
          </Row>
        </Card>
      );
      break;
    case 'roster':
    case 'draft':
    case 'moves':
    case 'playoffs':
      body = (
        <View pointerEvents={commish ? 'auto' : 'none'} style={{ opacity: commish ? 1 : 0.85 }}>
          <SettingsEditor section={section as SettingsSection} s={draft} patch={patch} />
        </View>
      );
      break;
    case 'divisions':
      body = (
        <Card>
          <Row label="Divisions" hint="Division winners can take the top playoff seeds">
            <Stepper value={draft.divisions} min={0} max={4} onChange={(n) => patch((d) => { d.divisions = n; })} />
          </Row>
          {draft.divisions ? (
            <Row label="Division winners seeded first">
              <Chip label={draft.playoffs.divisionWinnersFirst ? 'On' : 'Off'} active={draft.playoffs.divisionWinnersFirst} onPress={() => patch((d) => { d.playoffs.divisionWinnersFirst = !d.playoffs.divisionWinnersFirst; })} />
            </Row>
          ) : null}
          {draft.divisions ? (
            <T muted style={[type.small, { marginTop: 8 }]}>Teams split in order: {L.teams.map((t, i) => `${t.name} (${(i % draft.divisions) + 1})`).join(', ')}. Drag-to-assign comes with the full build.</T>
          ) : null}
        </Card>
      );
      break;
    case 'members':
      body = (
        <>
          <Card>
            <T style={type.bodyStrong}>Invite link</T>
            <T muted style={[type.small, { marginVertical: 6 }]}>Anyone with the link picks an open team. No account hoops before they see the league.</T>
            <Button small kind="secondary" label="Copy invite link" onPress={() => st.showToast('Invite link copied.')} />
          </Card>
          <Card style={{ paddingVertical: 4 }}>
            {L.teams.map((t) => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <TeamAvatar team={t} size={32} />
                <View style={{ flex: 1 }}>
                  <T style={type.bodyStrong}>{t.name}</T>
                  <T muted style={type.small}>{t.manager}{L.commissioners.includes(t.id) ? ' · Commish' : ''}</T>
                </View>
                {t.id === ME ? <Button small kind="ghost" label="Add co-owner" onPress={() => st.showToast('Co-owner invite copied. They can set lineups and make moves for your team.')} /> : null}
              </View>
            ))}
          </Card>
        </>
      );
      break;
    case 'dues':
      body = (
        <>
          <Card>
            <T style={type.bodyStrong}>Coil never holds your money</T>
            <T muted style={[type.small, { marginTop: 4 }]}>Collect dues with a service like LeagueSafe, then paste your league's join link here. Everyone gets a Pay dues button that opens it, and you check off who has paid.</T>
          </Card>
          {L.dues?.url ? (
            <Button label={`Pay $${L.dues.amount} dues`} onPress={() => Linking.openURL(L.dues!.url)} />
          ) : null}
          {commish ? (
            <Card style={{ marginTop: 10 }}>
              <T muted style={type.label}>DUES LINK</T>
              <Input value={duesUrl} onChangeText={setDuesUrl} autoCapitalize="none" placeholder="https://www.leaguesafe.com/join/…" style={{ marginTop: 6 }} />
              <Row label="Amount per team">
                <Stepper value={duesAmt} min={0} max={5000} step={5} format={(v) => `$${v}`} onChange={setDuesAmt} />
              </Row>
              <View style={{ height: 8 }} />
              <Button small label="Save dues link" disabled={!/^https:\/\//.test(duesUrl)} onPress={() => { st.setDues({ url: duesUrl, amount: duesAmt, paid: L.dues?.paid ?? [] }); st.showToast('Saved. The league knows where to pay.'); }} />
            </Card>
          ) : null}
          {L.dues ? (
            <Card style={{ paddingVertical: 4 }}>
              {L.teams.map((t) => {
                const paid = L.dues!.paid.includes(t.id);
                return (
                  <Pressable key={t.id} disabled={!commish} onPress={() => st.toggleDuesPaid(t.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
                    <TeamAvatar team={t} size={28} />
                    <T style={[type.bodyStrong, { flex: 1 }]}>{t.name}</T>
                    <T style={{ color: paid ? c.success : c.warning }}>{paid ? '✓ Paid' : 'Not yet'}</T>
                  </Pressable>
                );
              })}
            </Card>
          ) : null}
          {commish ? <T muted style={[type.micro, { textAlign: 'center' }]}>Tap a team to mark them paid.</T> : null}
        </>
      );
      break;
    case 'note':
      body = commish ? (
        <Card>
          <Input value={note} onChangeText={setNote} multiline placeholder="Rookie draft date, rule reminders, trash talk…" style={{ minHeight: 120, textAlignVertical: 'top' }} />
          <View style={{ height: 8 }} />
          <Button label="Pin it" onPress={() => { st.setCommishNote(note.trim()); st.showToast(note.trim() ? 'Pinned. The league got a heads up.' : 'Note removed.'); router.back(); }} />
        </Card>
      ) : (
        <Card>
          <T>{L.commishNote ?? 'Nothing pinned right now.'}</T>
        </Card>
      );
      break;
    case 'history':
      body = (
        <>
          {L.history.map((h) => (
            <Card key={h.season} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <T style={{ fontSize: 28 }}>🏆</T>
              <View style={{ flex: 1 }}>
                <T style={type.title}>{h.champion}</T>
                <T muted style={type.small}>{h.season} champion{h.runnerUp ? ` · beat ${h.runnerUp}` : ''}</T>
              </View>
            </Card>
          ))}
          {commish ? (
            <Card>
              <T muted style={type.label}>ADD A PAST CHAMPION</T>
              <Row label="Season">
                <Stepper value={season} min={1990} max={CURRENT_SEASON} onChange={setSeason} />
              </Row>
              <Input value={champ} onChangeText={setChamp} placeholder="Champion team or manager" style={{ marginTop: 8 }} />
              <View style={{ height: 8 }} />
              <Button small label="Add to history" disabled={!champ.trim()} onPress={() => { st.addHistory(season, champ.trim()); setChamp(''); }} />
            </Card>
          ) : null}
        </>
      );
      break;
    case 'draftresults': {
      const board = buildDraftOrder('snake', L.teams.map((t) => t.id), L.settings.draft.rounds);
      const taken = new Map(L.teams.map((t) => [t.id, 0]));
      body = (
        <Card style={{ paddingVertical: 4 }}>
          {board.slice(0, L.teams.length * 6).map((slot, i) => {
            const t = L.teams.find((x) => x.id === slot.teamId)!;
            const k = taken.get(t.id)!;
            taken.set(t.id, k + 1);
            const pid = t.players[k];
            const p = pid ? L.players[pid] : null;
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
                <T style={[type.num, { width: 44, color: c.textMuted, fontSize: 12 }]}>{slot.round}.{String(((i % L.teams.length) + 1)).padStart(2, '0')}</T>
                <TeamAvatar team={t} size={22} />
                <T style={[type.smallStrong, { flex: 1 }]} numberOfLines={1}>{p?.name ?? '—'}</T>
                <T muted style={type.micro}>{p ? `${p.position} · ${p.nflTeam}` : ''}</T>
              </View>
            );
          })}
          <T muted style={[type.micro, { paddingVertical: 8 }]}>First six rounds shown in the preview.</T>
        </Card>
      );
      break;
    }
    case 'corrections':
      body = (
        <Card>
          <T style={type.bodyStrong}>Week 10</T>
          <T muted style={[type.small, { marginTop: 4 }]}>The league reviews stats on Tuesday and Thursday. When a stat changes, the score updates here and in chat, with exactly which player and stat moved.</T>
          <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.border }}>
            <T>{Object.values(L.players)[2].name}: a 12-yard catch ruled a run. Receiving −12, rushing +12, catches −1.</T>
            <T muted style={type.micro}>Example correction in the preview.</T>
          </View>
        </Card>
      );
      break;
    case 'legend':
      body = (
        <Card style={{ paddingVertical: 4 }}>
          {(['questionable', 'doubtful', 'out', 'ir', 'pup', 'suspended'] as InjuryStatus[]).map((s) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <View style={{ width: 44 }}><InjuryBadge status={s} /></View>
              <T style={{ flex: 1 }}>{injuryTag(s).label}</T>
            </View>
          ))}
          {[
            ['TAXI', 'Taxi squad. Stashed young player, doesn\'t use a roster spot'],
            ['🔒', 'Locked by the commissioner. No adds, drops or trades'],
            ['🧢', 'Commissioner'],
            ['proj', 'Projection. During games it updates with what has already happened'],
            ['▲ ▼', 'Rank moves after a rule change'],
          ].map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <T style={[type.smallStrong, { width: 44 }]}>{k}</T>
              <T style={{ flex: 1 }}>{v}</T>
            </View>
          ))}
        </Card>
      );
      break;
    default:
      body = <T>Nothing here yet.</T>;
  }

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}>
        <T muted style={type.smallStrong}>‹ Settings</T>
      </Pressable>
      <H1 kicker={editable && !commish ? 'Read only · commissioners can edit' : sub}>{title}</H1>
      {body}
      {editable && commish ? (
        <View style={{ marginTop: 12 }}>
          <Button label={changes.length ? `Save ${changes.length} change${changes.length === 1 ? '' : 's'} and tell the league` : 'No changes yet'} disabled={!changes.length} onPress={save} />
          {changes.length ? <T muted style={[type.micro, { marginTop: 6, textAlign: 'center' }]}>{changes.slice(0, 4).join(' · ')}</T> : null}
        </View>
      ) : null}
    </Screen>
  );
}
