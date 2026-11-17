import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { injuryTag, type InjuryStatus, type Position } from '../engine';
import { useApp } from '../store/useApp';
import { type } from '../theme/type';

// Coil palette, shared with Coil Best Ball. Violet = you, mint = the one action.
export const c = {
  bg: '#0B0B14',
  surface: '#15152A',
  surfaceAlt: '#1E1E38',
  border: '#2C2C4A',
  text: '#F4F3FF',
  textMuted: '#9A98B8',
  primary: '#7C5CFF',
  accent: '#2EE6C5',
  success: '#3DDC84',
  warning: '#FFB547',
  danger: '#FF5D5D',
};

export const POS_COLORS: Record<Position, string> = {
  QB: '#FF6B9A',
  RB: '#4CC38A',
  WR: '#5AB0FF',
  TE: '#FFA24C',
  K: '#B9B6D6',
  DST: '#9C8CFF',
  DL: '#E9A23B',
  LB: '#E9A23B',
  DB: '#E9A23B',
};

export function Screen({ children, scroll = true, pad = true }: { children: ReactNode; scroll?: boolean; pad?: boolean }) {
  const insets = useSafeAreaInsets();
  const style = { paddingTop: insets.top + 8, paddingHorizontal: pad ? 16 : 0, paddingBottom: 40 };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {scroll ? (
        <ScrollView contentContainerStyle={style} keyboardShouldPersistTaps="handled">
          <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center' }}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, style]}>{children}</View>
      )}
      <Toast />
    </View>
  );
}

function Toast() {
  const toast = useApp((s) => s.toast);
  if (!toast) return null;
  return (
    <View pointerEvents="none" style={styles.toast}>
      <T style={type.bodyStrong}>{toast}</T>
    </View>
  );
}

export function T({ children, style, muted, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[type.body, { color: muted ? c.textMuted : c.text }, style]}>
      {children}
    </Text>
  );
}

export function H1({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <View style={{ marginBottom: 14, marginTop: 6 }}>
      {kicker ? <T style={[type.label, { color: c.accent, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }]}>{kicker}</T> : null}
      <T style={type.display32}>{children}</T>
    </View>
  );
}

export function H2({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8 }}>
      <T style={type.display24}>{children}</T>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress, highlight }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; highlight?: boolean }) {
  const body = <View style={[styles.card, highlight && { borderColor: c.primary }, style]}>{children}</View>;
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function Button({ label, onPress, kind = 'primary', small, disabled }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'danger' | 'ghost'; small?: boolean; disabled?: boolean }) {
  const bg = kind === 'primary' ? c.accent : kind === 'danger' ? c.danger : kind === 'ghost' ? 'transparent' : c.surfaceAlt;
  const fg = kind === 'primary' ? '#06201B' : kind === 'danger' ? '#fff' : c.text;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.8 : 1, paddingVertical: small ? 8 : 14, paddingHorizontal: small ? 12 : 18 },
        kind === 'ghost' && { borderWidth: 1, borderColor: c.border },
      ]}
    >
      <T style={[small ? type.smallStrong : type.bodyStrong, { color: fg, textAlign: 'center' }]}>{label}</T>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: color ?? c.primary, borderColor: color ?? c.primary }]}>
      <T style={[type.smallStrong, { color: active ? '#fff' : c.textMuted }]}>{label}</T>
    </Pressable>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((o) => (
        <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.segmentItem, value === o.key && { backgroundColor: c.surfaceAlt }]}>
          <T style={[type.smallStrong, { color: value === o.key ? c.text : c.textMuted, textAlign: 'center' }]}>{o.label}</T>
        </Pressable>
      ))}
    </View>
  );
}

export function Stepper({ value, onChange, min = 0, max = 99, step = 1, format }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string }) {
  const round = (v: number) => Math.round(v * 100) / 100;
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft.replace(/[^0-9.\-]/g, ''));
    if (draft.trim() !== '' && Number.isFinite(n)) onChange(round(Math.max(min, Math.min(max, n))));
    setDraft(null);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Pressable onPress={() => onChange(round(Math.max(min, value - step)))} style={styles.stepBtn}>
        <T style={type.bodyStrong}>−</T>
      </Pressable>
      {draft !== null ? (
        <TextInput
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={[type.num, { minWidth: 46, maxWidth: 70, textAlign: 'center', color: c.text, fontSize: 15, borderBottomWidth: 1, borderBottomColor: c.accent, paddingVertical: 2 }]}
        />
      ) : (
        <Pressable onPress={() => setDraft(String(value))} hitSlop={6} accessibilityLabel="Type a value">
          <T style={[type.num, { minWidth: 46, textAlign: 'center', color: c.text, fontSize: 15 }]}>{format ? format(value) : String(value)}</T>
        </Pressable>
      )}
      <Pressable onPress={() => onChange(round(Math.min(max, value + step)))} style={styles.stepBtn}>
        <T style={type.bodyStrong}>+</T>
      </Pressable>
    </View>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <T style={type.bodyStrong}>{label}</T>
        {hint ? <T muted style={type.small}>{hint}</T> : null}
      </View>
      {children}
    </View>
  );
}

export function PosBadge({ pos }: { pos: Position }) {
  return (
    <View style={[styles.pos, { backgroundColor: POS_COLORS[pos] + '26', borderColor: POS_COLORS[pos] }]}>
      <T style={[type.label, { color: POS_COLORS[pos] }]}>{pos === 'DST' ? 'D/ST' : pos}</T>
    </View>
  );
}

/** Headshot when the feed has one; otherwise warm initials on the position color. */
export function PlayerAvatar({ name, position, url, size = 34 }: { name: string; position: Position; url?: string; size?: number }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surfaceAlt }} />;
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: POS_COLORS[position] + '33', borderWidth: 1, borderColor: POS_COLORS[position], alignItems: 'center', justifyContent: 'center' }}>
      <T style={[type.label, { color: POS_COLORS[position], fontSize: size * 0.34 }]}>{initials}</T>
    </View>
  );
}

export function InjuryBadge({ status }: { status?: InjuryStatus }) {
  const tag = injuryTag(status);
  if (!tag.code) return null;
  const color = tag.severity >= 3 ? c.danger : tag.severity === 2 ? '#FF8A4C' : c.warning;
  return (
    <View style={[styles.inj, { borderColor: color }]}>
      <T style={[type.label, { color }]}>{tag.code}</T>
    </View>
  );
}

export function Input(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={c.textMuted} {...props} style={[styles.input, props.style]} />;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: c.border, marginVertical: 10 }} />;
}

const styles = StyleSheet.create({
  card: { backgroundColor: c.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: c.border, marginBottom: 10 },
  button: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.border, marginRight: 6, marginBottom: 6 },
  segment: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: c.border, marginBottom: 12 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 10 },
  stepBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border },
  pos: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, minWidth: 34, alignItems: 'center' },
  inj: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 4, marginLeft: 6 },
  input: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, color: c.text, padding: 12, fontFamily: type.body.fontFamily, fontSize: 15 },
  toast: { position: 'absolute', bottom: 90, left: 16, right: 16, backgroundColor: c.surfaceAlt, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.accent, alignItems: 'center' },
});
