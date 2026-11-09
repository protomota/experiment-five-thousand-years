import assert from 'node:assert/strict';
import {events, eras} from '../src/events.ts';
import {filterMilestones, isUnitedStatesHistory, usHistoryIds} from '../src/history-filter.ts';

for (const id of usHistoryIds) assert(events.some(event => event.id === id), `Unknown US history ID: ${id}`);
const us = filterMilestones(events, 'us');
const ids = new Set(us.map(event => event.id));
assert.equal(us.filter(event => event.presidency).length, 47);
for (const id of ['event-q192769', 'event-q10806', 'event-q8740', 'event-q8663', 'wwi', 'event-q362', 'event-q186447', 'apollo']) {
  assert(ids.has(id), `US history must include ${id}, including overseas involvement`);
}
for (const id of ['pyramids', 'haiti', 'event-q214426', 'event-q48780688', 'event-q65049774', 'event-q112666390']) {
  assert(!ids.has(id), `Unrelated or merely US-located global milestone ${id} must stay outside US history`);
}
assert.deepEqual(filterMilestones(events, 'world'), events, 'World view retains the full catalog and ordering');
const rights = filterMilestones(events, 'us', 'Rights & society');
assert(rights.length > 0 && rights.every(event => isUnitedStatesHistory(event) && event.category === 'Rights & society'));
assert.equal(filterMilestones(events, 'us', null, eras[0]).length, 0, 'Unavailable early eras produce an empty selection');
const recent = filterMilestones(events, 'us', null, {start:2000, end:2026});
assert(recent.every(event => event.year >= 2000 && event.year <= 2026));
assert(ids.has('politics-q115857612'), 'Latest US political milestone remains discoverable');
assert(us.every((event, index) => index === 0 || event.year >= us[index - 1].year));
console.log(`PASS: ${us.length} US history milestones, 47 presidencies, overseas participation, exclusion boundaries, theme/era intersections and world reset.`);
