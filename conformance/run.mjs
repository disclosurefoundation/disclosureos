import { readFileSync } from 'node:fs';
import { parseEnrichedObservation } from '../packages/disclosureos-schema/dist/index.js';

const fixtures = JSON.parse(readFileSync(new URL('./observation-fixtures.json', import.meta.url)));
const strict = process.argv.includes('--target');
// Keep the original seven runtime regression expectations stable. The expanded
// cross-surface corpus is exercised by conformance:matrix.
const legacy = fixtures.filter((fixture) => typeof fixture.v1Accepts === 'boolean');
if (legacy.length !== 7) throw new Error('The original seven regression fixtures must remain present');
const results = legacy.map((fixture) => {
  const accepted = parseEnrichedObservation(fixture.input).success;
  return { id: fixture.id, accepted, targetAccepts: fixture.targetAccepts,
    baselineMatches: accepted === fixture.v1Accepts, targetMatches: accepted === fixture.targetAccepts };
});
console.log(JSON.stringify({ mode: strict ? 'v2-target' : 'v1-baseline', results }, null, 2));
if (results.some((r) => !(strict ? r.targetMatches : r.baselineMatches))) process.exitCode = 1;
