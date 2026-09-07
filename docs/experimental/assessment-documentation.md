# Experimental assessment documentation profile

The `assessment-documentation` profile is the first schema-owned eligibility preflight for claim histories. It checks declared support and the integrity of caller-supplied bytes. It is experimental and deliberately narrower than a scientific research profile. A pass means the documentary requirements below are satisfied, not that an event, interpretation, sensor label, quotation, or processing result is scientifically verified.

Use `evaluateAssessmentDocumentation` from `@disclosureos/schema/experimental/v2`. The profile ID is `urn:disclosureos:experimental:profile:assessment-documentation`, version `0.1.0`. Input remains the unchanged records-owned claim-history 0.1.0 contract. The schema package imports its public parser and types, never a cross-package Zod schema. Existing schema artifacts, v1 consumers, and package versions remain unchanged; this code has not been published.

## Reproduce the synthetic example

From the repository root after building packages:

```ts
import { readFileSync } from 'node:fs';
import { evaluateAssessmentDocumentation } from '@disclosureos/schema/experimental/v2';

const input: unknown = JSON.parse(readFileSync('examples/v2/assessment-documentation.json', 'utf8'));
const assets = new Map([
  ['source:report', new Uint8Array(readFileSync('examples/v2/documentation-assets/source-report.txt'))],
  ['product:raw', new Uint8Array(readFileSync('examples/v2/documentation-assets/product-raw.txt'))],
  ['product:summary', new Uint8Array(readFileSync('examples/v2/documentation-assets/product-summary.txt'))],
]);
const result = await evaluateAssessmentDocumentation(input, { assets });
console.log(result.checks, result.assessments, result.issues);
```

The [example](../../examples/v2/assessment-documentation.json) and tiny content files are entirely synthetic. The record declares a confirmed assessment to exercise that branch; no scientific conclusion or actual instrument acquisition is represented. The profile compares actual byte hashes, but does not reproduce the declared reduction or inspect the locator contents. Calling the same API without `assets` produces `not_checked` for otherwise complete documentation. It never fetches a URI.

## Profile rules

Only current evaluator assessments are evaluated. Superseded claims stay in the archive, and explicit assessment input links may still refer to them. Source statements do not become current assessments. No current assessments, or an unassessed current claim, yields `not_checked` rather than a vacuous pass. An unsupported confirmed claim remains structurally preservable by the records parser but fails this profile.

Every assessed outcome requires:

- Nonempty inputs that reach source content or data products. A descriptor alone is insufficient.
- A declared description for its method, any supporting assessed-claim methods, traversed processing methods, and measurement selection methods. Versions already resolve through records semantics.
- Passage locators for supporting source statements and factual value assertions. Direct documentary source inputs must be located through an assertion. Locators are checked for presence and the core's syntax/order rules, not against file contents.
- Pinned SHA-256 digests and nonempty local bytes for supporting products and documentary sources, including provenance targets. Complete bytes must match their declared digests. Raw instrument source declarations can identify acquisition provenance without being content files themselves; they never substitute for a raw product.

For a declared `confirmed` outcome, the profile additionally requires:

- A supplied known or approximate event time.
- A measurement input. For a measurement-subject assessment, it must be the named measurement; for an observation subject, at least one measurement must be in the support graph. A quoted “confirmed” statement or product descriptor alone cannot satisfy this rule.
- Supplied quantitative uncertainty for every relevant measurement. No numerical threshold or confidence default is introduced.
- Primary measurement lineage reaching a raw product whose source declares `instrument_data`, with a factual value assertion locating the value in a supporting product. Source-kind labels remain unverified declarations. Uncertainty annotations and supersession links cannot establish primary instrument lineage.
- A non-unknown definition when a measurement frame is declared. The generic profile cannot infer which quantities require a frame; domain-specific requirements remain future work.
- Digest and byte verification of relevant measurement uncertainty references, as supplementary provenance. These references do not establish primary measurement lineage.

These are conservative documentation requirements for the experimental outcome labels, not validated scientific tier criteria. A successful metadata path cannot establish whether a file is genuinely instrument-derived, whether a measurement is physically correct, or whether conventional explanations were excluded. `reported`, `absent`, and `inconclusive` use the general documentary requirements; this does not certify an absence claim's scientific methodology.

## Diagnostics and stages

The result pins the input schema/rule-set contract and profile identity, and returns an assessment report with referenced sources/products/measurements, byte checks, and stable diagnostics. It does not return or modify the input document, add confidence, count votes, or compute a score. Shared content is hashed once per evaluation; each independent assessment retains its own result.

| Rule | Meaning |
| --- | --- |
| `PROFILE.NO_ASSESSMENTS`, `PROFILE.UNASSESSED` | No current completed assessment to evaluate; not checked |
| `PROFILE.INPUTS_REQUIRED` | Missing content support or descriptor-only input |
| `PROFILE.METHOD_CONTEXT` | Referenced method lacks its declared description |
| `PROFILE.LOCATOR_REQUIRED` | Missing passage or measurement-product locator |
| `PROFILE.DIGEST_REQUIRED` | Required content is not pinned by a digest |
| `PROFILE.MEASUREMENT_REQUIRED` | Confirmed declaration lacks the required measurement input |
| `PROFILE.MEASUREMENT_UNCERTAINTY` | Relevant quantitative uncertainty is unknown |
| `PROFILE.INSTRUMENT_PRODUCT_REQUIRED` | Primary measurement lineage lacks a declared raw instrument product |
| `PROFILE.EVENT_TIME`, `PROFILE.FRAME_CONTEXT` | Required temporal or declared frame context is unknown |
| `EXTERNAL.ASSET_UNAVAILABLE`, `EXTERNAL.HASH_UNAVAILABLE` | Required bytes or hashing capability are unavailable; not checked |
| `EXTERNAL.DIGEST_MISMATCH`, `EXTERNAL.EMPTY_ASSET` | Supplied content fails the integrity/support check |

Invalid structure or semantics prevents profile execution. For a valid claim history, any documentary error or byte failure makes the profile fail; otherwise missing verification makes it not checked; otherwise it passes. An unassessed current claim keeps the aggregate not checked even if another claim passes. Individual assessment results remain available.

`checks.external` is failed when a checked asset fails and otherwise remains not checked, since this API does not complete external verification. Individual asset checks distinguish passed, failed, and not checked, including expected and actual SHA-256 digests when available. `scientific`, `locatorContents`, and `methodExecution` always remain not checked. `success` means this selected documentary profile passed, not universal conformance. Structural/semantic issues retain the records parser's codes and pointers.

Bytes are caller-provided, copied before asynchronous work, and hashed with Web Crypto SHA-256. Hashing errors cannot become success. Results contain no raw byte payloads. This initial in-memory API is intended for bounded local samples: it copies the supplied asset map and hashes whole assets, and is not a bulk-file streaming interface. Source authenticity, privacy/public projection, content-format decoding, calibration applicability, units/frames beyond local declarations, vocabulary membership, reproducible processing, and scientific adequacy require further checks. Extra unused supplied assets do not affect eligibility.

## Verification and next work

`pnpm test:v2-documentation` executes the portable fixture corpus, reproduces the synthetic files, verifies input and byte snapshot isolation, checks hashes independently with Node crypto, tests shared-content hashing, prevents implicit network retrieval, and exercises long processing histories. The existing records corpus remains the independent structural-conformance authority; this profile adds no new input JSON Schema.

This is a WP04/WP06 bridge, not completion of the supported research profile. The next work is method-specific eligibility and instrument/session/calibration context, followed by shared CLI/browser presentation and scientific review. Future profile behavior must use a new version. Publishing packages, deploying the Index, importing partner data, and certifying research conclusions are outside this increment.

The [experimental acquisition context](acquisition-context.md) now supplies a separate instrument-history inventory. This profile does not yet consume it or upgrade its declared source-kind check to verified instrument/calibration eligibility.
