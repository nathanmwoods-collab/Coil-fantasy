import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, c, Input, T } from '../../components/ui';
import { eventCopy, plainText } from '../../engine';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

const QUICK = ['🔥', '😂', '😱', '👍'];

export default function Chat() {
  const L = useApp((s) => s.league);
  const send = useApp((s) => s.sendChat);
  const react = useApp((s) => s.react);
  const [text, setText] = useState('');
  const insets = useSafeAreaInsets();
  const team = (id: string | null) => L.teams.find((t) => t.id === id);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <T style={type.display24}>League chat</T>
        <T muted style={type.small}>{L.name} · {L.teams.length} managers</T>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        {L.chat.map((m, i) => {
          const isCoil = m.author.kind === 'coil';
          const t = m.author.kind === 'member' ? team(m.author.teamId) : undefined;
          const mine = t?.id === 'T1';
          const seed = Number(m.id.replace(/\D/g, '')) || i;
          return (
            <View key={m.id} style={{ alignItems: isCoil ? 'stretch' : mine ? 'flex-end' : 'flex-start' }}>
              {isCoil ? (
                <View style={{ backgroundColor: '#2EE6C514', borderColor: '#2EE6C555', borderWidth: 1, borderRadius: 14, padding: 12 }}>
                  <T style={[type.label, { color: c.accent, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }]}>
                    {m.event?.type === 'trade' ? 'Trade' : m.event?.type === 'waiver' ? 'Waivers' : 'Coil'}
                  </T>
                  <T>{m.event ? eventCopy(m.event, seed) : m.text}</T>
                </View>
              ) : (
                <View style={{ maxWidth: '85%' }}>
                  {!mine ? <T muted style={[type.micro, { marginBottom: 2, marginLeft: 4 }]}>{t?.emoji} {t?.manager}</T> : null}
                  <View style={{ backgroundColor: mine ? c.primary : c.surface, borderRadius: 16, paddingVertical: 9, paddingHorizontal: 12, borderWidth: mine ? 0 : 1, borderColor: c.border }}>
                    <T style={{ color: mine ? '#fff' : c.text }}>{plainText(m.text)}</T>
                  </View>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                {Object.entries(m.reactions).map(([e, users]) => (
                  <Pressable key={e} onPress={() => react(m.id, e)} style={{ flexDirection: 'row', backgroundColor: users.includes('u1') ? '#7C5CFF44' : c.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: c.border }}>
                    <T style={type.small}>{e} {users.length}</T>
                  </Pressable>
                ))}
                {QUICK.filter((e) => !m.reactions[e]).slice(0, 2).map((e) => (
                  <Pressable key={e} onPress={() => react(m.id, e)} style={{ borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2, opacity: 0.45 }}>
                    <T style={type.small}>{e}+</T>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: c.border, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
        <Input value={text} onChangeText={setText} placeholder="Talk some trash…" style={{ flex: 1 }} onSubmitEditing={() => { send(text); setText(''); }} />
        <Button label="Send" onPress={() => { send(text); setText(''); }} />
      </View>
    </KeyboardAvoidingView>
  );
}
