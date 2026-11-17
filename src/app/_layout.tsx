import { BigShoulders_800ExtraBold, BigShoulders_900Black } from '@expo-google-fonts/big-shoulders';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { SchibstedGrotesk_400Regular, SchibstedGrotesk_600SemiBold, SchibstedGrotesk_800ExtraBold } from '@expo-google-fonts/schibsted-grotesk';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { c } from '../components/ui';

export default function RootLayout() {
  const [loaded] = useFonts({
    BigShoulders_800ExtraBold,
    BigShoulders_900Black,
    DMMono_500Medium,
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_800ExtraBold,
  });
  useEdgeSwipeBack();
  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  return (
    <SafeAreaProvider style={{ backgroundColor: c.bg }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, gestureEnabled: true, fullScreenGestureEnabled: true, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="create" />
        <Stack.Screen name="import" />
        <Stack.Screen name="trade" options={{ presentation: 'modal' }} />
        <Stack.Screen name="player/[id]" />
        <Stack.Screen name="settings/index" />
        <Stack.Screen name="settings/scoring" />
        <Stack.Screen name="settings/[section]" />
        <Stack.Screen name="commish/[tool]" />
        <Stack.Screen name="team/[id]" />
        <Stack.Screen name="matchup" />
      </Stack>
    </SafeAreaProvider>
  );
}

/**
 * iOS-style back: drag from the left edge to the right. The native stack does
 * this on phones; this covers the web build (and the preview) the same way.
 */
function useEdgeSwipeBack() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    let start: { x: number; y: number; t: number } | null = null;
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      start = t && t.clientX < 28 ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
    };
    const up = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      start = null;
      if (dx > 60 && dy < 60 && router.canGoBack()) router.back();
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
    };
  }, []);
}
