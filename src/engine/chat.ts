// League chat model. Pure data and helpers; the transport (websocket, push)
// lives outside the engine. Chat is the heart of the league, so league events
// (trades, waivers, big wins) post into it as friendly cards.

import type { TeamId } from './types';

export type ChatAuthor = { kind: 'member'; userId: string; teamId: TeamId | null } | { kind: 'coil' };

export type ChatMessage = {
  id: string;
  leagueId: string;
  author: ChatAuthor;
  sentAt: string; // ISO
  /** Plain text with @mentions as "@[Name](userId)". */
  text: string;
  /** Reply thread parent. */
  replyTo?: string;
  gifUrl?: string;
  poll?: Poll;
  event?: LeagueEvent;
  reactions: Record<string, string[]>; // emoji -> userIds
  editedAt?: string;
  deletedAt?: string;
};

export type Poll = {
  question: string;
  options: { id: string; label: string; votes: string[] }[];
  closesAt?: string;
  /** Rule-change polls can apply a setting when they pass (commissioner confirms). */
  ruleChange?: { field: string; value: unknown; passShare: number };
};

export type LeagueEvent =
  | { type: 'trade'; teams: string[]; summary: string }
  | { type: 'waiver'; team: string; added: string; dropped?: string; bid?: number }
  | { type: 'big_win'; winner: string; loser: string; margin: number }
  | { type: 'close_win'; winner: string; loser: string; margin: number }
  | { type: 'high_score'; team: string; points: number; week: number }
  | { type: 'commissioner_edit'; summary: string }
  | { type: 'draft_starting'; minutes: number }
  | { type: 'free_agent'; team: string; added?: string; dropped?: string }
  | {
      type: 'waiver_run';
      /** Every claim from the run, winners and the bids that came up short. */
      results: { player: string; winner: string; bid: number; dropped?: string; losers: { team: string; bid: number }[] }[];
    };

const MENTION = /@\[([^\]]+)\]\(([^)]+)\)/g;

export function mentionedUserIds(text: string): string[] {
  return [...text.matchAll(MENTION)].map((m) => m[2]);
}

/** Text with mentions rendered as "@Name" for previews and push notifications. */
export function plainText(text: string): string {
  return text.replace(MENTION, (_m, name) => `@${name}`);
}

export function toggleReaction(msg: ChatMessage, emoji: string, userId: string): ChatMessage {
  const current = msg.reactions[emoji] ?? [];
  const next = current.includes(userId) ? current.filter((u) => u !== userId) : [...current, userId];
  const reactions = { ...msg.reactions, [emoji]: next };
  if (!next.length) delete reactions[emoji];
  return { ...msg, reactions };
}

export function vote(poll: Poll, optionId: string, userId: string, now: string = new Date().toISOString()): Poll {
  if (poll.closesAt && now > poll.closesAt) return poll;
  return {
    ...poll,
    options: poll.options.map((o) => ({
      ...o,
      votes: o.id === optionId ? [...o.votes.filter((v) => v !== userId), userId] : o.votes.filter((v) => v !== userId),
    })),
  };
}

/** Did a rule-change poll pass? Share is of the whole league, not just voters. */
export function pollPassed(poll: Poll, leagueMembers: number, yesOptionId: string): boolean {
  if (!poll.ruleChange) return false;
  const yes = poll.options.find((o) => o.id === yesOptionId)?.votes.length ?? 0;
  return yes >= Math.ceil(leagueMembers * poll.ruleChange.passShare);
}

/**
 * Warm, human copy for event cards. Several lines per event so the league
 * doesn't read the same sentence every week; `seed` picks one.
 */
export function eventCopy(event: LeagueEvent, seed = 0): string {
  const pick = (lines: string[]) => lines[Math.abs(seed) % lines.length];
  switch (event.type) {
    case 'trade':
      return pick([
        `Trade alert: ${event.summary}. Let the debate begin.`,
        `${event.teams.join(' and ')} just made a deal. ${event.summary}.`,
        `Done deal: ${event.summary}. Who won it? Chat, you decide.`,
      ]);
    case 'waiver':
      return event.bid !== undefined
        ? pick([
            `${event.team} spent $${event.bid} on ${event.added}${event.dropped ? ` and waved goodbye to ${event.dropped}` : ''}.`,
            `$${event.bid} for ${event.added}. ${event.team} is feeling confident.`,
          ])
        : `${event.team} picked up ${event.added}${event.dropped ? `, dropping ${event.dropped}` : ''}.`;
    case 'big_win':
      return pick([
        `${event.winner} beat ${event.loser} by ${event.margin.toFixed(1)}. That one is going in the history books.`,
        `${event.winner} rolled ${event.loser} by ${event.margin.toFixed(1)}. Somebody check on ${event.loser}.`,
      ]);
    case 'close_win':
      return pick([
        `${event.winner} edged ${event.loser} by ${event.margin.toFixed(2)}. Heart rates are returning to normal.`,
        `${event.margin.toFixed(2)} points. That's all that separated ${event.winner} and ${event.loser}.`,
      ]);
    case 'high_score':
      return `${event.team} put up ${event.points.toFixed(1)} in week ${event.week}, the best score in the league this week.`;
    case 'commissioner_edit':
      return `Commissioner update: ${event.summary}. It's in the league log for anyone curious.`;
    case 'draft_starting':
      return event.minutes <= 0 ? 'The draft is live. Good luck, everyone.' : `Draft starts in ${event.minutes} minutes. Get your queues ready.`;
    case 'free_agent':
      return event.added && event.dropped
        ? `${event.team} added ${event.added} and dropped ${event.dropped}.`
        : event.added
          ? `${event.team} added ${event.added}.`
          : `${event.team} dropped ${event.dropped}.`;
    case 'waiver_run': {
      const lines = event.results.map((r) => {
        const lost = r.losers.length ? ` (also bid: ${r.losers.map((l) => `${l.team} $${l.bid}`).join(', ')})` : '';
        return `${r.winner} won ${r.player} for $${r.bid}${lost}`;
      });
      return `Waivers ran. ${lines.join('. ')}.`;
    }
  }
}
