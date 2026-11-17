import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { TeamAvatar } from '../../components/league';
import { Reactions } from '../../components/Reactions';
import { TeamDepth } from '../../components/TeamDepth';
import { Button, c, Card, InjuryBadge, Input, PlayerAvatar, POS_COLORS, Screen, Segmented, T } from '../../components/ui';
import { ageOf, CURRENT_SEASON, CURRENT_WEEK, heightLabel, ME } from '../../demo/league';
import { fullStatLine, matchupColor, nflGame, ownership, playerWeek, snapShare, statSummary } from '../../demo/games';
import { injuryTag, irEligible, scoreStatLine, scoringFromPreset, taxiEligible, type StatLine } from '../../engine';
import { NFL_TEAMS } from '../../news/sources';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

type Col = { key: keyof StatLine | 'fpts' | 'snp' | 'rank'; label: string; group: string };
const COLS: Record<string, Col[]> = {
  QB: [
    { key: 'passAtt', label: 'ATT', group: 'PASSING' },
    { key: 'passCmp', label: 'CMP', group: 'PASSING' },
    { key: 'passYds', label: 'YD', group: 'PASSING' },
    { key: 'passTd', label: 'TD', group: 'PASSING' },
    { key: 'passInt', label: 'INT', group: 'PASSING' },
    { key: 'rushAtt', label: 'CAR', group: 'RUSHING' },
    { key: 'rushYds', label: 'YD', group: 'RUSHING' },
    { key: 'rushTd', label: 'TD', group: 'RUSHING' },
  ],
  RB: [
    { key: 'rushAtt', label: 'CAR', group: 'RUSHING' },
    { key: 'rushYds', label: 'YD', group: 'RUSHING' },
    { key: 'rushTd', label: 'TD', group: 'RUSHING' },
    { key: 'recTgt', label: 'TGT', group: 'RECEIVING' },
    { key: 'rec', label: 'REC', group: 'RECEIVING' },
    { key: 'recYds', label: 'YD', group: 'RECEIVING' },
    { key: 'recTd', label: 'TD', group: 'RECEIVING' },
    { key: 'fumLost', label: 'FUM', group: 'MISC' },
  ],
  WR: [
    { key: 'recTgt', label: 'TGT', group: 'RECEIVING' },
    { key: 'rec', label: 'REC', group: 'RECEIVING' },
    { key: 'recYds', label: 'YD', group: 'RECEIVING' },
    { key: 'recTd', label: 'TD', group: 'RECEIVING' },
    { key: 'rec40', label: '40+', group: 'RECEIVING' },
    { key: 'rushAtt', label: 'CAR', group: 'RUSHING' },
    { key: 'rushYds', label: 'YD', group: 'RUSHING' },
  ],
};
COLS.TE = COLS.WR.slice(0, 5);

export default function PlayerCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const L = useApp((s) => s.league);
  const toast = useApp((s) => s.showToast);
  const moveToIR = useApp((s) => s.moveToIR);
  const moveToTaxi = useApp((s) => s.moveToTaxi);
  const p = L.players[id ?? ''];
  const [tab, setTab] = useState<'summary' | 'log' | 'team' | 'history'>('summary');
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(false);
  const [watching, setWatching] = useState(false);
  const [reacts, setReacts] = useState<Record<string, number>>({ '🔥': 14, '😂': 3, '🐐': 2 });
  const [mine, setMine] = useState<string[]>([]);
  const [pastOpen, setPastOpen] = useState(false);

  const data = useMemo(() => {
    if (!p) return null;
    const rules = L.settings.scoring;
    const all = Object.values(L.players);
    const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
    const season = new Map(all.map((x) => [x.id, weeks.filter((w) => w < CURRENT_WEEK).reduce((s, w) => s + playerWeek(rules, x, w, CURRENT_WEEK).points, 0)]));
    const mySeason = season.get(p.id) ?? 0;
    const posRank = all.filter((x) => x.position === p.position && (season.get(x.id) ?? 0) > mySeason).length + 1;
    const overall = all.filter((x) => (season.get(x.id) ?? 0) > mySeason).length + 1;
    const log = weeks.map((w) => {
      const pw = playerWeek(rules, p, w, CURRENT_WEEK);
      const played = pw.game && pw.game.status !== 'upcoming';
      const peers = played ? all.filter((x) => x.position === p.position).map((x) => playerWeek(rules, x, w, CURRENT_WEEK).points) : [];
      const rank = played ? peers.filter((x) => x > pw.points).length + 1 : null;
      return { week: w, pw, played, rank, snp: played ? snapShare(p, w) : null };
    });
    const playedGames = log.filter((g) => g.played && g.week < CURRENT_WEEK);
    const avg = playedGames.reduce((s, g) => s + g.pw.points, 0) / Math.max(1, playedGames.length);
    const ppr = scoringFromPreset('ppr');
    const avgPpr = playedGames.reduce((s, g) => s + scoreStatLine(ppr, p.position, g.pw.stats).total, 0) / Math.max(1, playedGames.length);
    const past = weeks.slice(0, 17).map((w) => {
      const g = nflGame(p.nflTeam, w + 100, p.bye, 999);
      const stats = g ? fullStatLine(p, w + 100) : {};
      return { week: w, opp: g ? `${g.home ? '' : '@'}${g.opp}` : 'BYE', stats, pts: g ? scoreStatLine(rules, p.position, stats).total : null };
    });
    const owner = L.teams.find((t) => t.players.includes(p.id));
    const teammates = all.filter((x) => x.nflTeam === p.nflTeam && x.id !== p.id);
    return { posRank, overall, log, playedGames, avg, avgPpr, past, owner, teammates, own: ownership(p) };
  }, [p, L]);

  if (!p || !data) {
    return (
      <Screen>
        <T>Player not found.</T>
      </Screen>
    );
  }

  const tag = injuryTag(p.status);
  const isMine = data.owner?.id === ME;
  const last = data.playedGames[data.playedGames.length - 1];
  const cols = COLS[p.position] ?? COLS.WR;
  const nfl = NFL_TEAMS[p.nflTeam];
  const posColor = POS_COLORS[p.position];
  // Heat for a cell: compare to this player's own season average.
  const heat = (key: Col['key'], v: number | null | undefined) => {
    if (v === null || v === undefined) return 'transparent';
    const vals = data.playedGames.map((g) => (key === 'fpts' ? g.pw.points : key === 'snp' ? g.snp ?? 0 : ((g.pw.stats[key as keyof StatLine] as number) ?? 0)));
    const avg = vals.reduce((s, x) => s + x, 0) / Math.max(1, vals.length);
    if (!avg) return 'transparent';
    const r = v / avg;
    return r >= 1.25 ? '#3DDC8440' : r >= 1.05 ? '#3DDC841F' : r <= 0.6 ? '#FF5D5D40' : r <= 0.9 ? '#FF5D5D1F' : 'transparent';
  };

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/team'))}>
        <T muted style={type.smallStrong}>‹ Back</T>
      </Pressable>

      <Card style={{ marginTop: 10, backgroundColor: posColor + '14', borderColor: posColor + '55' }}>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <View style={{ alignItems: 'center' }}>
            <PlayerAvatar name={p.name} position={p.position} url={p.headshotUrl} size={84} />
            <T style={[type.smallStrong, { marginTop: 6 }]}>{nfl?.name ?? p.nflTeam}</T>
            <T muted style={type.micro}>
              <T style={[type.micro, { color: posColor }]}>{p.position}</T> · {p.nflTeam} · #{p.jersey}
            </T>
          </View>
          <View style={{ flex: 1 }}>
            {data.owner ? (
              <Pressable onPress={() => router.push(data.owner!.id === ME ? '/team' : `/team/${data.owner!.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TeamAvatar team={data.owner} size={18} />
                <T style={[type.small, { color: c.accent }]} numberOfLines={1}>{data.owner.name}</T>
              </Pressable>
            ) : (
              <T style={[type.small, { color: c.accent }]}>Free agent</T>
            )}
            <T style={[type.display32, { textTransform: 'uppercase', lineHeight: 34 }]}>{p.name}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <InjuryBadge status={p.status} />
              {p.injuryNote ? <T style={[type.small, { color: c.warning, marginLeft: 6 }]}>{tag.label} · {p.injuryNote}</T> : null}
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
          {[
            ['AGE', ageOf(p).toFixed(1)],
            ['HT', heightLabel(p.heightIn)],
            ['WT', `${p.weightLb}`],
            ['EXP', p.yearsPro === 0 ? 'R' : `${p.yearsPro}`],
          ].map(([k, v]) => (
            <View key={k}>
              <T muted style={type.label}>{k}</T>
              <T style={type.display24}>{v}</T>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={isMine ? 'Drop' : data.owner ? 'Propose trade' : 'Claim'}
              kind={isMine ? 'ghost' : 'primary'}
              onPress={() => (isMine ? toast('In the full app this asks "are you sure?" first.') : data.owner ? router.push({ pathname: '/trade', params: { partner: data.owner.id, want: p.id } }) : toast('Claim placed for Wednesday waivers.'))}
            />
          </View>
          <Button label={watching ? '★' : '☆'} kind="secondary" onPress={() => { setWatching(!watching); toast(watching ? 'Stopped watching.' : `You'll get news on ${p.name} even when he's not on your team.`); }} />
        </View>
        {isMine ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {irEligible(L.settings, p) && (L.settings.roster.IR ?? 0) > 0 ? <Button small kind="secondary" label="Move to IR" onPress={() => toast(moveToIR(p.id) ?? `${p.name} moved to IR. Roster spot opened.`)} /> : null}
            {taxiEligible(L.settings, p) && (L.settings.roster.TAXI ?? 0) > 0 ? <Button small kind="secondary" label="Move to taxi" onPress={() => toast(moveToTaxi(p.id) ?? `${p.name} moved to the taxi squad.`)} /> : null}
          </View>
        ) : null}
      </Card>

      <Card onPress={() => setEditingNote(true)} style={{ alignItems: editingNote ? 'stretch' : 'center' }}>
        {editingNote ? (
          <>
            <Input value={note} onChangeText={setNote} placeholder="Notes only your league sees (trade talk, keeper cost…)" autoFocus multiline />
            <View style={{ height: 8 }} />
            <Button small label="Save note" onPress={() => { setEditingNote(false); toast('League note saved.'); }} />
          </>
        ) : (
          <T muted style={type.bodyStrong}>{note ? `📝 ${note}` : '＋ League note'}</T>
        )}
      </Card>

      <Segmented value={tab} onChange={setTab} options={[{ key: 'summary', label: 'Summary' }, { key: 'log', label: 'Game log' }, { key: 'team', label: 'Team' }, { key: 'history', label: 'History' }]} />

      {tab === 'summary' && (
        <>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {[
                ['RANK', `#${data.posRank} ${p.position}`, `#${data.overall} overall`],
                ['ROSTERED', `${data.own.rostered}%`, `${data.own.started}% start ${data.own.trend > 0 ? `▲${data.own.trend}` : data.own.trend < 0 ? `▼${-data.own.trend}` : ''}`],
                ['PTS / GAME', data.avg.toFixed(2), `${data.avgPpr.toFixed(2)} in PPR`],
              ].map(([k, v, sub]) => (
                <View key={k}>
                  <T muted style={type.label}>{k}</T>
                  <T style={type.display24}>{v}</T>
                  <T muted style={type.micro}>{sub}</T>
                </View>
              ))}
            </View>
          </Card>

          {last ? (
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T muted style={type.label}>WEEK {last.week} · {last.pw.game!.home ? 'vs' : '@'} {last.pw.game!.opp}</T>
                <T style={[type.label, { color: last.pw.game!.teamScore >= last.pw.game!.oppScore ? c.success : c.danger }]}>
                  {last.pw.game!.teamScore >= last.pw.game!.oppScore ? 'W' : 'L'} {last.pw.game!.teamScore}-{last.pw.game!.oppScore}
                </T>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 6 }}>
                <T style={type.display32}>{last.pw.points.toFixed(2)} <T muted style={type.small}>pts</T></T>
                <T muted style={type.small}>proj {last.pw.projected.toFixed(2)}</T>
              </View>
              <T style={[type.small, { fontFamily: type.num.fontFamily, marginTop: 4 }]}>{statSummary(p.position, last.pw.stats)}</T>
              <T muted style={[type.small, { marginTop: 4 }]}>{last.pw.points > last.pw.projected * 1.3 ? 'Way over his projection. Somebody owes him an apology.' : last.pw.points < last.pw.projected * 0.7 ? 'Rough one. Next week is a new week.' : 'Right about where we expected.'}</T>
              <Reactions reactions={Object.fromEntries(Object.entries(reacts).map(([e, n]) => [e, n + (mine.includes(e) ? 1 : 0)]))} mine={mine} onToggle={(e) => { if (!(e in reacts)) setReacts({ ...reacts, [e]: 0 }); setMine(mine.includes(e) ? mine.filter((x) => x !== e) : [...mine, e]); }} />
            </Card>
          ) : null}

          <T style={[type.display24, { marginTop: 14, marginBottom: 8 }]}>Projected vs final</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {data.log.filter((g) => g.week >= CURRENT_WEEK - 3 && g.week <= CURRENT_WEEK + 3).map((g) => (
              <Card key={g.week} style={{ width: 104, alignItems: 'center', borderColor: g.week === CURRENT_WEEK ? c.accent : c.border }}>
                <T muted style={type.label}>WK {g.week}</T>
                <T muted style={type.micro}>{g.pw.game ? `${g.pw.game.home ? 'vs' : '@'} ${g.pw.game.opp}` : 'BYE'}</T>
                <T style={[type.num, { marginTop: 6 }]}>{g.pw.game ? g.pw.projected.toFixed(1) : '–'}</T>
                <T muted style={type.micro}>proj</T>
                <T style={[type.num, { marginTop: 4, color: g.played ? (g.pw.points >= g.pw.projected ? c.success : c.danger) : c.textMuted }]}>{g.played ? g.pw.points.toFixed(1) : '–'}</T>
                <T muted style={type.micro}>{g.pw.game?.status === 'live' ? 'live' : 'final'}</T>
              </Card>
            ))}
          </ScrollView>
          <T muted style={[type.micro, { textAlign: 'center' }]}>Preview numbers are made up.</T>
        </>
      )}

      {tab === 'log' && (
        <>
          <T style={[type.title, { marginBottom: 6 }]}>{CURRENT_SEASON}</T>
          <LogTable
            pos={p.position}
            cols={cols}
            rows={data.log.map((g) => ({
              week: g.week,
              opp: g.pw.game ? `${g.pw.game.home ? '' : '@'}${g.pw.game.opp}` : 'BYE',
              fpts: g.played ? g.pw.points : null,
              snp: g.snp,
              rank: g.rank,
              stats: g.played ? g.pw.stats : null,
            }))}
            heat={heat}
          />
          <Pressable onPress={() => setPastOpen(!pastOpen)} style={{ paddingVertical: 12 }}>
            <T style={[type.title, { color: c.accent }]}>{CURRENT_SEASON - 1} {pastOpen ? '▾' : '▸'}</T>
          </Pressable>
          {pastOpen ? <LogTable pos={p.position} cols={cols} rows={data.past.map((g) => ({ week: g.week, opp: g.opp, fpts: g.pts, snp: g.pts === null ? null : snapShare(p, g.week + 100), rank: null, stats: g.pts === null ? null : g.stats }))} heat={() => 'transparent'} /> : null}
        </>
      )}

      {tab === 'team' && <TeamDepth L={L} player={p} />}

      {tab === 'history' && (
        <Card>
          <T style={type.bodyStrong}>In this league</T>
          <T muted style={{ marginTop: 4 }}>{data.owner ? `Drafted by ${data.owner.name} in the ${CURRENT_SEASON} ${L.settings.format === 'dynasty' ? 'startup' : ''} draft.` : 'Never rostered in this league.'}</T>
          <T muted style={[type.small, { marginTop: 8 }]}>Every add, drop, trade and keeper decision for this player shows here, including seasons imported from your old platform.</T>
        </Card>
      )}
    </Screen>
  );
}

type LogRow = { week: number; opp: string; fpts: number | null; snp: number | null; rank: number | null; stats: StatLine | null };

function LogTable({ cols, rows, heat, pos }: { cols: Col[]; rows: LogRow[]; heat: (k: Col['key'], v: number | null | undefined) => string; pos: string }) {
  const all: Col[] = [{ key: 'fpts', label: 'FPTS', group: 'FANTASY' }, { key: 'snp', label: 'SNP%', group: 'FANTASY' }, { key: 'rank', label: 'RANK', group: 'FANTASY' }, ...cols];
  const W = 52;
  return (
    <Card style={{ padding: 0, flexDirection: 'row', overflow: 'hidden' }}>
      <View style={{ width: 86, borderRightWidth: 1, borderRightColor: c.border }}>
        <View style={{ height: 40, justifyContent: 'flex-end', paddingHorizontal: 8, paddingBottom: 4 }}>
          <T muted style={type.label}>WK  OPP</T>
        </View>
        {rows.map((r) => (
          <View key={r.week} style={{ height: 30, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
            <T style={[type.num, { width: 24, fontSize: 12 }]}>{r.week}</T>
            <T style={[type.smallStrong, { fontSize: 12, color: r.opp === 'BYE' ? c.textMuted : matchupColor(r.opp.replace('@', ''), pos, { hard: c.danger, easy: c.success, neutral: c.text }) }]}>{r.opp}</T>
          </View>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ height: 40, flexDirection: 'row' }}>
            {all.map((col, i) => (
              <View key={i} style={{ width: W, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 4 }}>
                {i === 0 || all[i - 1].group !== col.group ? <T muted style={[type.micro, { fontSize: 9, position: 'absolute', top: 4, left: 4 }]}>{col.group}</T> : null}
                <T muted style={type.label}>{col.label}</T>
              </View>
            ))}
          </View>
          {rows.map((r) => (
            <View key={r.week} style={{ height: 30, flexDirection: 'row' }}>
              {all.map((col, i) => {
                const v = col.key === 'fpts' ? r.fpts : col.key === 'snp' ? r.snp : col.key === 'rank' ? r.rank : r.stats ? ((r.stats[col.key] as number | undefined) ?? 0) : null;
                return (
                  <View key={i} style={{ width: W - 4, margin: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: col.key === 'rank' ? 'transparent' : heat(col.key, v) }}>
                    <T style={[type.num, { fontSize: 12, color: v === null ? c.textMuted : c.text }]}>{v === null ? (r.opp === 'BYE' ? '' : '–') : col.key === 'fpts' ? v.toFixed(2) : String(v)}</T>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </Card>
  );
}
