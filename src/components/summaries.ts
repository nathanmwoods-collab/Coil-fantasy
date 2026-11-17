import { injuryTag, playoffEndWeek, SLOT_LABELS, type LeagueSettings, type ScoringRules, type SlotType } from '../engine';

export function scoringSummary(r: ScoringRules): string {
  const rec = r.points.rec ?? 0;
  const ppr = rec === 0 ? 'No PPR' : rec === 1 ? 'PPR' : rec === 0.5 ? 'Half PPR' : `${rec} per catch`;
  const parts = [ppr, `${r.points.passTd ?? 0}-pt passing TDs`];
  const te = r.positionOverrides.TE?.rec;
  if (te !== undefined && te !== rec) parts.push(`TE ${te} per catch`);
  const extras = r.milestones.length + r.bonuses.length + r.bigPlays.length + r.catchLengthBonuses.length;
  if (extras) parts.push(`${extras} bonus${extras === 1 ? '' : 'es'}`);
  if (r.points.rush1stDown || r.points.rec1stDown) parts.push('first downs count');
  return parts.join(', ');
}

export function rosterSummary(s: LeagueSettings): string {
  const order: SlotType[] = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'WR_RB', 'WR_TE', 'SUPERFLEX', 'K', 'DST', 'DL', 'LB', 'DB', 'IDP_FLEX'];
  const starters = order.filter((k) => s.roster[k]).map((k) => `${(s.roster[k] ?? 0) > 1 ? `${s.roster[k]} ` : ''}${SLOT_LABELS[k]}`);
  const extra = [s.roster.BN ? `${s.roster.BN} bench` : '', s.roster.IR ? `${s.roster.IR} IR` : '', s.roster.TAXI ? `${s.roster.TAXI} taxi` : ''].filter(Boolean);
  return [...starters, ...extra].join(', ');
}

export function draftSummary(s: LeagueSettings): string {
  const t = { snake: 'Snake', linear: 'Linear', third_round_reversal: '3rd-round reversal', auction: 'Auction' }[s.draft.type];
  const timer = s.draft.pickTimerSec === null ? 'no timer' : s.draft.pickTimerSec >= 3600 ? `${s.draft.pickTimerSec / 3600}h timer` : `${s.draft.pickTimerSec}s timer`;
  return `${t}, ${s.draft.rounds} rounds, ${timer}`;
}

export function waiverSummary(s: LeagueSettings): string {
  const day = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' }[s.waivers.runDay];
  const t = s.waivers.type === 'faab' ? `FAAB, $${s.waivers.faabBudget} budget` : s.waivers.type === 'rolling' ? 'Rolling priority' : 'Reverse standings';
  return `${t}, runs ${day}`;
}

export function tradeSummary(s: LeagueSettings): string {
  const review = { none: 'No review', commissioner: 'Commish approves', league_vote: 'League vote' }[s.trades.review];
  return `${review}, deadline ${s.trades.deadlineWeek ? `week ${s.trades.deadlineWeek}` : 'none'}${s.format === 'dynasty' ? `, picks ${s.trades.futurePickSeasons} seasons out` : ''}`;
}

export function playoffSummary(s: LeagueSettings): string {
  return `${s.playoffs.teams} teams, weeks ${s.playoffs.startWeek}–${playoffEndWeek(s)}${s.playoffs.weeksPerRound === 2 ? ', 2-week rounds' : ''}${s.playoffs.reseed ? ', reseeded' : ''}`;
}

export function irSummary(s: LeagueSettings): string {
  return s.roster.IR ? `${s.roster.IR} spots for ${s.irEligible.map((x) => injuryTag(x).code).join(', ')}` : 'No IR';
}
