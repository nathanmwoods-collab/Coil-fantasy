import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { CURRENT_WEEK, ME, opponentOf, teamWeek } from '../demo/league';
import { ownership, playerWeek, statSummary, winProbability, type PlayerWeek } from '../demo/games';
import { injuryTag, irEligible, SLOT_LABELS, taxiEligible, type SlotType } from '../engine';
import { isCommish, useApp } from '../store/useApp';
import { type } from '../theme/type';
import { LeagueHeader, pickImage, TeamAvatar } from './league';
import { Button, c, Card, Chip, H2, InjuryBadge, PlayerAvatar, POS_COLORS, T } from './ui';

const ordinal = (n: number) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] ?? ['th', 'st', 'nd', 'rd'][n % 100] ?? 'th');

export function TeamView({ teamId }: { teamId: string }) {
  const L = useApp((s) => s.league);
  const moveToIR = useApp((s) => s.moveToIR);
  const activate = useApp((s) => s.activateFromIR);
  const moveToTaxi = useApp((s) => s.moveToTaxi);
  const promote = useApp((s) => s.promoteFromTaxi);
  const updateMyTeam = useApp((s) => s.updateMyTeam);
  const toast = useApp((s) => s.showToast);
  const [open, setOpen] = useState<string | null>(null);
  const [week, setWeek] = useState(CURRENT_WEEK);
  const [section, setSection] = useState<'lineup' | 'schedule'>('lineup');

  const team = L.teams.find((t) => t.id === teamId)!;
  const mine = teamId === ME;
  const tw = useMemo(() => teamWeek(L, teamId, week), [L, teamId, week]);
  const oppId = opponentOf(L, teamId, week);
  const opp = oppId ? L.teams.find((t) => t.id === oppId) : null;
  const otw = useMemo(() => (oppId ? teamWeek(L, oppId, week) : null), [L, oppId, week]);
  const rec = L.standings.find((r) => r.teamId === teamId)!;
  const rankBy = (f: (r: typeof rec) => number) => [...L.standings].sort((a, b) => f(b) - f(a)).findIndex((r) => r.teamId === teamId) + 1;
  const place = L.standings.findIndex((r) => r.teamId === teamId) + 1;
  const winP = otw ? winProbability(tw.liveProjected, otw.liveProjected, (tw.remaining + otw.remaining) / 2) : null;
  const pastWeek = week < CURRENT_WEEK;

  const PlayerLine = ({ id, slot, pw }: { id: string | null; slot: string; pw: PlayerWeek | null }) => {
    if (!id)
      return (
        <View style={rowStyle}>
          <SlotPill slot={slot} />
          <T muted style={{ marginLeft: 10 }}>Empty</T>
        </View>
      );
    const p = L.players[id];
    const own = ownership(p);
    const g = pw?.game;
    const result = !g
      ? 'Bye week'
      : g.status === 'upcoming'
        ? `${g.clock} ${g.home ? 'vs' : '@'} ${g.opp}`
        : `${g.status === 'final' ? (g.teamScore > g.oppScore ? 'W' : g.teamScore < g.oppScore ? 'L' : 'T') : g.clock} ${g.teamScore}-${g.oppScore} ${g.home ? 'vs' : '@'} ${g.opp}`;
    const resultColor = !g || g.status === 'upcoming' ? c.textMuted : g.status === 'live' ? c.warning : g.teamScore >= g.oppScore ? c.success : c.danger;
    const line = pw ? statSummary(p.position, pw.stats) : '';
    return (
      <View>
        <Pressable onPress={() => router.push(`/player/${id}`)} style={rowStyle}>
          <SlotPill slot={slot} />
          <View style={{ marginLeft: 10 }}>
            <PlayerAvatar name={p.name} position={p.position} url={p.headshotUrl} size={40} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
              <T style={type.bodyStrong} numberOfLines={1}>{p.name}</T>
              <T style={[type.micro, { color: POS_COLORS[p.position], marginLeft: 6 }]}>{p.position}</T>
              <T muted style={type.micro}> · {p.nflTeam}</T>
              <InjuryBadge status={p.status} />
            </View>
            <T muted style={type.micro}>
              {own.rostered}% rostered · {own.started}% start{p.yearsPro === 0 ? ' · rookie' : ''}
            </T>
            <T style={[type.micro, { color: resultColor }]}>{result}</T>
            {line ? <T muted style={[type.micro, { fontFamily: type.num.fontFamily }]}>{line}</T> : null}
          </View>
          <View style={{ alignItems: 'flex-end', minWidth: 54 }}>
            <T style={[type.num, { fontSize: 17, color: c.text }]}>{pw && g && g.status !== 'upcoming' ? pw.points.toFixed(2) : '–'}</T>
            <T muted style={[type.num, { fontSize: 11 }]}>{pw ? pw.projected.toFixed(2) : ''}</T>
          </View>
        </Pressable>
      </View>
    );
  };

  const reserve = (ids: string[]) => ids.map((id) => ({ id, pw: playerWeek(L.settings.scoring, L.players[id], week, CURRENT_WEEK) }));

  return (
    <>
      <LeagueHeader />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {L.teams.map((t) => (
          <Pressable key={t.id} onPress={() => (t.id === teamId ? null : t.id === ME ? router.push('/team') : router.push(`/team/${t.id}`))} style={{ opacity: t.id === teamId ? 1 : 0.55, borderRadius: 12, borderWidth: t.id === teamId ? 2 : 0, borderColor: c.primary }} accessibilityLabel={t.name}>
            <TeamAvatar team={t} size={30} />
          </Pressable>
        ))}
      </View>
      <Card highlight={mine}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable
            disabled={!mine}
            onPress={async () => {
              const uri = await pickImage();
              if (uri) {
                updateMyTeam({ imageUri: uri });
                toast('New team image. Looking sharp.');
              }
            }}
          >
            <TeamAvatar team={team} size={58} />
            {mine ? <T style={{ position: 'absolute', right: -4, bottom: -4, fontSize: 14 }}>📷</T> : null}
          </Pressable>
          <View style={{ flex: 1 }}>
            <T style={type.title} numberOfLines={1}>{team.name}</T>
            <T muted style={type.small}>
              {team.manager}
              {isCommish(L) && L.commissioners.includes(teamId) ? ' · Commish' : ''}
              {team.locked ? ' · 🔒 Locked' : ''}
            </T>
            <T style={[type.smallStrong, { marginTop: 2 }]}>
              {rec.wins}-{rec.losses}{rec.ties ? `-${rec.ties}` : ''} · {ordinal(place)}
              <T muted style={type.small}> · PF {ordinal(rankBy((r) => r.pointsFor))} · PA {ordinal(rankBy((r) => r.pointsAgainst))}</T>
            </T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T style={[type.display32, { color: mine ? c.primary : c.text }]}>{tw.points.toFixed(2)}</T>
            <T muted style={[type.num, { fontSize: 12 }]}>{pastWeek ? `proj ${tw.projected.toFixed(2)}` : `proj ${tw.liveProjected.toFixed(2)}`}</T>
          </View>
        </View>
        {opp && otw && winP !== null ? (
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T style={[type.smallStrong, { color: winP >= 0.5 ? c.accent : c.warning }]}>{pastWeek ? (tw.points >= otw.points ? 'Won' : 'Lost') : `${Math.round(winP * 100)}% to win`}</T>
              <T muted style={type.small}>vs {opp.name} · {otw.points.toFixed(2)}</T>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: 'hidden', marginTop: 6 }}>
              <View style={{ width: `${(pastWeek ? (tw.points >= otw.points ? 1 : 0) : winP) * 100}%`, height: 6, backgroundColor: c.accent }} />
            </View>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
          <Chip label="Lineup" active={section === 'lineup'} onPress={() => setSection('lineup')} />
          <Chip label="Schedule" active={section === 'schedule'} onPress={() => setSection('schedule')} />
          <Chip label="Trade" onPress={() => router.push('/trade')} />
          {L.settings.waivers.type === 'faab' ? <Chip label={`$${team.faab} FAAB`} /> : null}
          <Chip label={`Waiver #${team.waiverPriority}`} />
        </View>
      </Card>

      {section === 'schedule' ? (
        <Card style={{ paddingVertical: 4 }}>
          {Array.from({ length: L.settings.regularSeasonWeeks }, (_, i) => i + 1).map((w) => {
            const o = opponentOf(L, teamId, w);
            const ot = o ? L.teams.find((t) => t.id === o) : null;
            const ws = L.weeks.find((x) => x.week === w);
            const a = ws?.scores[teamId];
            const b = o ? ws?.scores[o] : undefined;
            return (
              <Pressable key={w} onPress={() => { setWeek(w); setSection('lineup'); }} style={[rowStyle, { paddingVertical: 9 }]}>
                <T style={[type.num, { width: 50, color: c.textMuted }]}>Wk {w}</T>
                {ot ? <TeamAvatar team={ot} size={22} /> : null}
                <T style={[type.small, { flex: 1, marginLeft: 8 }]} numberOfLines={1}>{ot?.name ?? 'Bye'}</T>
                {a !== undefined && b !== undefined ? (
                  <T style={[type.num, { fontSize: 13, color: a >= b ? c.success : c.danger }]}>{a >= b ? 'W' : 'L'} {a.toFixed(1)}-{b.toFixed(1)}</T>
                ) : (
                  <T muted style={type.small}>{w === CURRENT_WEEK ? 'Live' : 'Upcoming'}</T>
                )}
              </Pressable>
            );
          })}
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, marginBottom: 8 }}>
            <T style={type.display24}>Starters</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Pressable hitSlop={8} onPress={() => setWeek(Math.max(1, week - 1))} style={{ padding: 6 }}>
                <T style={[type.bodyStrong, { color: c.accent }]}>‹</T>
              </Pressable>
              <T style={[type.smallStrong, { color: c.accent, minWidth: 64, textAlign: 'center' }]}>Week {week}</T>
              <Pressable hitSlop={8} onPress={() => setWeek(Math.min(18, week + 1))} style={{ padding: 6 }}>
                <T style={[type.bodyStrong, { color: c.accent }]}>›</T>
              </Pressable>
            </View>
          </View>
          {mine && week === CURRENT_WEEK && tw.starters.some((s) => s.playerId && injuryTag(L.players[s.playerId].status).inactive) ? (
            <T style={[type.small, { color: c.warning, marginBottom: 6 }]}>Heads up: an inactive player is in your lineup.</T>
          ) : null}
          <Card style={{ paddingVertical: 2 }}>
            {tw.starters.map((s, i) => (
              <PlayerLine key={i} id={s.playerId} slot={SLOT_LABELS[s.slot as SlotType]} pw={s.pw} />
            ))}
          </Card>
          <H2 right={<T muted style={type.small}>{tw.bench.reduce((s, b) => s + b.pw.points, 0).toFixed(1)} pts left on the bench</T>}>Bench</H2>
          <Card style={{ paddingVertical: 2 }}>
            {[...tw.bench].sort((a, b) => b.pw.projected - a.pw.projected).map((b) => (
              <PlayerLine key={b.playerId} id={b.playerId} slot="BN" pw={b.pw} />
            ))}
          </Card>
          {(['IR', 'TAXI'] as const).map((kind) => {
            const slots = L.settings.roster[kind] ?? 0;
            if (!slots) return null;
            const ids = kind === 'IR' ? team.ir : team.taxi;
            const eligible = tw.starters
              .map((x) => x.playerId)
              .concat(tw.bench.map((x) => x.playerId))
              .filter((x): x is string => !!x)
              .filter((x) => (kind === 'IR' ? irEligible(L.settings, L.players[x]) : taxiEligible(L.settings, L.players[x])));
            return (
              <View key={kind}>
                <H2 right={<T muted style={type.small}>{ids.length}/{slots} spots</T>}>{kind === 'IR' ? 'Injured reserve' : 'Taxi squad'}</H2>
                <Card style={{ paddingVertical: 2 }}>
                  {reserve(ids).map((x) => (
                    <View key={x.id}>
                      <PlayerLine id={x.id} slot={kind} pw={x.pw} />
                      {mine ? (
                        <Pressable
                          onPress={() => {
                            if (kind === 'IR') activate(x.id);
                            else promote(x.id);
                            toast(kind === 'IR' ? `${L.players[x.id].name} is back on your roster.` : `${L.players[x.id].name} is called up.`);
                          }}
                          style={{ alignSelf: 'flex-end', paddingVertical: 6 }}
                        >
                          <T style={[type.smallStrong, { color: c.accent }]}>{kind === 'IR' ? 'Activate' : 'Promote to roster'}</T>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                  {mine
                    ? Array.from({ length: Math.max(0, slots - ids.length) }, (_, i) => (
                        <View key={`empty${i}`}>
                          <Pressable onPress={() => setOpen(open === `${kind}${i}` ? null : `${kind}${i}`)} style={[rowStyle, { borderStyle: 'dashed' }]}>
                            <SlotPill slot={kind} />
                            <View style={{ marginLeft: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', borderColor: c.accent }}>
                              <T style={[type.smallStrong, { color: c.accent }]}>＋ {kind === 'IR' ? 'Move a player to IR' : 'Stash a young player'}</T>
                            </View>
                          </Pressable>
                          {open === `${kind}${i}` ? (
                            <View style={{ paddingVertical: 8 }}>
                              {eligible.length ? (
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                                  {eligible.map((pid) => (
                                    <Chip
                                      key={pid}
                                      label={`${L.players[pid].name}${injuryTag(L.players[pid].status).code ? ` · ${injuryTag(L.players[pid].status).code}` : ''}`}
                                      onPress={() => {
                                        const err = kind === 'IR' ? moveToIR(pid) : moveToTaxi(pid);
                                        toast(err ?? (kind === 'IR' ? `${L.players[pid].name} moved to IR. Roster spot opened.` : `${L.players[pid].name} moved to the taxi squad.`));
                                        setOpen(null);
                                      }}
                                    />
                                  ))}
                                </View>
                              ) : (
                                <T muted style={type.small}>
                                  {kind === 'IR' ? `Nobody qualifies right now. This league allows ${L.settings.irEligible.map((x) => injuryTag(x).code).join(', ')}.` : 'Nobody qualifies right now. Taxi is for rookies and young players.'}
                                </T>
                              )}
                            </View>
                          ) : null}
                        </View>
                      ))
                    : !ids.length ? <T muted style={{ paddingVertical: 10 }}>Empty</T> : null}
                </Card>
              </View>
            );
          })}
          <T muted style={[type.micro, { textAlign: 'center', marginTop: 8 }]}>Big number is points scored, small is the projection.</T>
        </>
      )}
    </>
  );
}

function SlotPill({ slot }: { slot: string }) {
  return (
    <View style={{ width: 46, paddingVertical: 6, borderRadius: 10, backgroundColor: c.surfaceAlt, alignItems: 'center' }}>
      <T style={[type.label, { color: c.textMuted, fontSize: 10 }]} numberOfLines={1}>{slot}</T>
    </View>
  );
}

const rowStyle = { flexDirection: 'row' as const, alignItems: 'center' as const, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#2C2C4A' };
