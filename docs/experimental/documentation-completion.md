# Experimental documentation completion

`evaluateDocumentationCompletion` adds an actionable checklist to the existing
[assessment documentation profile](assessment-documentation.md). It evaluates the
source history and supplied bytes itself, preserves the complete validator result,
and explains which requirements are satisfied, missing, failed, unchecked or
inapplicable. It does not accept a caller's claimed completion flags.

This is an experimental WP08 increment in `@disclosureos/schema/experimental/v2`.
Schema owns profile checking and orchestration; the separate scoring-owned
[assessment summary](assessment-summary.md) describes declarations, revisions,
duplicates and shared support. Neither produces an aggregate replacement score.

## Run the supplied example

Use Node 22 and the local package build:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@disclosureos/schema...' build
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { evaluateDocumentationCompletion } from './packages/disclosureos-schema/dist/experimental/v2/index.js';
const history = JSON.parse(readFileSync('examples/v2/assessment-documentation.json', 'utf8'));
const assets = new Map(['source:report', 'product:raw', 'product:summary'].map(ref => [
  ref, new Uint8Array(readFileSync(`examples/v2/documentation-assets/${ref.replace(':', '-')}.txt`)),
]));
const report = await evaluateDocumentationCompletion(history, { assets });
console.log(JSON.stringify(report.assessments, null, 2));
const withoutFiles = await evaluateDocumentationCompletion(history);
console.log(JSON.stringify(withoutFiles.actions, null, 2));
JS
```

Installed consumers import `evaluateDocumentationCompletion` from
`@disclosureos/schema/experimental/v2`. The example is synthetic. Its eight
satisfied groups and one inapplicable frame group are a description of the
selected documentary requirements, not a scientific grade.

## Applicability and checklist groups

Each current assessment receives its own checklist, identified by claim reference,
topic and subject. An unassessed topic, absent domain or unsupported second claim
does not alter another claim's checklist. The unchanged validator still exposes
its history-wide profile result under `validation`; a mixed history can have an
unchecked overall profile while one assessment's documentation passes.

| Requirement group | Applicability | Satisfied means |
|---|---|---|
| Attributed evaluator assessment | All current assessment entries | An assessed declaration passed the existing structural and semantic checks |
| Documentary support | Assessed declarations | Traceable content, required method descriptions and applicable passage/value locators meet this profile |
| Content digests | Identified required supporting assets | Required SHA-256 pins are declared |
| Content integrity | Identified required supporting assets | Exact supplied local bytes are nonempty and match their pins |
| Matching measurement | Assessed confirmed declarations | Primary support contains a measurement matching the subject |
| Event time | Assessed confirmed declarations | The observation supplies a known or approximate event time |
| Measurement uncertainty | Confirmed declaration with a matching measurement | The record supplies characterized uncertainty under the existing profile |
| Raw product lineage | Confirmed declaration with a matching measurement | Primary support reaches a raw product declaring an instrument-data source |
| Reference frames | Confirmed declaration with a matching, frame-referencing measurement | Its declared measurement frame has a supplied definition |

The last five groups are inapplicable for assessed reported, absent or inconclusive
declarations under this documentary profile. This does not waive the requirements
of a different instrument-research profile. An undeclared measurement frame is
inapplicable here because this profile checks declared frame references; it does
not prove that a frame is scientifically unnecessary.

A valid source-only history has report applicability `not_applicable`; it does not
require a fabricated evaluator. Invalid structure or semantics leaves applicability
`not_checked` and returns no checklists. An explicitly unassessed entry is retained:
its attributed-assessment requirement is missing, dependent checks remain unchecked,
and instrument applicability remains undetermined until an assessed outcome exists.

## Statuses, prerequisites and next actions

Every item has a stable ID, required importance, applicability, explanatory reason,
status, actionable diagnostics and `blockedBy` requirement IDs where appropriate.

| Status | Meaning |
|---|---|
| `satisfied` | This documentary check completed without an unresolved diagnostic |
| `missing` | Required documentation or local content is absent or explicitly unknown |
| `failed` | Supplied content is empty or fails a known digest comparison |
| `not_checked` | A prerequisite or runtime capability prevents checking |
| `not_applicable` | The current profile does not apply this requirement, with a stated reason |

For example, a missing subject-matching measurement leaves uncertainty and product
lineage unchecked. Missing source pins prevent byte verification. Absent local
bytes produce a missing-content item, while the underlying validator retains its
`not_checked` integrity status. Corruption produces a failed item; the recovery
instruction is to resolve the source/version mismatch, not to replace a digest
merely to obtain a pass. Unavailable hashing stays unchecked with a runtime
recovery action.

`actions` retains each original diagnostic's code, pointer, severity and message,
adding `nextAction`. Item actions are the relevant subset. Structural/reference
issues retain a general source-based correction instruction. Do not discard the
underlying diagnostics when displaying the guidance. A blocked item can have no
new diagnostic of its own; follow `blockedBy` to the prerequisite's action.

`counts` describes nine checklist groups by status for that assessment. It is not
a percentage, an independent-evidence count, a vote, a weight or an estimate of
scientific completeness. Inapplicable groups are reported separately, with no
reward or penalty. `documentationStatus` is copied from the authoritative validator;
consumers must not infer a pass by counting rows or dropping unresolved diagnostics.
There is no cross-assessment completion score.

Repeated declarations have identical per-claim checklists but remain separately
addressable for their validation diagnostics. Use the assessment summary's explicit
deduplication when presenting unique declarations; do not sum completion counts
across copies. Confidence is neither required nor rewarded, including confidence
zero. This first checklist reflects existing required groups; it introduces no
new recommended scientific thresholds or domain-specific scoring criteria.

## Contract and limits

`DOCUMENTATION_COMPLETION_POLICY` identifies
`urn:disclosureos:experimental:policy:documentation-completion`, version `0.1.0`.
`DOCUMENTATION_REQUIREMENTS` is the frozen group catalog. `validation.profile` and
`validation.contract` retain the invoked profile and claim-history contract pins.
No existing schema artifact, profile rule, package version or v1 API changes.

History data used for applicability is captured before asynchronous checks, and
the delegated validator snapshots local byte buffers before hashing. No URLs are
fetched or methods executed. Scientific eligibility, source/locator contents and
method execution remain unchecked. The result does not cover calibration adequacy,
timing-model adequacy, distribution authorization or full scientific reproduction.
It is not a public projection; topics, identifiers and diagnostics can describe
restricted records. Callers must bound untrusted inputs and apply their access
policy when presenting results.

`pnpm test:v2-completion` runs the full existing documentary corpus through both
APIs and tests applicability, source-only/unassessed states, blocked prerequisites,
unknown confidence, per-topic isolation, hash failures, snapshot isolation and
non-mutation. The complete validator result must remain identical.

Remaining WP08 work includes reviewed recommended inputs, additional domain profiles,
and combined versioned evaluation provenance. The [research checklist](research-completion.md)
and [legacy population coverage](population-coverage.md) now have separate guidance.
CLI/Index integration of v2 evaluations and scientific review remain separate work.

The [instrument research completion guide](research-completion.md) covers calibration, timing and report prerequisites for the selected research profile.
