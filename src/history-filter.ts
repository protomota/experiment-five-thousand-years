import type { Milestone } from './events';

export type HistoryScope = 'world' | 'us';

// Editorial membership, not a geographic bounding box: American history also
// includes overseas participation. A global event's US map pin alone is not enough.
export const usHistoryIds = new Set([
  // Colonial North America, independence and domestic conflicts.
  'event-q869045', // Queen Anne's War
  'event-q33143', // Seven Years' War, including its North American theater
  'event-q192769', 'event-q778010', 'event-q334029', 'event-q127912',
  'event-q862751', 'event-q653664', 'event-q846674', 'event-q1132579',
  'event-q301487', 'event-q459447', 'event-q41894', 'event-q841278',
  'event-q6683', 'event-q331377', 'event-q1064335', 'event-q8676',
  'event-q543165', 'event-q221469', 'event-q719252', 'event-q751186',
  'event-q233343', 'event-q1327790', 'event-q220497', 'event-q205422',
  // Rights, society, economy, science and events in the United States.
  'event-q2736155', 'event-q391358', 'event-q175613', 'flight',
  'event-q211386', 'event-q8698', 'event-q201684', 'event-q186356',
  'event-q127050', 'event-q1066650', 'event-q207342', 'event-q249367',
  'event-q1128871', 'event-q585962', 'event-q749610', 'event-q1608064',
  'apollo', 'event-q48469', 'event-q1053476', 'event-q2513',
  'event-q696187', 'event-q10806', 'event-q192446', 'event-q896666',
  // Direct US participation overseas, diplomacy and joint space missions.
  'event-q150229', 'event-q7350', 'wwi', 'event-q8736', 'event-q362',
  'event-q52418', 'event-q699897', 'event-q2050460', 'event-q700032',
  'event-q194132', 'event-q327099', 'event-q714777', 'event-q700547',
  'event-q16470', 'event-q609030', 'event-q696900', 'event-q2748496',
  'event-q488', 'event-q192660', 'event-q696931', 'event-q14303815',
  'event-q835881', 'event-q379433', 'event-q1360624', 'event-q697403',
  'un', 'event-q8683', 'event-q4576', 'event-q151349', 'event-q8663',
  'event-q976887', 'event-q8740', 'event-q128160', 'event-q922661',
  'event-q37643', 'event-q190029', 'event-q1327861', 'iss',
  'event-q182865', 'event-q545449', 'event-q19085', 'event-q18357664',
  'event-q51844684', 'event-q186447', 'event-q108102583', 'event-q16947045',
  'event-q138503695', // The catalog's sourced 2026 US–Iran conflict entry
  // US elections, political parties and movements.
  'politics-q698106', 'politics-q29552', 'politics-q29468', 'politics-q698842',
  'politics-q502044', 'politics-q205304', 'politics-q179868', 'politics-q699590',
  'politics-q42761', 'politics-q699716', 'politics-q327959', 'politics-q45578',
  'politics-q19042', 'politics-q180654', 'politics-q19600530', 'politics-q699872',
  'politics-q22923830', 'politics-q104705419', 'politics-q101110072', 'politics-q115857612',
]);

export function isUnitedStatesHistory(event: Milestone): boolean {
  return Boolean(event.presidency) || usHistoryIds.has(event.id);
}

export function filterMilestones(
  milestones: Milestone[],
  scope: HistoryScope,
  category: string | null = null,
  era: { start: number; end: number } | null = null,
): Milestone[] {
  return milestones.filter(event =>
    (scope === 'world' || isUnitedStatesHistory(event)) &&
    (!category || event.category === category) &&
    (!era || event.year >= era.start && event.year <= era.end),
  );
}
