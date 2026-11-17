import type { InjuryStatus } from './types';

export type InjuryTag = {
  status: InjuryStatus;
  /** Short code shown on the player chip. Empty for active players. */
  code: string;
  label: string;
  /** How worried a manager should be: 0 = fine, 3 = not playing. */
  severity: 0 | 1 | 2 | 3;
  /** Will not play this week. */
  inactive: boolean;
};

export const INJURY_TAGS: Record<InjuryStatus, InjuryTag> = {
  active: { status: 'active', code: '', label: 'Healthy', severity: 0, inactive: false },
  day_to_day: { status: 'day_to_day', code: 'DTD', label: 'Day to day', severity: 1, inactive: false },
  questionable: { status: 'questionable', code: 'Q', label: 'Questionable', severity: 1, inactive: false },
  doubtful: { status: 'doubtful', code: 'D', label: 'Doubtful', severity: 2, inactive: false },
  out: { status: 'out', code: 'O', label: 'Out', severity: 3, inactive: true },
  ir: { status: 'ir', code: 'IR', label: 'Injured reserve', severity: 3, inactive: true },
  pup: { status: 'pup', code: 'PUP', label: 'Physically unable to perform', severity: 3, inactive: true },
  nfi: { status: 'nfi', code: 'NFI', label: 'Non-football injury', severity: 3, inactive: true },
  suspended: { status: 'suspended', code: 'SUS', label: 'Suspended', severity: 3, inactive: true },
  covid: { status: 'covid', code: 'COV', label: 'Illness list', severity: 3, inactive: true },
};

export function injuryTag(status: InjuryStatus | undefined): InjuryTag {
  return INJURY_TAGS[status ?? 'active'];
}

/** Map the many spellings feeds use ("Q", "Questionable", "Injured Reserve") to one status. */
export function normalizeInjuryStatus(raw: string | null | undefined): InjuryStatus {
  if (!raw) return 'active';
  const v = raw.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
  if (v === 'q' || v.startsWith('quest')) return 'questionable';
  if (v === 'd' || v.startsWith('doubt')) return 'doubtful';
  if (v === 'o' || v === 'out') return 'out';
  if (v === 'ir' || v.includes('injured reserve') || v === 'ir r' || v === 'ir dfr') return 'ir';
  if (v.includes('pup')) return 'pup';
  if (v.includes('nfi') || v.includes('non football')) return 'nfi';
  if (v.startsWith('sus') || v === 'sspd') return 'suspended';
  if (v.includes('cov') || v.includes('illness')) return 'covid';
  if (v === 'dtd' || v.includes('day to day')) return 'day_to_day';
  return 'active';
}
