import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { LeagueAvatar, leagueKicker, pickImage } from '../../components/league';
import { draftSummary, irSummary, playoffSummary, rosterSummary, scoringSummary, tradeSummary, waiverSummary } from '../../components/summaries';
import { c, Card, H1, Screen, Segmented, T } from '../../components/ui';
import { ME } from '../../demo/league';
import { isCommish, useApp } from '../../store/useApp';
import { type } from '../../theme/type';

type Item = { icon: string; title: string; sub: string; href: string; danger?: boolean };

export default function Settings() {
  const L = useApp((s) => s.league);
  const setLeagueImage = useApp((s) => s.setLeagueImage);
  const toast = useApp((s) => s.showToast);
  const commish = isCommish(L);
  const [tab, setTab] = useState<'general' | 'commish'>('general');
  const me = L.teams.find((t) => t.id === ME)!;
  const dynasty = L.settings.format === 'dynasty';

  const groups: { title: string; items: Item[] }[] = [
    {
      title: 'You',
      items: [
        { icon: '🐍', title: 'My team', sub: `${me.name} · image, name, player nicknames`, href: '/settings/myteam' },
        { icon: '🔔', title: 'Notifications', sub: 'Pick what buzzes your phone', href: '/settings/notifications' },
      ],
    },
    {
      title: 'Rules',
      items: [
        { icon: '🏈', title: 'League', sub: `${leagueKicker(L)} · name and image`, href: '/settings/league' },
        { icon: '➗', title: 'Scoring', sub: scoringSummary(L.settings.scoring), href: '/settings/scoring' },
        { icon: '📋', title: 'Roster and IR', sub: `${rosterSummary(L.settings)} · ${irSummary(L.settings)}`, href: '/settings/roster' },
        { icon: '🎯', title: 'Draft', sub: draftSummary(L.settings), href: '/settings/draft' },
        { icon: '🔁', title: 'Waivers and trades', sub: `${waiverSummary(L.settings)} · ${tradeSummary(L.settings)}`, href: '/settings/moves' },
        { icon: '🏆', title: 'Playoffs', sub: playoffSummary(L.settings), href: '/settings/playoffs' },
        { icon: '🧭', title: 'Divisions', sub: L.settings.divisions ? `${L.settings.divisions} divisions` : 'No divisions', href: '/settings/divisions' },
      ],
    },
    {
      title: 'League life',
      items: [
        { icon: '👥', title: 'Members', sub: `${L.teams.length} managers · invite link · co-owners`, href: '/settings/members' },
        // Dues parked for now (Nathan, 2026-11-17). Re-enable by restoring this row.
        // { icon: '💵', title: 'League dues', sub: L.dues ? `$${L.dues.amount} · ${L.dues.paid.length} of ${L.teams.length} paid · held outside Coil` : 'Not set up', href: '/settings/dues' },
        { icon: '📌', title: 'Commish note', sub: L.commishNote ?? 'Nothing pinned', href: '/settings/note' },
        { icon: '📜', title: 'League history', sub: L.history.length ? L.history.map((h) => `${h.season} ${h.champion}`).join(' · ') : 'Add past champions', href: '/settings/history' },
        { icon: '🧾', title: 'Draft results', sub: dynasty ? 'Startup draft, every pick' : 'This season, every pick', href: '/settings/draftresults' },
        { icon: '🩹', title: 'Stat corrections', sub: 'What changed after the games ended', href: '/settings/corrections' },
        { icon: '🔤', title: 'What the icons mean', sub: 'Q, D, O, IR, taxi, locks and more', href: '/settings/legend' },
      ],
    },
  ];

  const tools: Item[] = [
    { icon: '🏆', title: 'Playoff bracket', sub: 'Fix seeds or results in any round', href: '/commish/bracket' },
    { icon: '🧢', title: 'Commissioners', sub: `${L.commissioners.length} right now · add or remove co-commish`, href: '/commish/commissioners' },
    { icon: '🔀', title: 'Rosters and picks', sub: 'Force an add, drop or move; reassign picks', href: '/commish/rosters' },
    { icon: '🔒', title: 'Lock a roster', sub: `${L.teams.filter((t) => t.locked).length} locked`, href: '/commish/lock' },
    { icon: '✏️', title: 'Fix a score', sub: 'Change any week and records update', href: '/commish/scores' },
    { icon: '💰', title: 'Waiver order and FAAB', sub: 'Set priority and budget for any team', href: '/commish/waivers' },
    { icon: '📝', title: 'Set a lineup', sub: 'For a manager who forgot', href: '/commish/lineups' },
    { icon: '📅', title: 'Change matchups', sub: 'Swap opponents for any week', href: '/commish/schedule' },
    { icon: '♻️', title: 'Clear all rosters', sub: 'Keep the settings, start a fresh draft', href: '/commish/reset', danger: true },
    { icon: '🗑️', title: 'Delete league', sub: 'Gone for good, for everyone', href: '/commish/delete', danger: true },
  ];

  const Row = ({ it }: { it: Item }) => (
    <Pressable onPress={() => router.push(it.href as never)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: it.danger ? '#FF5D5D22' : c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ fontSize: 17 }}>{it.icon}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T style={[type.bodyStrong, it.danger ? { color: c.danger } : null]}>{it.title}</T>
        <T muted style={type.small} numberOfLines={2}>{it.sub}</T>
      </View>
      <T muted>›</T>
    </Pressable>
  );

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/league'))}>
        <T muted style={type.smallStrong}>‹ Back</T>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <Pressable
          disabled={!commish}
          onPress={async () => {
            const uri = await pickImage();
            if (uri) {
              setLeagueImage(uri);
              toast('New league image. Everyone will see it.');
            }
          }}
        >
          <LeagueAvatar league={L} size={56} />
          {commish ? <T style={{ position: 'absolute', right: -4, bottom: -4, fontSize: 14 }}>📷</T> : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          <H1 kicker="League settings">{L.name}</H1>
        </View>
      </View>
      {L.commishNote ? (
        <Card style={{ borderColor: c.accent }}>
          <T style={[type.label, { color: c.accent }]}>📌 FROM THE COMMISH</T>
          <T style={{ marginTop: 4 }}>{L.commishNote}</T>
        </Card>
      ) : null}
      {commish ? (
        <Segmented value={tab} onChange={setTab} options={[{ key: 'general', label: 'League' }, { key: 'commish', label: 'Commish tools' }]} />
      ) : (
        <T muted style={[type.small, { marginBottom: 10 }]}>You can see every rule here. Only commissioners can change them, and every change is posted in chat.</T>
      )}
      {tab === 'general' || !commish ? (
        groups.map((g) => (
          <View key={g.title}>
            <T muted style={[type.label, { marginTop: 12, marginBottom: 2, letterSpacing: 1 }]}>{g.title.toUpperCase()}</T>
            <Card style={{ paddingVertical: 0 }}>
              {g.items.map((it) => <Row key={it.title} it={it} />)}
            </Card>
          </View>
        ))
      ) : (
        <>
          <T muted style={[type.small, { marginBottom: 6 }]}>Everything you change here is posted in league chat, with what changed.</T>
          <Card style={{ paddingVertical: 0 }}>
            {tools.map((it) => <Row key={it.title} it={it} />)}
          </Card>
        </>
      )}
    </Screen>
  );
}
