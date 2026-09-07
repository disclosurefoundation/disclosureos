import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { validateSurfaces } from './validate-surfaces.mjs';

const fixtures = JSON.parse(readFileSync(new URL('./observation-fixtures.json', import.meta.url)));
const baseline = JSON.parse(readFileSync(new URL('./v1-surfaces.json', import.meta.url)));
const ids = fixtures.map(f => f.id);
if (new Set(ids).size !== ids.length || ids.length === 0) throw new Error('Fixture IDs must be unique and nonempty');
if (!isDeepStrictEqual([...ids].sort(), Object.keys(baseline).sort())) throw new Error('Baseline and fixture IDs differ');
const results = fixtures.map(fixture => {
  const actual = validateSurfaces(fixture);
  return { id: fixture.id, rules: fixture.rules, actual, expected: baseline[fixture.id],
    matchesBaseline: isDeepStrictEqual(actual, baseline[fixture.id]) };
});
console.log(JSON.stringify({ contract: 'v1-cross-surface-baseline',
  note: 'Legacy acceptance and warning counts only; not v2 staged conformance or scientific certification.',
  results }, null, 2));
if (results.some(r => !r.matchesBaseline)) process.exitCode = 1;
