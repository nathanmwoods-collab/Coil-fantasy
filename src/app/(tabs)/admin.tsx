import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, c, Card, Chip, H1, H2, InjuryBadge, Input, Screen, Segmented, T } from '../../components/ui';
import { reviewDecision, type NewsSource, type SourceTrust } from '../../news/pipeline';
import { groupSources, NFL_TEAMS, teamsMissingBeatWriters } from '../../news/sources';
import { useApp } from '../../store/useApp';
import { type } from '../../theme/type';

const TRUST: { key: SourceTrust; label: string; color: string }[] = [
  { key: 'trusted', label: 'Trusted', color: '#3DDC84' },
  { key: 'review', label: 'Review', color: '#FFB547' },
  { key: 'blocked', label: 'Blocked', color: '#FF5D5D' },
];

export default function Admin() {
  const [tab, setTab] = useState<'queue' | 'sources' | 'audit'>('queue');
  return (
    <Screen>
      <H1 kicker="Only admins see this">News desk</H1>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { key: 'queue', label: 'Approve' },
          { key: 'sources', label: 'Sources' },
          { key: 'audit', label: 'Monthly check' },
        ]}
      />
      {tab === 'queue' ? <Queue /> : tab === 'sources' ? <Sources /> : <Audit />}
    </Screen>
  );
}

function Queue() {
  const queue = useApp((s) => s.queue);
  const sent = useApp((s) => s.sent);
  const sources = useApp((s) => s.sources);
  const decide = useApp((s) => s.decideNews);
  const toast = useApp((s) => s.showToast);
  const src = (id: string) => sources.find((s) => s.id === id);

  return (
    <>
      <T muted style={{ marginBottom: 10 }}>
        Trusted sources with a clear match push on their own. Everything else waits here for one tap. Pushes only go to managers who roster, face or watch the player.
      </T>
      {queue.length === 0 ? (
        <Card>
          <T style={type.bodyStrong}>All caught up.</T>
          <T muted>New stories land here and you'll get a push.</T>
        </Card>
      ) : null}
      {queue.map((q) => {
        const s = src(q.sourceId);
        const why = reviewDecision(q, s);
        return (
          <Card key={q.rawId}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <T style={type.title}>{q.playerName}</T>
              <InjuryBadge status={q.status ?? undefined} />
            </View>
            <T style={{ marginTop: 6 }}>{q.text}</T>
            <T muted style={[type.small, { marginTop: 6 }]}>
              {s?.name ?? q.sourceId} · {s?.trust ?? 'unknown'} source · match {(q.confidence * 100).toFixed(0)}%
              {why === 'needs_review' && s?.trust === 'trusted' ? ' · held because the match is unsure' : ''}
            </T>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Button label={`Push to ${q.reach.toLocaleString()}`} onPress={() => { decide(q.rawId, 'pushed'); toast(`Sent to ${q.reach.toLocaleString()} managers.`); }} />
              </View>
              <Button label="Deny" kind="ghost" onPress={() => { decide(q.rawId, 'denied'); toast('Denied. Nobody was notified.'); }} />
            </View>
          </Card>
        );
      })}
      {sent.length ? <H2>Recent decisions</H2> : null}
      {sent.map((s) => (
        <Card key={s.rawId} style={{ opacity: 0.75 }}>
          <T style={type.bodyStrong}>{s.playerName}: {s.decision === 'pushed' ? `pushed to ${s.reach.toLocaleString()}` : 'denied'}</T>
          <T muted style={type.small}>{s.text}</T>
        </Card>
      ))}
    </>
  );
}

function Sources() {
  const sources = useApp((s) => s.sources);
  const setTrust = useApp((s) => s.setTrust);
  const addSource = useApp((s) => s.addSource);
  const toast = useApp((s) => s.showToast);
  const [openTeam, setOpenTeam] = useState<string | null>(null);
  const [handle, setHandle] = useState('');
  const [role, setRole] = useState('');
  const groups = groupSources(sources);
  const missing = teamsMissingBeatWriters(sources);

  const SourceRow = ({ s }: { s: NewsSource }) => (
    <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.border }}>
      <T style={type.bodyStrong}>{s.name}</T>
      <T muted style={type.small}>{s.role ?? s.kind}{s.kind === 'x' ? ' · X' : ''}</T>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {TRUST.map((t) => (
          <Chip key={t.key} label={t.label} active={s.trust === t.key} color={t.color} onPress={() => setTrust(s.id, t.key)} />
        ))}
      </View>
    </View>
  );

  return (
    <>
      <T muted style={{ marginBottom: 10 }}>
        Trusted: confident matches push right away. Review: always waits for you. Blocked: ignored.
      </T>
      {missing.length ? (
        <Card style={{ borderColor: '#FFB547' }}>
          <T style={type.bodyStrong}>{missing.length} teams need beat writers</T>
          <T muted style={type.small}>Open a team to add its writers. The monthly check suggests current ones for you to approve.</T>
        </Card>
      ) : null}
      {groups.map((g) =>
        g.category === 'national' ? (
          <View key="national">
            <H2>National</H2>
            <Card style={{ paddingVertical: 4 }}>
              {g.sources.map((s) => (
                <SourceRow key={s.id} s={s} />
              ))}
            </Card>
          </View>
        ) : null,
      )}
      <H2>Teams</H2>
      {groups
        .filter((g) => g.category !== 'national')
        .map((g) => (
          <Card key={g.category} style={{ paddingVertical: 10 }}>
            <Pressable onPress={() => setOpenTeam(openTeam === g.category ? null : g.category)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T style={type.bodyStrong}>{g.label}</T>
              <T muted style={type.small}>
                {g.sources.filter((s) => s.tier === 'beat').length} beat · {openTeam === g.category ? 'close' : 'open'}
              </T>
            </Pressable>
            {openTeam === g.category ? (
              <View style={{ marginTop: 6 }}>
                {g.sources.map((s) => (
                  <SourceRow key={s.id} s={s} />
                ))}
                <T style={[type.smallStrong, { marginTop: 10, marginBottom: 6 }]}>Add a beat writer</T>
                <Input value={handle} onChangeText={setHandle} placeholder="X handle, e.g. @writer" autoCapitalize="none" />
                <View style={{ height: 6 }} />
                <Input value={role} onChangeText={setRole} placeholder={`Role, e.g. ${NFL_TEAMS[g.category]?.name ?? ''} beat writer, outlet`} />
                <View style={{ height: 8 }} />
                <Button
                  small
                  label="Add as Review"
                  disabled={!handle.trim()}
                  onPress={() => {
                    const h = handle.trim().replace(/^@/, '');
                    addSource({ id: `x:${h.toLowerCase()}`, name: `@${h}`, tier: 'beat', trust: 'review', url: `https://x.com/${h}`, kind: 'x', category: g.category, role: role.trim() || `${NFL_TEAMS[g.category]?.name} beat writer` });
                    setHandle('');
                    setRole('');
                    toast(`Added @${h}. Their stories wait for review until you trust them.`);
                  }}
                />
              </View>
            ) : null}
          </Card>
        ))}
    </>
  );
}

function Audit() {
  const run = useApp((s) => s.runAudit);
  const log = useApp((s) => s.auditLog);
  const suggestions = useApp((s) => s.auditSuggestions);
  const next = useApp((s) => s.nextAudit);
  return (
    <>
      <Card>
        <T style={type.title}>Monthly source check</T>
        <T muted style={{ marginTop: 4 }}>
          Every month Coil checks each source is still active and in the same job. If a writer posts that they now cover another team, they move to that team. If an account is gone, it's removed. Anything unclear comes to you.
        </T>
        <T muted style={[type.small, { marginTop: 8 }]}>Next run: {new Date(next).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</T>
        <View style={{ marginTop: 12 }}>
          <Button label="Run it now" onPress={run} />
        </View>
      </Card>
      {suggestions.length ? <H2>Needs your call</H2> : null}
      {suggestions.map((s, i) => (
        <Card key={i} style={{ borderColor: '#FFB547' }}>
          <T>{s}</T>
        </Card>
      ))}
      {log.length ? <H2>Change log</H2> : null}
      {log.map((l, i) => (
        <Card key={i}>
          <T style={type.bodyStrong}>
            {l.action.type === 'reassign' ? `Moved ${l.action.sourceId} from ${l.action.from} to ${l.action.to}` : l.action.type === 'remove' ? `Removed ${l.action.sourceId}` : `${l.action.sourceId}: ${l.action.type.replace('_', ' ')}`}
            {l.applied ? '' : ' (suggested)'}
          </T>
          <T muted style={type.small}>{'reason' in l.action ? l.action.reason : ''}</T>
        </Card>
      ))}
    </>
  );
}
