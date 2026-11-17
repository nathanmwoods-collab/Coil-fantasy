import { router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';

import { TeamView } from '../../components/TeamView';
import { Screen, T } from '../../components/ui';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

export default function OtherTeam() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exists = useApp((s) => s.league.teams.some((t) => t.id === id));
  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/league'))}>
        <T muted style={type.smallStrong}>‹ Back</T>
      </Pressable>
      {exists ? <TeamView teamId={id!} /> : <T>That team isn't in this league.</T>}
    </Screen>
  );
}
