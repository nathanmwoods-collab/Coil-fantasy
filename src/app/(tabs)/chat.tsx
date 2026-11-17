import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LeagueHeader, TeamAvatar } from '../../components/league';
import { EmojiPicker, Reactions } from '../../components/Reactions';
import { Button, c, Input, Segmented, T } from '../../components/ui';
import { ME } from '../../demo/league';
import { eventCopy, plainText, type ChatMessage } from '../../engine';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

const LABEL: Record<string, string> = { trade: 'Trade', waiver: 'Waivers', waiver_run: 'Waivers', free_agent: 'Free agency', commissioner_edit: 'Commish', close_win: 'Final', big_win: 'Final', high_score: 'Final', draft_starting: 'Draft' };
const MOVES = new Set(['trade', 'waiver', 'waiver_run', 'free_agent', 'commissioner_edit']);

export default function Chat() {
  const L = useApp((s) => s.league);
  const send = useApp((s) => s.sendChat);
  const react = useApp((s) => s.react);
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'chat' | 'activity'>('chat');
  const [picking, setPicking] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const team = (id: string | null) => L.teams.find((t) => t.id === id);
  const teamByName = (n: string) => L.teams.find((t) => t.name === n);
  const shown = tab === 'chat' ? L.chat : L.chat.filter((m) => m.event && MOVES.has(m.event.type));
  const time = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });

  const Event = ({ m }: { m: ChatMessage }) => {
    const e = m.event!;
    if (e.type === 'waiver_run') {
      return (
        <View>
          {e.results.map((r, i) => (
            <View key={i} style={{ marginTop: i ? 10 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {teamByName(r.winner) ? <TeamAvatar team={teamByName(r.winner)!} size={22} /> : null}
                <T style={type.bodyStrong}>
                  <T style={{ color: c.success }}>＋ {r.player}</T> <T muted style={type.small}>to {r.winner} · ${r.bid}</T>
                </T>
              </View>
              {r.dropped ? <T style={[type.small, { color: c.danger, marginLeft: 30 }]}>− {r.dropped}</T> : null}
              {r.losers.map((l) => (
                <T key={l.team} muted style={[type.small, { marginLeft: 30 }]}>
                  {l.team === team(ME)?.name ? 'You' : l.team} bid ${l.bid} and came up short
                </T>
              ))}
            </View>
          ))}
        </View>
      );
    }
    if (e.type === 'free_agent') {
      const t = teamByName(e.team);
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {t ? <TeamAvatar team={t} size={22} /> : null}
          <View style={{ flex: 1 }}>
            <T muted style={type.small}>{e.team}</T>
            {e.added ? <T style={[type.bodyStrong, { color: c.success }]}>＋ {e.added}</T> : null}
            {e.dropped ? <T style={[type.bodyStrong, { color: c.danger }]}>− {e.dropped}</T> : null}
          </View>
        </View>
      );
    }
    return <T>{eventCopy(e, Number(m.id.replace(/\D/g, '')) || 0)}</T>;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <LeagueHeader sub={`${L.teams.length} managers`} />
        <Segmented value={tab} onChange={setTab} options={[{ key: 'chat', label: 'Chat' }, { key: 'activity', label: 'Moves' }]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        {L.commishNote && tab === 'chat' ? (
          <View style={{ borderColor: c.accent, borderWidth: 1, borderRadius: 14, padding: 10 }}>
            <T style={[type.label, { color: c.accent }]}>📌 PINNED BY THE COMMISH</T>
            <T style={{ marginTop: 2 }}>{L.commishNote}</T>
          </View>
        ) : null}
        {shown.map((m) => {
          const isCoil = m.author.kind === 'coil';
          const t = m.author.kind === 'member' ? team(m.author.teamId) : undefined;
          const mine = t?.id === ME;
          const counts = Object.fromEntries(Object.entries(m.reactions).map(([e, u]) => [e, u.length]));
          const myReacts = Object.entries(m.reactions).filter(([, u]) => u.includes('u1')).map(([e]) => e);
          return (
            <View key={m.id} style={{ alignItems: isCoil ? 'stretch' : mine ? 'flex-end' : 'flex-start' }}>
              {isCoil ? (
                <Pressable onLongPress={() => setPicking(m.id)} delayLongPress={300} style={{ backgroundColor: '#2EE6C50F', borderColor: '#2EE6C544', borderWidth: 1, borderRadius: 14, padding: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <T style={[type.label, { color: c.accent, textTransform: 'uppercase', letterSpacing: 1 }]}>{LABEL[m.event?.type ?? ''] ?? 'Coil'}</T>
                    <T muted style={type.micro}>{time(m.sentAt)}</T>
                  </View>
                  {m.event ? <Event m={m} /> : <T>{m.text}</T>}
                </Pressable>
              ) : (
                <View style={{ maxWidth: '85%', flexDirection: mine ? 'row-reverse' : 'row', gap: 6, alignItems: 'flex-end' }}>
                  {!mine && t ? <TeamAvatar team={t} size={24} /> : null}
                  <View style={{ flexShrink: 1 }}>
                    {!mine ? <T muted style={[type.micro, { marginBottom: 2, marginLeft: 4 }]}>{t?.manager}</T> : null}
                    <Pressable onLongPress={() => setPicking(m.id)} delayLongPress={300} style={{ backgroundColor: mine ? c.primary : c.surface, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 12, borderWidth: mine ? 0 : 1, borderColor: c.border }}>
                      <T style={{ color: mine ? '#fff' : c.text }}>{plainText(m.text)}</T>
                    </Pressable>
                  </View>
                </View>
              )}
              {Object.keys(counts).length ? <Reactions reactions={counts} mine={myReacts} onToggle={(e) => react(m.id, e)} align={mine ? 'flex-end' : 'flex-start'} /> : null}
            </View>
          );
        })}
        {tab === 'chat' ? <T muted style={[type.micro, { textAlign: 'center' }]}>Press and hold any message to react with any emoji.</T> : null}
      </ScrollView>
      <EmojiPicker open={!!picking} onClose={() => setPicking(null)} onPick={(e) => { if (picking) react(picking, e); setPicking(null); }} />
      {tab === 'chat' ? (
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.border, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
          <Input value={text} onChangeText={setText} placeholder="Talk some trash…" style={{ flex: 1 }} onSubmitEditing={() => { send(text); setText(''); }} />
          <Button label="Send" onPress={() => { send(text); setText(''); }} />
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
