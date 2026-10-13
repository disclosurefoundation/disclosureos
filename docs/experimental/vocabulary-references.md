# Shared vocabulary references, experimental 0.1.0

This implemented V2 source-candidate contract identifies a term without replacing the claim's subject or supporting inputs. It supports observable characteristics, origin hypotheses and custom catalogs. It is not published to npm yet.

## Public APIs

Import `VocabularyCatalogSchema`, `VocabularyCatalogTermSchema`, `VocabularyTermReferenceSchema`, `VocabularyBindingSchema`, `VocabularyBindingsSchema`, `parseVocabularyCatalog` and `parseVocabularyBindings` from `@disclosureos/records/experimental/v2`. The same exports are available through `@disclosureos/schema/experimental/v2`, together with `evaluateVocabularyBindings` and `VOCABULARY_BINDINGS_PROFILE`.

Types include `VocabularyCatalog`, `VocabularyCatalogTerm`, `VocabularyTermReference`, `VocabularyBinding`, `VocabularyBindings`, `VocabularyBindingOptions` and `VocabularyBindingResult`. The last two belong to the schema evaluator entry point.

Both packages expose JSON Schemas at:

- `experimental/v2/vocabulary-catalog/schema/0.1.0`
- `experimental/v2/vocabulary-term-reference/schema/0.1.0`
- `experimental/v2/vocabulary-bindings/schema/0.1.0`

The corresponding emitters are `vocabularyCatalogJsonSchema`, `vocabularyTermReferenceJsonSchema` and `vocabularyBindingsJsonSchema`. Plain JSON Schemas validate structure. Parsers also check local semantics such as unique term IDs and valid dates; the evaluator checks exact document resolution and relationships.

## Create and retain a catalog

```ts
import { createHash } from "node:crypto";
import { createObservableCatalog } from "@disclosureos/observables";
import {
  parseVocabularyCatalog,
  VOCABULARY_CATALOG_SCHEMA_ID,
} from "@disclosureos/records/experimental/v2";

const catalog = createObservableCatalog({
  id: "disclosureos-characteristics-2026-10",
  revision: "2026-10-13.1",
  publishedBy: "DisclosureOS",
  publishedAt: "2026-10-13T12:00:00Z",
});
const parsed = parseVocabularyCatalog(catalog);
if (!parsed.success) throw new Error("Invalid catalog");

// Retain these bytes. Do not serialize them again when resolving the reference.
const catalogBytes = new TextEncoder().encode(JSON.stringify(catalog, null, 2) + "\n");
const sha256 = createHash("sha256").update(catalogBytes).digest("hex");
const term = {
  catalogId: catalog.catalogId,
  revision: catalog.revision,
  document: { documentId: catalog.id, schemaId: VOCABULARY_CATALOG_SCHEMA_ID, sha256 },
  termId: "apparent_hover",
};
```

Use `createOriginCatalog` from `@disclosureos/origins` for the OCS hypothesis catalog. Both builders take `id`, `revision`, `publishedBy` and `publishedAt`. Custom catalogs use the same strict envelope with their own authority-qualified `urn:` or `https:` catalog ID.

Catalog IDs and revisions are exact strings. Revisions are immutable publication identifiers; `latest` is rejected. Term IDs and supplied short codes are unique within the catalog. Namespaced JSON extensions retain domain metadata. `readObservableTermDefinition` and `readOriginTermDefinition` validate and return their respective package-owned metadata, or return `undefined` when it is unavailable or malformed.

Creating a catalog does not publish it, establish who authored it or validate its scientific content. Retain the original bytes and use a new revision for later changed content. The direct V2 definition update requires no aliases or migration layer.

## Attach a term to a claim

A `vocabulary_bindings` document contains a nonempty `bindings` array. Each binding has:

```ts
{
  id: "hover-criterion",
  recordedAt: "2026-10-13T13:00:00Z",
  assignedBy: "person:reviewer",
  rationale: "This assessment addresses the stated apparent-hover definition.",
  claim: {
    document: historySnapshot, // documentId, exact schemaId and SHA-256
    claimId: "hover-review"
  },
  relation: "assessment_criterion",
  term
}
```

`about` is an attributed indexing association. It can target a source assertion, unassessed claim or assessed claim and does not imply that a characteristic occurred. `assessment_criterion` declares which exact term an assessed claim addresses. It requires `status: "assessed"` and exact agreement between binding `assignedBy` and claim `evaluatedBy`.

Keep the subject, input references, method, outcome and evaluation attribution in the history. One exact claim can have several `about` associations but only one distinct declared criterion across selected companions. Independent assessments of several terms need separate claims. A binding cannot predate its target claim's recorded time.

## Resolve locally

```ts
import { evaluateVocabularyBindings } from "@disclosureos/schema/experimental/v2";

const result = await evaluateVocabularyBindings(bindings, {
  documents: new Map([
    [term.document.sha256, catalogBytes],
    [historySnapshot.sha256, historyBytes],
    // Include exact context, entity, case and other history dependencies if required.
  ]),
  additionalBindings: [], // Optional other selected companion documents.
});
```

The evaluator copies byte buffers before its first asynchronous operation. It supports observation histories `0.1.0`–`0.5.0` and case history `0.1.0`, using their declared parsers and existing subject/input dependency checks. It rejects invalid UTF-8 and duplicate JSON keys, including escaped-equivalent keys, and verifies SHA-256 before trusting document content. It never fetches catalog IDs or selects a latest revision.

Selected companions are objects. Identical IDs and parsed contents deduplicate; the same ID with different contents fails. Exact byte identity applies to catalog/history snapshots and their dependencies. Conflicting catalog revisions or criteria fail instead of being resolved by input order.

Assessed `supersedes` chains touched by a criterion binding must retain the same complete term reference. Missing declarations or unavailable catalog bytes leave continuity unchecked. A newly defined question needs a separate assessment. About-only associations do not add criteria to unrelated claims.

## Read the result

- `checks.structural` and `checks.semantic` describe the supplied companion documents.
- `checks.profile` describes required reference and relationship checks: `passed`, `failed` or `not_checked`. Any known failure takes precedence over unresolved inputs.
- `success` is true only when those three checks pass.
- `bindings` contains each association's references, relation, status and available `resolvedTerm`.
- `snapshots`, `unresolvedReferences` and `issues` explain what resolved and why other checks failed or remain unchecked.
- `checks.external`, `domainProfiles`, `scientificValidity` and `authenticity` remain `not_checked`.

Missing bytes and unsupported contracts remain unchecked. Supplied wrong digests, IDs, known contracts or members fail. A resolved catalog does not authenticate an author or establish an outcome. The core evaluator retains extensions without validating domain semantics. Local resolution also cannot detect conflicting declarations withheld from the supplied set; a publisher must enforce revision retention across submissions.

## Run the example and conformance suite

From the repository root:

```sh
pnpm --filter "@disclosureos/schema..." build
pnpm emit:v2-vocabulary
pnpm test:v2-vocabulary
pnpm example:vocabulary
```

The [runnable example](../../examples/v2/vocabulary-demo/run.mjs) resolves a custom catalog against source and assessment claims. The [conformance tests](../../conformance/vocabulary.test.mjs) also exercise the official observable and origin catalogs. [RFC 0007](../rfcs/0007-vocabulary-references.md) records the decision and its review boundaries; [the definition review](../rfcs/0007-vocabulary/definition-review.md) explains the direct twelve-term baseline.
