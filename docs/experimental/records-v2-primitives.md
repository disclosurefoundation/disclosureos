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
- Time values distinguish year, month, calendar date, and offset-bearing instant. The initial supported domain is Gregorian years 0001–9999 and UTC instants, preserving their original offsets and fractional strings. Other time scales, leap-second notation, and interval-valued estimates need later contracts; do not coerce them into this format.
- Positions currently support WGS84 latitude/longitude. Real zeros and signed coordinates remain valid. Other datums, altitude/frame metadata, and quantitative uncertainty are future primitives rather than inferred defaults.
- Source-value assertions preserve alternative estimates, source locators, optional SHA-256 declarations, source author identity, and extracting-system identity separately. Missing author identity stays missing. No assertion is selected, averaged, assigned confidence, or promoted to a supported assessment by this parser.
- All object boundaries are strict. Source text and timestamp strings are not trimmed or normalized.

The `PrimitiveRecord` container exercises these building blocks. It is **not** the complete v2 Observation, a migration output contract, or a public projection API. In particular, callers must not assume that marking a field redacted removes restricted information from other assertions in their record. A policy-aware public projection remains separate work.

## Validation result

`success` means structural and local-provenance checks passed. It does not mean external references or digests were verified, nor that a research profile passed. `uncheckedRefs` explicitly lists external source/product references; validation makes no network requests. On structural failure, local and external reference traversal is not performed.

Issues identify a stable code, structural/semantic stage, JSON Pointer, and message. Local assertion IDs must be unique; assertion references must exist and concern the same field. Time-range locators must end at or after their start. The parser does not decide whether a cited assertion actually supports a selected value or whether a claimed digest matches any bytes.

The committed schema is available through `@disclosureos/records/experimental/v2/schema`, with a separate experimental URN. It specifies structural validation only. `primitivesJsonSchema()` emits plain JSON from within records; downstream packages must not compose Zod instances across package boundaries. Local-reference and interval-order checks are semantic and intentionally remain outside JSON Schema.

## Verification and remaining work

After building records, `pnpm emit:v2-primitives` explicitly regenerates the experimental artifact. Tests never regenerate it automatically.

`pnpm test:v2-primitives` validates synthetic fixtures with independent Ajv and the runtime, checks expected semantic results, checks emitter drift, and round-trips successful records. Records unit tests cover preservation and local-reference diagnostics. The legacy matrix remains unchanged.

These fixtures exercise important migration outcomes such as preserving `0,0` and `1900-01-01`; there is no v1-to-v2 migrator yet. Interval estimates, derived-value selection provenance, profile-controlled not-applicable fields, full claims/supersession, versioned source inventories, migration/quarantine reporting, and policy-aware public projection remain future work. Do not equate this primitive parser with completed WP03 or full v2 conformance.
