# Experimental measurement bindings

This unpublished v2 experiment connects each instrument-supported measurement to one acquisition-bound raw product, one captured channel, and an explicit measurement capture time. It builds on [acquisition bindings](acquisition-bindings.md), without changing that contract or the separate [assessment documentation](assessment-documentation.md) profile.

The contract is `urn:disclosureos:experimental:measurement-bindings:0.1.0`. The profile is `urn:disclosureos:experimental:profile:measurement-bindings`, version `0.1.0`, scope `single_channel_declared_capture`.

## Use

```ts
import { evaluateMeasurementBindings } from '@disclosureos/schema/experimental/v2';

const result = await evaluateMeasurementBindings(
  history, context, acquisitionBindings, measurementBindings, { assets },
);
```

`assets` uses the acquisition context namespace: `product:ID`, `manifest:ID`, `calibration:ID/report`, and `calibration:ID/review`. Supply complete local `Uint8Array` values. The evaluator never fetches URLs. Inputs and buffers are snapshotted before asynchronous hashing.

The mapping document identifies the history, observation, acquisition context, and acquisition binding document by their exact local IDs. Each entry declares `measurementRef`, `observationProductRef`, `channelId`, and `time`. References remain local to their named documents. IDs are declared links, not authenticated identities or content hashes.

The synthetic example is [`examples/v2/acquisition-binding-demo/measurements.json`](../../examples/v2/acquisition-binding-demo/measurements.json). Use it alongside that directory's history, context, bindings, and three asset files. These synthetic files demonstrate a reproducible contract check; they do not represent ELDÆON observations or validated measurements.

JSON Schema exports:

- `@disclosureos/schema/experimental/v2/measurements/schema`
- `@disclosureos/schema/experimental/v2/measurements/schema/0.1.0`

## Rules

- Every measurement with primary lineage reaching an instrument-data source needs a mapping. Primary lineage follows measurement sources, assertion provenance, and derived-product processing inputs. Uncertainty annotations, considered but unused assertions, and assessment claims cannot substitute for source lineage.
- A mapping requires a raw product already connected through the acquisition binding document. That product must occur in the measurement's primary lineage.
- One channel mapping per measurement is supported. Multiple instrument raw products in primary lineage are rejected by this profile. Multi-product fusion needs a future explicit contract.
- The channel must occur in both the pinned manifest and the acquisition's channel list. Quantity and unit strings must match exactly. Same-quantity reductions can retain their declared processing lineage, but the evaluator does not execute them. Unit conversions and changes of quantity are outside this profile.
- Measurement time is explicit and separate from observation event time. No time is inferred from the event, file metadata, sampling rate, or array position. Unknown times remain structurally valid but cannot pass this profile.
- Known times require valid Gregorian UTC instants with seconds and an explicit UTC offset. Calendar validity is a semantic check, not a JSON Schema format claim. Arbitrary fractional precision is preserved.
- Intervals are nonempty and half-open `[start, end)`. A measurement interval may equal its capture interval; a measurement instant at the capture end is outside. A point acquisition supports only that exact instant.
- The existing acquisition evaluator is run internally. It checks document links, context completeness, and actual local raw/manifest/calibration artifact bytes. Caller-supplied success flags are never accepted.

## Results and limits

`checks` separates structural, semantic, profile, and external status. Malformed structures skip dependent checks. A failed measurement semantic rule or an unmet measurement requirement produces a failed profile. The nested `acquisition` result is present when those local checks permit evaluation; its diagnostics and statuses are preserved. Upstream semantic failures leave the dependent profile unchecked. Missing bytes leave an otherwise eligible profile `not_checked`; corrupt bytes fail. No instrument-supported measurements produces `not_checked`, not a vacuous pass.

`scientific`, `clockUncertainty`, and `artifactContents` remain `not_checked`. Inherited external status remains `not_checked` even when all supplied hashes match, because external authenticity is not established. A successful profile verifies declared support and nominal time containment, not that a file actually contains the stated channel/value/time, that the quantity is physically correct, or that clock error bars fit within the capture. It does not approve calibration reviews, apply instrument response corrections, validate reference frames, or confer a confirmed assessment.

The documentary profile remains independent and must be evaluated separately where required. This change adds no scores, confidence defaults, migrations, browser workflows, or package release.

Next: define the instrument research eligibility criteria, including calibration adequacy, uncertainty-aware timing, processing reproducibility, and the required checks for an actual partner dataset.

## Conformance

`pnpm test:v2-measurements` runs the portable JSON fixture corpus plus boundary, lineage-bypass, byte-integrity, snapshot, and schema parity checks. Regenerate the experimental artifact with `pnpm emit:v2-measurements`; its checked-in identity is frozen for this contract version.

The separate [research prerequisites profile](research-prerequisites.md) now checks
purpose-specific calibration-use reviews and explicitly interpreted timing
intervals. It does not compute clock uncertainty or certify scientific eligibility.
