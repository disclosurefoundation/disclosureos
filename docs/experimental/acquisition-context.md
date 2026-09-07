# Experimental acquisition context

This instruments-owned contract describes the declared acquisition history of raw products: physical instrument identity, pinned manifest revisions, deployments, channel calibration, and clock context. It is a standalone metadata document, not a bulk telemetry format, scientific certification, or stable release. It implements the first instrument-history portion of RFC 0005 without changing existing records or instrument schema artifacts.

The [synthetic example](../../examples/v2/acquisition-context.json) exercises a background acquisition with pinned configuration and calibration. All identities, dates, quantities, artifact hashes, byte lengths, and reports are illustrative declarations. No corresponding manifest, calibration report, review, or raw-data bytes have been verified or published by this example.

```ts
import { readFileSync } from 'node:fs';
import { parseAcquisitionContext } from '@disclosureos/instruments/experimental/v2';

const input: unknown = JSON.parse(readFileSync('examples/v2/acquisition-context.json', 'utf8'));
const result = parseAcquisitionContext(input);
console.log(result.checks, result.issues, result.uncheckedArtifactPointers);
if (result.success) console.log(result.acquisitions);
```

## Document boundaries

`instruments` assigns document-local IDs to physical instances with known or explicitly unknown identity. Manufacturer/model and optional serial numbers are declarations, not authenticated identities. A local ID alone does not establish real-world uniqueness.

`manifests` contains explicit revision IDs, instrument references, version labels, publication timestamps, configuration declarations, channels, and an artifact descriptor. Artifact descriptors pin SHA-256, byte length, and media/native format; a URI is optional. An instrument/version pair must appear only once. Hardware and firmware can be unknown; channel sampling is either a positive declared rate or unknown. These fields describe the acquisition configuration, not verified hardware capabilities. Publication can occur after an acquisition; publication time is not automatically treated as configuration activation time.

`deployments` binds an instrument to a pinned or unresolved manifest, a known or unknown deployment window, and site description. This is deployment context, not a complete session/dataset release format. Moving instruments, station coordinates, and coordinate transforms require richer downstream context.

`acquisitions` describes an exact declared capture point or integration interval independently of deployment membership. It explicitly pins or leaves unresolved its manifest and deployment. Its channels each pin one calibration or retain unresolved history. Background, known control, candidate, other, and unknown classifications are allowed; none asserts anomalous behavior. Clock source, synchronization, resolution, and uncertainty are explicit known/unknown fields. Known timestamps use UTC offsets; native clock conversion and clock correction histories remain follow-up work.

`products` binds raw-product IDs and artifact descriptors to acquisitions. Products sharing an acquisition reference share that declared capture time. Products with different capture windows must reference different acquisitions, even in the same deployment. A deployment window or convenience session label cannot override capture times. Native data remain external. Derived products and processing remain in the records/dataset layer rather than being mislabeled as raw acquisitions.

## Pinned calibration context

Each calibration identifies an instrument, an exact manifest revision, and one channel. It preserves performed time, declared validity, method identity/version/description, report artifact, uncertainty, and separate review metadata. Method, report, performance time, validity, or uncertainty can be unknown. Expanded uncertainty requires a positive coverage factor; coverage probability is optional and is never inferred from that factor. Magnitudes are nonnegative and units must match the channel exactly; no unit conversion is inferred.

A pinned acquisition calibration must refer to the same instrument, exact manifest revision, and selected channel. Its performance time cannot be after acquisition start, including by a sub-millisecond fraction. A later calibration cannot backfill acquisition-time calibration merely because someone declares an earlier validity start. Its validity must cover the entire known capture interval or instant.

Unknown performance/validity or an unresolved calibration leaves the acquisition history incomplete; the archive still validates. Overlapping calibration records may coexist because every channel binding chooses an explicit ID. No resolver selects the newest, first, or apparently closest calibration. Duplicate channel bindings are rejected. A calibration from another configuration is not substituted automatically.

Review is separately declared as unreviewed, unknown, or reviewed with evaluator, timestamp, outcome, and report. A review cannot precede a known calibration performance time. An accepted review is not independently verified by this parser; a rejected or inconclusive review remains preserved. Neither changes the historical acquisition binding automatically. Future research profiles must decide how reviewed calibration supports eligibility.

## Time and containment

Deployment and calibration windows are half-open intervals, `[start, end)`, with strictly increasing endpoints. Acquisitions are either instants or positive-duration intervals. An acquisition interval ending exactly at a window's end is contained; an instant at that endpoint is outside. Zero-duration intervals must be represented as point samples, which do not prove any integration duration or multi-instrument simultaneity.

The instruments package owns its JSON/Zod shape and reuses the records package's plain `compareUtcInstants` API for offset normalization and exact fractional ordering. No Zod instance crosses package boundaries. That helper returns -1, 0, 1, or undefined for invalid/unresolvable input, and preserves fractional precision rather than rounding to milliseconds. The shared UTC lexical contract is checked against independent JSON Schema validation in the corpus.

Containment checks use declared nominal times. They do not infer synchronized clocks, propagate timing uncertainty into coverage bounds, or verify synchronization accuracy. Unknown timing stays visible rather than creating a date, duration, or simultaneous-acquisition claim. Research profiles must account for clock uncertainty and acquisition semantics separately.

## Validation results

Structural validation rejects unexpected keys and malformed values; namespaced JSON extensions are preserved. Semantic validation checks ID uniqueness, pinned reference resolution, instrument/revision/channel agreement, units, chronological order, and declared temporal containment. Required local targets must resolve; explicit unresolved bindings remain warnings, not silently repaired references.

Success returns the input without coercion or defaults and an acquisition-resolution list. `resolved` means the selected references and declared temporal relationships passed the implemented checks without explicit unknown context among identity, configuration, deployment site/window, sampling, clock fields, and calibration documentation. It does not mean every possible instrument fact is present or scientifically adequate. `incomplete` lists the unknown/unresolved JSON Pointers. Optional omitted serial numbers and known unreviewed/rejected review states are not silently rewritten.

Both `checks.profile` and `checks.external` remain `not_checked`. `uncheckedArtifactPointers` lists manifest, calibration/report, review, and raw-product artifact declarations whose contents have not been inspected. The parser never retrieves URLs, reads native bytes, verifies hashes/sizes, checks report contents, authenticates identities, or certifies calibration validity. On structural or semantic failure, it returns neither parsed data nor acquisition-resolution results.

| Rule family | Checked relationship |
| --- | --- |
| `REF.UNIQUE_ID`, `MANIFEST.AMBIGUOUS_VERSION` | IDs, per-revision channels, channel bindings, and instrument/version pairs are unambiguous |
| `REF.LOCAL_RESOLUTION`, `REF.INSTRUMENT_MISMATCH` | Pinned targets exist and belong to the declared instance |
| `MANIFEST.MISMATCH`, `CHANNEL.UNKNOWN`, `CALIBRATION.CHANNEL_MISMATCH` | Exact configuration and channel agree |
| `TIME.INSTANT`, `TIME.INTERVAL`, `TIME.OUTSIDE_DEPLOYMENT` | UTC resolution, interval shape, and deployment containment |
| `CALIBRATION.AFTER_ACQUISITION`, `CALIBRATION.OUTSIDE_VALIDITY`, `CALIBRATION.REVIEW_ORDER` | Performance, coverage, and review chronology |
| `UNIT.MISMATCH` | Declared calibration uncertainty unit matches the channel |
| `CONTEXT.UNKNOWN`, `CONTEXT.UNRESOLVED` | Archival gaps remain explicit without an invented resolution |

## Artifacts, verification, and next work

The schema ID is `urn:disclosureos:experimental:acquisition-context:0.1.0`, exported at `@disclosureos/instruments/experimental/v2/acquisition/schema` and the versioned `/schema/0.1.0` path. `pnpm emit:v2-acquisition` regenerates it after building instruments and records. `pnpm test:v2-acquisition` checks emitter drift, independent Ajv/runtime structural agreement, semantic cases, round trips, exact UTC boundaries, legacy non-resolution, and many explicit channel bindings.

This document declares frozen revisions but is not a storage system: it cannot detect edits to a revision in a different submission or prove that artifact contents match the manifest metadata. Storage and release tooling must enforce immutable revision IDs and pinned bytes across updates.

Next work connects this inventory to Observation raw products using verified identities/digests, then incorporates method-specific instrument requirements into the documentation/research profiles. Dataset releases, session inventories, native file adapters, byte verification, uncertainty-aware clock comparisons, calibration report review, CLI/browser integration, and independent reproduction remain outstanding. No package publication, partner import, migration, or scientific certification is included.

The [experimental acquisition bindings](acquisition-bindings.md) now connect this inventory to Observation raw products through explicit source/product mappings and supplied byte checks. Measurement/channel mapping and scientific eligibility remain subsequent work.
