// MyFantasyLeague (MFL) import.
//
// MFL has a documented export API that returns JSON:
//   https://api.myfantasyleague.com/{year}/export?TYPE=league&L={id}&JSON=1
//   TYPE=rosters, TYPE=players&DETAILS=1, TYPE=futureDraftPicks, TYPE=leagueStandings
// Public leagues need nothing else. Private leagues need the manager's MFL
// login: our server calls /{year}/login?USERNAME=…&PASSWORD=…&XML=1 once, keeps
// only the MFL_USER_ID cookie it returns (never the password), and with that
// cookie TYPE=myleagues lists the manager's leagues so they can just pick one.
// MFL asks heavy API users to register a client name and send it as the
// User-Agent; we do that from the server.
//
// MFL quirk: a list with one item comes back as an object, not an array.

import { pickId, type DraftPick } from '../engine/picks';
import { scoringFromPreset } from '../engine/scoring';
import { defaultSettings, type LeagueSettings } from '../engine/settings';
import type { Position, SlotType } from '../engine/types';
import type { ImportedLeague, ImportedPlayer, ImportedTeam } from './types';

export type Fetch = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;

export const MFL_API = 'https://api.myfantasyleague.com';

/** MFL wraps single items as objects. Always get an array. */
export const list = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

/** League id from an MFL link (…myfantasyleague.com/2026/home/12345) or a bare number. */
export function parseMflLeagueId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/myfantasyleague\.com\/\d{4}\/\w+\/(\d+)/i) ?? s.match(/[?&]L=(\d+)/) ?? s.match(/^(\d{4,6})$/);
  return m ? m[1] : null;
}

const MFL_POS: Record<string, Position> = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', PK: 'K', Def: 'DST', DE: 'DL', DT: 'DL', LB: 'LB', CB: 'DB', S: 'DB' };

/** "Chase, Ja'Marr" -> "Ja'Marr Chase". */
export const mflName = (n: string) => (n.includes(',') ? `${n.split(',').slice(1).join(',').trim()} ${n.split(',')[0].trim()}` : n);

export function mapMflSettings(league: any, warnings: string[]): LeagueSettings {
  const franchises = list(league.franchises?.franchise);
  const taxi = Number(league.taxiSquad ?? 0);
  const s = defaultSettings({ name: league.name ?? 'MFL league', format: taxi > 0 || league.loadRosters === 'email_draft' ? 'dynasty' : 'redraft', teams: Number(league.franchises?.count ?? franchises.length ?? 12) });

  // Starters: MFL lists a min-max per position plus a total; extra spots become flex.
  const roster: Partial<Record<SlotType, number>> = {};
  let fixed = 0;
  for (const p of list(league.starters?.position)) {
    const pos = MFL_POS[p.name];
    const min = Number(String(p.limit).split('-')[0]);
    if (pos && min) {
      roster[pos as SlotType] = (roster[pos as SlotType] ?? 0) + min;
      fixed += min;
    }
  }
  const total = Number(league.starters?.count ?? fixed);
  const qbMax = Number(String(list(league.starters?.position).find((p: any) => p.name === 'QB')?.limit ?? '1').split('-').pop());
  if (total > fixed) {
    if (qbMax > (roster.QB ?? 1)) {
      roster.SUPERFLEX = 1;
      if (total - fixed > 1) roster.FLEX = total - fixed - 1;
    } else roster.FLEX = total - fixed;
  }
  const size = Number(league.rosterSize ?? 0);
  if (size) roster.BN = Math.max(0, size - total);
  if (Number(league.injuredReserve)) roster.IR = Number(league.injuredReserve);
  if (taxi) roster.TAXI = taxi;
  if (Object.keys(roster).length) s.roster = roster;
  s.dynasty.taxiSlots = taxi;

  s.scoring = scoringFromPreset('ppr');
  s.scoringPreset = 'ppr';
  warnings.push('MFL scoring rules come over from the rules page next; until then Coil uses PPR. Check Scoring before week 1.');

  if (league.usesSalaries === '1') warnings.push('This league uses salaries and contracts. Contract years come over; salary caps are coming to Coil soon.');
  if (league.bbidAvailableBalance || franchises.some((f: any) => f.bbidAvailableBalance !== undefined)) s.waivers.type = 'faab';
  if (league.lastRegularSeasonWeek) {
    s.regularSeasonWeeks = Number(league.lastRegularSeasonWeek);
    s.playoffs.startWeek = s.regularSeasonWeeks + 1;
  }
  const divisions = list(league.divisions?.division);
  if (divisions.length > 1) s.divisions = divisions.length;
  if (s.format === 'dynasty') s.trades.futurePickSeasons = 3;
  return s;
}

export function mapMflTeams(league: any, rosters: any, players: Map<string, any>): ImportedTeam[] {
  const byId = new Map(list(rosters?.rosters?.franchise).map((f: any) => [f.id, f]));
  return list(league.franchises?.franchise).map((f: any): ImportedTeam => {
    const roster = byId.get(f.id) as any;
    const ps: ImportedPlayer[] = list(roster?.player).map((p: any) => {
      const info = players.get(p.id);
      return {
        sourcePlayerId: p.id,
        name: info ? mflName(info.name) : p.id,
        position: info ? MFL_POS[info.position] ?? null : null,
        nflTeam: info?.team && info.team !== 'FA' ? info.team : null,
        slot: p.status === 'INJURED_RESERVE' ? 'IR' : p.status === 'TAXI_SQUAD' ? 'TAXI' : 'active',
        contractYears: p.contractYear ? Number(p.contractYear) : undefined,
      };
    });
    return {
      sourceTeamId: `F${f.id}`,
      name: f.name ?? `Franchise ${f.id}`,
      ownerName: f.owner_name ?? null,
      ownerSourceUserId: null,
      avatarUrl: f.icon || f.logo || undefined,
      players: ps,
      faabRemaining: f.bbidAvailableBalance !== undefined ? Number(f.bbidAvailableBalance) : null,
      waiverPosition: f.waiverSortOrder ? Number(f.waiverSortOrder) : undefined,
    };
  });
}

/** MFL lists each team's future picks directly, including ones traded in. */
export function mapMflPicks(future: any): DraftPick[] {
  const picks: DraftPick[] = [];
  for (const f of list(future?.futureDraftPicks?.franchise)) {
    for (const p of list(f.futureDraftPick)) {
      const original = `F${p.originalPickFor}`;
      picks.push({ id: pickId(Number(p.year), Number(p.round), original), season: Number(p.year), round: Number(p.round), originalTeamId: original, ownerTeamId: `F${f.id}`, pickInRound: null, used: false });
    }
  }
  return picks;
}

export async function importMflLeague(input: string, opts: { season: number; fetch?: Fetch }): Promise<ImportedLeague> {
  const fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as Fetch);
  const id = parseMflLeagueId(input);
  if (!id) throw new Error('That doesn’t look like an MFL league link or ID.');
  const get = async (type: string, extra = '') => {
    const res = await fetchImpl(`${MFL_API}/${opts.season}/export?TYPE=${type}&L=${id}${extra}&JSON=1`);
    if (!res.ok) throw new Error(`MFL returned ${res.status} for ${type}.`);
    const body = await res.json();
    if (body?.error) throw new Error(/private|login|access/i.test(JSON.stringify(body.error)) ? 'This MFL league is private. Sign in with your MFL account once so we can read it.' : `MFL said: ${body.error.$t ?? body.error}`);
    return body;
  };
  const { league } = await get('league');
  if (!league) throw new Error('We couldn’t find that MFL league.');
  const [rosters, playerList, future] = await Promise.all([get('rosters'), get('players', '&DETAILS=1'), get('futureDraftPicks').catch(() => null)]);
  const players = new Map(list(playerList?.players?.player).map((p: any) => [p.id, p]));
  const warnings: string[] = [];
  const settings = mapMflSettings(league, warnings);
  const teams = mapMflTeams(league, rosters, players);
  const picks = mapMflPicks(future);
  return { source: 'mfl', sourceLeagueId: id, season: opts.season, name: settings.name, settings, teams, picks, history: [], warnings };
}
