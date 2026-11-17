import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { fullStatLine } from '../demo/games';
import { demoPlayers } from '../demo/league';
import {
  ALL_STATS,
  clearOverride,
  getRowValue,
  isOverridden,
  rowLabel,
  SCORING_CATALOG,
  SCORING_PRESETS,
  scoreStatLine,
  scoringFromPreset,
  setRowValue,
  statLabel,
  yardsPerPoint,
  type CatalogRow,
  type Position,
  type ScoringPresetKey,
  type ScoringRules,
  type StatKey,
} from '../engine';
import { type } from '../theme/type';
import { c, Card, Chip, Input, PlayerAvatar, T } from './ui';

const PLAYERS = Object.values(demoPlayers());
const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST', 'DL', 'LB', 'DB'];
const PREVIEW_WEEKS = 10;

function seasonPoints(rules: ScoringRules) {
  const out = new Map<string, number>();
  for (const p of PLAYERS) {
    let total = 0;
    for (let w = 1; w <= PREVIEW_WEEKS; w++) if (w !== p.bye) total += scoreStatLine(rules, p.position, fullStatLine(p, w)).total;
    out.set(p.id, total);
  }
  return out;
}

/**
 * Every scoring rule, grouped by category, with a search box, highlighted
 * changes, per-position tweaks on any stat, and a live "who gains, who loses"
 * preview against the rules the league started with.
 */
export function ScoringEditor({ rules, baseline, onChange, readOnly }: { rules: ScoringRules; baseline: ScoringRules; onChange: (r: ScoringRules) => void; readOnly?: boolean }) {
  const [cat, setCat] = useState(SCORING_CATALOG[0].key);
  const [query, setQuery] = useState('');
  const [tweakPos, setTweakPos] = useState<Position>('TE');
  const [tweakStat, setTweakStat] = useState<StatKey>('rec');

  const edit = (fn: (r: ScoringRules) => void) => {
    if (readOnly) return;
    const next = structuredClone(rules);
    fn(next);
    onChange(next);
  };

  const before = useMemo(() => seasonPoints(baseline), [baseline]);
  const after = useMemo(() => seasonPoints(rules), [rules]);
  const movers = useMemo(() => {
    const rank = (m: Map<string, number>) => new Map([...m.entries()].sort((a, b) => b[1] - a[1]).map(([id], i) => [id, i + 1]));
    const rb = rank(before);
    const ra = rank(after);
    return PLAYERS.map((p) => ({ p, delta: (after.get(p.id) ?? 0) - (before.get(p.id) ?? 0), move: (rb.get(p.id) ?? 0) - (ra.get(p.id) ?? 0), rank: ra.get(p.id) ?? 0 }))
      .filter((x) => x.move !== 0 || Math.abs(x.delta) > 0.01)
      .sort((a, b) => Math.abs(b.move) - Math.abs(a.move) || Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 6);
  }, [before, after]);

  const changedCount = useMemo(() => SCORING_CATALOG.flatMap((x) => x.sections.flatMap((s) => s.rows)).filter((r) => getRowValue(rules, r) !== getRowValue(baseline, r)).length, [rules, baseline]);

  const q = query.trim().toLowerCase();
  const sections = q
    ? SCORING_CATALOG.flatMap((cg) => cg.sections.map((s) => ({ ...s, title: `${cg.label} · ${s.title}`, rows: s.rows.filter((r) => rowLabel(r).toLowerCase().includes(q)) }))).filter((s) => s.rows.length)
    : SCORING_CATALOG.find((x) => x.key === cat)!.sections;

  const RuleRow = ({ row }: { row: CatalogRow }) => {
    const v = getRowValue(rules, row);
    const base = getRowValue(baseline, row);
    const changed = v !== base;
    const yards = row.kind === 'per' && row.yards;
    const inherited = row.kind === 'pos' && !isOverridden(rules, row);
    const step = yards ? 0.01 : Math.abs(v) < 1 && row.kind !== 'fg' && row.kind !== 'pa' && row.kind !== 'ya' ? 0.25 : 0.5;
    const hint = row.kind === 'per' ? row.hint : row.kind === 'pos' ? row.hint : undefined;
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 10, backgroundColor: changed ? '#7C5CFF1F' : undefined, borderBottomWidth: 1, borderBottomColor: c.border }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <T style={type.bodyStrong}>{rowLabel(row)}</T>
          {yards && v ? <T muted style={type.micro}>1 point every {yardsPerPoint(v)} yards</T> : null}
          {inherited ? <T muted style={type.micro}>Same as everyone ({base})</T> : null}
          {hint ? <T muted style={type.micro}>{hint}</T> : null}
          {changed ? <T style={[type.micro, { color: c.primary }]}>was {base}</T> : null}
        </View>
        {row.kind === 'pos' && !inherited && !readOnly ? (
          <Pressable onPress={() => edit((r) => clearOverride(r, row))} hitSlop={8} style={{ marginRight: 6 }}>
            <T muted style={type.small}>reset</T>
          </Pressable>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: readOnly ? 0.6 : 1 }}>
          <Pressable disabled={readOnly} onPress={() => edit((r) => setRowValue(r, row, Math.round((v - step) * 100) / 100))} style={stepBtn}>
            <T style={type.bodyStrong}>−</T>
          </Pressable>
          <T style={[type.num, { minWidth: 52, textAlign: 'center', fontSize: 15, color: v > 0 ? c.text : v < 0 ? c.danger : c.textMuted }]}>{v > 0 ? `+${v}` : v}</T>
          <Pressable disabled={readOnly} onPress={() => edit((r) => setRowValue(r, row, Math.round((v + step) * 100) / 100))} style={stepBtn}>
            <T style={type.bodyStrong}>+</T>
          </Pressable>
        </View>
      </View>
    );
  };

  const extraOverrides = (Object.entries(rules.positionOverrides) as [Position, Partial<Record<StatKey, number>>][]).flatMap(([pos, stats]) =>
    Object.entries(stats ?? {}).map(([stat, val]) => ({ pos, stat: stat as StatKey, val: val as number })),
  );

  return (
    <>
      {!readOnly ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 }}>
          {(Object.keys(SCORING_PRESETS) as ScoringPresetKey[]).map((k) => (
            <Chip key={k} label={`Start from ${SCORING_PRESETS[k].label}`} onPress={() => onChange(scoringFromPreset(k))} />
          ))}
        </View>
      ) : null}

      <Card>
        <T style={[type.label, { color: c.accent, textTransform: 'uppercase', letterSpacing: 1 }]}>Who your changes help</T>
        {movers.length ? (
          <>
            <T muted style={[type.small, { marginTop: 4, marginBottom: 6 }]}>Same {PREVIEW_WEEKS} weeks of stats, rescored with your rules.</T>
            {movers.map(({ p, delta, move, rank }) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}>
                <PlayerAvatar name={p.name} position={p.position} size={26} />
                <T style={[type.smallStrong, { flex: 1 }]} numberOfLines={1}>{p.name} <T muted style={type.micro}>{p.position}</T></T>
                <T style={[type.num, { fontSize: 12, color: delta >= 0 ? c.success : c.danger }]}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)} pts</T>
                <T style={[type.num, { fontSize: 12, width: 64, textAlign: 'right', color: move > 0 ? c.success : move < 0 ? c.danger : c.textMuted }]}>{move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : '–'} #{rank}</T>
              </View>
            ))}
          </>
        ) : (
          <T muted style={[type.small, { marginTop: 4 }]}>Change any rule and you'll see which players rise or fall, before anyone else does.</T>
        )}
        {changedCount ? <T style={[type.micro, { color: c.primary, marginTop: 6 }]}>{changedCount} rule{changedCount === 1 ? '' : 's'} changed</T> : null}
      </Card>

      <Input value={query} onChangeText={setQuery} placeholder="Find a rule: sacks, 40+, first down…" autoCapitalize="none" />
      {!q ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, marginBottom: 4 }} contentContainerStyle={{ paddingRight: 16 }}>
          {SCORING_CATALOG.map((cg) => (
            <Chip key={cg.key} label={cg.label} active={cat === cg.key} onPress={() => setCat(cg.key)} />
          ))}
          <Chip label="Position tweaks" active={cat === 'tweaks'} onPress={() => setCat('tweaks')} />
          <Chip label="Rounding" active={cat === 'rounding'} onPress={() => setCat('rounding')} />
        </ScrollView>
      ) : null}

      {cat === 'tweaks' && !q ? (
        <Card>
          <T style={type.title}>Position tweaks</T>
          <T muted style={[type.small, { marginBottom: 8 }]}>Give any position its own value for any stat. TE premium, QB rushing, RB first downs, whatever your league dreams up.</T>
          {extraOverrides.map((o) => (
            <View key={`${o.pos}-${o.stat}`} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}>
              <T style={[type.bodyStrong, { flex: 1 }]}>{o.pos} · {statLabel(o.stat)}</T>
              <T style={[type.num, { marginRight: 10 }]}>{o.val}</T>
              {!readOnly ? (
                <Pressable onPress={() => edit((r) => { const x = { ...r.positionOverrides[o.pos] }; delete x[o.stat]; r.positionOverrides[o.pos] = x; })}>
                  <T style={{ color: c.danger }}>Remove</T>
                </Pressable>
              ) : null}
            </View>
          ))}
          {!readOnly ? (
            <View style={{ marginTop: 10 }}>
              <T muted style={type.label}>POSITION</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
                {POSITIONS.map((p) => <Chip key={p} label={p} active={tweakPos === p} onPress={() => setTweakPos(p)} />)}
              </View>
              <T muted style={[type.label, { marginTop: 6 }]}>STAT</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {ALL_STATS.map((st) => <Chip key={st} label={statLabel(st)} active={tweakStat === st} onPress={() => setTweakStat(st)} />)}
              </ScrollView>
              <View style={{ marginTop: 8 }}>
                <RuleRow row={{ kind: 'pos', stat: tweakStat, position: tweakPos, label: `${tweakPos} · ${statLabel(tweakStat)}` }} />
              </View>
            </View>
          ) : null}
        </Card>
      ) : cat === 'rounding' && !q ? (
        <Card>
          <T style={type.title}>Decimal places</T>
          <T muted style={[type.small, { marginBottom: 8 }]}>How precise each player's score is. Two decimals settles almost every tie.</T>
          <View style={{ flexDirection: 'row' }}>
            {([0, 1, 2] as const).map((d) => <Chip key={d} label={d === 0 ? 'Whole points' : `${d} decimal${d > 1 ? 's' : ''}`} active={rules.decimals === d} onPress={() => edit((r) => { r.decimals = d; })} />)}
          </View>
        </Card>
      ) : (
        sections.map((sec) => (
          <Card key={sec.title}>
            <T style={type.title}>{sec.title}</T>
            {sec.subtitle ? <T muted style={[type.small, { marginBottom: 2 }]}>{sec.subtitle}</T> : null}
            {sec.rows.map((row, i) => <RuleRow key={i} row={row} />)}
          </Card>
        ))
      )}
      {q && !sections.length ? <T muted style={{ textAlign: 'center', marginTop: 10 }}>No rule matches "{query}".</T> : null}
    </>
  );
}

const stepBtn = { width: 34, height: 34, borderRadius: 10, backgroundColor: '#1E1E38', alignItems: 'center' as const, justifyContent: 'center' as const };
