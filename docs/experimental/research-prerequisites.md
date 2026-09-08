# Experimental instrument research prerequisites

This profile checks a set of documented prerequisites for reviewing an instrument-supported assessment. It combines the [assessment documentation](assessment-documentation.md) and [measurement bindings](measurement-bindings.md) profiles with explicit calibration-use and timing reviews. It does not certify scientific eligibility.

Contract: `urn:disclosureos:experimental:instrument-research-review:0.1.0`.
Profile: `urn:disclosureos:experimental:profile:instrument-research-prerequisites`, version `0.1.0`, scope `reviewed_declared_inputs`.

## Why a separate review contract

A calibration declaration or an accepted calibration report does not establish that its uncertainty is suitable for every analysis. [NIST's traceability guidance](https://www.nist.gov/metrology/metrological-traceability) makes the distinction between traceability and fitness for purpose. This contract therefore requires a separate use review tied to a named, versioned purpose and the exact measurement and calibration pin.

The existing acquisition clock metadata supplies a magnitude and unit without specifying its statistical interpretation. It cannot safely become an absolute time bound automatically. [NIST's uncertainty reporting guidance](https://www.nist.gov/pml/nist-technical-note-1297/nist-tn-1297-7-reporting-uncertainty) distinguishes uncertainty statements and their coverage assumptions. Here, the supplied interval explicitly declares either `bound` or `coverage_interval`. This is an experimental design informed by those distinctions, not a claim of NIST certification or a complete metrology implementation.

## API

```ts
import { evaluateInstrumentResearchPrerequisites } from '@disclosureos/schema/experimental/v2';

const result = await evaluateInstrumentResearchPrerequisites(
  history, context, acquisitionBindings, measurementBindings, review,
  { observationAssets, contextAssets, reviewAssets },
);
```

All asset maps contain complete local `Uint8Array` values. Namespaces are separate:

| Map | Keys |
| --- | --- |
| `observationAssets` | Existing documentary keys such as `source:report`, `product:raw`, `product:summary` |
| `contextAssets` | Existing acquisition keys such as `product:captured-raw`, `manifest:r1`, `calibration:c1/report`, `calibration:c1/review` |
| `reviewAssets` | `measurement:ID/calibration-use` and `measurement:ID/timing` |

The evaluator snapshots documents and all three byte maps before asynchronous work. It runs the underlying profiles itself; it does not accept cached success flags. URLs are never fetched. Identical local IDs across namespaces do not identify the same artifact automatically.

The JSON Schema is exported at `@disclosureos/schema/experimental/v2/research/schema` and `/research/schema/0.1.0`. UTC calendar validity and ordering are semantic checks in addition to structural JSON Schema validation.

## Required declarations

The review identifies the history, observation, acquisition context, acquisition binding document, and measurement binding document by exact local IDs. `purpose` contains an ID, version, and description. Each mapped measurement needs exactly one entry:

- `measurementRef` identifies the mapped measurement.
- `calibrationRef` identifies the calibration actually pinned by the captured channel. A newer or unrelated calibration cannot substitute for that pin.
- `calibrationUse` is either explicitly unreviewed or a review with reviewer, UTC time, outcome, rationale, versioned method, and SHA-256/byte-length-pinned report. Passing requires acceptance. The underlying calibration review must also be accepted. The use review cannot predate the nominal measurement or the calibration review.
- `timing` may be explicitly unknown, or contain closed `lower` and `upper` UTC limits, assumptions, and a review with the same attribution and report requirements. `coverage_interval` additionally requires a coverage probability strictly between zero and one. `bound` forbids that probability field. No confidence or coverage is defaulted. The timing review cannot predate its upper limit.

The timing review is expected to document how the total interval was derived, including clock offset, synchronization, resolution, latency, sample integration, and relevant correlations. This evaluator checks the declaration and report bytes; it does not read the report, recompute an uncertainty budget, or verify those assumptions. No numerical conversion from the legacy clock magnitude is performed.

Every interval must enclose the full nominal measurement time and fit within capture, deployment, and calibration-validity windows. Those windows remain half-open. Because the reviewed interval is closed, its upper limit must be strictly before a window's end. Merely touching the end fails this conservative prerequisite. A point acquisition can contain only the same point. Arbitrary fractional timestamp precision and UTC offsets are preserved.

Unknown measurement uncertainty, unreviewed/rejected/inconclusive required reviews, unresolved windows, and missing per-measurement entries cannot pass. A complete use review does not override incomplete acquisition metadata. There must also be an applicable current assessment for the documentary profile; a packet with no applicable instrument measurements or current assessment does not pass vacuously.

## Result interpretation

`success` means the documented prerequisites pass. `review` identifies the review document and its named, versioned purpose. `documentation` and `measurements` retain the nested results, including their profile versions and limitations. `reviewAssets` records each report's expected and actual byte identity. `issues` and separate structural, semantic, profile, and external statuses explain failures.

Malformed documents skip dependent checks. Local semantic contradictions and missing required declarations fail the local profile. When nested structural or semantic checks fail, the dependent profile is unchecked. Missing local files or unavailable hashing leave an otherwise complete profile unchecked; corrupt files fail. External authenticity remains unchecked even when all hashes match.

These fields always remain `not_checked`:

- `scientificEligibility`: no scientific conclusion or research certification.
- `calibrationAdequacy`: an accepted purpose-specific review is declared, but its reasoning has not been verified.
- `timingModel`: no propagation or interpretation of the clock magnitude is inferred or executed.
- `reviewerAuthenticity`: a name is not proof of identity, competence, or independence.

There are no default tolerances, reviewer quorums, rankings, confidence scores, or anomaly promotions. A coverage interval fitting the windows is not a claim that every possible time fits. Existing experimental contracts and stable package versions are unchanged. Reviews use local document IDs; cryptographically pinned whole-packet input snapshots and independently reproduced calculations remain required future work before a stable research-eligibility claim.

## Reproduction and remaining work

[`examples/v2/research-prerequisites-demo`](../../examples/v2/research-prerequisites-demo) contains a complete synthetic packet and files grouped by asset namespace. Every reviewer, acceptance, purpose, and interval in that example is synthetic. It is neither ELDÆON data nor a real calibration review.

Run `pnpm test:v2-research` for the portable corpus, schema agreement, temporal boundaries, no-fetch behavior, mutation snapshots, and missing/corrupt-file regressions. `pnpm emit:v2-research` emits the versioned artifact.

Next, pin whole-packet input identity and method/environment metadata in a reproduction record, then exercise a reproducible synthetic calculation before native partner integration. Qualified review must settle purpose-specific tolerances, calibration applicability, timing propagation, reference-frame handling, and interpretation. This profile makes those required declarations inspectable without claiming that review has happened.

The [reproduction packet experiment](reproduction-packet.md) now freezes exact input
bytes and demonstrates a fixed synthetic calculation in TypeScript and Python.
This does not replace independent scientific review or a full Python validator.
