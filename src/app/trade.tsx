import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TeamAvatar } from '../components/league';
import { Button, c, Card, H1, InjuryBadge, PlayerAvatar, POS_COLORS, Screen, Stepper, T } from '../components/ui';
import { ME } from '../demo/league';
import { pickLabel, picksOwnedBy } from '../engine';
import { useApp } from '../store/useApp';
import { type } from '../theme/type';

export default function Trade() {
  const params = useLocalSearchParams<{ partner?: string; want?: string }>();
  const L = useApp((s) => s.league);
  const proposeTrade = useApp((s) => s.proposeTrade);
  const toast = useApp((s) => s.showToast);
  const others = L.teams.filter((t) => t.id !== ME);
  const [partner, setPartner] = useState(params.partner && others.some((t) => t.id === params.partner) ? params.partner : others[0].id);
  const [givePlayers, setGivePlayers] = useState<string[]>([]);
  const [getPlayers, setGetPlayers] = useState<string[]>(params.want ? [params.want] : []);
  const [givePicks, setGivePicks] = useState<string[]>([]);
  const [getPicks, setGetPicks] = useState<string[]>([]);
  const [giveFaab, setGiveFaab] = useState(0);
  const [getFaab, setGetFaab] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const name = (id: string) => L.teams.find((t) => t.id === id)!.name;
  const me = L.teams.find((t) => t.id === ME)!;
  const them = L.teams.find((t) => t.id === partner)!;
  const dynasty = L.settings.format === 'dynasty';
  const faab = L.settings.waivers.type === 'faab';
  const toggle = (list: string[], set: (v: string[]) => void, id: string) => set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const Side = ({ team, players, setPlayers, picks, setPicks, faabAmt, setFaabAmt, title }: { team: typeof me; players: string[]; setPlayers: (v: string[]) => void; picks: string[]; setPicks: (v: string[]) => void; faabAmt: number; setFaabAmt: (n: number) => void; title: string }) => (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <TeamAvatar team={team} size={30} />
        <View style={{ flex: 1 }}>
          <T style={type.title}>{title}</T>
          <T muted style={type.small}>{team.name}</T>
        </View>
        <T style={[type.smallStrong, { color: c.accent }]}>{players.length + picks.length + (faabAmt ? 1 : 0)} selected</T>
      </View>
      {[...team.players].sort((a, b) => L.players[b].proj - L.players[a].proj).map((pid) => {
        const p = L.players[pid];
        const on = players.includes(pid);
        return (
          <Pressable key={pid} onPress={() => toggle(players, setPlayers, pid)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 10, backgroundColor: on ? '#7C5CFF2A' : undefined }}>
            <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {on ? <T style={{ color: '#fff', fontSize: 12 }}>✓</T> : null}
            </View>
            <PlayerAvatar name={p.name} position={p.position} size={28} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T style={type.smallStrong}>{p.name}</T>
                <InjuryBadge status={p.status} />
              </View>
              <T style={[type.micro, { color: POS_COLORS[p.position] }]}>{p.position} <T muted style={type.micro}>· {p.nflTeam}{team.ir.includes(pid) ? ' · IR' : team.taxi.includes(pid) ? ' · taxi' : ''}</T></T>
            </View>
          </Pressable>
        );
      })}
      {dynasty ? (
        <>
          <T muted style={[type.label, { marginTop: 10, marginBottom: 4 }]}>DRAFT PICKS</T>
          {picksOwnedBy(L.picks, team.id).map((p) => {
            const on = picks.includes(p.id);
            return (
              <Pressable key={p.id} onPress={() => toggle(picks, setPicks, p.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: 10, backgroundColor: on ? '#7C5CFF2A' : undefined }}>
                <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                  {on ? <T style={{ color: '#fff', fontSize: 12 }}>✓</T> : null}
                </View>
                <T style={type.smallStrong}>{pickLabel(p, name)}</T>
              </Pressable>
            );
          })}
        </>
      ) : null}
      {faab ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <T style={[type.smallStrong, { flex: 1 }]}>FAAB <T muted style={type.micro}>(${team.faab} left)</T></T>
          <Stepper value={faabAmt} min={0} max={team.faab} step={5} format={(v) => `$${v}`} onChange={setFaabAmt} />
        </View>
      ) : null}
    </Card>
  );

  const summary = (players: string[], picks: string[], f: number) => [...players.map((id) => L.players[id].name), ...picks.map((id) => pickLabel(L.picks.find((p) => p.id === id)!, name)), ...(f ? [`$${f} FAAB`] : [])].join(', ');
  const youGet = summary(getPlayers, getPicks, getFaab);
  const youGive = summary(givePlayers, givePicks, giveFaab);

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/league'))}>
        <T muted style={type.smallStrong}>‹ Close</T>
      </Pressable>
      <H1 kicker={dynasty ? 'Players, picks and FAAB' : 'Players and FAAB'}>Build a trade</H1>

      <T muted style={[type.label, { marginBottom: 6 }]}>TRADE WITH</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {others.map((t) => (
          <Pressable key={t.id} onPress={() => { setPartner(t.id); setGetPlayers([]); setGetPicks([]); setGetFaab(0); setErrors([]); }} style={{ alignItems: 'center', width: 64, opacity: partner === t.id ? 1 : 0.5 }}>
            <View style={{ borderRadius: 14, borderWidth: partner === t.id ? 2 : 0, borderColor: c.primary }}>
              <TeamAvatar team={t} size={40} />
            </View>
            <T style={[type.micro, { marginTop: 4, textAlign: 'center' }]} numberOfLines={1}>{t.manager}</T>
          </Pressable>
        ))}
      </View>

      <Side team={them} title="You get" players={getPlayers} setPlayers={setGetPlayers} picks={getPicks} setPicks={setGetPicks} faabAmt={getFaab} setFaabAmt={setGetFaab} />
      <Side team={me} title="You give" players={givePlayers} setPlayers={setGivePlayers} picks={givePicks} setPicks={setGivePicks} faabAmt={giveFaab} setFaabAmt={setGiveFaab} />

      <Card style={{ borderColor: c.accent }}>
        <T style={type.bodyStrong}>The deal</T>
        <T style={{ marginTop: 4 }}>You get: <T muted>{youGet || 'nothing yet'}</T></T>
        <T style={{ marginTop: 2 }}>{them.manager} gets: <T muted>{youGive || 'nothing yet'}</T></T>
        {errors.map((e, i) => <T key={i} style={{ color: c.danger, marginTop: 6 }}>{e}</T>)}
        <View style={{ height: 10 }} />
        <Button
          label={`Send to ${them.manager}`}
          onPress={() => {
            const errs = proposeTrade({ partner, givePlayers, getPlayers, givePicks, getPicks, giveFaab, getFaab });
            setErrors(errs);
            if (!errs.length) {
              toast(`${them.manager} accepted. The league just heard about it.`);
              router.back();
            }
          }}
        />
        <T muted style={[type.micro, { marginTop: 6, textAlign: 'center' }]}>In the preview, everyone says yes. Live, they get a push and can accept, decline or counter.</T>
      </Card>
    </Screen>
  );
}
