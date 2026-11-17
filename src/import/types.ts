// The common shape every importer produces. The commissioner reviews it on a
// single "here's what we found" screen, fixes anything flagged, and then each
// manager claims their team from an invite link. Nobody re-enters a roster.

import type { DraftPick } from '../engine/picks';
import type { LeagueSettings } from '../engine/settings';
import type { Position } from '../engine/types';

export type ImportSource = 'sleeper' | 'espn' | 'yahoo' | 'mfl' | 'fleaflicker' | 'text';

export type ImportedPlayer = {
  sourcePlayerId: string | null;
  name: string;
  position: Position | null;
  nflTeam: string | null;
  /** Where the player sits on the imported roster. */
  slot: 'active' | 'IR' | 'TAXI';
  /** Keeper leagues: round the player costs, if the source knows it. */
  keeperRound?: number;
  /** Contract years left, for salary/contract leagues. */
  contractYears?: number;
};

export type ImportedTeam = {
  sourceTeamId: string;
  name: string;
  ownerName: string | null;
  ownerSourceUserId: string | null;
  coOwnerNames?: string[];
  avatarUrl?: string;
  players: ImportedPlayer[];
  faabRemaining: number | null;
  waiverPosition?: number;
  record?: { wins: number; losses: number; ties: number; pointsFor: number; pointsAgainst: number };
};

export type ImportedSeason = {
  season: number;
  leagueName: string;
  championTeamId: string | null;
  championName: string | null;
  runnerUpName?: string | null;
  standings: { teamName: string; ownerName: string | null; wins: number; losses: number; ties: number; pointsFor: number }[];
};

export type ImportedLeague = {
  source: ImportSource;
  sourceLeagueId: string;
  season: number;
  name: string;
  settings: LeagueSettings;
  teams: ImportedTeam[];
  /** Every tradable pick with its current owner. Team ids are sourceTeamIds. */
  picks: DraftPick[];
  history: ImportedSeason[];
  /** Things the commissioner should double-check, in plain language. */
  warnings: string[];
};
