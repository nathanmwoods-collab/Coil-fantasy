import type { StatKey, StatLine } from './types';

/**
 * Coil's own baseline projection, used when the data provider sells none.
 * A weighted average of a player's recent games (newer games count more),
 * blended toward last season's per-game line early in the year. Simple and
 * explainable; a better model can replace it behind the same function.
 */
export function projectStatLine(
  recentGames: StatLine[],
  lastSeasonPerGame: StatLine | null,
  opts: { decay?: number; priorGames?: number } = {},
): StatLine {
  const decay = opts.decay ?? 0.8;
  const priorGames = opts.priorGames ?? 3;
  const totals: Partial<Record<StatKey, number>> = {};
  let weightSum = 0;

  // recentGames[0] is the most recent game.
  recentGames.forEach((g, i) => {
    const w = decay ** i;
    weightSum += w;
    for (const [k, v] of Object.entries(g)) {
      if (typeof v === 'number') totals[k as StatKey] = (totals[k as StatKey] ?? 0) + v * w;
    }
  });

  if (lastSeasonPerGame) {
    // Treat last season as `priorGames` worth of evidence at average weight.
    const w = priorGames * (recentGames.length ? weightSum / recentGames.length : 1);
    weightSum += w;
    for (const [k, v] of Object.entries(lastSeasonPerGame)) {
      if (typeof v === 'number') totals[k as StatKey] = (totals[k as StatKey] ?? 0) + v * w;
    }
  }

  const out: StatLine = {};
  if (!weightSum) return out;
  for (const [k, v] of Object.entries(totals)) out[k as StatKey] = Math.round(((v as number) / weightSum) * 100) / 100;
  return out;
}
