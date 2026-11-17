import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, c, Card, Chip, H1, H2, Screen, T } from '../components/ui';
import { ME } from '../demo/league';
import { pickLabel, picksOwnedBy } from '../engine';
import { useApp } from '../store/useApp';
import { type } from '../theme/type';

export default function Trade() {
  const L = useApp((s) => s.league);
  const tradePicks = useApp((s) => s.tradePicks);
  const toast = useApp((s) => s.showToast);
  const others = L.teams.filter((t) => t.id !== ME);
  const [partner, setPartner] = useState(others[0].id);
  const [give, setGive] = useState<string[]>([]);
  const [get, setGet] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const name = (id: string) => L.teams.find((t) => t.id === id)!.name;
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const PickList = ({ teamId, chosen, onToggle }: { teamId: string; chosen: string[]; onToggle: (id: string) => void }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {picksOwnedBy(L.picks, teamId).map((p) => (
        <Chip key={p.id} label={pickLabel(p, name)} active={chosen.includes(p.id)} onPress={() => onToggle(p.id)} />
      ))}
    </View>
  );

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/league'))}>
        <T muted style={type.smallStrong}>‹ Close</T>
      </Pressable>
      <H1 kicker="Dynasty · picks up to 3 seasons out">Trade draft picks</H1>

      <H2>With</H2>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {others.map((t) => (
          <Chip key={t.id} label={`${t.emoji} ${t.name}`} active={partner === t.id} onPress={() => { setPartner(t.id); setGet([]); }} />
        ))}
      </View>

      <H2>You send</H2>
      <Card>
        <PickList teamId={ME} chosen={give} onToggle={(id) => toggle(give, setGive, id)} />
      </Card>

      <H2>You get</H2>
      <Card>
        <PickList teamId={partner} chosen={get} onToggle={(id) => toggle(get, setGet, id)} />
      </Card>

      {errors.length ? (
        <Card style={{ borderColor: c.danger }}>
          {errors.map((e) => (
            <T key={e} style={{ color: c.danger }}>{e}</T>
          ))}
        </Card>
      ) : null}

      <Button
        label={give.length || get.length ? `Send offer to ${name(partner)}` : 'Pick some picks'}
        disabled={!give.length && !get.length}
        onPress={() => {
          // Preview: the other manager accepts right away so you can see the result.
          const errs = tradePicks(give, partner, get);
          setErrors(errs);
          if (!errs.length) {
            toast(`${name(partner)} accepted. It's in the league chat.`);
            router.replace('/league');
          }
        }}
      />
      <T muted style={[type.micro, { textAlign: 'center', marginTop: 8 }]}>In the preview, every offer is accepted instantly.</T>
    </Screen>
  );
}
