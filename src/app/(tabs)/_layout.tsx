import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { c } from '../../components/ui';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

const icon = (glyph: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 18, color }}>{glyph}</Text>;

export default function TabsLayout() {
  const queue = useApp((s) => s.queue.length);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, height: 64, paddingTop: 6, paddingBottom: 10 },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarLabelStyle: { fontFamily: type.label.fontFamily, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="league" options={{ title: 'League', tabBarIcon: icon('🏆') }} />
      <Tabs.Screen name="team" options={{ title: 'My team', tabBarIcon: icon('🐍') }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="admin" options={{ title: 'Admin', tabBarIcon: icon('🛡'), tabBarBadge: queue || undefined }} />
    </Tabs>
  );
}
