import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, H1, H2, InjuryBadge, PlayerAvatar, Screen, T } from '../../components/ui';
import { ME } from '../../demo/league';
import { injuryTag, irEligible, optimalLineup, SLOT_LABELS, taxiEligible, type Player } from '../../engine';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

export default function Team() {
  const L = useApp((s) => s.league);
  const moveToIR = useApp((s) => s.moveToIR);
  const activate = useApp((s) => s.activateFromIR);
  const moveToTaxi = useApp((s) => s.moveToTaxi);
  const promote = useApp((s) => s.promoteFromTaxi);
  const toast = useApp((s) => s.showToast);
  const [open, setOpen] = useState<string | null>(null);

  const me = L.teams.find((t) => t.id === ME)!;
  const active = me.players.filter((p) => !me.ir.includes(p) && !me.taxi.includes(p)).map((id) => L.players[id]);
  const weekly = (id: string) => Math.round((L.players[id].proj / 17) * 10) / 10;
  const willPlay = (p: Player) => !injuryTag(p.status).inactive;
  const { lineup, total } = optimalLineup(L.settings, active, (p) => weekly(p.id), willPlay);
  const starters = new Set(lineup.map((l) => l.playerId));
  const bench = active.filter((p) => !starters.has(p.id)).sort((a, b) => b.proj - a.proj);
  const benchedInjured = active.filter((p) => !willPlay(p));

  const PlayerLine = ({ id, slot }: { id: string | null; slot: string }) => {
    if (!id)
      return (
        <View style={rowStyle}>
          <T muted style={[type.label, { width: 44 }]}>{slot}</T>
          <T muted>Empty</T>
        </View>
      );
    const p = L.players[id];
    const tag = injuryTag(p.status);
    return (
      <View>
        <Pressable onPress={() => setOpen(open === id ? null : id)} style={rowStyle}>
          <T muted style={[type.label, { width: 44 }]}>{slot}</T>
          <PlayerAvatar name={p.name} position={p.position} url={p.headshotUrl} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T style={type.bodyStrong} numberOfLines={1}>{p.name}</T>
              <InjuryBadge status={p.status} />
            </View>
            <T muted style={type.micro}>
              {p.position} · {p.nflTeam} · bye {p.bye}
              {p.injuryNote ? ` · ${p.injuryNote}` : ''}
              {p.yearsPro === 0 ? ' · rookie' : ''}
            </T>
          </View>
          <T style={type.num}>{weekly(id).toFixed(1)}</T>
        </Pressable>
        {open === id ? (
          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 10, paddingLeft: 44, flexWrap: 'wrap' }}>
            <Button small label="Player card" onPress={() => { setOpen(null); router.push(`/player/${id}`); }} />
            {me.ir.includes(id) ? (
              <Button small kind="secondary" label="Activate from IR" onPress={() => { activate(id); setOpen(null); toast(`${p.name} is back on your roster.`); }} />
            ) : me.taxi.includes(id) ? (
              <Button small kind="secondary" label="Promote to roster" onPress={() => { promote(id); setOpen(null); toast(`${p.name} is called up.`); }} />
            ) : (
              <>
                <Button
                  small
                  kind="secondary"
                  label={irEligible(L.settings, p) ? 'Move to IR' : `IR: not eligible (${tag.code || 'healthy'})`}
                  disabled={!irEligible(L.settings, p)}
                  onPress={() => { const err = moveToIR(id); toast(err ?? `${p.name} moved to IR. Roster spot opened.`); setOpen(null); }}
                />
                {taxiEligible(L.settings, p) ? (
                  <Button small kind="secondary" label="Move to taxi" onPress={() => { const err = moveToTaxi(id); toast(err ?? `${p.name} moved to the taxi squad.`); setOpen(null); }} />
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <H1 kicker={`${me.manager} · FAAB $${me.faab}`}>{me.emoji} {me.name}</H1>

      {benchedInjured.length ? (
        <Card style={{ borderColor: '#FFB547' }}>
          <T style={type.bodyStrong}>Heads up</T>
          <T muted style={{ marginTop: 4 }}>
            {benchedInjured.map((p) => `${p.name} (${injuryTag(p.status).code})`).join(', ')} won't play this week. Your best lineup below already leaves them out.
          </T>
        </Card>
      ) : null}

      <H2 right={<T style={[type.num, { color: '#7C5CFF', fontSize: 15 }]}>{total.toFixed(1)} proj</T>}>Starters</H2>
      <Card style={{ paddingVertical: 4 }}>
        {lineup.map((l, i) => (
          <PlayerLine key={i} id={l.playerId} slot={SLOT_LABELS[l.slot]} />
        ))}
      </Card>

      <H2>Bench</H2>
      <Card style={{ paddingVertical: 4 }}>
        {bench.map((p) => (
          <PlayerLine key={p.id} id={p.id} slot="BN" />
        ))}
      </Card>

      <H2 right={<T muted style={type.small}>{me.ir.length}/{L.settings.roster.IR} spots</T>}>Injured reserve</H2>
      <Card style={{ paddingVertical: 4 }}>
        {me.ir.length ? me.ir.map((id) => <PlayerLine key={id} id={id} slot="IR" />) : <T muted style={{ paddingVertical: 10 }}>Nobody on IR. Allowed here: {L.settings.irEligible.map((s) => injuryTag(s).code).join(', ')}.</T>}
      </Card>

      <H2 right={<T muted style={type.small}>{me.taxi.length}/{L.settings.roster.TAXI} spots</T>}>Taxi squad</H2>
      <Card style={{ paddingVertical: 4 }}>
        {me.taxi.length ? me.taxi.map((id) => <PlayerLine key={id} id={id} slot="TAXI" />) : <T muted style={{ paddingVertical: 10 }}>Stash rookies and second-year players here. They don't count against your roster.</T>}
      </Card>
      <T muted style={[type.micro, { textAlign: 'center', marginTop: 8 }]}>Tap a player for IR and taxi moves.</T>
    </Screen>
  );
}

const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2C2C4A' };
