# Experimental records v2 value primitives

Implementation of the first bounded portion of RFC 0002 and source-value provenance from RFC 0003. Import explicitly from `@disclosureos/records/experimental/v2`. Existing records entry points and v1 JSON Schema remain unchanged. This entry point is under development for the coordinated v2 release and is not yet available in the published npm package.

```ts
import { parsePrimitiveRecord } from '@disclosureos/records/experimental/v2';

const result = parsePrimitiveRecord({
  id: 'synthetic-example',
  eventTime: { state: 'unknown', reason: 'not_recorded' },
  position: {
    state: 'known',
    value: { latitude: 0, longitude: 0, datum: 'WGS84' },
    sourceRefs: ['source:original'],
  },
});

if (result.success) {
  // Source values are preserved; no date or position was invented.
  console.log(result.data, result.uncheckedRefs);
}
```

## Implemented boundary

- Known and approximate envelopes require a typed value and at least one source reference. Approximate also requires an explicit precision description.
- Unknown reasons distinguish not recorded, not collected, and unavailable. Redacted requires a nonblank reason. Neither state can carry a value, sorting anchor, or other undeclared property.
- Time values distinguish year, month, calendar date, and offset-bearing instant. The initial supported domain is Gregorian years 0001–9999 and UTC instants, preserving their original offsets and fractional strings. Intervals preserve same-kind endpoints (year, month, date, or instant), including original offsets and fractional precision. They are bounded event-time estimates, not automatically acquisition durations. Mixed calendar precision is rejected instead of expanded into invented endpoints. Other time scales and leap-second notation need later contracts.
- Positions currently support WGS84 latitude/longitude. Real zeros and signed coordinates remain valid. Other datums, altitude/frame metadata, and quantitative uncertainty are future primitives rather than inferred defaults.
- Source-value assertions preserve alternative estimates, source locators, optional SHA-256 declarations, source author identity, and extracting-system identity separately. Missing author identity stays missing. The parser never automatically selects or averages assertions, assigns confidence, or promotes them to supported assessments. A supplied selection record is checked as described below.
- All object boundaries are strict. Source text and timestamp strings are not trimmed or normalized.

The `PrimitiveRecord` container exercises these building blocks. It is **not** the complete v2 Observation, a migration output contract, or a public projection API. In particular, callers must not assume that marking a field redacted removes restricted information from other assertions in their record. A policy-aware public projection remains separate work.

## Validation result

`success` means structural and local-provenance checks passed. It does not mean external references or digests were verified, nor that a research profile passed. `uncheckedRefs` explicitly lists external source/product references; validation makes no network requests. On structural failure, local and external reference traversal is not performed.

Issues identify a stable code, structural/semantic stage, JSON Pointer, and message. Local assertion IDs must be unique; assertion references must exist and concern the same field. Time-range locators must end at or after their start. A supplied selection must copy its cited source value exactly. The parser does not decide whether the method or source is scientifically adequate, or whether a claimed digest matches any bytes.

The current 0.2.0 schema is available through `@disclosureos/records/experimental/v2/schema` and `@disclosureos/records/experimental/v2/schema/0.2.0`, with a separate experimental URN. The merged 0.1.0 artifact remains byte-identical and is available through `@disclosureos/records/experimental/v2/schema/0.1.0`. These are schema artifact revisions, not npm package releases. It specifies structural validation only. `primitivesJsonSchema()` emits plain JSON from within records; downstream packages must not compose Zod instances across package boundaries. Local-reference and interval-order checks are semantic and intentionally remain outside JSON Schema.

## Interval ordering and explicit selection

An interval value has `kind: "interval"` and `start`/`end` point values. Endpoints must use the same kind; equal endpoints are valid. Calendar endpoints compare at their stated precision. Instants require explicit seconds and a UTC offset (including Z); minute-only strings are rejected consistently by runtime and JSON Schema. UTC instants compare after offset normalization, with fractional digits compared independently of JavaScript millisecond timestamps. Source strings are not rewritten. Interval order and matching precision are semantic checks and are not claimed by the structural JSON Schema alone.

A known/approximate field may contain a `selection` object:

```json
{
  "assertionRef": "assertion:a",
  "consideredAssertionRefs": ["assertion:a", "assertion:b"],
  "methodRef": "method:source-priority",
  "methodVersion": "1.0.0",
  "evaluatedBy": "person:curator",
  "evaluatedAt": "2026-09-07T12:00:00Z",
  "rationale": "Synthetic example: prefer the directly recorded value."
}
```

The selected assertion must resolve locally, concern the same field, appear in both considered inputs and field source references, and have exactly the selected field value. Every considered input must resolve to a same-field assertion, without duplicates. All competing assertions remain in the record, whether considered or not; the parser never deletes them. A method reference is listed in `uncheckedRefs` and is never fetched. Different textual representations of the same instant are not a verbatim selection; normalization/derivation needs its own future processing contract.

Selection is optional in this primitive container. Its absence must not be interpreted as an audited curator decision; profile requirements for curated values remain future work. Selection records are prohibited on unknown or redacted envelopes. This verifies the declared choice's internal consistency, not that the curator made a correct scientific judgment or actually performed the stated method.

## Verification and remaining work

After building records, `pnpm emit:v2-primitives` explicitly regenerates the experimental artifact. Tests never regenerate it automatically.

`pnpm test:v2-primitives` validates synthetic fixtures with independent Ajv and the runtime, checks expected semantic results, checks emitter drift, and round-trips successful records. Records unit tests cover preservation and local-reference diagnostics. The legacy matrix remains unchanged.

These fixtures exercise important migration outcomes such as preserving `0,0` and `1900-01-01`; there is no v1-to-v2 migrator yet. Derived-value processing provenance, profile-controlled not-applicable fields, full claims/supersession, versioned source inventories, migration/quarantine reporting, and policy-aware public projection remain future work. Do not equate this primitive parser with completed WP03 or full v2 conformance.


## Integrated Observation

The [experimental Observation contract](observation-contract.md) now assembles these values with uncertainty, reference frames, local inventories, selected source assertions, measurements, and processing history. It is a separate document schema and parser. This primitive container and its historical schema artifacts remain available; migration and public projection are still separate work.
