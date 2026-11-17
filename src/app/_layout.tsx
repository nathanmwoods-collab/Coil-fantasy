import { BigShoulders_800ExtraBold, BigShoulders_900Black } from '@expo-google-fonts/big-shoulders';
import { DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import { SchibstedGrotesk_400Regular, SchibstedGrotesk_600SemiBold, SchibstedGrotesk_800ExtraBold } from '@expo-google-fonts/schibsted-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
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
