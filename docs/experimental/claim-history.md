# Experimental claim history

This records-owned contract implements the first part of RFC 0003: source statements, evaluator assessments, and explicit revision history. It is an additive review envelope containing an unchanged experimental Observation 0.1.0 snapshot and a `claims` array. It does not change v1, the primitive artifacts, or the Observation artifact. It is not published or stable.

The [synthetic example](../../examples/v2/claim-history.json) preserves a source calling motion “confirmed,” an unassessed review, and a later inconclusive assessment. All people, statements, methods, and values are illustrative. No partner data or executed scientific analysis is claimed.

```ts
import { readFileSync } from 'node:fs';
import { parseExperimentalClaimHistory } from '@disclosureos/records/experimental/v2';

const input: unknown = JSON.parse(readFileSync('claim-history.json', 'utf8'));
const result = parseExperimentalClaimHistory(input);
console.log(result.contract, result.checks, result.issues);
if (result.success) console.log(result.currentClaimRefs);
```

## Statement and assessment boundaries

Every claim has a document-scoped ID, a recording timestamp, a topic, and an explicit subject: the embedded observation or one of its measurements. `recordedAt` describes when this version entered the history, not when an event happened or a source originally spoke. A missing original speaker or extraction identity stays omitted in source provenance. Recording timestamps must be supplied by the caller, never inferred from event time.

A `source_assertion` contains source text and provenance identifying a declared source or product. Optional page, time-range, or JSON Pointer locators preserve a source passage reference. `attributedTo` identifies the original author, while `extractedBy` identifies the extractor. Neither becomes an assessment evaluator. Optional `reportedLevel` preserves the source's wording, including unfamiliar labels. It never grants eligibility or current confirmed status. The parser does not verify quotation fidelity.

An `assessment` is explicitly `unassessed` or `assessed`. Both contain a rationale and input references. Unassessed claims cannot carry an outcome, evaluator, or confidence as if evaluation had occurred. An assessed claim requires an evaluator, evaluation timestamp, and method/version matching the embedded inventory. Its declared outcome is `reported`, `confirmed`, `absent`, or `inconclusive`. These are attributed statements, not validator-certified conclusions. Assessed absence is distinct from unassessed.

Confidence is optional and, when supplied, must fall in [0,1]. Missing confidence stays omitted, never 1. No calibration or statistical interpretation of the evaluator's confidence is implied. Topic strings are descriptive and have no validated vocabulary membership in this increment. Origin interpretations, domain-specific propositions, and other assessment taxonomies remain separate follow-up contracts.

## Local references and support

Assessment inputs can reference another `claim`, or an embedded Observation `source`, `product`, value `assertion`, or `measurement`. The `claim:` namespace is separate from `assertion:`, which retains its earlier factual-value meaning. IDs cannot be duplicated within a claim history; input and supersession lists cannot repeat references. References must resolve locally. Declared method versions must match exactly.

An assessed claim can have an empty input list. This deliberately preserves an evaluator's unsupported statement without pretending it is eligible for research use. A parser pass for an outcome of `confirmed`, even with inputs, is only a structural and local semantic pass. `checks.profile` and `checks.external` are always `not_checked`. A sensor descriptor cannot be an input in this contract; an instrument-like source or product label likewise provides no scientific certification.

Source/product digests are compared only when both the statement and inventory declare them. The validator does not fetch URLs, read product bytes, verify digests, authenticate identities, inspect locators, or execute methods. `uncheckedRefs` lists underlying Observation source/product/method/frame declarations. Identity labels, source text, extension contents, and scientific meaning also remain unverified; this list is not an exhaustive verification checklist.

## Revision history and disagreement

Changing a claim creates a new ID and an explicit `supersedes` list. Every predecessor must remain in the document. Revisions retain the claim kind, topic, and subject; a source statement cannot be superseded into an assessment. An assessed predecessor can only be superseded by an assessed claim with the same evaluator label. A different evaluator records an independent assessment. This is an attribution consistency check, not proof of authorship or authorization.

A revision cannot have an earlier recording timestamp than its predecessor. An evaluation cannot occur after its own recording timestamp. Offset-equivalent instants and sub-millisecond precision are handled by the existing temporal rules. Equal timestamps are allowed; explicit links determine revision order. Source occurrence and extraction may precede or follow other historical evaluations, so no additional chronology is invented for arbitrary input relationships.

Claim inputs and supersession together must be acyclic. Iterative validation supports long histories without recursive graph traversal. Array order does not decide which revision wins. If two revisions supersede the same predecessor, both remain current until an explicit subsequent revision resolves that branch. Success returns `currentClaimRefs`, meaning only “not superseded in this document,” including source statements and unassessed claims. It does not mean accepted, eligible, true, or independently supported.

The parser preserves all claims and input references and computes no score, vote count, or confidence aggregate. Shared inputs are visible, but semantic deduplication and dependence-aware evaluation remain WP08 work. Storage must enforce append-only history across submissions: this stateless parser cannot detect omitted history from a previous document, an ID reused with altered content in another submission, or forged timestamps. A document-scoped history is not a cryptographically verified revision log.

## Validation and artifacts

`parseExperimentalClaimHistory` returns `success`, staged `checks`, stable diagnostic codes and JSON Pointers, `uncheckedRefs`, and a `contract` identifying the document schema and rule-set version. Structural failure skips semantics. Embedded Observation semantic diagnostics retain an `/observation` prefix. Semantic failure returns neither parsed data nor a current-claim list. Successful parsing preserves the supplied values and extensions without defaults or coercion.

The standalone artifact is `urn:disclosureos:experimental:claim-history:0.1.0`, exported at `@disclosureos/records/experimental/v2/claims/schema` and `/claims/schema/0.1.0`. It embeds the structural Observation contract for standalone validation. Run `pnpm emit:v2-claims` after building records to regenerate it. `pnpm test:v2-claims` runs the portable corpus through runtime and independent Ajv validation, checks artifact drift and round trips, and exercises a 3,000-revision chain, branched history, and offline behavior.

New semantic rules are `CLAIM.SUPERSESSION_SCOPE`, `CLAIM.REVISION_ORDER`, `CLAIM.REVISION_ATTRIBUTION`, `CLAIM.DEPENDENCY_CYCLE`, and `CLAIM.EVALUATION_ORDER`; existing reference, temporal, digest, and method codes are reused. Core objects reject unknown fields. Namespaced extensions remain arbitrary JSON and are not a safe place to assume automatic redaction.

## Remaining work

This completes the first claim-history increment, not WP04. Research profiles must still define documentary support and sensor-derived lineage requirements; qualified review must establish scientific adequacy. Vocabulary pinning, shared CLI/browser orchestration, score redesign, public projection, migration/quarantine, dataset/instrument history, and independent Python validation remain planned. The envelope is not a public projection: restricted source values, assertions, provenance, text, and extensions require a separate publication policy. No package release or application adoption is included.

An optional schema-owned [assessment documentation profile](assessment-documentation.md) now checks declared support and caller-supplied byte integrity. The records parser itself remains unchanged and still reports profile and external checks as not checked.

The scoring-owned [assessment summary](assessment-summary.md) now implements
current-declaration deduplication and shared-support diagnostics. It does not
upgrade the parser's scientific or profile checks.
