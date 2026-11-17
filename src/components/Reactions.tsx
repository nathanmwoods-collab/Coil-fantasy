import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { type } from '../theme/type';
import { c, T } from './ui';

const QUICK = ['❤️', '😂', '🔥', '😱', '👍', '😭'];

const ALL: [string, string][] = [
  ['Faces', '😀 😃 😄 😁 😆 🥹 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😋 😛 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 🤗 🤔 🫡 🤭 🫢 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 🤡 💩 👻 💀 ☠️ 👽 🤖 🎃'],
  ['Hands', '👍 👎 👊 ✊ 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✌️ 🤞 🫰 🤟 🤘 👌 🤌 🤏 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤙 💪 🦵 🫵 👀 🧠 🫀'],
  ['Sports', '🏈 🏟️ 🏆 🥇 🥈 🥉 🏅 🎖️ ⏱️ 📈 📉 🧢 🎯 🪄 🎲 🃏 🧊 🔥 💯 ⚡️ 💥 🚀 🎉 🎊 🍾 🥂 🍻 🍺 🍕 🌮 🌯 🍔 🍗 🥩 🍩 ☕'],
  ['Animals', '🐍 🐐 🦅 🐻 🐯 🦁 🐴 🦬 🐬 🐆 🦖 🐉 🐺 🦊 🐶 🐱 🐭 🐹 🐰 🐼 🐨 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🦆 🦉 🦇 🐝 🦋 🐌 🐢 🦈 🐳'],
  ['Hearts', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 💕 💞 💓 💗 💖 💘 💝 ✨ ⭐ 🌟 💫 ✅ ❌ ⚠️ 🚨 🆗 🆒 🆕 💤 💬 🗯️ 💭'],
];

/** Reaction chips with tap-to-toggle; press and hold (or ＋) opens every emoji. */
export function Reactions({ reactions, mine, onToggle, align = 'flex-start' }: { reactions: Record<string, number>; mine: string[]; onToggle: (emoji: string) => void; align?: 'flex-start' | 'flex-end' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4, justifyContent: align }}>
        {Object.entries(reactions)
          .filter(([, n]) => n > 0)
          .map(([e, n]) => (
            <Pressable key={e} onPress={() => onToggle(e)} onLongPress={() => setOpen(true)} style={{ flexDirection: 'row', backgroundColor: mine.includes(e) ? '#7C5CFF44' : c.surface, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: mine.includes(e) ? c.primary : c.border }}>
              <T style={type.small}>{e} {n}</T>
            </Pressable>
          ))}
        <Pressable onPress={() => setOpen(true)} hitSlop={6} style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: c.border }} accessibilityLabel="Add a reaction">
          <T muted style={type.small}>☺︎＋</T>
        </Pressable>
      </View>
      <EmojiPicker open={open} onClose={() => setOpen(false)} onPick={(e) => { onToggle(e); setOpen(false); }} />
    </>
  );
}

export function EmojiPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: string) => void }) {
  const [typed, setTyped] = useState('');
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => null} style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 30, maxHeight: '70%', maxWidth: 640, width: '100%', alignSelf: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: c.surfaceAlt, borderRadius: 999, paddingVertical: 8, marginBottom: 12 }}>
            {QUICK.map((e) => (
              <Pressable key={e} onPress={() => onPick(e)} hitSlop={6}>
                <T style={{ fontSize: 28 }}>{e}</T>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={typed}
            onChangeText={(v) => {
              setTyped('');
              const ch = [...v].find((x) => /\p{Extended_Pictographic}/u.test(x));
              if (ch) onPick(v.trim());
            }}
            placeholder="Or type any emoji from your keyboard"
            placeholderTextColor={c.textMuted}
            style={{ backgroundColor: c.surfaceAlt, borderRadius: 12, color: c.text, padding: 10, marginBottom: 10, fontFamily: type.body.fontFamily }}
          />
          <ScrollView>
            {ALL.map(([title, list]) => (
              <View key={title} style={{ marginBottom: 10 }}>
                <T muted style={[type.label, { marginBottom: 4 }]}>{title.toUpperCase()}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {list.split(' ').map((e) => (
                    <Pressable key={e} onPress={() => onPick(e)} style={{ width: '12.5%', alignItems: 'center', paddingVertical: 6 }}>
                      <T style={{ fontSize: 26 }}>{e}</T>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
