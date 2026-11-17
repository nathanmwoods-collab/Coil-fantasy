import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ScoringEditor } from '../../components/ScoringEditor';
import { Button, c, H1, Screen, T } from '../../components/ui';
import { describeScoringChanges } from '../../engine';
import { isCommish, useApp } from '../../store/useApp';
import { type } from '../../theme/type';

export default function ScoringSettings() {
  const L = useApp((s) => s.league);
  const updateSettings = useApp((s) => s.updateSettings);
  const toast = useApp((s) => s.showToast);
  const commish = isCommish(L);
  const [rules, setRules] = useState(() => structuredClone(L.settings.scoring));
  const changes = describeScoringChanges(L.settings.scoring, rules);

  const save = () => {
    const n = updateSettings({ ...L.settings, scoring: rules }).length;
    toast(n ? `Saved ${n} change${n === 1 ? '' : 's'}. Every score was recalculated and the league was told.` : 'Nothing changed.');
    if (n) router.back();
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}>
          <T muted style={type.smallStrong}>‹ Settings</T>
        </Pressable>
        {commish && changes.length ? (
          <Pressable onPress={() => setRules(structuredClone(L.settings.scoring))}>
            <T style={[type.smallStrong, { color: c.textMuted }]}>Undo all</T>
          </Pressable>
        ) : null}
      </View>
      <H1 kicker={commish ? 'Every rule, your way' : 'Read only · commissioners can edit'}>Scoring</H1>
      <ScoringEditor rules={rules} baseline={L.settings.scoring} onChange={setRules} readOnly={!commish} />
      {commish ? (
        <View style={{ marginTop: 12 }}>
          <Button label={changes.length ? `Save ${changes.length} change${changes.length === 1 ? '' : 's'} and tell the league` : 'No changes yet'} disabled={!changes.length} onPress={save} />
          {changes.length ? <T muted style={[type.micro, { marginTop: 6, textAlign: 'center' }]}>{changes.slice(0, 4).join(' · ')}{changes.length > 4 ? ' · …' : ''}</T> : null}
        </View>
      ) : null}
    </Screen>
  );
}
