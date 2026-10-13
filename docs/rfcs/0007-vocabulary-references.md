# RFC 0007: Vocabulary references and definition revisions

Status: **design proposal for review, not implemented or published**. Owners: records, observables, origins and schema. Reviewed against canonical commit `e19a89793871d23fb036e59c75ff83c86e21dfad`. This follows [RFC 0003](0003-claims.md) and [RFC 0004](0004-scientific-neutrality.md).

## Decision

Give a selected term a shared reference that identifies its catalog, immutable revision and exact document bytes. Keep that reference separate from the subject under review and the source material used to support a claim. Use a companion document to connect the reference to an existing claim. Do not add fields to existing strict claim-history schemas.

The same mechanics serve observable terms, origin hypotheses and custom catalogs. Their meanings remain distinct. An observable describes a characteristic to report or investigate; an origin term identifies a possible explanation. Neither a catalog entry nor a reference to one establishes that the characteristic occurred, is anomalous, or has the proposed origin.

This checkpoint proposes the contract and reviews all twelve observable definitions. It does not change exported types, JSON Schemas, parsers, package versions, existing definitions, retained example packets or assessment results. No npm publication accompanies it.

## Why this is needed

V2 claim histories already distinguish source assertions, unassessed reviews and attributed assessments. They identify subjects and supporting inputs. Their `topic` is free text, however: a misspelled catalog ID and an unrecorded definition revision can both pass structural validation. Retaining a catalog as an ordinary source does not identify which entry supplied a claim's meaning.

The portal currently performs its own membership and snapshot checks. Those checks need a reusable standard contract. This work closes the reference gap; it does not make a successful lookup a scientific finding.

| Question | Existing or proposed answer |
| --- | --- |
| What is being reviewed? | Existing claim `subject`, under the declared history version |
| Which defined term is involved? | Proposed `term` reference |
| Who attached that term, and why? | Companion binding attribution |
| What supports the review? | Existing provenance, `inputRefs` and version-specific citation/input fields |
| Who assessed it, using what method? | Existing evaluator, evaluation time and method/version |
| What did they conclude? | Existing assessment status, outcome and rationale |

The public teaching order is Records → Instruments → Observables → Claims → Origins → Scoring. This is a reading sequence, not a requirement that every record have instruments, every characteristic have an assessment, or every assessment propose an origin or receive a score. The catalog definition itself is terminology. Applying it to a particular observation is an attributed statement or assessment, even when it uses empirical measurements.

## Proposed shared reference

These names are proposed serialization, not available TypeScript exports. `Id` uses the existing document-ID alphabet (`[A-Za-z0-9][A-Za-z0-9._-]*`); `Text` is a nonempty string containing non-whitespace text. All objects below reject unknown fields. URI identities are compared exactly, without lowercasing or normalizing; use authority-qualified absolute `urn:` or `https:` identities. A URI is an identifier, not permission to fetch it.

```ts
type DocumentSnapshotRef = {
  documentId: Id;
  schemaId: Text;
  sha256: string; // Exactly 64 lowercase hexadecimal characters.
};

type VocabularyTermReference = {
  catalogId: string; // Authority-qualified urn: or https: identity.
  revision: Text;    // Opaque immutable publication identifier; never "latest".
  document: DocumentSnapshotRef;
  termId: Id;
};
```

Reuse the existing [DocumentSnapshotRef](../../packages/disclosureos-records/src/experimental/v2/context-schema.ts), including its exact-byte SHA-256 meaning. The complete tuple identifies the term. A label, short code or `termId` alone is not a global identity. `revision` is not the npm version or schema version.

- `catalogId` identifies the publisher's vocabulary over time.
- `revision` identifies one immutable publication of that vocabulary.
- `document` pins the exact artifact establishing its meaning.
- `termId` selects one entry within it.

Hash the retained UTF-8 bytes before parsing. Do not pretty-print, sort keys or normalize whitespace before hashing. A repackaged artifact has a new digest; an immutable catalog publication must retain its original bytes. Reject invalid UTF-8 and duplicate JSON object keys, including escaped-equivalent keys, rather than accepting parser-dependent meaning. Hashes establish byte identity, not authorship or scientific validity.

## Proposed catalog envelope

Proposed contract identity: `urn:disclosureos:experimental:vocabulary-catalog:0.1.0`. This identifier is reserved here for discussion; there is no schema export at that identity yet.

```ts
type VocabularyCatalog = {
  kind: "vocabulary_catalog";
  schemaVersion: "0.1.0";
  id: Id;
  catalogId: string;
  revision: Text;
  publishedBy: Text;
  publishedAt: Instant;
  terms: Array<{
    id: Id;
    label: Text;
    description: Text;
    code?: Text;
    category?: Text;
    extensions?: Record<string, JsonValue>;
  }>;
  extensions?: Record<string, JsonValue>;
};
```

`Instant` uses the current valid Gregorian UTC-offset timestamp rules, including seconds. There must be at least one term, with unique IDs. If short codes are supplied, they must also be unique within the catalog. Display labels need not be unique. `publishedBy` is declared attribution, not an authenticated identity. Namespace extension keys using the existing records extension rules; do not use them to override core fields.

The shared catalog supports identity and membership. The observables package owns a domain profile for scientific basis, proposed checks, methods, sources, limitations and editorial review status. Origins owns its hypothesis-specific metadata. All metadata is part of the pinned bytes. Unrecognized extensions are retained but their semantics remain unchecked; core membership success must not imply domain-profile approval. A supplied domain profile that fails its recognized validator fails that profile, while an unsupported or unavailable optional profile stays unchecked. Keep those results separate from core lookup. Domain implementations should expose their metadata through typed helpers rather than require portal-specific parsing.

The definition review's [candidate JSON](0007-vocabulary/observable-catalog-proposal.json) is an **editorial comparison artifact**, not an instance of this envelope. Its preserved originals and proposed replacements will inform a new catalog only after review. Do not wrap and relabel an old packet as though it had always used this new contract.

## Proposed companion bindings

Proposed contract identity: `urn:disclosureos:experimental:vocabulary-bindings:0.1.0`.

```ts
type VocabularyBindings = {
  kind: "vocabulary_bindings";
  schemaVersion: "0.1.0";
  id: Id;
  bindings: Array<{
    id: Id;
    recordedAt: Instant;
    assignedBy: Text;
    rationale: Text;
    claim: {
      document: DocumentSnapshotRef;
      claimId: Id;
    };
    relation: "about" | "assessment_criterion";
    term: VocabularyTermReference;
  }>;
};
```

Require at least one binding and unique binding IDs within the document. A target is one claim in one exact history snapshot, not a subject ID or a source locator. The subject remains in that claim. Source assertions retain their original source attribution; the person attaching a term does not become the speaker or evaluator. Direct tagging of arbitrary passages without a claim is outside this first companion: use an existing source assertion when preserving a reported characteristic, without fabricating an assessment.

The binding's `recordedAt` cannot precede the target claim's `recordedAt`. It may be later. It records when this association was declared, not when the observation occurred or when a method was performed. A curator may add an association to an old claim, but must not claim that their own wording came from the original source.

### Two relations with different authority

| Relation | Meaning | Permitted targets and limits |
| --- | --- | --- |
| `about` | The assigning person indexes this claim under this term. | Source assertion, unassessed or assessed claim. Any number of distinct terms and curators. No inference that a term applies or that the original assessor used this definition. |
| `assessment_criterion` | The assessor declares that this exact term definition is the criterion addressed by this assessment. | Assessed claim only. `assignedBy` must exactly equal its `evaluatedBy`. One distinct criterion per target claim across the supplied binding set. |

The stronger relation is needed to make assessments reproducible. A curator's `about` association cannot silently acquire that meaning. Matching attribution strings is only a documentary consistency check; neither relation authenticates a person or proves that a method was performed. A later criterion declaration remains visibly later. Consumers should call it the **declared criterion**, not a verified account of the original evaluation.

An assessment can be indexed under several terms but its single outcome must not be distributed across them. Separate independently assessed terms require separate claims. A deliberately compound criterion needs its own explicit catalog entry and method. `assessment_criterion` says what an existing result addresses; it neither changes the result nor supplies a missing result.

Historical observable support levels (`not_indicated`, `reported`, `documented`, `measured`, `confirmed`) are not added to this companion. They do not map automatically to V2 outcomes (`reported`, `confirmed`, `absent`, `inconclusive`), even where spellings match. Supporting a future domain-specific level declaration needs a separate compatibility decision.

## Resolution and validation

The schema package should orchestrate a pure local evaluator supplied with complete byte buffers for catalog and history documents, plus the binding document. Snapshot caller buffers before asynchronous work. Match by the full document reference, not by filename, array position or a caller's precomputed pass flag. No validator fetches a URI, chooses a newest revision, or supplies a default term.

1. Parse the binding document under its declared contract. Invalid structure stops dependent checks.
2. Resolve each exact referenced snapshot. Missing bytes produce `not_checked`. Supplied bytes with a mismatching digest fail, even if their parsed contents resemble the expected document.
3. Verify the document ID and dispatch to the parser for the exact schema identity. Validate the supplied history, its subject and references using that history's existing rules. Unsupported schema versions remain `not_checked`; recognized invalid documents fail. Never accept a version by structural similarity.
4. Verify the catalog's declared identity and revision against the reference, then resolve exact term membership. A missing term in a supplied valid catalog fails. A custom catalog uses the same rules without receiving institutional endorsement.
5. Validate attribution, binding chronology, relation cardinality and criterion continuity. Distinct curators' `about` associations remain distinct. Exact duplicate copies of a binding document are deduplicated by snapshot identity; they do not count as independent support. Conflicting criteria must fail, not be resolved by list order or timestamp.
6. Preserve the existing `checks` shape: `structural`, `semantic`, `profile` and `external`, with diagnostics and unresolved references. `external` remains `not_checked`. Scientific validity is outside this evaluator, not a new success field. Membership and criterion-declaration checks can pass while authenticity and scientific adequacy remain unchecked.

For the proposed reference-resolution profile: any applicable failed requirement means `failed`; otherwise any unresolved required input means `not_checked`; only all resolved and valid requirements mean `passed`. No aggregate "confirmed" status is produced. Missing bytes must never be presented as invalid data or a passed check. Preserve independent failures alongside unresolved diagnostics rather than hiding them under an overall unchecked result.

The initial implementation must cover observation histories `0.1.0` through `0.5.0` and case histories `0.1.0` that exist at the reviewed canonical commit. This is a source implementation target, not a statement that all are published on npm. A record, measurement, sample, entity/field or case relation retains exactly the subject allowed by its own declared version.

### Immutable revisions and claim histories

- Within supplied inputs, reject two artifacts declaring the same `(catalogId, revision)` with different document IDs, schema IDs or hashes. The evaluator cannot prove global uniqueness across absent artifacts. Publishers or registries must prohibit revision reuse and retain released bytes.
- Existing claim parsers still enforce kind, topic, subject, attribution and chronology along `supersedes` links. Add criterion continuity checks alongside them; do not change their old schemas.
- Criterion continuity applies to the assessed revision chains touched by a supplied `assessment_criterion` binding, including linked assessed predecessors and successors in the target history. An `about`-only document does not impose criterion requirements on unrelated assessments. Skip inapplicable continuity checks; they do not prevent reference-resolution success.
- For an assessed-to-assessed revision, the declared criterion must remain the same full `VocabularyTermReference`. If either declaration or its catalog is unavailable, criterion continuity is `not_checked`, not silently inherited. Different criteria fail the profile.
- References target an exact history snapshot. A binding pointing to a predecessor claim in an older snapshot does not automatically cover the copy of that claim in a newer snapshot. The first implementation requires an explicit binding for the claim in the newer snapshot, retaining its criterion; otherwise that required declaration remains unchecked. Do not infer cross-snapshot equivalence from matching IDs alone.
- An unassessed predecessor has no criterion declaration under this proposal. Its first assessed successor may declare one; there is no prior outcome to carry forward. Retain the predecessor and the normal claim revision checks.
- A changed definition, including a new catalog revision containing otherwise identical wording, requires a separate assessment with its own declared criterion. Explain a reassessment in its rationale and cite the earlier claim using existing supported input mechanisms where applicable. Do not overload `supersedes` to change the question being assessed.
- `about` bindings do not inherit or alter outcomes and do not silently migrate to new terms. This first format has no automatic merge or latest-binding selection. Indexing corrections are new retained companion snapshots, selected explicitly by the caller; previous snapshots remain available.
- Criterion declarations cannot use that indexing-correction path. Once a criterion has been declared for an exact claim, changing it requires a separate assessment. A caller must not hide an incompatible declaration to relabel the same result. The local evaluator rejects conflicts in supplied inputs; enforcing this restriction across separate submissions requires publisher/registry retention of previous declarations, just as catalog immutability does. Offline parsing cannot prove that undisclosed conflicting declarations do not exist.

## Worked example

The [illustrative catalog](0007-vocabulary/catalog.example.json) defines a neutral synthetic term, `radial_motion`. The [bindings](0007-vocabulary/bindings.example.json) point to the exact bytes of the existing [synthetic history](../../examples/v2/claim-history.json):

1. A curator indexes `statement-1` as `about` radial motion. The quoted source word "confirmed" stays source wording; it does not become an assessed outcome.
2. That curator indexes `review-2` under the same term. This alone does not establish the evaluator's intended criterion.
3. The synthetic evaluator separately declares `assessment_criterion` for `review-2`. Its existing outcome remains `inconclusive`, and its measurement subject and two inputs remain unchanged.

The source's statement and the evaluator's assessment can disagree without a conflict in the vocabulary reference. These files illustrate serialization and exact references; they are not executable conformance fixtures or a new public schema. The example's custom catalog is not part of the twelve-observable proposal and defines no anomaly threshold.

## Definition review and continuity

See [the twelve-definition review](0007-vocabulary/definition-review.md) and its [complete candidate wording](0007-vocabulary/observable-catalog-proposal.json). The review retains the existing definitions for comparison and proposes neutral characteristics with explicit observation opportunities, comparison conditions and limitations. It does not independently validate the original literature or certify disputed frameworks.

The critical changes are substantive. "Anti-gravity" asserts a mechanism; "non-terrestrial provenance" asserts an origin; an associated biological change does not establish causation. Removing those predicates changes which cases fit a term. New neutral concepts therefore receive proposed new IDs and codes, with explicit **non-equivalent** historical crosswalks. Old IDs, definitions and attributed assessments remain identifiable. A crosswalk is a discovery aid, not an alias or a license to transfer results. Pure spelling or presentation corrections can retain an ID in a new immutable publication only when meaning is unchanged.

Qualitative observations remain useful. The revised catalog should describe what can be reported or investigated, then identify the additional information needed to assess it. A term match does not by itself distinguish anomalous from conventional behavior. A claim of anomaly needs a declared comparison, method and limits; an origin explanation needs its own attributed claim. Testimony can support a reported characteristic without being converted into a measured result.

## Acceptance matrix for implementation

These are required fixtures for the next implementation checkpoint, not tests claimed to run in this documentation PR.

| Case | Required result |
| --- | --- |
| Observable, origin and authority-qualified custom catalogs | Same reference mechanics resolve; domain meanings and approval remain separate |
| Source statement indexed `about` a term | Resolves without creating an assessment or presence flag |
| Several `about` terms on one assessed claim | Retain all associations; never copy the outcome into separate term findings |
| Assessor declares one criterion | Resolves with original subject, method, sources and outcome unchanged |
| Curator attempts criterion with different `assignedBy` | Fails attribution check |
| Source assertion or unassessed claim used as criterion target | Fails relation eligibility |
| Two distinct criteria for the same exact claim | Fails; no last-writer selection |
| Binding recorded before its target claim | Fails chronology |
| Explicit absence; inconclusive review; omitted review; unassessed review | Four distinct states; vocabulary lookup changes none of them |
| Two independent evaluators, or two curators | Preserve separate attributions; no averaging, deduplication by term, or voting |
| Unknown term in valid supplied catalog | Fails membership |
| Wrong digest, document ID, schema identity, catalog identity or revision | Fails when contradicted by supplied recognized bytes; unsupported contracts remain unchecked |
| Missing history/catalog bytes | Dependent checks `not_checked`; do not infer absence |
| Duplicate term ID/code or duplicate JSON keys | Fails rather than accepting ambiguous lookup |
| Same catalog/revision with conflicting snapshots | Fails within supplied inputs |
| Historical catalog plus proposed non-equivalent successor | Both remain addressable; no automatic outcome/level migration |
| Assessed claim revision with identical criterion | Passes continuity if existing history rules pass |
| Assessed claim revision with changed criterion | Fails; new assessment required |
| Assessed claim revision with missing prior criterion | Continuity `not_checked`; no inferred inheritance |
| Predecessor binding points only to an older history snapshot | New snapshot's required declaration remains unchecked until explicitly bound |
| Only `about` associations, with unrelated generic assessments | No criterion continuity requirement; local reference checks can pass |
| Conflicting criterion hidden in a later submission | Retaining publisher/registry rejects it; local-only validator does not claim cross-submission detection |
| Unassessed to assessed revision | First criterion permitted, without inventing an earlier outcome |
| New definition reviewed in an independent new claim | Permitted; older claim stays tied to its original definition |
| Domain metadata, unsupported domain profile or external authorship | Preserve exact bytes; scientific/authenticity checks remain unchecked |
| Caller buffers mutate during asynchronous validation | Evaluation uses retained snapshots, not a mix of old and new bytes |
| Every supported subject/history version | Resolve the claim in that version without widening its subject |

## Implementation order after design review

1. Implement shared reference/catalog/binding types, strict JSON Schemas and semantic checks in the canonical packages. Records owns claim and snapshot mechanics; schema orchestrates exact-byte resolution; observables and origins own domain catalogs. Keep existing entry points unchanged.
2. Deliver the matrix above through runtime, emitted JSON Schema and local evaluator tests, with a small developer example. Include official observable/origin and custom catalogs so one domain does not become special-cased.
3. Finalize the proposed definition wording and qualified source review before marking a new catalog stable. Publish a separately identified experimental catalog first if scientific review remains incomplete; no unsupported claims of review or consensus.
4. Consume that shared contract in the portal and showcase, replacing topic-string membership conventions. Add the same throughline to Origins before continuing its page. Regenerate retained packets deliberately with exact historic references, then run the existing integrity/loader checks.
5. Include the packages in the coordinated V2 release after the remaining agreed work. Do not publish incrementally for this checkpoint.

The important design choice is agreed before another page depends on it. Full scientific review need not block implementation of reference mechanics, but it must block treating draft definitions or scientific thresholds as settled.
