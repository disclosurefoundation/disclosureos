# Experimental acquisition bindings

This schema-owned bridge explicitly connects an Observation's instrument sources and raw products to an acquisition-context inventory. Its experimental profile checks cross-document declarations and local byte identity. Matching names alone never create a link, and a digest declaration alone never counts as verified bytes.

The API is `evaluateAcquisitionBindings(history, context, bindings, options)` from `@disclosureos/schema/experimental/v2`. Each document remains independently owned: records validates the claim history, instruments validates acquisition context, and schema owns only the binding document and cross-document orchestration. No Zod instance crosses package boundaries.

## Reproduce the synthetic packet

The [demo directory](../../examples/v2/acquisition-binding-demo) contains three JSON documents and three small synthetic artifacts. It deliberately maps Observation `product:raw` to context `product:captured-raw`, demonstrating that identity does not depend on matching labels. The instrument, calibration, and review declarations are synthetic; no real acquisition or calibration is claimed.

From the repository root after building packages:

```ts
import { readFileSync } from 'node:fs';
import { evaluateAcquisitionBindings } from '@disclosureos/schema/experimental/v2';

const root = 'examples/v2/acquisition-binding-demo';
const history: unknown = JSON.parse(readFileSync(`${root}/history.json`, 'utf8'));
const context: unknown = JSON.parse(readFileSync(`${root}/context.json`, 'utf8'));
const bindings: unknown = JSON.parse(readFileSync(`${root}/bindings.json`, 'utf8'));
const assets = new Map([
  ['product:captured-raw', new Uint8Array(readFileSync(`${root}/assets/product-captured-raw.txt`))],
  ['manifest:r1', new Uint8Array(readFileSync(`${root}/assets/manifest-r1.txt`))],
  ['calibration:c1/report', new Uint8Array(readFileSync(`${root}/assets/calibration-c1-report.txt`))],
]);
const result = await evaluateAcquisitionBindings(history, context, bindings, { assets });
console.log(result.checks, result.bindings, result.assets, result.issues);
```

Without supplied bytes, otherwise complete bindings return `not_checked`. The evaluator never fetches a URI. Supplied byte-length mismatches, empty files, or SHA-256 mismatches fail. The exact UTF-8 bytes matter; no normalization or reserialization is performed before hashing.

## Binding document and identity rules

The binding document has its own ID and pins the supplied `historyId`, `observationId`, and `contextId`. These IDs prevent accidental cross-document selection; they do not authenticate the documents or freeze their contents across submissions. Unexpected normative fields are rejected and namespaced JSON extensions are retained by the binding schema.

`sources` maps an Observation `sourceRef` to a context `instrumentRef`. The Observation source must be declared as `instrument_data`, the instrument must exist, and each source has only one mapping. Multiple source aliases may explicitly map to the same instrument; no vote or independence inference is made.

`products` maps `observationProductRef` to `contextProductRef`. Both must exist, and the Observation product must be raw. This initial profile requires one-to-one product mappings; aliases or containers needing many-to-one relationships require an explicit future contract. Derived products cannot be relabeled as raw acquisition products.

Every Observation raw product declaring an instrument-data source needs a binding, including inventory products that are not current assessment inputs. Each of its producing instrument-data sources needs an explicit source mapping to the instrument declared by the target acquisition. This is an inventory-wide binding check, not a filter for one claim's inputs. An instrument-free inventory returns `not_checked`, not a vacuous pass.

The Observation digest and context digest must agree. A missing Observation digest fails the profile without filling it from the context. Format and media-type strings must match exactly; no alias, conversion, or decoder is inferred. Observation products do not currently declare byte length, so supplied bytes are checked against the context artifact's declared length.

## Selected acquisition context and artifacts

The instruments parser first checks the entire acquisition-context document for structural and semantic contradictions. Each bound acquisition must then have `resolved` context under that parser's existing rules. Explicit unknown or unresolved history remains preservable but fails this selected binding profile as incomplete.

Required assets are scoped to the context inventory and keyed as follows:

| Key | Required bytes |
| --- | --- |
| `product:ID` | Bound raw product |
| `manifest:ID` | Its exact pinned manifest artifact |
| `calibration:ID/report` | Each selected calibration's declared report |
| `calibration:ID/review` | Its review report, when a review is declared |

Unknown calibration reports already make selected context incomplete. Known unreviewed or rejected review states remain historical declarations. Verifying report bytes does not approve the calibration or override a rejected review. Unused inventory artifacts need no supplied bytes, while invalid unused inventory declarations can still fail the instruments parser. Extra supplied assets are ignored by eligibility checks.

Shared artifact keys are verified once and referenced by each product-binding result. Inputs are parsed into snapshots and caller byte buffers are copied before asynchronous hashing. This bounded in-memory API hashes whole assets with Web Crypto SHA-256; it is not a streaming interface for large datasets. Hashing unavailability produces not-checked diagnostics and cannot become success.

## Stages and diagnostics

The result pins all three input schema/rule-set contracts and the profile `urn:disclosureos:experimental:profile:acquisition-bindings`, version `0.1.0`. Issues use `/history`, `/context`, or `/bindings` pointer prefixes. Invalid structure prevents dependent cross-document checks; invalid input semantics or contradictory mappings prevent profile/byte checks.

Missing required mappings, incomplete selected context, or missing digest declarations fail the profile. Otherwise missing bytes/hashing leave it not checked, and fully matching bytes pass. A partial binding report can pass while the aggregate fails because another required product is unbound. Asset checks report expected and actual lengths/digests when available; product reports identify the required asset keys.

`checks.external` fails on demonstrated byte-integrity failure and otherwise remains not checked, because external verification is broader than hashing. `scientific`, `identityAuthenticity`, and `artifactContents` always remain not checked. `success` means this selected binding profile passed, not that a claim or calibration is scientifically supported.

| Rule | Meaning |
| --- | --- |
| `BINDING.DOCUMENT_ID` | Binding names a different input document |
| `REF.LOCAL_RESOLUTION`, `REF.UNIQUE_ID` | Missing target or ambiguous mapping |
| `BINDING.SOURCE_KIND`, `BINDING.RAW_REQUIRED` | Ineligible source/product declaration for an instrument raw binding |
| `BINDING.SOURCE_IDENTITY` | Producer mapping disagrees with the selected acquisition instrument |
| `BINDING.DIGEST_MISMATCH`, `BINDING.FORMAT_MISMATCH` | Linked declarations contradict each other |
| `BINDING.PRODUCT_REQUIRED`, `BINDING.SOURCE_REQUIRED`, `BINDING.DIGEST_REQUIRED` | Required mapping or byte-identity declaration is absent |
| `BINDING.CONTEXT_INCOMPLETE`, `BINDING.NO_INSTRUMENT_PRODUCTS` | Incomplete selected history or nothing applicable to evaluate |
| `EXTERNAL.ASSET_UNAVAILABLE`, `EXTERNAL.HASH_UNAVAILABLE` | Verification is unavailable, not passed |
| `EXTERNAL.SIZE_MISMATCH`, `EXTERNAL.EMPTY_ASSET`, `EXTERNAL.DIGEST_MISMATCH` | Supplied artifact bytes fail verification |

## Limits and next work

The [assessment documentation profile](assessment-documentation.md) remains unchanged and independent. It checks assessment support; this bridge checks inventory product identity and selected context. Passing either one does not imply passing the other, and neither is a scientific research profile. The demo can pass both when their separate required assets are supplied.

Byte identity does not authenticate the physical instrument, prove that manifest/calibration metadata match the contents of those artifacts, or establish that a raw file originated from that instrument. This evaluator also does not map a measurement to an acquisition channel, compare Observation event time to capture time, propagate clock uncertainty, establish simultaneity, review calibration adequacy, decode native formats, or reproduce processing. Those require subsequent contracts, adapters, and scientific review. Storage must enforce immutable IDs and document revisions across submissions; this stateless function cannot detect a historical rewrite in another packet.

The binding artifact is `urn:disclosureos:experimental:acquisition-bindings:0.1.0`, exported at `@disclosureos/schema/experimental/v2/bindings/schema` and the versioned `/bindings/schema/0.1.0` path. Existing artifacts are unchanged. Run `pnpm emit:v2-bindings` after building schema and dependencies; `pnpm test:v2-bindings` checks independent structural validation of all three documents, byte verification, round-trip input preservation, shared hashing, and offline behavior.

Next work binds measurements to channels and capture context before tightening instrument research eligibility. Dataset release/session composition, native adapters, shared CLI/browser diagnostics, independent reproduction, and publication remain outstanding. This increment publishes no packages and imports no partner data.
