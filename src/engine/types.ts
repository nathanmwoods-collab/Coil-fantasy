// Core types for the Coil Fantasy league rules engine.
// The engine is pure TypeScript with no React or network code, so every rule
// can be unit tested and shared by the app, the server and import tools.

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST' | 'DL' | 'LB' | 'DB';

export const OFFENSE: Position[] = ['QB', 'RB', 'WR', 'TE'];
export const IDP: Position[] = ['DL', 'LB', 'DB'];

/** Roster slots. Starter slots first, then reserve slots (BN, IR, TAXI). */
export type SlotType =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'K'
  | 'DST'
  | 'DL'
  | 'LB'
  | 'DB'
  | 'FLEX' // W/R/T
  | 'WR_RB'
  | 'WR_TE'
  | 'SUPERFLEX' // Q/W/R/T
  | 'IDP_FLEX'
  | 'BN'
  | 'IR'
  | 'TAXI';

export const RESERVE_SLOTS: SlotType[] = ['BN', 'IR', 'TAXI'];

export type TeamId = string;
export type PlayerId = string;

/** Every stat the scoring engine knows how to score. */
export type StatKey =
  // passing
  | 'passYds'
  | 'passTd'
  | 'passInt'
  | 'passCmp'
  | 'passInc'
  | 'passAtt'
  | 'pass2pt'
  | 'pass1stDown'
  | 'sacked'
  // rushing
  | 'rushYds'
  | 'rushTd'
  | 'rushAtt'
  | 'rush2pt'
  | 'rush1stDown'
  // receiving
  | 'rec'
  | 'recYds'
  | 'recTd'
  | 'recTgt'
  | 'rec2pt'
  | 'rec1stDown'
  // misc offense
  | 'fumLost'
  | 'fum'
  | 'krTd'
  | 'prTd'
  | 'krYds'
  | 'prYds'
  // kicking
  | 'fgMiss'
  | 'xpMade'
  | 'xpMiss'
  // team defense / special teams
  | 'defSack'
  | 'defInt'
  | 'defFumRec'
  | 'defTd'
  | 'defSafety'
  | 'defBlkKick'
  | 'stTd'
  | 'pointsAllowed'
  | 'yardsAllowed'
  // individual defensive players
  | 'idpSoloTkl'
  | 'idpAstTkl'
  | 'idpSack'
  | 'idpTfl'
  | 'idpQbHit'
  | 'idpInt'
  | 'idpPassDef'
  | 'idpFf'
  | 'idpFumRec'
  | 'idpTd'
  | 'idpSafety';

export type StatLine = Partial<Record<StatKey, number>> & {
  /** Distance of each made field goal, in yards. */
  fgMadeYards?: number[];
  /** Length of each passing / rushing / receiving TD, for big-play bonuses. */
  passTdYards?: number[];
  rushTdYards?: number[];
  recTdYards?: number[];
  /** Yards on each catch, for tiered PPR. */
  recYardsEach?: number[];
};

export type Player = {
  id: PlayerId;
  name: string;
  position: Position;
  /** Extra positions a player is eligible at (rare in football, e.g. a TE/WR). */
  altPositions?: Position[];
  nflTeam: string;
  /** Years in the league; 0 = rookie. Used for taxi squad eligibility. */
  yearsPro?: number;
  /** Injury or roster designation from the news feed. */
  status?: InjuryStatus;
  /** Short injury note, e.g. "Hamstring". */
  injuryNote?: string;
  /** Headshot URL from the data provider; the app falls back to an initials avatar. */
  headshotUrl?: string;
};

/**
 * Designations shown as tags on players. Codes follow what managers know:
 * Q questionable, D doubtful, O out, IR injured reserve, PUP, NFI, SUS, COV.
 */
export type InjuryStatus =
  | 'active'
  | 'questionable'
  | 'doubtful'
  | 'out'
  | 'ir'
  | 'pup'
  | 'nfi'
  | 'suspended'
  | 'covid'
  | 'day_to_day';
