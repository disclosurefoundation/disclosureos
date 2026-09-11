# C3b: attributable case assessments

This is an **unreleased source checkpoint**, accumulated for the
[coordinated V2 release](../releases/v2-completion.md). It is not in npm beta.3.
It follows the [connected-case foundation](README.md). No version bump, public
portal promotion or package publication is part of this checkpoint.

A case organizes the record. A case claim describes what a source says or what
a particular reviewer concludes about it. The case itself does not reference
the claim history, so later review does not introduce a dependency cycle or
change the case bytes being reviewed.

## Contract and APIs

| Owner | Entry | API |
| --- | --- | --- |
| records | `/experimental/v2` | `CaseClaimHistorySchema`, `parseCaseClaimHistory`, `caseClaimHistoryJsonSchema` |
| records | `/experimental/v2/case-claims/schema/0.1.0` | Plain JSON Schema artifact |
| schema | `/experimental/v2` | `evaluateCaseClaimHistory` |

The root is `case_claim_history`, version `0.1.0`, with an ID, declared `caseRefs`
and `claims`. This distinct envelope can address multiple observations and case
revisions. It reuses the existing source-statement, unassessed/assessed claim and
revision vocabulary; it does not project a multi-observation case into the
single-observation claim-history parsers. Earlier contracts remain unchanged.

```ts
import { parseCaseClaimHistory } from '@disclosureos/records/experimental/v2';
import { evaluateCaseClaimHistory } from '@disclosureos/schema/experimental/v2';

const local = parseCaseClaimHistory(candidate);
const resolved = await evaluateCaseClaimHistory(candidate, {
  documents: suppliedSnapshotBytesBySha256,
});
```

Use a source build for these APIs. `documents` contains exact UTF-8 case and
observation bytes keyed by SHA-256, not parsed objects or URLs.

## Subjects and inputs

Each subject is one of:

- `case`: an exact case snapshot.
- `case_entity`: a case snapshot plus entity kind, ID and optional schema-defined
  field. Groups, investigations, responses, memberships and relationships retain
  their separate identities. An omitted field cannot be resolved just because
  its name appears in the schema.
- `case_relation`: a directed pair of observation endpoints. Each endpoint names
  an exact case snapshot and an observation ID within that case's pinned scope.

Relationship subjects retain `corroborates`, `contradicts`, `same_object`,
`duplicate_of`, `re_analysis_of`, `supersedes` and `superseded_by`. The value names
the proposition under review, not an established relationship. The source text
or assessment outcome explains what is being asserted. No inverse, transitive
identity, corroboration, record merge or lifecycle change is produced.

`part_of` belongs to structural case membership, not to a scientific relationship
assessment. `precedes` and `follows` retain the C3a chronology semantics.

Source statements retain text, optional reported level, author and extraction
recorder, scoped source/product provenance and optional locator/digest. Provenance
selects a case snapshot and observation, so identical source IDs in separate
observations cannot be confused.

Assessments retain rationale, status and explicit inputs. An assessed claim also
requires an evaluator, evaluation time, scoped method reference, exact method
version and supplied outcome; confidence is optional and never defaulted.
An unassessed claim carries no evaluated outcome or evaluator fields.

| Input | Resolves to |
| --- | --- |
| `inputRefs` | Local claims by `claim:<id>`, including a prior assessment when relevant. |
| `caseInputRefs` / `case_assertion` | Exact case snapshot, entity kind, ID, field and assertion ID. |
| `caseInputRefs` / `case_basis` | The supplied basis of an exact membership or relationship record. |
| `observationInputRefs` | A source, product, assertion or measurement in an observation pinned by the selected case. |

An assessed claim requires at least one explicit input. Unknown/redacted/unmapped
case declarations may be cited as such; reference validation does not convert
them into positive support. Investigation conclusions, confidence, findings and
recommendations remain source declarations in the case. An independent review
targets their exact field and assertion inputs without replacing that source text.

## Revisions and independent reviewers

Claims have distinct revision IDs. `supersedes` must preserve kind, topic and the
complete subject, including snapshot digests and relationship direction. Assessed
revisions preserve the evaluator; another reviewer records a separate assessment.
Source-statement revisions preserve the source author. A revision cannot predate
its predecessor and an evaluation cannot postdate its recording.

Claim inputs and supersession form one acyclic dependency graph. Array order and
the latest timestamp never select a preferred reviewer or scientific conclusion.
`currentClaimRefs` means only that a valid local claim is not explicitly
superseded. It can include conflicting assessments and unassessed claims.

Changed case bytes require a separate subject and claim, with a prior-assessment
input when appropriate. Multiple case revisions can coexist in `caseRefs` under
distinct hashes. Relationship endpoints can therefore compare different snapshots
of the same observation ID. Two case wrappers that resolve to the same underlying
observation snapshot do not create distinct endpoints.

The relationship term `supersedes` is a proposition about observation snapshots.
The claim's `supersedes` array revises an assessment or source statement. Neither
operation changes Observation status, withdraws a dataset or edits source bytes.

## Supplied-snapshot evaluation

Local parsing checks typed subjects and inputs, declared case references, dates,
unique identities, revision scope/attribution and cycles. External checks remain
`not_checked` and observation targets are unresolved until bytes are supplied.

The evaluator copies the used case and observation buffers before its first
asynchronous check. It peeks only to discover declared dependencies, then checks
case hashes, identity, structure and semantics, and delegates observation scope
validation to `evaluateCaseRecord`. It resolves fields, assertion IDs, link bases,
source/measurement inputs and method versions inside their exact snapshots.
Missing snapshots are unavailable; wrong hashes, identities or contracts fail.
An external failure returns no `currentClaimRefs` for downstream consumption.

The integrity scope covers supplied case and observation snapshot bytes, not the
history object itself or underlying source artifacts. No network fetch occurs.
Scientific interpretation, source-file authenticity, temporal normalization and
profile applicability remain unchecked. `confirmed` is a reviewer's supplied
outcome, never a result computed by this validator. Public authorization and safe
projection remain application responsibilities.

## Worked control and acceptance

[The fictional example](../../examples/v2/case-assessment-demo/history.json)
keeps an unresolved source conclusion, an inconclusive same-object assessment,
an explicit review revision, a separate reviewer and an unassessed corroboration
question. No ELDÆON data or actual scientific review is represented.

```sh
pnpm --filter '@disclosureos/schema...' build
pnpm test:v2-case-claims
python3 scripts/check-c3-case-mapping.py
node examples/v2/case-assessment-demo/run.mjs
```

The [field ledger](case-baseline-mapping.csv) now gives attributed destinations
for all baseline relation kinds. It remains an accounting artifact, not a claim
that the complete public experience or all C3 work has shipped.

Checkpoint checks pass: 44 case-assessment conformance tests, 328 C1/C2/C3a
regression tests and 92 records/schema unit tests. Both affected packages build,
type-check and pass strict ESM package-export checks. The fixture runner and
28-occurrence field-accounting check pass.

The [C3c link contract](links.md) now supplies direct context/entity/intake
associations with separately reported validation limits. Still pending are public
presentation and application access/output enforcement, followed by the four-case
integration acceptance and coordinated package/portal release. The current history
accepts only the explicit input roles listed above; it must not silently accept
unresolved arbitrary supplemental documents.
