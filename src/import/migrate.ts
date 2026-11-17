// One-link migration. The commissioner imports the league once; Coil makes a
// claim link for every team. Managers tap their link (or pick their team from
// the league invite) and they're in, with their roster, picks and history.

import type { ImportedLeague } from './types';

export type TeamClaim = {
  sourceTeamId: string;
  teamName: string;
  ownerName: string | null;
  code: string;
  claimedByUserId: string | null;
  claimedAt: string | null;
};

export type Migration = {
  leagueId: string;
  inviteCode: string;
  claims: TeamClaim[];
  commissionerUserId: string;
};

/** Path for claim links; the app prefixes its real domain once one is chosen. */
export const DEFAULT_JOIN_BASE = '/join';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I

export function makeCode(rnd: () => number, length = 6): string {
  let s = '';
  for (let i = 0; i < length; i++) s += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
  return s;
}

export function startMigration(
  league: ImportedLeague,
  leagueId: string,
  commissionerUserId: string,
  commissionerSourceTeamId: string | null,
  rnd: () => number = Math.random,
): Migration {
  const used = new Set<string>();
  const fresh = () => {
    let c = makeCode(rnd);
    while (used.has(c)) c = makeCode(rnd);
    used.add(c);
    return c;
  };
  return {
    leagueId,
    inviteCode: fresh(),
    commissionerUserId,
    claims: league.teams.map((t) => ({
      sourceTeamId: t.sourceTeamId,
      teamName: t.name,
      ownerName: t.ownerName,
      code: fresh(),
      claimedByUserId: t.sourceTeamId === commissionerSourceTeamId ? commissionerUserId : null,
      claimedAt: t.sourceTeamId === commissionerSourceTeamId ? new Date(0).toISOString() : null,
    })),
  };
}

export function claimLink(m: Migration, claim: TeamClaim, base = DEFAULT_JOIN_BASE): string {
  return `${base}/${m.inviteCode}/${claim.code}`;
}

/** A ready-to-paste message for the old league's group chat. */
export function migrationMessage(m: Migration, leagueName: string, base = DEFAULT_JOIN_BASE): string {
  const lines = m.claims
    .filter((c) => !c.claimedByUserId)
    .map((c) => `${c.teamName}${c.ownerName ? ` (${c.ownerName})` : ''}: ${claimLink(m, c, base)}`);
  return [
    `${leagueName} is moving to Coil. Everything came with us: rosters, picks, FAAB and every past champion.`,
    'Tap your team to claim it. Takes about 20 seconds:',
    ...lines,
  ].join('\n');
}

export type ClaimError = 'bad_code' | 'already_claimed' | 'user_has_team';

export function claimTeam(
  m: Migration,
  code: string,
  userId: string,
  at = new Date().toISOString(),
): { migration: Migration; error?: undefined } | { migration: Migration; error: ClaimError } {
  const claim = m.claims.find((c) => c.code === code.toUpperCase());
  if (!claim) return { migration: m, error: 'bad_code' };
  if (claim.claimedByUserId && claim.claimedByUserId !== userId) return { migration: m, error: 'already_claimed' };
  if (m.claims.some((c) => c.claimedByUserId === userId && c.code !== claim.code)) return { migration: m, error: 'user_has_team' };
  return {
    migration: { ...m, claims: m.claims.map((c) => (c === claim ? { ...c, claimedByUserId: userId, claimedAt: at } : c)) },
  };
}

/** Progress for the commissioner's "who's in" card. */
export function migrationProgress(m: Migration): { claimed: number; total: number; waitingOn: string[] } {
  const waiting = m.claims.filter((c) => !c.claimedByUserId);
  return { claimed: m.claims.length - waiting.length, total: m.claims.length, waitingOn: waiting.map((c) => c.ownerName ?? c.teamName) };
}
