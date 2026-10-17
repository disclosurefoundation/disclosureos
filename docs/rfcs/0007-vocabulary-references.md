# RFC 0007: Shared vocabulary references and the V2 definition baseline

Status: **implemented in the V2 source candidate; not yet published to npm**. Owners: records, observables, origins and schema. Updated 13 October 2026. This implements the separation described in [RFC 0003](0003-claims.md) and [RFC 0004](0004-scientific-neutrality.md).

## Decision

A vocabulary reference identifies a catalog, its immutable revision, its exact retained document and one term. A companion binding connects that reference to a claim while keeping the reviewed subject and supporting sources in the claim itself.

The twelve observable definitions are revised directly as the V2 baseline. This checkpoint has no compatibility aliases, historical crosswalks or migration layer. Git records development history. Once a catalog is released for real use, retain its exact bytes and do not reuse its revision for changed content.

Observable terms describe characteristics to report or investigate. Origin terms identify possible explanations. Neither term membership nor a successful reference check establishes that a characteristic occurred, is anomalous, or has a particular origin. A descriptive term can also fit an ordinary event.

The public teaching order is Records → Instruments → Observables → Claims → Origins → Scoring. It is a reading sequence, not a requirement that every record contain instruments, every term have an assessment, or every assessment receive an origin or score.

## Separate declarations

| Question | Where it belongs |
| --- | --- |
| What is being reviewed? | Claim `subject`, using the subject types of its history contract |
| Which defined term is involved? | Binding `term`, including catalog identity, revision, snapshot and term ID |
| Who attached the term, and why? | Binding `assignedBy`, `recordedAt` and `rationale` |
| What supports the review? | Claim provenance, inputs and version-specific citations |
| Who assessed it and how? | Claim evaluator, evaluation time, method and method version |
| What did they conclude? | Claim assessment status, outcome and rationale |

The companion is useful separation between terminology and claims. It is not a compatibility mechanism. Free-text claim `topic` remains a description; it does not substitute for a resolved vocabulary reference.

## Implemented shared contracts

Records owns these strict schemas, their parsers and JSON Schema emitters:

- `VocabularyCatalogSchema`, `VocabularyCatalogTermSchema` and `parseVocabularyCatalog`.
- `VocabularyTermReferenceSchema`.
- `VocabularyBindingSchema`, `VocabularyBindingsSchema` and `parseVocabularyBindings`.

Schema reexports them at `@disclosureos/schema/experimental/v2` and provides the local `evaluateVocabularyBindings` evaluator. See the [developer guide](../experimental/vocabulary-references.md), [owning definitions](../../packages/disclosureos-records/src/experimental/v2/vocabulary-schema.ts) and [evaluator](../../packages/disclosureos-schema/src/experimental/v2/vocabulary-bindings.ts).

### Catalog and selected term

```ts
type VocabularyTermReference = {
  catalogId: string;
  revision: string;
  document: {
    documentId: string;
    schemaId: string;
    sha256: string;
  };
  termId: string;
};
```

The complete tuple is the reference. A display label, short code or local term ID alone is not a global identity.

The `vocabulary_catalog` envelope has `schemaVersion: "0.1.0"`, `id`, `catalogId`, `revision`, `publishedBy`, `publishedAt` and a nonempty `terms` array. Each term has an ID, label and description; code, category and namespaced JSON extensions are optional. Term IDs and any supplied codes must be unique within the catalog. Labels need not be unique.

Catalog IDs use an authority-qualified `urn:` or `https:` identity, compared exactly. A URI identifies the catalog; it is not permission to fetch it. The revision is a nonempty immutable publication identifier, not an npm version, schema version or `latest` alias. Publication attribution is a declaration, not authenticated identity.

Contract identities are:

- `urn:disclosureos:experimental:vocabulary-catalog:0.1.0`
- `urn:disclosureos:experimental:vocabulary-term-reference:0.1.0`
- `urn:disclosureos:experimental:vocabulary-bindings:0.1.0`

The snapshot uses the existing `DocumentSnapshotRef`. SHA-256 covers the exact retained UTF-8 bytes before parsing. Reformatting or reordering JSON changes those bytes and the digest. Invalid UTF-8 and duplicate object keys, including escaped-equivalent keys, fail resolution. No canonicalization, network request, latest-revision lookup or default term is performed.

### Companion bindings

A `vocabulary_bindings` document has `schemaVersion: "0.1.0"`, an ID and a nonempty `bindings` array. Each binding includes its own unique ID, recorded time, assigning person, rationale, relation, term reference and a claim reference. The claim reference identifies the exact history snapshot and a `claimId` within it.

| Relation | Meaning | Constraint |
| --- | --- | --- |
| `about` | The assigning person indexes this claim under a term. | May target a source assertion, unassessed claim or assessed claim. Does not establish presence or declare the assessor's criterion. |
| `assessment_criterion` | The assessor declares the exact definition addressed by an assessment. | Requires an assessed claim. `assignedBy` must equal `evaluatedBy` exactly. Only one distinct criterion is allowed per exact target claim across selected companions. |

The binding cannot precede its target claim's recorded time. A later criterion declaration remains a later declaration, not proof of what was performed earlier. Attribution-string equality is a documentary consistency check, not identity verification.

Several curators can independently index one claim, and a claim can be about several terms. Its outcome is not copied into separate findings for all those terms. Independent term assessments require separate claims. Direct annotation of an arbitrary passage without a claim is outside this contract; use an attributed source assertion to retain reported characteristics without fabricating an assessment.

## Resolution and result boundaries

```ts
const result = await evaluateVocabularyBindings(bindings, {
  documents,          // ReadonlyMap<sha256, Uint8Array>
  additionalBindings // Optional other selected companion objects
});
```

The evaluator copies all supplied byte buffers before its first asynchronous operation. It parses selected companions before resolving their catalogs and histories. Identical companion IDs and parsed contents deduplicate; the same ID with different contents fails. Companions themselves are supplied objects, not byte-pinned inputs. Catalogs, histories and their referenced dependencies are byte-pinned documents.

For each binding, the evaluator validates the exact document digest and ID, dispatches the declared contract, checks catalog identity and revision, resolves the term and target claim, and checks attribution and chronology. It supports observation claim histories `0.1.0` through `0.5.0` and case claim history `0.1.0`. It reuses each contract's parser and, where applicable, its existing subject/input dependency evaluator; this companion does not widen a subject union.

Within supplied inputs, two valid artifacts cannot declare the same catalog and revision with different snapshot identities. Conflicting assessment criteria also fail. Neither catalog conflicts nor criteria are resolved by timestamp or array order.

| Condition | Reference-profile result |
| --- | --- |
| Required bytes absent or declared contract unsupported | `not_checked`, with unresolved references and diagnostics |
| Supplied digest, ID, known contract, term membership, attribution or other required rule fails | `failed` |
| Every required reference and rule resolves successfully | `passed` |

Failures take precedence over unresolved inputs, and both remain in the diagnostics. `success` is true only when structural, semantic and reference-profile checks pass. `checks.external` remains `not_checked`. A successful lookup is not an authentication or scientific result.

Each returned binding includes its references, relation, resolution status and, when resolved, the selected term. The result also reports checked snapshots and unresolved references. `domainProfiles`, `scientificValidity` and `authenticity` remain explicitly `not_checked`.

## Criterion continuity for future assessments

An assessed revision connected through `supersedes` retains the same complete term reference. The evaluator checks assessed predecessors and successors in chains touched by a selected criterion binding. Both declarations must refer to the same exact history snapshot; a declaration in a different snapshot does not implicitly cover it. Missing criterion declarations or unavailable catalogs leave continuity unchecked. A changed criterion fails and requires a separate assessment of the newly defined question.

An unassessed predecessor has no declared assessment criterion. Its first assessed successor can declare one. About-only associations do not impose criterion requirements on unrelated generic assessments.

These are prospective reproducibility rules for the V2 baseline. The evaluator cannot discover withheld artifacts or conflicting declarations from separate submissions. A retaining publisher must enforce immutability across its submissions; a local check makes no global uniqueness claim.

## Domain ownership and direct definition update

The observables and origins packages export catalogs using the same envelope:

- `createObservableCatalog` uses `https://os.disclosure.org/vocabularies/observable-characteristics` and places methodological metadata in `org.disclosureos.observables` term extensions.
- `createOriginCatalog` uses `https://os.disclosure.org/vocabularies/origin-hypotheses` and retains OCS taxonomy metadata and attribution in `org.disclosureos.origins` extensions.
- `readObservableTermDefinition` and `readOriginTermDefinition` expose typed domain metadata. A missing or malformed domain extension returns no typed definition. The core evaluator does not certify these extensions.

The [definition review](0007-vocabulary/definition-review.md) and [structured review record](0007-vocabulary/observable-catalog-proposal.json) explain all twelve direct replacements, their methods and limitations. Package constants are the runtime source of truth. The structured review file is editorial material, not a `vocabulary_catalog` document.

The revised terms separate apparent motion from physical acceleration, detection discrepancies from intent, association from causation, and specimen characteristics from biological or origin conclusions. Technology and biologics remain editorial groups, not findings that either is present. This is the DisclosureOS characteristics vocabulary, not a claim to reproduce the original ATIP framework.

The reference scorer rejects nonempty descriptive observable claim lists instead of turning them into anomaly strength. That rejection is not a zero score or an absence finding. V2 attributed assessments and explicit profiles remain the appropriate path for research results. Existing support-level words and V2 outcome words are distinct declarations; matching spellings do not authorize a conversion.

The methodological review is implemented; independent scientific validation and expert approval are not claimed. The cited sources support specific measurement and interpretation cautions, not endorsement of this taxonomy or any particular UAP event.

## Executable checks and rollout

The [runnable example](../../examples/v2/vocabulary-demo/run.mjs) uses a custom motion catalog, an attributed source assertion and an assessor's separate criterion declaration. It preserves the example claim's own subject, inputs and inconclusive outcome. The [fixture builder](../../examples/v2/vocabulary-demo/fixture.mjs) computes exact references from retained serializations; it replaces the earlier documentation-only JSON examples.

Run from the repository root after building packages:

```sh
pnpm emit:v2-vocabulary
pnpm test:v2-vocabulary
pnpm example:vocabulary
```

The [conformance suite](../../conformance/vocabulary.test.mjs) covers official observable and origin catalogs, custom catalogs, all implemented history contracts, descriptive associations, assessor attribution, chronology, duplicate IDs and JSON keys, exact digests, missing inputs, criterion conflicts and continuity, caller-buffer mutation, schema drift and role-confusion prevention. CI runs that suite and the example.

The portal consumes these canonical contracts and revised definitions in the current PR stack. No npm release accompanies this checkpoint. Publication remains part of the coordinated V2 release; package availability must not be inferred from an open source-candidate PR.
