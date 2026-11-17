// Monthly source audit. For every source: is it still posting, and is the
// person still in the same job? Beat writers move outlets and teams; insiders
// retire. Clear cases are applied automatically and logged; anything unsure
// goes to the admin as a suggestion.

import type { NewsSource } from './pipeline';
import { NFL_TEAMS } from './sources';

/** What the fetcher saw for one source (profile bio + recent posts). */
export type SourceObservation = {
  sourceId: string;
  reachable: boolean; // account / feed still exists
  bio?: string;
  lastPostAt?: string;
  recentPosts?: string[];
};

export type AuditAction =
  | { type: 'ok'; sourceId: string }
  | { type: 'reassign'; sourceId: string; from: string; to: string; reason: string; auto: boolean }
  | { type: 'remove'; sourceId: string; reason: string; auto: boolean }
  | { type: 'review_role'; sourceId: string; reason: string }
  | { type: 'inactive'; sourceId: string; reason: string };

const ROLE_CHANGE = [
  /\b(new (job|role|chapter|gig))\b/i,
  /\b(excited|thrilled|honored|happy) to (announce|share|join)\b/i,
  /\b(i'?m|i am) (joining|moving to|heading to|leaving)\b/i,
  /\b(will now|now) (cover|be covering)\b/i,
  /\bmy last (day|story|season)\b/i,
  /\b(stepping away|signing off|retiring)\b/i,
];

const LEAVING = /\b(stepping away|signing off|retiring|leaving (journalism|the business|media))\b/i;

/** Which teams a piece of text talks about, by name, city or alias. */
export function teamsMentioned(text: string): string[] {
  const t = text.toLowerCase();
  const out: string[] = [];
  for (const [abbr, team] of Object.entries(NFL_TEAMS)) {
    const words = [team.name, ...team.aliases].map((w) => w.toLowerCase());
    if (words.some((w) => new RegExp(`\\b${w}\\b`).test(t))) out.push(abbr);
  }
  return out;
}

/** The team a covering phrase points to: "now covering the Jets", "joining ... to cover the Bears". */
export function coveringTeam(text: string): string | null {
  const m = text.match(/\bcover(?:ing)?\s+(?:the\s+)?([A-Za-z0-9 ]{3,30})/i);
  if (!m) return null;
  const teams = teamsMentioned(m[1]);
  return teams.length === 1 ? teams[0] : null;
}

const DAY = 86_400_000;

export function auditSource(source: NewsSource, obs: SourceObservation | undefined, now: string, inSeason: boolean): AuditAction {
  if (source.kind === 'wire' || source.kind === 'team_site') return { type: 'ok', sourceId: source.id };
  if (!obs || !obs.reachable) {
    return { type: 'remove', sourceId: source.id, reason: 'The account or feed no longer exists.', auto: true };
  }
  const texts = [obs.bio ?? '', ...(obs.recentPosts ?? [])];
  const announcement = texts.find((t) => ROLE_CHANGE.some((re) => re.test(t)));
  if (announcement) {
    if (LEAVING.test(announcement)) {
      return { type: 'remove', sourceId: source.id, reason: `Posted that they're stepping away: "${announcement.slice(0, 120)}"`, auto: false };
    }
    const newTeam = coveringTeam(announcement);
    if (newTeam && source.category !== 'national' && newTeam !== source.category) {
      return { type: 'reassign', sourceId: source.id, from: source.category, to: newTeam, reason: `Says they now cover the ${NFL_TEAMS[newTeam].name}: "${announcement.slice(0, 120)}"`, auto: true };
    }
    return { type: 'review_role', sourceId: source.id, reason: `Possible job change: "${announcement.slice(0, 120)}"` };
  }
  // Bio no longer names the team they're filed under.
  if (source.category !== 'national' && obs.bio) {
    const bioTeams = teamsMentioned(obs.bio);
    if (bioTeams.length === 1 && bioTeams[0] !== source.category) {
      return { type: 'reassign', sourceId: source.id, from: source.category, to: bioTeams[0], reason: `Bio now mentions the ${NFL_TEAMS[bioTeams[0]].name}.`, auto: false };
    }
  }
  const idleDays = obs.lastPostAt ? (Date.parse(now) - Date.parse(obs.lastPostAt)) / DAY : Infinity;
  const limit = inSeason ? 30 : 90;
  if (idleDays > limit) {
    return { type: 'inactive', sourceId: source.id, reason: `No posts in ${Number.isFinite(idleDays) ? Math.floor(idleDays) : 'a long time'} days.` };
  }
  return { type: 'ok', sourceId: source.id };
}

export type AuditLogEntry = { at: string; action: AuditAction; applied: boolean };

/**
 * Run the audit over every source. Auto actions are applied (reassign team,
 * or remove a source that's gone); the rest come back as suggestions for the
 * admin. Every action is logged either way.
 */
export function runMonthlyAudit(
  sources: NewsSource[],
  observations: SourceObservation[],
  now: string,
  inSeason: boolean,
): { sources: NewsSource[]; log: AuditLogEntry[]; suggestions: AuditAction[] } {
  const byId = new Map(observations.map((o) => [o.sourceId, o]));
  const log: AuditLogEntry[] = [];
  const suggestions: AuditAction[] = [];
  const next: NewsSource[] = [];

  for (const s of sources) {
    const action = auditSource(s, byId.get(s.id), now, inSeason);
    const obs = byId.get(s.id);
    const verified = { ...s, lastVerifiedAt: now, lastPostAt: obs?.lastPostAt ?? s.lastPostAt };
    if (action.type === 'ok') {
      next.push(verified);
      continue;
    }
    const auto = 'auto' in action && action.auto;
    log.push({ at: now, action, applied: auto });
    if (action.type === 'reassign' && auto) next.push({ ...verified, category: action.to });
    else if (action.type === 'remove' && auto) continue;
    else {
      next.push(verified);
      suggestions.push(action);
    }
  }
  return { sources: next, log, suggestions };
}

/** First day of next month at 09:00 UTC: when the next audit runs. */
export function nextAuditAt(now: string): string {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 9)).toISOString();
}
