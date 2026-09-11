# C3a: connected cases

This is an **unreleased source checkpoint**. npm remains at beta.3 under the
[consolidated V2 policy](../releases/v2-completion.md). No publication or version
bump is part of this checkpoint.

[C3b case assessments](assessments.md) adds the downstream review envelope for
case, entity/field and directed relationship subjects. It preserves independent
reviewers and explicit revisions without altering this case-record contract.

A case connects observations without combining their underlying facts. The new
case-record `0.1.0` contract names exact observation snapshots, sourced directed
relationships, event groups, investigation reports and response events. It does
not decide whether two observations concern the same object or corroborate one
another. It also does not select a preferred finding.

## Use from the source build

| Owner | Entry | API |
| --- | --- | --- |
| records | `/experimental/v2` | `CaseRecordSchema`, `parseCaseRecord`, `caseRecordJsonSchema`, `caseProvenances` |
| records | `/experimental/v2/case/schema/0.1.0` | Plain JSON Schema artifact |
| schema | `/experimental/v2` | `evaluateCaseRecord` |

```ts
import { parseCaseRecord } from '@disclosureos/records/experimental/v2';
import { evaluateCaseRecord } from '@disclosureos/schema/experimental/v2';

const parsed = parseCaseRecord(candidate);
// Local parsing does not read or verify external snapshots.
const review = await evaluateCaseRecord(candidate, {
  documents: suppliedObservationBytesBySha256,
});
```

These APIs are available after building this source checkout, not from published
beta.3. No prior observation, context, entity, history or profile schema changes.

## Scope and identity

`observationRefs` contains one snapshot per observation ID, with exact contract
identity and SHA-256 of supplied bytes. Two versions of the same observation do
not silently coexist under one local ID. A changed observation requires a new
case snapshot; references never follow a URL or a mutable latest pointer.

Every sourced assertion and link basis has provenance with `observationId`, a
source/product reference, attributed author and recorder. The observation ID
selects its pinned snapshot. `source:log` in observation A is distinct from
`source:log` in observation B. A source may support a case-wide statement, but
must belong to one of the explicitly scoped observations.

The case assembler (`recordedBy`) is distinct from the source author
(`attributedTo`) and extraction recorder (`extractedBy`). Public labels may stand
in for withheld identities. A case label never establishes cross-source identity.

## Records in a case

| Entity | What it carries |
| --- | --- |
| `event_group` | Sourced label, cluster/wave/flap/other type and description. |
| `membership` | One observation or local group belongs to another local group, with a sourced basis. Group nesting must be acyclic. |
| `relationship` | Explicit `fromObservationId`, `toObservationId`, directed `related_to`, `precedes` or `follows`, plus a sourced basis. |
| `investigation` | Observation scope; sourced investigating body/bodies, file number, calendar time, status, reported methods and findings, conclusions, confidence and recommendations. Optional method references resolve in the investigation's scoped observations. |
| `response_event` | Observation scope; sourced time, responding body, official/military response, media attention, public/policy impact and allegation wording. |

Each entity has its own identity, unique within its kind. Field assertions have
IDs unique across the owning entity's fields. Known, approximate, unknown,
redacted and unmapped states remain separate. Conflicting conclusions remain
independent sourced declarations. Known `false` requires provenance; unknown or
omitted media attention does not become false. An allegation is attributed text,
not an unqualified concealment boolean or a finding by DisclosureOS.

Investigation findings and confidence are explicitly **reported**. The downstream
case assessments identify subjects, inputs, evaluator and method separately.
Reported method wording does not manufacture an executed method or its results.

## Chronology and membership checks

Both endpoints of a relationship must be declared observations. Membership must
name the correct local kind and a declared group. Self relationships fail. A
`follows` declaration is reversed only inside the cycle check, so A precedes B
and A follows B form a conflict. The output never manufactures inverse edges.
Membership and chronology are checked as separate graphs with iterative traversal.

Chronology validation establishes only that the supplied declarations are
acyclic. It does not derive dates, compare uncertain event intervals, identify
objects, establish independence or infer a scientific relationship transitively.
Missing observation bytes prevent a complete reference check, including a fully
checked declared chronology. An unresolved external target stays in the case
scope for display; it cannot yield a successful evaluation.

The dependency direction is Case to Observation in this contract. Case-to-case,
Context and Entities snapshot links are not yet accepted, so no dependency cycle
is representable. Later extensions must validate their expanded dependencies.

## Evaluation boundaries

`parseCaseRecord` checks structure, calendar values, local IDs, scope and graph
cycles. `checks.external` remains `not_checked` and `uncheckedRefs` lists the
observation digests.

`evaluateCaseRecord` accepts exact UTF-8 bytes keyed by digest. It copies the used
buffers before awaiting, checks each digest, parses the declared observation
contract, confirms the observation ID, then resolves source/product and method
references in that snapshot. Missing bytes are `unavailable`; wrong bytes,
identities, invalid UTF-8/JSON, invalid observation contracts and missing local
targets fail. Conflicting declared source digests fail, but source-file bytes are
not read or authenticated.

The evaluator receives the case as an object; it does not verify a digest of the
case itself. Its integrity scope is supplied observation snapshot bytes. Source
artifact integrity, temporal normalization, scientific interpretation and profile
applicability remain unchecked. No network fetch occurs and no access rights are
inferred from a source label.

## Worked control and checks

[The fictional control](../../examples/v2/connected-case-demo/caseRecord.json)
groups two station records, reports a later observation with unknown exact times,
keeps competing reported conclusions, and retains an unassessed allegation. It
contains no real partner dataset. Both observations intentionally use `source:log`
to exercise scoped citations. Source log bytes are not supplied.

```sh
pnpm --filter '@disclosureos/schema...' build
pnpm test:v2-case
python3 scripts/check-c3-case-mapping.py
node examples/v2/connected-case-demo/run.mjs
```

Conformance covers source-ID collisions, missing/wrong snapshots, cycles,
duplicate identities, negative and missing declarations, method scope, exact
example/schema reproduction and JSON Schema interoperability. The
[field ledger](case-baseline-mapping.csv) and its checker account for every
investigation, response and relation property occurrence in the baseline. This
is semantic accounting, not a claim that C3 or the full V2 standard is complete.

Checkpoint verification: 31 case conformance tests, 297 C1/C2 regression tests
and 92 records/schema package unit tests pass. Both affected packages build,
type-check and pass their strict package-export checks. The ledger accounts for
28 baseline property occurrences. C3b now supplies the attributed relationship
destinations previously deferred in that ledger.

## Remaining C3 checkpoints

1. Connect additional pinned context/entity/intake references. Case-level
   assessments and attributed relationship kinds are implemented in C3b;
   observation withdrawal remains independent and must not cascade automatically.
2. Add the public presentation contract and application integration for narrative,
   attachments, selected findings and publication notices. Enforce allowlists
   across rendering, exports, search, metadata and caches; keep private notes,
   identity mappings and storage URLs in the application envelope.
3. Review the integrated viewer against all four design cases and finish the
   baseline field ledger before the coordinated package/portal release.

Strict rejection of an `internalNotes` property here is not an access-control
system. Source text itself may contain restricted information. Consumers must
not treat this parser or its error output as a public-safe projection.
