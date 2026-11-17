// Sports data adapter. The app and server only talk to this interface, so the
// provider (MySportsFeeds today) can be swapped without touching league logic.

import type { InjuryStatus, Player, PlayerId, StatLine } from '../engine/types';

export type NflGame = {
  id: string;
  week: number;
  startsAt: string; // ISO time
  home: string; // team abbreviation
  away: string;
  status: 'scheduled' | 'live' | 'final';
};

export type PlayerInjury = {
  playerId: PlayerId;
  status: InjuryStatus;
  note?: string;
  updatedAt?: string;
};

export type NewsItem = {
  id: string;
  playerId: PlayerId | null;
  headline: string;
  body?: string;
  source: string;
  url?: string;
  publishedAt: string;
};

export type WeeklyStats = { playerId: PlayerId; week: number; stats: StatLine };

export type Projection = { playerId: PlayerId; week: number | 'season'; stats: StatLine; source: string };

export interface SportsDataProvider {
  readonly name: string;
  players(season: number): Promise<Player[]>;
  injuries(season: number): Promise<PlayerInjury[]>;
  schedule(season: number): Promise<NflGame[]>;
  weeklyStats(season: number, week: number): Promise<WeeklyStats[]>;
  /** Not every provider sells projections; null means "use Coil's own model". */
  projections(season: number, week: number): Promise<Projection[] | null>;
  /** Not every provider has a news feed; null means none. */
  news(since: string): Promise<NewsItem[] | null>;
}
