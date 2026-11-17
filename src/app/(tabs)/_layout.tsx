import { Tabs } from 'expo-router';
import { Text, View, type ColorValue } from 'react-native';

import { LeagueAvatar, LeagueSwitcher, TeamAvatar } from '../../components/league';
import { c } from '../../components/ui';
import { ME } from '../../demo/league';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 18, color }}>{glyph}</Text>;

/** Dim the picture when its tab isn't selected, like the glyph icons. */
const ring = (focused: boolean, child: React.ReactNode) => <View style={{ opacity: focused ? 1 : 0.6, borderRadius: 8, borderWidth: focused ? 1.5 : 0, borderColor: c.accent }}>{child}</View>;

export default function TabsLayout() {
  const queue = useApp((s) => s.queue.length);
  const isAdmin = useApp((s) => s.isAppAdmin);
  const league = useApp((s) => s.league);
  const me = league.teams.find((t) => t.id === ME)!;
  const openSwitcher = useApp((s) => s.setSwitcherOpen);
  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 74, paddingTop: 6, paddingBottom: 14 },
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.textMuted,
          tabBarLabelStyle: { fontFamily: type.label.fontFamily, fontSize: 11 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('⌂') }} />
        <Tabs.Screen
          name="league"
          options={{ title: 'League', tabBarIcon: ({ focused }) => ring(focused, <LeagueAvatar league={league} size={22} />) }}
          listeners={{ tabLongPress: () => openSwitcher(true) }}
        />
        <Tabs.Screen name="team" options={{ title: 'My team', tabBarIcon: ({ focused }) => ring(focused, <TeamAvatar team={me} size={22} />) }} />
        <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: icon('💬') }} />
        <Tabs.Screen name="admin" options={{ title: 'News desk', tabBarIcon: icon('🛡'), tabBarBadge: queue || undefined, href: isAdmin ? undefined : null }} />
      </Tabs>
      <LeagueSwitcher />
    </>
  );
}
