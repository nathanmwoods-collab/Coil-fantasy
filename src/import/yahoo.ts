// Yahoo Fantasy import.
//
// Yahoo has no public read API: every call needs the manager's OAuth 2.0
// sign-in. The flow:
//   1. The app opens yahooAuthUrl() and the manager signs in to Yahoo.
//   2. Yahoo sends back a one-time code. Coil's server swaps it for a token at
//      https://api.login.yahoo.com/oauth2/get_token (that call needs our app's
//      secret, so it can't happen on the phone).
//   3. With the token, list the manager's NFL leagues:
//      /fantasy/v2/users;use_login=1/games;game_keys=nfl/leagues?format=json
//   4. For the league they tap: /league/{key}/settings and /league/{key}/teams/roster
// We only ask for read access (scope fspt-r). Setup: register a Coil app at
// developer.yahoo.com with Fantasy Sports read access.
//
// Yahoo's JSON wraps objects as arrays of one-key objects and collections as
// {"0": …, "1": …, "count": n}; the helpers below flatten both.

import { scoringFromPreset } from '../engine/scoring';
import { defaultSettings, type LeagueSettings } from '../engine/settings';
import type { Position, SlotType } from '../engine/types';
import type { ImportedLeague, ImportedPlayer, ImportedTeam } from './types';

export const YAHOO_API = 'https://fantasysports.yahooapis.com/fantasy/v2';

export function yahooAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'fspt-r', state });
  return `https://api.login.yahoo.com/oauth2/request_auth?${q}`;
}

/** [{a:1},{b:2},"x"] -> {a:1,b:2}. Nested arrays of parts are merged too. */
export function ymerge(parts: any): Record<string, any> {
  const out: Record<string, any> = {};
  const walk = (x: any) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === 'object') Object.assign(out, x);
  };
  walk(parts);
  return out;
}

/** {"0": a, "1": b, count: 2} -> [a, b]. */
export function yitems(coll: any): any[] {
  if (!coll || typeof coll !== 'object') return [];
  return Object.keys(coll)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => coll[k]);
}

export type YahooLeagueSummary = { leagueKey: string; name: string; season: string; teams: number; format: string };

export function parseYahooLeagues(body: any): YahooLeagueSummary[] {
  const user = yitems(body?.fantasy_content?.users)[0]?.user;
  const games = yitems(ymerge(user?.slice?.(1) ?? []).games);
  const out: YahooLeagueSummary[] = [];
  for (const g of games) {
    const leagues = yitems(ymerge(g.game?.slice?.(1) ?? []).leagues);
    for (const l of leagues) {
      const info = ymerge(l.league);
      out.push({ leagueKey: info.league_key, name: info.name, season: String(info.season), teams: Number(info.num_teams ?? 0), format: info.is_keeper === '1' || info.uses_keepers ? 'Keeper' : 'Redraft' });
    }
  }
  return out;
}

const Y_POS: Record<string, Position> = { QB: 'QB', RB: 'RB', WR: 'WR', TE: 'TE', K: 'K', DEF: 'DST', DL: 'DL', DE: 'DL', DT: 'DL', LB: 'LB', DB: 'DB', CB: 'DB', S: 'DB' };
const Y_SLOTS: Record<string, SlotType> = { ...Y_POS as Record<string, SlotType>, 'W/R/T': 'FLEX', 'W/R': 'WR_RB', 'W/T': 'WR_TE', 'Q/W/R/T': 'SUPERFLEX', D: 'IDP_FLEX', BN: 'BN', IR: 'IR' };

export function mapYahooSettings(body: any, warnings: string[]): LeagueSettings {
  const league = body?.fantasy_content?.league ?? [];
  const info = ymerge(league[0]);
  const st = ymerge(league[1]?.settings ?? []);
  const s = defaultSettings({ name: info.name ?? 'Yahoo league', format: st.uses_keepers || info.is_keeper === '1' ? 'keeper' : 'redraft', teams: Number(info.num_teams ?? 10) });
  const roster: Partial<Record<SlotType, number>> = {};
  for (const rp of st.roster_positions ?? []) {
    const p = rp.roster_position ?? rp;
    const slot = Y_SLOTS[p.position];
    if (slot) roster[slot] = (roster[slot] ?? 0) + Number(p.count ?? 1);
    else warnings.push(`Yahoo roster spot "${p.position}" was left out.`);
  }
  if (Object.keys(roster).length) s.roster = roster;
  s.scoring = scoringFromPreset('half_ppr');
  s.scoringPreset = 'half_ppr';
  warnings.push('Yahoo scoring uses stat numbers we still have to map one by one; Coil started you on half PPR. Check Scoring before week 1.');
  if (st.uses_faab === '1' || st.uses_faab === 1) s.waivers.type = 'faab';
  if (st.num_playoff_teams) s.playoffs.teams = Number(st.num_playoff_teams);
  if (st.playoff_start_week) {
    s.playoffs.startWeek = Number(st.playoff_start_week);
    s.regularSeasonWeeks = s.playoffs.startWeek - 1;
  }
  if (st.trade_end_date) warnings.push(`Yahoo trade deadline was ${st.trade_end_date}. Set the matching week in Waivers and trades.`);
  return s;
}

export function mapYahooTeams(body: any): ImportedTeam[] {
  const league = body?.fantasy_content?.league ?? [];
  const teams = yitems(league[1]?.teams);
  return teams.map((t: any): ImportedTeam => {
    const info = ymerge(t.team?.[0]);
    const manager = (info.managers ?? [])[0]?.manager ?? {};
    const players: ImportedPlayer[] = yitems(t.team?.[1]?.roster?.['0']?.players).map((p: any) => {
      const pi = ymerge(p.player?.[0]);
      const sel = ymerge(p.player?.[1]?.selected_position ?? []);
      return {
        sourcePlayerId: pi.player_key ?? null,
        name: pi.name?.full ?? 'Unknown player',
        position: Y_POS[pi.display_position?.split(',')[0]] ?? null,
        nflTeam: pi.editorial_team_abbr ? String(pi.editorial_team_abbr).toUpperCase() : null,
        slot: sel.position === 'IR' ? 'IR' : 'active',
      };
    });
    return {
      sourceTeamId: info.team_key ?? `T${info.team_id}`,
      name: info.name ?? `Team ${info.team_id}`,
      ownerName: manager.nickname ?? null,
      ownerSourceUserId: manager.guid ?? null,
      avatarUrl: info.team_logos?.[0]?.team_logo?.url,
      players,
      faabRemaining: info.faab_balance !== undefined ? Number(info.faab_balance) : null,
      waiverPosition: info.waiver_priority ? Number(info.waiver_priority) : undefined,
    };
  });
}

/**
 * Import with a token from Coil's server. `get` makes an authorized GET to
 * Yahoo and returns parsed JSON.
 */
export async function importYahooLeague(leagueKey: string, season: number, get: (path: string) => Promise<any>): Promise<ImportedLeague> {
  const [settingsBody, rosterBody] = await Promise.all([get(`/league/${leagueKey}/settings?format=json`), get(`/league/${leagueKey}/teams/roster?format=json`)]);
  const warnings: string[] = [];
  const settings = mapYahooSettings(settingsBody, warnings);
  const teams = mapYahooTeams(rosterBody);
  return { source: 'yahoo', sourceLeagueId: leagueKey, season, name: settings.name, settings, teams, picks: [], history: [], warnings };
}
