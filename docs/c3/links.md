# C3c: supplemental records connected to a case

This is an **unreleased source checkpoint** under the
[coordinated V2 publication policy](../releases/v2-completion.md). It is not in
npm beta.3. The existing case and case-assessment contracts remain unchanged.

A `case_links` document associates existing context, research-entity and intake
snapshots with one exact case revision. It supplies a curated path from the case
to the underlying detail. It does not copy that detail into the case, merge
competing documents or modify an assessment's subject. Case and assessment
snapshots do not point back to the link document, avoiding a dependency cycle.

## APIs and use

| Owner | Entry | API |
| --- | --- | --- |
| records | `/experimental/v2` | `CaseLinksSchema`, `parseCaseLinks`, `caseLinksJsonSchema` |
| records | `/experimental/v2/case-links/schema/0.1.0` | Plain JSON Schema artifact |
| schema | `/experimental/v2` | `evaluateCaseLinks` |

```ts
import { parseCaseLinks } from '@disclosureos/records/experimental/v2';
import { evaluateCaseLinks } from '@disclosureos/schema/experimental/v2';

const local = parseCaseLinks(candidate);
const bindings = await evaluateCaseLinks(candidate, {
  documents: suppliedSnapshotBytesBySha256,
});
```

Use these APIs from a built source checkout until the coordinated release.
The root has `kind: case_links`, `schemaVersion: 0.1.0`, ID, recorder and recording
time, an exact `caseRef`, and nonempty `links`. Each link has its own ID,
observation ID and sourced basis. The basis retains its author and extraction
recorder separately from the link-document assembler.

## Available links

| Kind | Target |
| --- | --- |
| `context` | Observation context 0.1.0, optionally selecting an entity and schema-defined field. |
| `entities` | Research entities 0.1.0, 0.2.0, 0.3.0 or 0.4.0, optionally selecting an entity and field accepted by that exact version. |
| `intake` | Source intake 0.1.0, optionally mapping receipt artifacts to source/product inventory entries in the case observation. |

Omitting a target links the whole supplement. It does not select a preferred
witness, source edition or specimen. A field target must exist on the selected
entity; membership in the schema alone is insufficient. IDs and array order do
not merge independently supplied documents.

Every context/entity supplement's observation reference must match the case's
observation ID, contract identity and byte digest. Sharing an observation ID is
insufficient when the bytes differ. A basis citation resolves within its own
explicitly scoped case observation, so repeated source IDs cannot be confused.

An intake link associates the supplied receipt with an observation based on the
recorded source declaration. It does not prove that the observation was derived
from that receipt. Optional artifact mappings require a receipt artifact ID,
an observation source/product ID and matching declared SHA-256 digests. An
observation artifact without a digest cannot satisfy an explicit mapping.
These checks compare inventory declarations; original file bytes are not read.

The earlier `dataSourceId` family described a dataset or pipeline identifier.
An exact intake reference is appropriate only when an actual receipt is supplied.
Retain any original source label in the sourced basis; do not fabricate an intake
document from an identifier alone. This is a forward data model, not a conversion
requirement. The [link field ledger](link-baseline-mapping.csv) records this change
of meaning and its limits.

## What validation establishes

`parseCaseLinks` checks structure, recording time, link identities, typed targets,
duplicate artifact associations and source locator ordering. It reports required
snapshot digests as unchecked.

`evaluateCaseLinks` copies the required buffers before asynchronous checks. It
verifies case, observation and linked-document hashes and identities, checks the
case through `evaluateCaseRecord`, and runs the exact context/entity parser or
the intake metadata checks. It then checks observation scope, selected entities
and fields, and optional artifact inventory mappings. Missing bytes or invalid
bindings prevent a successful result and yield no `resolvedLinkIds`.

`checks.external` is scoped to those association checks. A successful result is
**not full research-document conformance**. `supplementReferenceValidation` and
each supplement's `referenceValidation` remain `not_checked`, with its parser's
`uncheckedRefs` retained. Those references can include nested context/acquisition
or selection documents, measurements and original sources. Use the established
context, entity, laboratory and profile evaluators for their complete scopes.
This validator does not manufacture a claim history merely to run those checks.

Intake metadata is checked without supplying original files. The receipt's file
integrity profile is not satisfied by an association; use `evaluateSourceIntake`
with actual file bytes for that purpose. Unknown receipt metadata and restricted
access remain declarations, not permission to publish.

The integrity scope covers exact supplied case, observation and linked-document
bytes, not the link object itself. Original artifact integrity, scientific
interpretation, profile applicability and authorization remain unchecked. No URL
is fetched. Extra, unrelated buffers are not inspected.

## Public presentation boundary

The [C3d presentation layer](presentation.md) can use the links to organize a case's setting,
witnesses, documents, materials and source receipts. The existing specialized
claim histories remain available for their own domains; this checkpoint does not
add arbitrary supplemental inputs to case-claim-history.

Neither successful association nor `access: public` authorizes publication.
Intake snapshots may contain storage URLs, original filenames or restricted
metadata. Do not send complete linked snapshots, raw receipts or validation
errors to public renderers by default. The upcoming presentation/application
checkpoint owns field and artifact allowlists, exports, search, metadata and
caches. Strict schema rejection of `internalNotes` is not access enforcement.

## Fictional control and checks

[The example](../../examples/v2/case-links-demo/links.json) connects a case to
event context, a public witness pseudonym and a restricted intake declaration.
It contains no partner data or original artifact files.

```sh
pnpm --filter '@disclosureos/schema...' build
pnpm test:v2-case-links
python3 scripts/check-c3-link-mapping.py
node examples/v2/case-links-demo/run.mjs
```

Tests cover exact scope, all supported entity versions, typed targets, metadata
semantics, unavailable/wrong documents, source-ID collisions, digest declarations,
immutable buffers, no network access, and explicit unchecked research dependencies.

Verification passed: 35 link tests, 372 existing C1/C2/C3 conformance tests and
92 records/schema unit tests (499 total). Both affected packages build, type-check
and pass strict ESM package-export checks. The fixture runner and baseline mapping
check pass.

With case organization, assessments and supplemental associations implemented,
C3d now implements the public presentation contract and projection. The remaining
C3 implementation is portal integration and server access/output enforcement,
followed by integrated acceptance and the coordinated V2 release.
