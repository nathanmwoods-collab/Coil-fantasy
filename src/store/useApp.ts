import { create } from 'zustand';

import {
  applyTrade,
  describeScoringChanges,
  describeSettingsChanges,
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
import { ME, CURRENT_SEASON, CURRENT_WEEK, DEMO_LEAGUE_SPECS, buildDemoLeague, demoNewsQueue, demoSources, withRecomputedScores, type DemoLeague, type DemoTeam } from '../demo/league';
import { runMonthlyAudit, type AuditLogEntry, type SourceObservation, nextAuditAt } from '../news/audit';
import { setSourceTrust, type MatchedStory, type NewsSource, type SourceTrust } from '../news/pipeline';
import type { ImportedLeague } from '../import/types';
import type { Migration } from '../import/migrate';

type QueueItem = MatchedStory & { reach: number };

export type TradeOffer = { partner: string; givePlayers: string[]; getPlayers: string[]; givePicks: string[]; getPicks: string[]; giveFaab: number; getFaab: number };

type AppState = {
  leagues: DemoLeague[];
  /** The league every tab is showing. */
  league: DemoLeague;
  /** Coil staff only: shows the news desk. Regular managers never see it. */
  isAppAdmin: boolean;
  sources: NewsSource[];
  queue: QueueItem[];
  sent: (QueueItem & { decision: 'pushed' | 'denied'; at: string })[];
  auditLog: AuditLogEntry[];
  auditSuggestions: string[];
  nextAudit: string;
  createdLeagues: LeagueSettings[];
  lastImport: { league: ImportedLeague; migration: Migration } | null;
  toast: string | null;
  /** League switcher sheet, opened from any league header or a long press on the League tab. */
  switcherOpen: boolean;
  setSwitcherOpen: (open: boolean) => void;

  showToast: (msg: string) => void;
  switchLeague: (id: string) => void;
  setAppAdmin: (on: boolean) => void;
  sendChat: (text: string) => void;
  react: (id: string, emoji: string) => void;
  moveToIR: (playerId: string) => string | null;
  activateFromIR: (playerId: string) => void;
  moveToTaxi: (playerId: string) => string | null;
  promoteFromTaxi: (playerId: string) => void;
  proposeTrade: (t: TradeOffer) => string[];
  decideNews: (rawId: string, decision: 'pushed' | 'denied') => void;
  setTrust: (sourceId: string, trust: SourceTrust) => void;
  addSource: (s: NewsSource) => void;
  runAudit: () => void;
  saveLeague: (s: LeagueSettings) => void;
  setImport: (league: ImportedLeague, migration: Migration) => void;

  // My team and league identity
  updateMyTeam: (patch: Partial<Pick<DemoTeam, 'name' | 'emoji' | 'imageUri'>>) => void;
  setLeagueImage: (uri: string | undefined) => void;
  /** Owner (or a commissioner) sets a team's icon or photo. */
  setTeamLook: (teamId: string, look: { emoji?: string; imageUri?: string }) => void;
  setLeagueLook: (look: { emoji?: string; imageUri?: string }) => void;

  // Commissioner tools. Every change posts a notice in league chat.
  updateSettings: (next: LeagueSettings) => string[];
  editScore: (week: number, teamId: string, score: number) => void;
  setFaab: (teamId: string, faab: number) => void;
  setWaiverPriority: (teamId: string, priority: number) => void;
  toggleLock: (teamId: string) => void;
  toggleCommissioner: (teamId: string) => void;
  forceMove: (playerId: string, toTeamId: string | null) => void;
  swapOpponents: (week: number, a: string, b: string) => void;
  setDues: (dues: DemoLeague['dues']) => void;
  toggleDuesPaid: (teamId: string) => void;
  setCommishNote: (note: string) => void;
  addHistory: (season: number, champion: string) => void;
  setNotify: (key: string, on: boolean) => void;
  renameTeam: (teamId: string, name: string) => void;
  clearRosters: () => void;
  postNotice: (summary: string) => void;
  movePick: (pickId: string, toTeamId: string) => void;
  removeLeague: () => void;
};

const leagues = DEMO_LEAGUE_SPECS.map((spec) => buildDemoLeague(spec));

export const isCommish = (L: DemoLeague) => L.commissioners.includes(ME);

export const useApp = create<AppState>((set, get) => {
  /** Change the active league and keep the league list in sync. */
  const update = (fn: (L: DemoLeague) => DemoLeague) =>
    set((s) => {
      const next = fn(s.league);
      return { league: next, leagues: s.leagues.map((l) => (l.id === next.id ? next : l)) };
    });
  const notice = (L: DemoLeague, summary: string): DemoLeague => ({
    ...L,
    chat: [...L.chat, { id: `e${Date.now()}${Math.floor(Math.random() * 1000)}`, leagueId: L.id, author: { kind: 'coil' }, sentAt: new Date().toISOString(), text: '', event: { type: 'commissioner_edit', summary }, reactions: {} }],
  });
  const teamName = (L: DemoLeague, id: string) => L.teams.find((t) => t.id === id)?.name ?? id;
  const mapTeam = (L: DemoLeague, id: string, fn: (t: DemoTeam) => DemoTeam): DemoLeague => ({ ...L, teams: L.teams.map((t) => (t.id === id ? fn(t) : t)) });

  return {
    leagues,
    league: leagues[0],
    isAppAdmin: true,
    sources: demoSources(),
    queue: demoNewsQueue(leagues[0].players),
    sent: [],
    auditLog: [],
    auditSuggestions: [],
    nextAudit: nextAuditAt(new Date().toISOString()),
    createdLeagues: [],
    lastImport: null,
    toast: null,
    switcherOpen: false,
    setSwitcherOpen: (open) => set({ switcherOpen: open }),

    showToast: (msg) => {
      set({ toast: msg });
      setTimeout(() => {
        if (get().toast === msg) set({ toast: null });
      }, 2600);
    },

    switchLeague: (id) => set((s) => ({ league: s.leagues.find((l) => l.id === id) ?? s.league })),
    setAppAdmin: (on) => set({ isAppAdmin: on }),

    sendChat: (text) => {
      if (!text.trim()) return;
      update((L) => ({
        ...L,
        chat: [...L.chat, { id: `m${Date.now()}`, leagueId: L.id, author: { kind: 'member', userId: 'u1', teamId: ME }, sentAt: new Date().toISOString(), text: text.trim(), reactions: {} }],
      }));
    },

    react: (id, emoji) => update((L) => ({ ...L, chat: L.chat.map((m) => (m.id === id ? toggleReaction(m, emoji, 'u1') : m)) })),

    moveToIR: (playerId) => {
      const L = get().league;
      const me = L.teams.find((t) => t.id === ME)!;
      const p = L.players[playerId];
      if (me.locked) return 'Your commissioner has locked your roster.';
      if (!irEligible(L.settings, p)) return `${p.name} isn't eligible for IR in this league.`;
      if (me.ir.length >= (L.settings.roster.IR ?? 0)) return 'Your IR spots are full.';
      update((L2) => mapTeam(L2, ME, (t) => ({ ...t, ir: [...t.ir, playerId], taxi: t.taxi.filter((x) => x !== playerId) })));
      return null;
    },
    activateFromIR: (playerId) => update((L) => mapTeam(L, ME, (t) => ({ ...t, ir: t.ir.filter((x) => x !== playerId) }))),
    moveToTaxi: (playerId) => {
      const L = get().league;
      const me = L.teams.find((t) => t.id === ME)!;
      const p = L.players[playerId];
      if (!taxiEligible(L.settings, p)) return `${p.name} has too many years in the league for the taxi squad.`;
      if (me.taxi.length >= (L.settings.roster.TAXI ?? 0)) return 'Your taxi squad is full.';
      update((L2) => mapTeam(L2, ME, (t) => ({ ...t, taxi: [...t.taxi, playerId] })));
      return null;
    },
    promoteFromTaxi: (playerId) => update((L) => mapTeam(L, ME, (t) => ({ ...t, taxi: t.taxi.filter((x) => x !== playerId) }))),

    proposeTrade: (o) => {
      const L = get().league;
      const { partner } = o;
      const trade: Trade = {
        id: `tr${Date.now()}`,
        week: CURRENT_WEEK,
        proposedBy: ME,
        sides: [
          { teamId: ME, players: o.givePlayers.map((playerId) => ({ playerId, to: partner })), picks: o.givePicks.map((pickId) => ({ pickId, to: partner })), faab: o.giveFaab ? [{ amount: o.giveFaab, to: partner }] : [], drops: [] },
          { teamId: partner, players: o.getPlayers.map((playerId) => ({ playerId, to: ME })), picks: o.getPicks.map((pickId) => ({ pickId, to: ME })), faab: o.getFaab ? [{ amount: o.getFaab, to: ME }] : [], drops: [] },
        ],
      };
      const empty = !o.givePlayers.length && !o.getPlayers.length && !o.givePicks.length && !o.getPicks.length && !o.giveFaab && !o.getFaab;
      if (empty) return ['Add at least one player, pick or FAAB to the deal.'];
      if (L.teams.find((t) => t.id === ME)?.locked || L.teams.find((t) => t.id === partner)?.locked) return ['One of these rosters is locked by the commissioner.'];
      const teams = Object.fromEntries(L.teams.map((t) => [t.id, { teamId: t.id, roster: t.players, rosterLimit: 99, faab: t.faab }]));
      const issues = validateTrade(L.settings, trade, teams, L.picks, CURRENT_SEASON);
      if (issues.length) return issues.map((i) => i.message);
      const res = applyTrade(trade, teams, L.picks);
      const name = (id: string) => teamName(L, id);
      const describe = (players: string[], picks: string[], faab: number) =>
        [...players.map((id) => L.players[id].name), ...picks.map((id) => pickLabel(L.picks.find((p) => p.id === id)!, name)), ...(faab ? [`$${faab} FAAB`] : [])].join(', ') || 'nothing';
      const summary = `${name(ME)} gets ${describe(o.getPlayers, o.getPicks, o.getFaab)}; ${name(partner)} gets ${describe(o.givePlayers, o.givePicks, o.giveFaab)}`;
      const event: ChatMessage = { id: `e${Date.now()}`, leagueId: L.id, author: { kind: 'coil' }, sentAt: new Date().toISOString(), text: '', event: { type: 'trade', teams: [name(ME), name(partner)], summary }, reactions: {} };
      update((L2) => ({
        ...L2,
        picks: res.picks,
        teams: L2.teams.map((t) => {
          const r = res.teams[t.id];
          if (!r) return t;
          const keep = new Set(r.roster);
          return { ...t, players: r.roster, faab: r.faab, ir: t.ir.filter((x) => keep.has(x)), taxi: t.taxi.filter((x) => keep.has(x)) };
        }),
        chat: [...L2.chat, event],
      }));
      return [];
    },

    decideNews: (rawId, decision) =>
      set((s) => {
        const item = s.queue.find((q) => q.rawId === rawId);
        if (!item) return s;
        return { queue: s.queue.filter((q) => q.rawId !== rawId), sent: [{ ...item, decision, at: new Date().toISOString() }, ...s.sent] };
      }),

    setTrust: (sourceId, trust) => set((s) => ({ sources: s.sources.map((x) => (x.id === sourceId ? setSourceTrust(x, trust, 'you') : x)) })),
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
      set({ sources: res.sources, auditLog: [...res.log, ...get().auditLog], auditSuggestions: res.suggestions.map((a) => ('reason' in a ? a.reason : '')), nextAudit: nextAuditAt(now) });
      get().showToast(res.log.length ? `Checked ${get().sources.length} sources. ${res.log.length} need a look.` : `All ${get().sources.length} sources look current.`);
    },

    saveLeague: (s) => set((st) => ({ createdLeagues: [...st.createdLeagues, s] })),
    setImport: (l, migration) => set({ lastImport: { league: l, migration } }),

    updateMyTeam: (patch) => update((L) => mapTeam(L, ME, (t) => ({ ...t, ...patch }))),
    setLeagueImage: (uri) => update((L) => notice({ ...L, imageUri: uri }, uri ? 'new league image' : 'league image removed')),
    setTeamLook: (teamId, look) =>
      update((L) => {
        const next = mapTeam(L, teamId, (t) => ({ ...t, emoji: look.emoji ?? t.emoji, imageUri: look.imageUri }));
        return teamId === ME ? next : notice(next, `new picture for ${teamName(L, teamId)}`);
      }),
    setLeagueLook: (look) => update((L) => notice({ ...L, emoji: 'emoji' in look ? look.emoji : L.emoji, imageUri: look.imageUri }, 'new league picture')),

    updateSettings: (next) => {
      const L = get().league;
      const changes = [...describeSettingsChanges(L.settings, next), ...describeScoringChanges(L.settings.scoring, next.scoring)];
      if (!changes.length) return [];
      const scoringChanged = JSON.stringify(L.settings.scoring) !== JSON.stringify(next.scoring);
      update((L2) => {
        let out: DemoLeague = { ...L2, settings: next, name: next.name };
        if (scoringChanged) out = withRecomputedScores(out);
        return notice(out, `${changes.length === 1 ? changes[0] : `${changes.length} rule changes: ${changes.slice(0, 3).join('; ')}${changes.length > 3 ? '; and more' : ''}`}${scoringChanged ? '. Every score this season was recalculated' : ''}`);
      });
      return changes;
    },

    editScore: (week, teamId, score) =>
      update((L) => {
        const overrides = { ...L.scoreOverrides, [week]: { ...L.scoreOverrides?.[week], [teamId]: score } };
        return notice(withRecomputedScores({ ...L, scoreOverrides: overrides }), `${teamName(L, teamId)}'s week ${week} score set to ${score.toFixed(2)}. Records updated`);
      }),
    setFaab: (teamId, faab) => update((L) => notice(mapTeam(L, teamId, (t) => ({ ...t, faab })), `${teamName(L, teamId)} now has $${faab} FAAB`)),
    setWaiverPriority: (teamId, priority) =>
      update((L) => {
        const order = [...L.teams].sort((a, b) => a.waiverPriority - b.waiverPriority).filter((t) => t.id !== teamId);
        order.splice(priority - 1, 0, L.teams.find((t) => t.id === teamId)!);
        const teams = L.teams.map((t) => ({ ...t, waiverPriority: order.findIndex((o) => o.id === t.id) + 1 }));
        return notice({ ...L, teams }, `${teamName(L, teamId)} moved to waiver priority #${priority}`);
      }),
    toggleLock: (teamId) =>
      update((L) => {
        const locked = !L.teams.find((t) => t.id === teamId)!.locked;
        return notice(mapTeam(L, teamId, (t) => ({ ...t, locked })), `${teamName(L, teamId)} ${locked ? 'is locked from roster moves' : 'can make roster moves again'}`);
      }),
    toggleCommissioner: (teamId) =>
      update((L) => {
        const on = !L.commissioners.includes(teamId);
        const t = L.teams.find((x) => x.id === teamId)!;
        return notice({ ...L, commissioners: on ? [...L.commissioners, teamId] : L.commissioners.filter((x) => x !== teamId) }, `${t.manager} ${on ? 'is now a co-commissioner' : 'is no longer a commissioner'}`);
      }),
    forceMove: (playerId, toTeamId) =>
      update((L) => {
        const from = L.teams.find((t) => t.players.includes(playerId));
        const name = L.players[playerId].name;
        const teams = L.teams.map((t) => {
          const strip = { ...t, players: t.players.filter((x) => x !== playerId), ir: t.ir.filter((x) => x !== playerId), taxi: t.taxi.filter((x) => x !== playerId) };
          return t.id === toTeamId ? { ...strip, players: [...strip.players, playerId] } : strip;
        });
        const what = toTeamId ? `${name} moved ${from ? `from ${from.name} ` : ''}to ${teamName(L, toTeamId)}` : `${name} dropped from ${from?.name ?? 'his team'}`;
        return notice({ ...L, teams }, what);
      }),
    swapOpponents: (week, a, b) =>
      update((L) => {
        // a and b trade opponents for the week.
        const ma = L.schedule.find((m) => m.week === week && (m.home === a || m.away === a));
        const mb = L.schedule.find((m) => m.week === week && (m.home === b || m.away === b));
        if (!ma || !mb || ma === mb) return L;
        const schedule = L.schedule.map((m) => {
          if (m === ma) return m.home === a ? { ...m, home: b } : { ...m, away: b };
          if (m === mb) return m.home === b ? { ...m, home: a } : { ...m, away: a };
          return m;
        });
        return notice({ ...L, schedule }, `Week ${week} matchups changed: ${teamName(L, a)} and ${teamName(L, b)} swapped opponents`);
      }),
    setDues: (dues) => update((L) => notice({ ...L, dues }, dues?.url ? `league dues are $${dues.amount}, collected through the link in settings` : 'dues link removed')),
    toggleDuesPaid: (teamId) =>
      update((L) => {
        if (!L.dues) return L;
        const paid = L.dues.paid.includes(teamId) ? L.dues.paid.filter((x) => x !== teamId) : [...L.dues.paid, teamId];
        return { ...L, dues: { ...L.dues, paid } };
      }),
    setCommishNote: (note) => update((L) => notice({ ...L, commishNote: note || undefined }, note ? 'new pinned note from the commish' : 'pinned note removed')),
    addHistory: (season, champion) => update((L) => ({ ...L, history: [{ season, champion }, ...L.history].sort((a, b) => b.season - a.season) })),
    setNotify: (key, on) => update((L) => ({ ...L, notify: { ...L.notify, [key]: on } })),
    renameTeam: (teamId, name) => update((L) => notice(mapTeam(L, teamId, (t) => ({ ...t, name })), `${teamName(L, teamId)} is now called ${name}`)),
    postNotice: (summary) => update((L) => notice(L, summary)),
    movePick: (pickId, toTeamId) =>
      update((L) => {
        const pick = L.picks.find((p) => p.id === pickId);
        if (!pick) return L;
        const label = pickLabel(pick, (id) => teamName(L, id));
        return notice({ ...L, picks: L.picks.map((p) => (p.id === pickId ? { ...p, ownerTeamId: toTeamId } : p)) }, `${label} moved to ${teamName(L, toTeamId)}`);
      }),
    clearRosters: () =>
      update((L) => notice(withRecomputedScores({ ...L, teams: L.teams.map((t) => ({ ...t, players: [], ir: [], taxi: [] })) }), 'every roster was cleared for a fresh draft. Settings stay the same')),
    removeLeague: () =>
      set((s) => {
        const rest = s.leagues.filter((l) => l.id !== s.league.id);
        if (!rest.length) return s;
        return { leagues: rest, league: rest[0] };
      }),
  };
});

export { eventCopy };
