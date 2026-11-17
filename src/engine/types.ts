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
  | 'sackedYds'
  | 'pass40'
  | 'passIntTd'
  // rushing
  | 'rushYds'
  | 'rushTd'
  | 'rushAtt'
  | 'rush2pt'
  | 'rush1stDown'
  | 'rush40'
  // receiving
  | 'rec'
  | 'recYds'
  | 'recTd'
  | 'recTgt'
  | 'rec2pt'
  | 'rec1stDown'
  | 'rec40'
  // misc offense
  | 'fumLost'
  | 'fum'
  | 'krTd'
  | 'prTd'
  | 'krYds'
  | 'prYds'
  | 'fumRecTd'
  | 'ownFumRec'
  // kicking
  | 'fgMade'
  | 'fgYds'
  | 'fgYdsOver30'
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
  | 'defIntYds'
  | 'defFumRetYds'
  | 'defBlkKickYds'
  | 'def2ptRet'
  | 'defTkl'
  | 'defTfl'
  | 'defSackYds'
  | 'defQbHit'
  | 'defPassDef'
  | 'defFf'
  | 'def3AndOut'
  | 'def4thStop'
  | 'defForcedPunt'
  | 'defMissedFgRetYds'
  | 'defKrYds'
  | 'defPrYds'
  | 'stFf'
  | 'stFumRec'
  | 'stSoloTkl'
  | 'stTkl'
  // individual defensive players
  | 'idpSoloTkl'
  | 'idpAstTkl'
  | 'idpTkl'
  | 'idpSack'
  | 'idpSackYds'
  | 'idpTfl'
  | 'idpQbHit'
  | 'idpInt'
  | 'idpIntYds'
  | 'idpPassDef'
  | 'idpFf'
  | 'idpFumRec'
  | 'idpFumRetYds'
  | 'idpBlkKick'
  | 'idpTd'
  | 'idpSafety';

export type StatLine = Partial<Record<StatKey, number>> & {
  /** Distance of each made field goal, in yards. */
  fgMadeYards?: number[];
  /** Length of each passing / rushing / receiving TD, for big-play bonuses. */
  passTdYards?: number[];
  rushTdYards?: number[];
  recTdYards?: number[];
  /** Yards on each catch, for tiered PPR and catch-length bonuses. */
  recYardsEach?: number[];
  /** Yards on each carry and each completion, for big-play bonuses on any play. */
  rushYardsEach?: number[];
  passCmpYardsEach?: number[];
  /** Distance of each missed field goal. */
  fgMissYards?: number[];
  /** Length of each interception / fumble return TD (defense or IDP). */
  intRetTdYards?: number[];
  fumRetTdYards?: number[];
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
