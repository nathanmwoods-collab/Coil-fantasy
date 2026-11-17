// Universal import: paste rosters from any site (ESPN, Yahoo, a spreadsheet,
// a group text) and Coil sorts it out. This is the fallback that makes every
// league movable, even from platforms without an API.
//
// Format, one block per team, blank line between teams:
//
//   Tacos Al Pastor (Nathan)
//   Josh Allen
//   Bijan Robinson
//   Puka Nacua (IR)
//   Some Rookie (Taxi)
//   Travis Kelce - keeper rd 3
//   2027 1st
//   2028 2nd (via Bob's Team)
//   FAAB: 87

import { createFuturePicks, pickId, type DraftPick } from '../engine/picks';
import type { Player, Position } from '../engine/types';
import type { ImportedPlayer, ImportedTeam } from './types';

export type ParsedTeamBlock = {
  name: string;
  ownerName: string | null;
  players: { raw: string; name: string; slot: ImportedPlayer['slot']; keeperRound?: number }[];
  picks: { season: number; round: number; viaTeamName: string | null }[];
  faab: number | null;
};

const ROUND_WORDS: Record<string, number> = { '1st': 1, '2nd': 2, '3rd': 3, first: 1, second: 2, third: 3 };

function roundOf(word: string): number | null {
  const w = word.toLowerCase();
  if (ROUND_WORDS[w]) return ROUND_WORDS[w];
  const m = w.match(/^(\d+)(st|nd|rd|th)?$/);
  return m ? Number(m[1]) : null;
}

export function parseRosterText(text: string): ParsedTeamBlock[] {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length);

  return blocks.map((lines) => {
    const header = lines[0];
    const hm = header.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const block: ParsedTeamBlock = {
      name: (hm ? hm[1] : header).replace(/[:\-]+$/, '').trim(),
      ownerName: hm ? hm[2].trim() : null,
      players: [],
      picks: [],
      faab: null,
    };
    for (const raw of lines.slice(1)) {
      const faab = raw.match(/^faab\s*[:=]?\s*\$?(\d+)/i);
      if (faab) {
        block.faab = Number(faab[1]);
        continue;
      }
      const pick = raw.match(/^(20\d\d)\s+(?:round\s+)?(\w+)(?:\s+round)?(?:\s+pick)?\s*(?:\((?:via|from)\s+([^)]+)\))?$/i);
      if (pick && roundOf(pick[2])) {
        block.picks.push({ season: Number(pick[1]), round: roundOf(pick[2])!, viaTeamName: pick[3]?.trim() ?? null });
        continue;
      }
      let name = raw.replace(/^[\d.)\-\s]+(?=[A-Za-z])/, ''); // strip list numbering
      let slot: ImportedPlayer['slot'] = 'active';
      if (/\((IR|injured reserve)\)/i.test(name)) slot = 'IR';
      if (/\(taxi\)/i.test(name)) slot = 'TAXI';
      const keeper = name.match(/keeper\s*(?:rd|round)?\s*(\d+)/i);
      name = name
        .replace(/\((IR|injured reserve|taxi)\)/gi, '')
        .replace(/[-,]?\s*keeper.*$/i, '')
        .replace(/,?\s*\b(QB|RB|WR|TE|K|DST|D\/ST|DEF)\b.*$/i, '') // "Josh Allen, QB BUF"
        .trim();
      if (name) block.players.push({ raw, name, slot, keeperRound: keeper ? Number(keeper[1]) : undefined });
    }
    return block;
  });
}

// ---------------------------------------------------------------------------
// Player matching
// ---------------------------------------------------------------------------

const NICKNAMES: Record<string, string> = { gabe: 'gabriel', mike: 'michael', matt: 'matthew', chris: 'christopher', josh: 'joshua', nick: 'nicholas', dj: 'd j', aj: 'a j', cj: 'c j', tj: 't j', jk: 'j k' };

export function normalizePlayerName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function variants(name: string): string[] {
  const n = normalizePlayerName(name);
  const parts = n.split(' ');
  const out = new Set([n, n.replace(/ /g, '')]);
  if (NICKNAMES[parts[0]]) out.add([NICKNAMES[parts[0]], ...parts.slice(1)].join(' '));
  return [...out];
}

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export type PlayerMatch = { player: Player | null; confidence: 'exact' | 'close' | 'ambiguous' | 'none'; alternatives: Player[] };

/** Build once per import; matches pasted names (typos, nicknames, Jr.) to real players. */
export function createPlayerMatcher(players: Player[]) {
  const index = new Map<string, Player[]>();
  for (const p of players) {
    for (const v of variants(p.name)) index.set(v, [...(index.get(v) ?? []), p]);
    if (p.position === 'DST') {
      for (const v of [`${p.nflTeam} dst`, `${p.nflTeam} def`, `${p.nflTeam} d st`, `${p.nflTeam} defense`]) {
        index.set(normalizePlayerName(v), [p]);
      }
    }
  }
  return (name: string, hint?: { position?: Position; nflTeam?: string }): PlayerMatch => {
    for (const v of variants(name)) {
      let hits = index.get(v) ?? [];
      if (hits.length > 1 && hint) {
        const narrowed = hits.filter((p) => (!hint.position || p.position === hint.position) && (!hint.nflTeam || p.nflTeam === hint.nflTeam));
        if (narrowed.length) hits = narrowed;
      }
      if (hits.length === 1) return { player: hits[0], confidence: 'exact', alternatives: [] };
      if (hits.length > 1) return { player: null, confidence: 'ambiguous', alternatives: hits };
    }
    // Fuzzy: small typos only.
    const target = normalizePlayerName(name);
    const scored = players
      .map((p) => ({ p, d: editDistance(target, normalizePlayerName(p.name)) }))
      .filter((x) => x.d <= Math.max(1, Math.floor(target.length / 8)))
      .sort((a, b) => a.d - b.d);
    if (scored.length === 1 || (scored.length > 1 && scored[0].d < scored[1].d)) {
      return { player: scored[0].p, confidence: 'close', alternatives: scored.slice(1, 4).map((x) => x.p) };
    }
    if (scored.length) return { player: null, confidence: 'ambiguous', alternatives: scored.slice(0, 4).map((x) => x.p) };
    return { player: null, confidence: 'none', alternatives: [] };
  };
}

export type TextImportResult = {
  teams: ImportedTeam[];
  picks: DraftPick[];
  /** Names that need a human: ambiguous or not found. */
  needsReview: { teamName: string; raw: string; alternatives: Player[] }[];
  warnings: string[];
};

/** Turn pasted text into teams and picks, matched against the player list. */
export function importFromText(
  text: string,
  players: Player[],
  opts: { firstPickSeason: number; pickSeasons: number; rounds: number },
): TextImportResult {
  const blocks = parseRosterText(text);
  const match = createPlayerMatcher(players);
  const needsReview: TextImportResult['needsReview'] = [];
  const warnings: string[] = [];

  const teams: ImportedTeam[] = blocks.map((b, i) => ({
    sourceTeamId: `text:${i + 1}`,
    name: b.name,
    ownerName: b.ownerName,
    ownerSourceUserId: null,
    faabRemaining: b.faab,
    players: b.players.map((line) => {
      const m = match(line.name);
      if (m.confidence === 'ambiguous' || m.confidence === 'none') needsReview.push({ teamName: b.name, raw: line.raw, alternatives: m.alternatives });
      return {
        sourcePlayerId: m.player?.id ?? null,
        name: m.player?.name ?? line.name,
        position: m.player?.position ?? null,
        nflTeam: m.player?.nflTeam ?? null,
        slot: line.slot,
        keeperRound: line.keeperRound,
      };
    }),
  }));

  // Picks: everyone starts with their own; listed picks show who owns what now.
  const ids = teams.map((t) => t.sourceTeamId);
  let picks = opts.pickSeasons ? createFuturePicks(ids, opts.firstPickSeason, opts.pickSeasons, opts.rounds) : [];
  const byName = new Map(teams.map((t) => [t.name.toLowerCase(), t.sourceTeamId]));
  blocks.forEach((b, i) => {
    const owner = ids[i];
    for (const pk of b.picks) {
      if (!pk.viaTeamName) continue; // own pick, already there
      const original = byName.get(pk.viaTeamName.toLowerCase());
      if (!original) {
        warnings.push(`${b.name} lists a ${pk.season} round ${pk.round} pick via "${pk.viaTeamName}", but no team has that name.`);
        continue;
      }
      const id = pickId(pk.season, pk.round, original);
      if (!picks.some((p) => p.id === id)) {
        warnings.push(`${b.name}'s ${pk.season} round ${pk.round} pick is outside the pick window.`);
        continue;
      }
      picks = picks.map((p) => (p.id === id ? { ...p, ownerTeamId: owner } : p));
    }
  });

  // Owned twice? Same player on two rosters is a paste mistake worth flagging.
  const seen = new Map<string, string>();
  for (const t of teams)
    for (const p of t.players) {
      if (!p.sourcePlayerId) continue;
      const other = seen.get(p.sourcePlayerId);
      if (other) warnings.push(`${p.name} is on both ${other} and ${t.name}.`);
      else seen.set(p.sourcePlayerId, t.name);
    }

  return { teams, picks, needsReview, warnings };
}
