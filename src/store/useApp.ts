import { create } from 'zustand';

import {
  applyTrade,
  eventCopy,
  irEligible,
  pickLabel,
  taxiEligible,
  toggleReaction,
  validateTrade,
  type ChatMessage,
  type LeagueSettings,
  type Trade,
} from '../engine';
import { ME, CURRENT_SEASON, CURRENT_WEEK, buildDemoLeague, demoNewsQueue, demoSources, type DemoLeague } from '../demo/league';
import { runMonthlyAudit, type AuditLogEntry, type SourceObservation, nextAuditAt } from '../news/audit';
import { setSourceTrust, type MatchedStory, type NewsSource, type SourceTrust } from '../news/pipeline';
import type { ImportedLeague } from '../import/types';
import type { Migration } from '../import/migrate';

type QueueItem = MatchedStory & { reach: number };

type AppState = {
  league: DemoLeague;
  sources: NewsSource[];
  queue: QueueItem[];
  sent: (QueueItem & { decision: 'pushed' | 'denied'; at: string })[];
  auditLog: AuditLogEntry[];
  auditSuggestions: string[];
  nextAudit: string;
  createdLeagues: LeagueSettings[];
  lastImport: { league: ImportedLeague; migration: Migration } | null;
  toast: string | null;

  showToast: (msg: string) => void;
  sendChat: (text: string) => void;
  react: (id: string, emoji: string) => void;
  moveToIR: (playerId: string) => string | null;
  activateFromIR: (playerId: string) => void;
  moveToTaxi: (playerId: string) => string | null;
  promoteFromTaxi: (playerId: string) => void;
  tradePicks: (give: string[], partner: string, get: string[]) => string[];
  decideNews: (rawId: string, decision: 'pushed' | 'denied') => void;
  setTrust: (sourceId: string, trust: SourceTrust) => void;
  addSource: (s: NewsSource) => void;
  runAudit: () => void;
  saveLeague: (s: LeagueSettings) => void;
  setImport: (league: ImportedLeague, migration: Migration) => void;
};

const league = buildDemoLeague();

export const useApp = create<AppState>((set, get) => ({
  league,
  sources: demoSources(),
  queue: demoNewsQueue(league.players),
  sent: [],
  auditLog: [],
  auditSuggestions: [],
  nextAudit: nextAuditAt(new Date().toISOString()),
  createdLeagues: [],
  lastImport: null,
  toast: null,

  showToast: (msg) => {
    set({ toast: msg });
    setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 2600);
  },

  sendChat: (text) => {
    if (!text.trim()) return;
    const msg: ChatMessage = {
      id: `m${Date.now()}`,
      leagueId: 'L1',
      author: { kind: 'member', userId: 'u1', teamId: ME },
      sentAt: new Date().toISOString(),
      text: text.trim(),
      reactions: {},
    };
    set((s) => ({ league: { ...s.league, chat: [...s.league.chat, msg] } }));
  },

  react: (id, emoji) =>
    set((s) => ({ league: { ...s.league, chat: s.league.chat.map((m) => (m.id === id ? toggleReaction(m, emoji, 'u1') : m)) } })),

  moveToIR: (playerId) => {
    const { league: L } = get();
    const me = L.teams.find((t) => t.id === ME)!;
    const p = L.players[playerId];
    if (!irEligible(L.settings, p)) return `${p.name} isn't eligible for IR in this league.`;
    if (me.ir.length >= (L.settings.roster.IR ?? 0)) return 'Your IR spots are full.';
    set((s) => ({ league: { ...s.league, teams: s.league.teams.map((t) => (t.id === ME ? { ...t, ir: [...t.ir, playerId], taxi: t.taxi.filter((x) => x !== playerId) } : t)) } }));
    return null;
  },
  activateFromIR: (playerId) =>
    set((s) => ({ league: { ...s.league, teams: s.league.teams.map((t) => (t.id === ME ? { ...t, ir: t.ir.filter((x) => x !== playerId) } : t)) } })),
  moveToTaxi: (playerId) => {
    const { league: L } = get();
    const me = L.teams.find((t) => t.id === ME)!;
    const p = L.players[playerId];
    if (!taxiEligible(L.settings, p)) return `${p.name} has too many years in the league for the taxi squad.`;
    if (me.taxi.length >= (L.settings.roster.TAXI ?? 0)) return 'Your taxi squad is full.';
    set((s) => ({ league: { ...s.league, teams: s.league.teams.map((t) => (t.id === ME ? { ...t, taxi: [...t.taxi, playerId] } : t)) } }));
    return null;
  },
  promoteFromTaxi: (playerId) =>
    set((s) => ({ league: { ...s.league, teams: s.league.teams.map((t) => (t.id === ME ? { ...t, taxi: t.taxi.filter((x) => x !== playerId) } : t)) } })),

  tradePicks: (give, partner, getIds) => {
    const { league: L } = get();
    const trade: Trade = {
      id: `tr${Date.now()}`,
      week: CURRENT_WEEK,
      proposedBy: ME,
      sides: [
        { teamId: ME, players: [], picks: give.map((pickId) => ({ pickId, to: partner })), faab: [], drops: [] },
        { teamId: partner, players: [], picks: getIds.map((pickId) => ({ pickId, to: ME })), faab: [], drops: [] },
      ],
    };
    const teams = Object.fromEntries(L.teams.map((t) => [t.id, { teamId: t.id, roster: t.players, rosterLimit: 99, faab: t.faab }]));
    const issues = validateTrade(L.settings, trade, teams, L.picks, CURRENT_SEASON);
    if (!give.length && !getIds.length) return ['Pick at least one pick to trade.'];
    if (issues.length) return issues.map((i) => i.message);
    const { picks } = applyTrade(trade, teams, L.picks);
    const name = (id: string) => L.teams.find((t) => t.id === id)!.name;
    const label = (ids: string[], from: typeof L.picks) => ids.map((id) => pickLabel(from.find((p) => p.id === id)!, name)).join(', ') || 'nothing';
    const summary = `${name(ME)} gets ${label(getIds, L.picks)}; ${name(partner)} gets ${label(give, L.picks)}`;
    const event: ChatMessage = {
      id: `e${Date.now()}`,
      leagueId: 'L1',
      author: { kind: 'coil' },
      sentAt: new Date().toISOString(),
      text: '',
      event: { type: 'trade', teams: [name(ME), name(partner)], summary },
      reactions: {},
    };
    set((s) => ({ league: { ...s.league, picks, chat: [...s.league.chat, event] } }));
    return [];
  },

  decideNews: (rawId, decision) =>
    set((s) => {
      const item = s.queue.find((q) => q.rawId === rawId);
      if (!item) return s;
      return { queue: s.queue.filter((q) => q.rawId !== rawId), sent: [{ ...item, decision, at: new Date().toISOString() }, ...s.sent] };
    }),

  setTrust: (sourceId, trust) =>
    set((s) => ({ sources: s.sources.map((x) => (x.id === sourceId ? setSourceTrust(x, trust, 'you') : x)) })),

  addSource: (src) => set((s) => ({ sources: [...s.sources, src] })),

  runAudit: () => {
    const now = new Date().toISOString();
    const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
    // Demo observations: everyone active, plus two cases so the screen shows what an audit catches.
    const obs: SourceObservation[] = get().sources.map((s) => ({ sourceId: s.id, reachable: true, lastPostAt: recent }));
    const pft = obs.find((o) => o.sourceId === 'x:profootballtalk');
    if (pft) pft.recentPosts = ['Excited to announce a new chapter: launching my own show next month.'];
    const beat = get().sources.find((s) => s.tier === 'beat');
    if (beat) {
      const o = obs.find((x) => x.sourceId === beat.id)!;
      o.recentPosts = ["Personal news: I'm joining The Athletic and will now be covering the Jets."];
    }
    const res = runMonthlyAudit(get().sources, obs, now, true);
    set({
      sources: res.sources,
      auditLog: [...res.log, ...get().auditLog],
      auditSuggestions: res.suggestions.map((a) => ('reason' in a ? a.reason : '')),
      nextAudit: nextAuditAt(now),
    });
    get().showToast(res.log.length ? `Checked ${get().sources.length} sources. ${res.log.length} need a look.` : `All ${get().sources.length} sources look current.`);
  },

  saveLeague: (s) => set((st) => ({ createdLeagues: [...st.createdLeagues, s] })),
  setImport: (l, migration) => set({ lastImport: { league: l, migration } }),
}));

export { eventCopy };
