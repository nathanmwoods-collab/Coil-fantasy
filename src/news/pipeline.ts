// Breaking news pipeline.
//
//   sources (RSS, team sites, transaction wires, optional X) ──► raw items
//   ──► match player + status (rules here; an AI classifier can plug in)
//   ──► dedupe (same player + same status within a window = one story)
//   ──► approve queue (auto-approve trusted sources at high confidence)
//   ──► targeted push: only managers who roster or watch the player
//
// Everything here is pure logic so it can be tested; fetching and sending
// pushes live in the server.

import { injuryTag, normalizeInjuryStatus } from '../engine/injuries';
import type { InjuryStatus, Player, PlayerId } from '../engine/types';

export type SourceTier = 'official' | 'insider' | 'beat' | 'aggregator';

/**
 * What Coil does with a source's stories. Set by an admin in the news console.
 * trusted: confident matches push right away. review: always waits in the
 * approve queue. blocked: ignored entirely.
 */
export type SourceTrust = 'trusted' | 'review' | 'blocked';

export type NewsSource = {
  id: string;
  name: string;
  tier: SourceTier;
  trust: SourceTrust;
  url: string;
  kind: 'rss' | 'team_site' | 'x' | 'wire' | 'web';
  /** "national", or the NFL team a beat writer covers (e.g. "BUF"). */
  category: 'national' | string;
  /** What they do, e.g. "Bills beat writer, The Buffalo News". */
  role?: string;
  /** Set by the monthly audit. */
  lastVerifiedAt?: string;
  lastPostAt?: string;
  /** Audit trail of who changed trust and when. */
  history?: { at: string; by: string; from: SourceTrust; to: SourceTrust }[];
};

/** Approve, send to review, or block a source. Keeps an audit trail. */
export function setSourceTrust(source: NewsSource, trust: SourceTrust, by: string, at = new Date().toISOString()): NewsSource {
  if (source.trust === trust) return source;
  return { ...source, trust, history: [...(source.history ?? []), { at, by, from: source.trust, to: trust }] };
}

/** Drop items from blocked sources before any matching work. */
export function filterBlocked(items: RawNewsItem[], sources: Record<string, NewsSource>): RawNewsItem[] {
  return items.filter((i) => sources[i.sourceId] && sources[i.sourceId].trust !== 'blocked');
}

export type RawNewsItem = { id: string; sourceId: string; text: string; url?: string; publishedAt: string };

export type MatchedStory = {
  rawId: string;
  sourceId: string;
  playerId: PlayerId;
  playerName: string;
  status: InjuryStatus | null;
  /** Other news type when it's not an injury, e.g. trade or release. */
  kind: 'injury' | 'transaction' | 'role' | 'other';
  confidence: number; // 0..1
  text: string;
  publishedAt: string;
};

/** Optional AI classifier. Returns null to fall back to rules. */
export type Classifier = (item: RawNewsItem, candidates: Player[]) => Promise<Partial<MatchedStory> | null>;

const STATUS_PHRASES: [RegExp, InjuryStatus][] = [
  [/\b(placed|placing|landed|lands|going) (him )?on (injured reserve|IR)\b/i, 'ir'],
  [/\b(injured reserve)\b/i, 'ir'],
  [/\bruled out\b|\bwill not play\b|\bwon't play\b|\bis out\b|\binactive\b/i, 'out'],
  [/\bdoubtful\b/i, 'doubtful'],
  [/\bquestionable\b|\bgame[- ]time decision\b/i, 'questionable'],
  [/\bsuspended\b|\bsuspension\b/i, 'suspended'],
  [/\b(activated|returns? to practice|cleared|off injured reserve|will play|is active)\b/i, 'active'],
];

const TRANSACTION = /\b(traded|trade|released|waived|signed|signing|claimed)\b/i;
const ROLE = /\b(starting|will start|named starter|benched|depth chart|workhorse|lead back)\b/i;

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\.?\b/g, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Find players named in the text. Full names first; last name + team as a fallback. */
export function findPlayers(text: string, players: Player[]): Player[] {
  const t = ` ${normName(text)} `;
  const full = players.filter((p) => t.includes(` ${normName(p.name)} `));
  if (full.length) return full;
  return players.filter((p) => {
    const last = normName(p.name).split(' ').pop();
    return last && last.length > 3 && t.includes(` ${last} `) && text.toUpperCase().includes(p.nflTeam.toUpperCase());
  });
}

/** Rules-based matching. Good enough for clear wording; an AI classifier handles the rest. */
export function matchStory(item: RawNewsItem, players: Player[]): MatchedStory | null {
  const found = findPlayers(item.text, players);
  if (found.length !== 1) return null; // zero or ambiguous: send to manual review
  const p = found[0];
  let status: InjuryStatus | null = null;
  for (const [re, s] of STATUS_PHRASES) {
    if (re.test(item.text)) {
      status = s;
      break;
    }
  }
  const kind: MatchedStory['kind'] = status ? 'injury' : TRANSACTION.test(item.text) ? 'transaction' : ROLE.test(item.text) ? 'role' : 'other';
  const fullNameHit = normName(item.text).includes(normName(p.name));
  return {
    rawId: item.id,
    sourceId: item.sourceId,
    playerId: p.id,
    playerName: p.name,
    status,
    kind,
    confidence: (fullNameHit ? 0.6 : 0.4) + (kind !== 'other' ? 0.3 : 0),
    text: item.text,
    publishedAt: item.publishedAt,
  };
}

/** Collapse repeats: the same player + kind + status within `windowMin` minutes is one story. */
export function dedupe(stories: MatchedStory[], windowMin = 90): MatchedStory[] {
  const sorted = [...stories].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
  const kept: MatchedStory[] = [];
  for (const s of sorted) {
    const dup = kept.find(
      (k) =>
        k.playerId === s.playerId &&
        k.kind === s.kind &&
        k.status === s.status &&
        Math.abs(Date.parse(s.publishedAt) - Date.parse(k.publishedAt)) <= windowMin * 60_000,
    );
    if (!dup) kept.push(s);
  }
  return kept;
}

export type ReviewDecision = 'auto_approve' | 'needs_review';

/**
 * Human in the loop: trusted sources with a confident match go straight out;
 * review sources and shaky matches wait for a quick approve; blocked are ignored.
 */
export function reviewDecision(story: MatchedStory, source: NewsSource | undefined): ReviewDecision | 'ignore' {
  if (!source) return story.sourceId === 'feed' ? 'auto_approve' : 'needs_review';
  if (source.trust === 'blocked') return 'ignore';
  return source.trust === 'trusted' && story.confidence >= 0.85 ? 'auto_approve' : 'needs_review';
}

export type PushTarget = { userId: string; leagueId: string; reason: 'rostered' | 'watching' | 'opponent' };

export type Audience = {
  /** userId -> leagueId -> rostered player ids */
  rosters: { userId: string; leagueId: string; playerIds: PlayerId[] }[];
  watchlists: { userId: string; playerIds: PlayerId[] }[];
  /** This week's opponents, so you hear when their star is out. */
  opponents: { userId: string; leagueId: string; opponentPlayerIds: PlayerId[] }[];
  /** Users who muted a kind of alert. */
  muted: { userId: string; kinds: MatchedStory['kind'][] }[];
};

/** Only managers the news affects get a push. One push per user per story. */
export function pushTargets(story: MatchedStory, audience: Audience): PushTarget[] {
  const muted = new Map(audience.muted.map((m) => [m.userId, new Set(m.kinds)]));
  const out = new Map<string, PushTarget>();
  const add = (t: PushTarget) => {
    if (muted.get(t.userId)?.has(story.kind)) return;
    const prev = out.get(t.userId);
    const rank = { rostered: 0, opponent: 1, watching: 2 };
    if (!prev || rank[t.reason] < rank[prev.reason]) out.set(t.userId, t);
  };
  for (const r of audience.rosters) if (r.playerIds.includes(story.playerId)) add({ userId: r.userId, leagueId: r.leagueId, reason: 'rostered' });
  for (const o of audience.opponents) if (o.opponentPlayerIds.includes(story.playerId)) add({ userId: o.userId, leagueId: o.leagueId, reason: 'opponent' });
  for (const w of audience.watchlists) if (w.playerIds.includes(story.playerId)) add({ userId: w.userId, leagueId: '', reason: 'watching' });
  return [...out.values()];
}

/** Push copy: short, human, and tells you what to do. */
export function pushCopy(story: MatchedStory, target: PushTarget, onBench = false): { title: string; body: string } {
  const tag = story.status ? injuryTag(story.status) : null;
  const title = tag && tag.code ? `${story.playerName} (${tag.code})` : story.playerName;
  let body = story.text.length > 140 ? `${story.text.slice(0, 137)}…` : story.text;
  if (target.reason === 'rostered' && tag?.inactive && !onBench) body += ' He’s in your lineup. Tap to swap him out.';
  if (target.reason === 'opponent' && tag?.inactive) body += ' Good news for you this week.';
  return { title, body };
}

/** Feed status fallback: convert MySportsFeeds injury changes into stories. */
export function storiesFromStatusChanges(
  changes: { player: Player; from: InjuryStatus; to: InjuryStatus; at: string; note?: string }[],
): MatchedStory[] {
  return changes
    .filter((c) => c.from !== c.to)
    .map((c) => ({
      rawId: `status:${c.player.id}:${c.at}`,
      sourceId: 'feed',
      playerId: c.player.id,
      playerName: c.player.name,
      status: c.to,
      kind: 'injury' as const,
      confidence: 1,
      text: `${c.player.name} is now listed as ${injuryTag(c.to).label.toLowerCase()}${c.note ? ` (${c.note})` : ''}.`,
      publishedAt: c.at,
    }));
}

export { normalizeInjuryStatus };
