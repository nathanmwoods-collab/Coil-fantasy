import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';

import { ME, type DemoLeague, type DemoTeam } from '../demo/league';
import { isCommish, useApp } from '../store/useApp';
import { type } from '../theme/type';
import { c, T } from './ui';

/** Opens the photo library and returns a square image URI, or null if cancelled. */
export async function pickImage(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
  if (res.canceled || !res.assets?.[0]) return null;
  return res.assets[0].uri;
}

export function TeamAvatar({ team, size = 32 }: { team: Pick<DemoTeam, 'emoji' | 'imageUri' | 'name'>; size?: number }) {
  if (team.imageUri) return <Image source={{ uri: team.imageUri }} style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.surfaceAlt }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
      <T style={{ fontSize: size * 0.55, lineHeight: size * 0.75 }}>{team.emoji}</T>
    </View>
  );
}

export function LeagueAvatar({ league, size = 32 }: { league: Pick<DemoLeague, 'imageUri' | 'emoji'>; size?: number }) {
  if (league.imageUri) return <Image source={{ uri: league.imageUri }} style={{ width: size, height: size, borderRadius: size * 0.3 }} />;
  if (league.emoji)
    return (
      <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ fontSize: size * 0.55, lineHeight: size * 0.75 }}>{league.emoji}</T>
      </View>
    );
  return <Image source={require('../../assets/logo-mark.png')} style={{ width: size, height: size }} />;
}

const FORMAT_LABEL: Record<string, string> = { redraft: 'Redraft', keeper: 'Keeper', dynasty: 'Dynasty', bestball: 'Best ball' };

export function leagueKicker(L: DemoLeague) {
  return `${FORMAT_LABEL[L.settings.format]} · ${L.teams.length} teams`;
}

/** League name with a switcher, shown at the top of every league tab. */
export function LeagueHeader({ sub }: { sub?: string }) {
  const L = useApp((s) => s.league);
  const setOpen = useApp((s) => s.setSwitcherOpen);
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
        <Pressable onPress={() => setOpen(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel="Switch league">
          <LeagueAvatar league={L} size={36} />
          <View style={{ flex: 1 }}>
            <T style={[type.label, { color: c.accent, textTransform: 'uppercase', letterSpacing: 1 }]}>{sub ?? leagueKicker(L)}</T>
            <T style={type.title} numberOfLines={1}>
              {L.name} <T muted style={type.small}>▾</T>
            </T>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} hitSlop={10} style={{ padding: 8, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }} accessibilityLabel="League settings">
          <T style={{ fontSize: 18 }}>⚙︎</T>
        </Pressable>
      </View>
    </>
  );
}

/** Pick which league every tab shows. Mounted once, in the tab layout. */
export function LeagueSwitcher() {
  const L = useApp((s) => s.league);
  const leagues = useApp((s) => s.leagues);
  const switchLeague = useApp((s) => s.switchLeague);
  const open = useApp((s) => s.switcherOpen);
  const setOpen = useApp((s) => s.setSwitcherOpen);
  return (
    <>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable onPress={() => setOpen(false)} style={{ flex: 1, backgroundColor: '#000A', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 34, maxWidth: 640, width: '100%', alignSelf: 'center' }}>
            <T style={[type.display24, { marginBottom: 10 }]}>Your leagues</T>
            {leagues.map((l) => {
              const me = l.teams.find((t) => t.id === ME)!;
              const rec = l.standings.find((r) => r.teamId === ME);
              return (
                <Pressable
                  key={l.id}
                  onPress={() => {
                    switchLeague(l.id);
                    setOpen(false);
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, marginBottom: 6, backgroundColor: l.id === L.id ? '#7C5CFF22' : c.surfaceAlt, borderWidth: 1, borderColor: l.id === L.id ? c.primary : c.border }}
                >
                  <LeagueAvatar league={l} size={36} />
                  <View style={{ flex: 1 }}>
                    <T style={type.bodyStrong}>{l.name}</T>
                    <T muted style={type.small}>
                      {leagueKicker(l)} · {me.name} {rec ? `${rec.wins}-${rec.losses}` : ''}
                      {isCommish(l) ? ' · Commish' : ''}
                    </T>
                  </View>
                  {l.id === L.id ? <T style={{ color: c.accent }}>✓</T> : null}
                </Pressable>
              );
            })}
            <Pressable onPress={() => { setOpen(false); router.push('/import'); }} style={{ padding: 12 }}>
              <T style={[type.bodyStrong, { color: c.accent }]}>＋ Bring over another league</T>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
