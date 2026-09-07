import { readFileSync } from 'node:fs';
import { parseEnrichedObservation } from '../packages/disclosureos-schema/dist/index.js';

const fixtures = JSON.parse(readFileSync(new URL('./observation-fixtures.json', import.meta.url)));
const strict = process.argv.includes('--target');
const results = fixtures.map((fixture) => {
  const accepted = parseEnrichedObservation(fixture.input).success;
  return { id: fixture.id, accepted, targetAccepts: fixture.targetAccepts,
    baselineMatches: accepted === fixture.v1Accepts, targetMatches: accepted === fixture.targetAccepts };
});
console.log(JSON.stringify({ mode: strict ? 'v2-target' : 'v1-baseline', results }, null, 2));
if (results.some((r) => !(strict ? r.targetMatches : r.baselineMatches))) process.exitCode = 1;
