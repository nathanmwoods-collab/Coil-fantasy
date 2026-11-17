// Default news sources, grouped as National plus one group per NFL team.
// Admins approve, review or block any source (and add new ones) in the Admin
// area; this is only the starting list.
//
// Beat writers change outlets often, so team groups start with the official
// team source only. The first monthly audit suggests each team's current beat
// writers for an admin to approve, rather than shipping a list that may
// already be out of date.
//
// X accounts need the paid X API (or a licensed relay) to read in real time;
// RSS and team sites are free.

import type { NewsSource, SourceTrust } from './pipeline';

export const NFL_TEAMS: Record<string, { city: string; name: string; aliases: string[] }> = {
  ARI: { city: 'Arizona', name: 'Cardinals', aliases: ['cards'] },
  ATL: { city: 'Atlanta', name: 'Falcons', aliases: [] },
  BAL: { city: 'Baltimore', name: 'Ravens', aliases: [] },
  BUF: { city: 'Buffalo', name: 'Bills', aliases: [] },
  CAR: { city: 'Carolina', name: 'Panthers', aliases: [] },
  CHI: { city: 'Chicago', name: 'Bears', aliases: [] },
  CIN: { city: 'Cincinnati', name: 'Bengals', aliases: [] },
  CLE: { city: 'Cleveland', name: 'Browns', aliases: [] },
  DAL: { city: 'Dallas', name: 'Cowboys', aliases: [] },
  DEN: { city: 'Denver', name: 'Broncos', aliases: [] },
  DET: { city: 'Detroit', name: 'Lions', aliases: [] },
  GB: { city: 'Green Bay', name: 'Packers', aliases: [] },
  HOU: { city: 'Houston', name: 'Texans', aliases: [] },
  IND: { city: 'Indianapolis', name: 'Colts', aliases: [] },
  JAX: { city: 'Jacksonville', name: 'Jaguars', aliases: ['jags'] },
  KC: { city: 'Kansas City', name: 'Chiefs', aliases: [] },
  LAC: { city: 'Los Angeles', name: 'Chargers', aliases: ['bolts'] },
  LAR: { city: 'Los Angeles', name: 'Rams', aliases: [] },
  LV: { city: 'Las Vegas', name: 'Raiders', aliases: [] },
  MIA: { city: 'Miami', name: 'Dolphins', aliases: ['fins'] },
  MIN: { city: 'Minnesota', name: 'Vikings', aliases: ['vikes'] },
  NE: { city: 'New England', name: 'Patriots', aliases: ['pats'] },
  NO: { city: 'New Orleans', name: 'Saints', aliases: [] },
  NYG: { city: 'New York', name: 'Giants', aliases: [] },
  NYJ: { city: 'New York', name: 'Jets', aliases: [] },
  PHI: { city: 'Philadelphia', name: 'Eagles', aliases: ['birds'] },
  PIT: { city: 'Pittsburgh', name: 'Steelers', aliases: [] },
  SEA: { city: 'Seattle', name: 'Seahawks', aliases: [] },
  SF: { city: 'San Francisco', name: '49ers', aliases: ['niners'] },
  TB: { city: 'Tampa Bay', name: 'Buccaneers', aliases: ['bucs'] },
  TEN: { city: 'Tennessee', name: 'Titans', aliases: [] },
  WAS: { city: 'Washington', name: 'Commanders', aliases: [] },
};

const x = (handle: string, name: string, trust: SourceTrust, tier: NewsSource['tier'], role: string, category = 'national'): NewsSource => ({
  id: `x:${handle.toLowerCase()}`,
  name,
  tier,
  trust,
  url: `https://x.com/${handle}`,
  kind: 'x',
  category,
  role,
});

export const DEFAULT_SOURCES: NewsSource[] = [
  // National: insiders are trusted and auto-push when the match is confident.
  x('AdamSchefter', 'Adam Schefter', 'trusted', 'insider', 'NFL insider, ESPN'),
  x('RapSheet', 'Ian Rapoport', 'trusted', 'insider', 'NFL insider, NFL Network'),
  x('TomPelissero', 'Tom Pelissero', 'trusted', 'insider', 'NFL insider, NFL Network'),
  x('MikeGarafolo', 'Mike Garafolo', 'trusted', 'insider', 'NFL insider, NFL Network'),
  x('JFowlerESPN', 'Jeremy Fowler', 'trusted', 'insider', 'NFL insider, ESPN'),
  x('FieldYates', 'Field Yates', 'trusted', 'insider', 'NFL analyst, ESPN'),
  x('ProFootballTalk', 'ProFootballTalk', 'review', 'aggregator', 'NFL news site'),
  { id: 'wire:nfl-transactions', name: 'NFL transaction wire', tier: 'official', trust: 'trusted', url: 'https://www.nfl.com/transactions/', kind: 'wire', category: 'national', role: 'Official league transactions' },
  { id: 'feed:mysportsfeeds-injuries', name: 'MySportsFeeds injury feed', tier: 'official', trust: 'trusted', url: 'https://www.mysportsfeeds.com/', kind: 'wire', category: 'national', role: 'Injury designations (data feed)' },
  // One official source per team; beat writers are added by the audit or an admin.
  ...Object.entries(NFL_TEAMS).map(
    ([abbr, t]): NewsSource => ({
      id: `team:${abbr}`,
      name: `${t.city} ${t.name} (official)`,
      tier: 'official',
      trust: 'trusted',
      url: '',
      kind: 'team_site',
      category: abbr,
      role: 'Official team news',
    }),
  ),
];

/** Sources grouped for the Admin screen: National first, then teams A to Z. */
export function groupSources(sources: NewsSource[]): { category: string; label: string; sources: NewsSource[] }[] {
  const groups = new Map<string, NewsSource[]>();
  for (const s of sources) groups.set(s.category, [...(groups.get(s.category) ?? []), s]);
  const keys = [...groups.keys()].sort((a, b) => (a === 'national' ? -1 : b === 'national' ? 1 : a.localeCompare(b)));
  return keys.map((k) => ({
    category: k,
    label: k === 'national' ? 'National' : NFL_TEAMS[k] ? `${NFL_TEAMS[k].city} ${NFL_TEAMS[k].name}` : k,
    sources: groups.get(k)!,
  }));
}

/** Teams with no beat writer yet, so the Admin screen can nudge to fill them. */
export function teamsMissingBeatWriters(sources: NewsSource[]): string[] {
  return Object.keys(NFL_TEAMS).filter((t) => !sources.some((s) => s.category === t && s.tier === 'beat' && s.trust !== 'blocked'));
}
