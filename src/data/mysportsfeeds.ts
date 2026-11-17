// MySportsFeeds (v2.1) adapter.
//
// Field names follow the MSF v2.1 docs as we understand them; verify each
// mapping against a live response before launch (this container could not
// reach the API). Parsing is defensive: unknown fields are ignored, missing
// stats count as zero.
//
// Licensing note: MSF's personal tier is for non-commercial use. Confirm with
// MSF that Coil qualifies, or move to their commercial NFL tier, before launch.

import { normalizeInjuryStatus } from '../engine/injuries';
import type { Player, Position, StatLine } from '../engine/types';
import type { NflGame, PlayerInjury, SportsDataProvider, WeeklyStats } from './provider';

type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

const BASE = 'https://api.mysportsfeeds.com/v2.1/pull/nfl';

const POSITION_MAP: Record<string, Position> = {
  QB: 'QB',
  RB: 'RB',
  FB: 'RB',
  WR: 'WR',
  TE: 'TE',
  K: 'K',
  PK: 'K',
  DE: 'DL',
  DT: 'DL',
  NT: 'DL',
  DL: 'DL',
  LB: 'LB',
  OLB: 'LB',
  ILB: 'LB',
  MLB: 'LB',
  CB: 'DB',
  S: 'DB',
  SS: 'DB',
  FS: 'DB',
  DB: 'DB',
};

export function mapPosition(raw: string | undefined): Position | null {
  return raw ? POSITION_MAP[raw.toUpperCase()] ?? null : null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Convert one MSF gamelog `stats` object to Coil's StatLine. */
export function mapGamelogStats(s: any): StatLine {
  const p = s?.passing ?? {};
  const r = s?.rushing ?? {};
  const c = s?.receiving ?? {};
  const f = s?.fumbles ?? {};
  const k = s?.fieldGoals ?? {};
  const x = s?.extraPointAttempts ?? {};
  const t = s?.tackles ?? {};
  const i = s?.interceptions ?? {};
  const two = s?.twoPointAttempts ?? {};
  const kr = s?.kickoffReturns ?? {};
  const pr = s?.puntReturns ?? {};
  const line: StatLine = {
    passYds: num(p.passYards),
    passTd: num(p.passTD),
    passInt: num(p.passInt),
    passCmp: num(p.passCompletions),
    passAtt: num(p.passAttempts),
    passInc: Math.max(0, num(p.passAttempts) - num(p.passCompletions)),
    sacked: num(p.passSacks),
    rushYds: num(r.rushYards),
    rushTd: num(r.rushTD),
    rushAtt: num(r.rushAttempts),
    rec: num(c.receptions),
    recYds: num(c.recYards),
    recTd: num(c.recTD),
    recTgt: num(c.targets),
    fumLost: num(f.fumLost),
    fum: num(f.fumbles),
    pass2pt: num(two.twoPtPassMade),
    rush2pt: num(two.twoPtRushMade),
    rec2pt: num(two.twoPtPassRec),
    krTd: num(kr.krTD),
    prTd: num(pr.prTD),
    krYds: num(kr.krYds),
    prYds: num(pr.prYds),
    fgMiss: Math.max(0, num(k.fgAtt) - num(k.fgMade)),
    xpMade: num(x.xpMade),
    xpMiss: Math.max(0, num(x.xpAtt) - num(x.xpMade)),
    idpSoloTkl: num(t.tackleSolo),
    idpAstTkl: num(t.tackleAst),
    idpSack: num(t.sacks),
    idpTfl: num(t.tacklesForLoss),
    idpQbHit: num(t.qbHits),
    idpInt: num(i.interceptions),
    idpPassDef: num(i.passesDefended),
    idpFf: num(f.fumForced),
    idpFumRec: num(f.fumOppRec),
  };
  // Field goal distances: MSF buckets made FGs by range (fgMade1_19, fgMade20_29...).
  const buckets: [string, number][] = [
    ['fgMade1_19', 18],
    ['fgMade20_29', 25],
    ['fgMade30_39', 35],
    ['fgMade40_49', 45],
    ['fgMade50Plus', 52],
  ];
  const fgMadeYards: number[] = [];
  for (const [key, yds] of buckets) for (let n = 0; n < num(k[key]); n++) fgMadeYards.push(yds);
  if (fgMadeYards.length) line.fgMadeYards = fgMadeYards;
  for (const key of Object.keys(line) as (keyof StatLine)[]) if (line[key] === 0) delete line[key];
  return line;
}

export function mapPlayer(entry: any, season: number): Player | null {
  const p = entry?.player ?? entry;
  const position = mapPosition(p?.primaryPosition);
  if (!p?.id || !position) return null;
  const draftYear = p?.drafted?.year;
  return {
    id: `msf:${p.id}`,
    name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim(),
    position,
    nflTeam: p?.currentTeam?.abbreviation ?? entry?.teamAsOfDate?.abbreviation ?? 'FA',
    yearsPro: typeof draftYear === 'number' ? Math.max(0, season - draftYear) : p?.rookie ? 0 : undefined,
    status: normalizeInjuryStatus(p?.currentInjury?.playingProbability),
    injuryNote: p?.currentInjury?.description ?? undefined,
    // MSF includes an official headshot URL on players; confirm display rights before launch.
    headshotUrl: p?.officialImageSrc ?? undefined,
  };
}

export class MySportsFeedsProvider implements SportsDataProvider {
  readonly name = 'MySportsFeeds';
  constructor(
    private apiKey: string,
    private fetchImpl: Fetch = globalThis.fetch as unknown as Fetch,
  ) {}

  private async get(season: number, path: string): Promise<any> {
    const url = `${BASE}/${season}-regular/${path}`;
    const auth = btoa(`${this.apiKey}:MYSPORTSFEEDS`);
    const res = await this.fetchImpl(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) throw new Error(`MySportsFeeds ${path} failed with HTTP ${res.status}`);
    return res.json();
  }

  async players(season: number): Promise<Player[]> {
    const data = await this.get(season, 'players.json');
    return (data?.players ?? []).map((e: any) => mapPlayer(e, season)).filter(Boolean) as Player[];
  }

  async injuries(season: number): Promise<PlayerInjury[]> {
    const data = await this.get(season, 'player_injuries.json');
    return (data?.players ?? [])
      .filter((p: any) => p?.id)
      .map((p: any) => ({
        playerId: `msf:${p.id}`,
        status: normalizeInjuryStatus(p?.currentInjury?.playingProbability),
        note: p?.currentInjury?.description,
      }));
  }

  async schedule(season: number): Promise<NflGame[]> {
    const data = await this.get(season, 'games.json');
    return (data?.games ?? []).map((g: any) => {
      const s = g.schedule ?? {};
      const played = String(s.playedStatus ?? '').toUpperCase();
      return {
        id: `msf:${s.id}`,
        week: s.week,
        startsAt: s.startTime,
        home: s.homeTeam?.abbreviation,
        away: s.awayTeam?.abbreviation,
        status: played.startsWith('COMPLETED') ? 'final' : played === 'LIVE' ? 'live' : 'scheduled',
      } satisfies NflGame;
    });
  }

  async weeklyStats(season: number, week: number): Promise<WeeklyStats[]> {
    const data = await this.get(season, `week/${week}/player_gamelogs.json`);
    return (data?.gamelogs ?? [])
      .filter((g: any) => g?.player?.id)
      .map((g: any) => ({ playerId: `msf:${g.player.id}`, week, stats: mapGamelogStats(g.stats) }));
  }

  /** The free tier has no projections; Coil's own model fills in (engine/projections). */
  async projections(): Promise<null> {
    return null;
  }

  /** MSF has no news feed; news comes from a separate source (see spec). */
  async news(): Promise<null> {
    return null;
  }
}
