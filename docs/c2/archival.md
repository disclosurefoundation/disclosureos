# C2b: document editions and digital custody

Published in **2.0.0-beta.3**, this contract adds exact document editions, digital artifacts and
custody actions to the research entity model. The public reference is at https://os.disclosure.org/v2/records/documents. Material samples and laboratory analysis remain C2c; case
organization and application access controls remain C3.

## What researchers can describe

Two copies titled “Memo A” can have different bytes, pagination, markings and
release histories. Each has its own `source_edition`, bound to a source or product
in the observation inventory and its declared SHA-256. An `editionCitation`
selects the entity document's exact snapshot, the edition ID, artifact reference
and digest, and a page, time range or JSON pointer. A page from one edition cannot
silently become the same numbered page in another edition.

Six entity kinds join the existing witness, account, procedure and witness-group
kinds in research-entities 0.2.0:

| Kind | Contents and meaning |
| --- | --- |
| `source_edition` | Title, source type, author, organization, issue time, original/archive URLs, archive location, citation text, document type, agency/control/FOIA identifiers, original/current marking declarations, page count, redactions and notes. Display priority is separate from a contextual primary-source assertion. |
| `document_event` | Sourced creation, release, classification or declassification event linked to one edition. Date precision, authority, marking and reference are retained. Release does not imply declassification. |
| `digital_artifact` | Exact inventory artifact identity, additional hash declarations, capture metadata, declared custody status, prose trail, derivation links and update time. Capture metadata is a declaration, not a measurement of the event or authentication of the file. |
| `digital_custody_action` | Exact artifact, action, time, sender, recipient, location, reference and notes. A predecessor names another action on that artifact, a declared beginning, or an explicit unknown gap. Array order is not chronology. |
| `external_identifier` | Namespace/value/URL and optional primary display preference. Its subject explicitly selects the scoped observation or one edition. Catalog identity and event identity are not conflated. |
| `identifier_check` | A particular identifier value assertion, date, agent, method/version and result. Accessibility and identity matching are separate outcomes and remain historical declarations. |

Fields use independently identified sourced assertions with known, approximate,
unknown, redacted or unmapped content. Conflicting statements remain separate;
omission does not mean false. Free-text original wording can accompany values.
Structured alternatives are not automatically reconciled or ranked. Current
classification cannot be inferred from a historical marking or publication.

Page count is a positive integer; an invalid older value can remain unmapped,
never rounded. Redaction categories retain their original vocabulary. A declared
percentage is separately bounded 0–100 and is never inferred from “partial.”
Dates retain calendar precision without invented time zones. GPS altitude carries
its declared unit or `null` for an unknown unit; it never silently becomes meters.

## Custody and artifact identity

Declared SHA-256 is required for an exact edition or digital-artifact reference
and must agree with the scoped observation inventory. URLs and titles are
locators or metadata, not substitute identities. This checkpoint does not resolve
an unidentified legacy source automatically: if its artifact identity is not yet
known, retain the source inventory metadata and unresolved source record until
that identity can be established. Never invent a digest to satisfy the contract.

Additional SHA-256, SHA-512, SHA-1 and MD5 declarations preserve their algorithms
and hexadecimal values. Each identifies the artifact it describes or explicitly
names an unavailable original. An MD5 for an unavailable original does not verify
the current release copy. Additional SHA-256 declarations for identified artifacts
must agree with those artifacts' inventory declarations.

Custody predecessors must exist, concern the same artifact and form an acyclic
graph. Known single sender/recipient declarations must agree across a handoff;
comparable single known action times cannot reverse predecessor order. Unknown
or conflicting parties and dates are not filled in. Derived files have separate
artifact IDs and acyclic derivation links, not an inherited unbroken custody
chain. Physical sample custody is not represented as digital custody.

## Attributable artifact reviews

Claim-history 0.4.0 extends entity-addressed history with edition citations and
artifact reviews. Source assertions may carry `reportedArtifactReview`; assessed
claims may carry `artifactReview` with explicit inputs, evaluator, method/version,
evaluation time and rationale. Their subject is an exact edition or digital
artifact. Each independent review is its own claim, preserving disagreement and
supersession rules.

The review retains verifier, organization, credentials, historical review date,
method vocabulary/description, result, qualitative confidence, source credibility,
findings, report reference/URL, manipulation declaration and notes. A report
reference resolves in the observation inventory. A reported “authentic” finding is
still an attributed source statement; no review is executed by parsing it.
Witness reviews can also use edition citations as explicit inputs in 0.4.0.

## APIs and checked scope

```ts
import {
  parseArchivalEntities,
  parseArchivalClaimHistory,
  archivalEntitiesJsonSchema,
  archivalClaimHistoryJsonSchema,
} from '@disclosureos/records/experimental/v2';
import { evaluateArchivalClaimHistory } from '@disclosureos/schema/experimental/v2';

const result = await evaluateArchivalClaimHistory(history, {
  documents: new Map([
    [observationSha256, observationBytes],
    [entitiesSha256, entityDocumentBytes],
  ]),
});
```

Explicit JSON Schema exports:

- records `/experimental/v2/entities/schema/0.2.0`
- records `/experimental/v2/claims/schema/0.4.0`

The parser checks structure and local semantics. The evaluator additionally checks
supplied observation/entity/context/acquisition snapshot bytes, UTF-8 JSON,
SHA-256, document identity and complete observation scope, then resolves typed
references and edition citations. Known single page counts bound page citations;
unknown or conflicting counts do not produce an invented bound.

Successful evaluation leaves source artifact integrity, scientific interpretation,
profile applicability, time normalization and sensor fusion `not_checked`. The
evaluator never fetches URLs or reads source artifacts. Matching a declaration
against an inventory declaration is not verification against source bytes.
There is no computed authenticity verdict or custody-complete flag.

The prior observation, context, entities 0.1.0 and history 0.3.0 schemas remain
unchanged. Explicit older entry points retain their contract versions. The new
history selects entities 0.2.0; mixed entity versions are not projected silently
into one another. The existing released-document/testimony/material profiles are
not extended or certified by this checkpoint.

Public shapes reject unknown properties, including private intake/contact fields.
They are not a privacy sanitizer: permitted names, URLs, metadata and free text
must already be approved for publication by the producing application. Case-level
access rules and output enforcement remain C3.

## Coverage and runnable control

The [127-row field ledger](archival-baseline-mapping.csv) accounts for every frozen
`sourceData`, `documents`, `provenance` and `identifiers` occurrence plus the ten
source-document fields handed off by C2a. It states revised meanings explicitly.
The generic custody fields are covered for digital items here and retain a C2c
physical-custody owner. This is field accounting and design review, not an automatic
migration or proof that arbitrary legacy inputs are semantically equivalent.

The [fictional two-edition example](../../examples/v2/archival-editions-demo/README.md)
preserves three versus four pages, release versus unknown declassification,
an unavailable original's MD5 declaration and a custody gap. Conformance includes
schema drift/AJV agreement, wrong-edition and wrong-digest failures, local graph
and scope failures, retained missingness and older-contract regression checks.

```sh
pnpm --filter '@disclosureos/schema...' build
pnpm test:v2-archival
pnpm test:v2-entities
python3 scripts/check-c2-archival-mapping.py
node examples/v2/archival-editions-demo/run.mjs
```
