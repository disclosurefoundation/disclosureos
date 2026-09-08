# Population coverage of legacy records

`getPopulationCoverage` is the descriptive name for the existing schema field
counter. This is an additive, unreleased compatibility change in the WP08 work.
It operates on legacy `Observation` fields; it is not a v2 observation profile.
The old `getCompleteness` API and `completeness` CLI command remain available.

## API and command

```ts
import { getPopulationCoverage, type PopulationCoverageResult } from '@disclosureos/scoring';
// Also available from '@disclosureos/scoring/population-coverage'.
const coverage: PopulationCoverageResult = getPopulationCoverage(observation);
console.log(coverage.present, coverage.total, coverage.percentage);
```

After building this checkout:

```sh
node packages/disclosureos-cli/dist/index.js population-coverage ./data/ --recursive --json
```

Once an authorized release includes this change, installed CLI consumers can use
`disclosureos population-coverage`. The command validates legacy observations
structurally before counting. Invalid files and empty targets exit nonzero.
Its JSON result, directory/file discovery, deduplication and exit behavior match
`completeness`. Human output uses “Population coverage.” API calls themselves do
not validate input. Package versions and hosted applications are unchanged here.

## What is counted

The default denominator is `deriveFieldPaths()` from the installed legacy records
schema. Nested object fields are traversed; arrays, record/union nodes and other
leaves retain the existing traversal semantics. An array counts once, independent
of the number or quality of samples. This does not measure dataset membership,
background periods, missing telemetry samples or population representativeness.

`null`, `undefined`, empty strings, empty arrays and objects with no enumerable
keys count as absent. Zero and false count as present. Whitespace strings and
nonempty unknown-state objects count as present. A value can be present without
being valid or providing usable information. These rules are intentionally
unchanged for compatibility, including the existing JavaScript property lookup.

`percentage` is rounded `present / total * 100`; `requiredPercentage` uses only
paths marked required throughout the schema traversal. An empty denominator
returns zero. `missing` preserves path-list order and carries no prioritization
or applicability judgment. Optional irrelevant fields still affect the default
denominator. A 100% result certifies neither documentary completeness nor scientific
quality, and does not increase support for an origin or observable claim.

`PopulationCoverageOptions.paths` accepts the same caller-selected field list as
`CompletenessOptions.paths`. Entries are counted as supplied, including duplicates.
Selecting a smaller list can raise the percentage; comparisons therefore require
the same denominator and presence rules. Custom paths are not reviewed profiles.
The result contains no stable policy identity, source digest or reproducibility
certificate. Preserve the exact input, installed schema/package versions and field
list when recording how a count was produced; combined evaluation provenance is
separate pending work.

## Compatibility and the v2 direction

The new names delegate directly to the legacy counter. Result fields remain
`total`, `present`, `percentage`, `missing`, `requiredTotal`, `requiredPresent`, and
`requiredPercentage`. Existing stored output and the `CompletenessResult` schema
identity are unchanged; no alternate JSON Schema is introduced by this alias.
The new name is deliberately absent from `@disclosureos/scoring/experimental/v2`
because its default denominator is the legacy record schema.

For v2, use [documentation completion](documentation-completion.md) and
[research completion](research-completion.md) for applicable prerequisites and
source-based next actions. Use the [assessment summary](assessment-summary.md)
for declarations, differing outcomes and shared inputs. Those outputs remain
separate from this field count and from the legacy compellingness methodology.

`pnpm test:population-coverage` checks API/CLI compatibility, retained presence
rules, empty/custom denominators, invalid CLI inputs and clear human labels.
