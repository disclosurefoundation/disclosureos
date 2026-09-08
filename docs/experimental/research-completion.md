# Experimental instrument research completion

`evaluateInstrumentResearchCompletion` provides required prerequisite statuses and
source-based next actions for the explicitly selected instrument research profile.
It invokes the [research validator](research-prerequisites.md) and preserves its
complete result under `validation`. It does not accept caller-provided pass flags.

This WP08 increment is exported from `@disclosureos/schema/experimental/v2`.
Its policy is `urn:disclosureos:experimental:policy:instrument-research-completion`,
version `0.1.0`. The policy describes selected prerequisites, not scientific approval.

## Required phases

| Phase | What it reports |
| --- | --- |
| Input consistency | Structural and semantic checks actually reported by the validator |
| Review scope | A nonempty mapped measurement inventory with corresponding review entries |
| Reviewed context | Calibration review, measurement uncertainty, calibration-use review and interpreted timing prerequisites |
| Assessment documentation | The invoked documentary profile and its local supporting bytes |
| Measurement acquisition | The invoked measurement/acquisition binding profile and its local supporting bytes |
| Report integrity | Exact local calibration-use and timing report byte identity |

Statuses are `satisfied`, `missing`, `failed` and `not_checked`. Missing required
reviews or unavailable bytes differ from rejected/inconclusive reviews, inconsistent
references and corrupt bytes. Counts describe these six groups only. They are not
a percentage, weighted score, confidence estimate or scientific grade.

The research validator can stop before downstream checks. Such phases remain
`not_checked` with `blockedBy` references even if their diagnostic lists are empty.
An input-consistency pass describes only checks actually reported; it does not
claim that later binding checks ran. When downstream checks do run, their individual
results remain visible even if another phase fails. Empty mapped or review inventories
never make this explicitly selected profile inapplicable, and a nonempty inventory
does not prove exhaustive measurement coverage.

Actions preserve original codes, stages, severities, pointers and messages. A
`measurementRef` is attached only where an indexed review pointer identifies it.
Nested documentary pointers keep the validator's `/documentation` prefix.
Rejected reviews remain rejected; next actions never recommend fabricating review
records, backdating timestamps, trimming timing bounds or changing pins just to pass.

## Run the synthetic example

After `pnpm install --frozen-lockfile` and
`pnpm --filter '@disclosureos/schema...' build`, run with Node 22:

```sh
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { evaluateInstrumentResearchCompletion } from './packages/disclosureos-schema/dist/experimental/v2/index.js';
const root = 'examples/v2/research-prerequisites-demo';
const json = name => JSON.parse(readFileSync(`${root}/${name}.json`, 'utf8'));
const keys = {
  observationAssets: ['source:report', 'product:raw', 'product:summary'],
  contextAssets: ['manifest:r1', 'product:captured-raw', 'calibration:c1/report', 'calibration:c1/review'],
  reviewAssets: ['measurement:velocity/calibration-use', 'measurement:velocity/timing'],
};
const assets = Object.fromEntries(Object.entries(keys).map(([namespace, refs]) => [
  namespace, new Map(refs.map(ref => [ref, new Uint8Array(readFileSync(
    `${root}/${namespace}/${ref.replace(':', '-').replace('/', '-')}.txt`
  ))])),
]));
const report = await evaluateInstrumentResearchCompletion(
  json('history'), json('context'), json('bindings'), json('mapping'), json('review'), assets,
);
console.log(JSON.stringify(report.requirements, null, 2));
JS
```

Installed consumers use the same function from `@disclosureos/schema/experimental/v2`.
The supplied fixture satisfies six prerequisite groups. It is synthetic and carries
no partner research conclusion. Omitting asset maps produces missing byte checks.

Documents and supplied byte maps are snapshotted before asynchronous verification.
The three namespaces retain the underlying validator's meanings and never trigger
network retrieval. The full nested results remain available for detailed review.
Scientific eligibility, calibration adequacy, timing-model validity and reviewer
authenticity remain explicitly unchecked. The tool does not read review report
contents, independently reproduce analysis or certify suitability for a purpose.

Use the separate [documentation checklist](documentation-completion.md) for per-assessment
documentary applicability and the [assessment summary](assessment-summary.md) for
current declarations, duplicate copies and shared support.
