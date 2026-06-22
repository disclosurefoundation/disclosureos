# @disclosureos/records — Known Deferred Items

These items were identified during the v1 quality review and are documented
here for future consideration. None are blockers for v1 publication.

---

## 1. LocationData as a God Object

`LocationData` has 30+ fields mixing ground, maritime, and airborne contexts
in a single flat interface. A discriminated union approach (e.g.,
`{ context: 'ground' | 'maritime' | 'airborne' }` with context-specific fields)
would be more precise but is a significant refactor. Acceptable for v1 given
the flexibility needs of historical data ingestion.

**When to address:** If consumers report confusion about which fields apply
in which context, or when building form UIs that need to show/hide fields
conditionally.

---

## 2. Query-layer geometry (`GeoBounds` / `GeoPolygon`)

`FuzzyDate`, `DateRange`, and `RelativeDate` are now wired into `TemporalData`
(no longer orphaned). `GeoBounds` and `GeoPolygon` remain exported on the `./geo`
subpath but are intentionally **not** composed into `Observation` — they are a
future query/filter-layer concern (bounding-box / region search), and growing
query logic inside `records` is explicitly out of scope.

**When to address:** When the query/filter layer is built; re-home these (and any
spatial predicates) there rather than expanding the records core.

---

## 3. Constants Exhaustiveness Checking

The constants arrays (e.g., `SOURCE_TYPES: readonly SourceType[]`) accept any
subset of their type union at compile time. If a new member is added to the
union type but not to the array, the compiler won't catch it.

**Recommended pattern for v2:**
```typescript
const SOURCE_TYPES = [
  'foia', 'official_report', // ...
] as const satisfies readonly SourceType[];
```

This requires TypeScript 4.9+ `satisfies` and ensures the array is both
readonly and exhaustive.

**When to address:** Next time a union type is extended and the corresponding
array is forgotten.

---

## 4. Branded `ISODateString` Type

All date fields are typed as plain `string`. A branded type alias would
provide compile-time clarity about expected format:

```typescript
type ISODateString = string & { readonly __brand: unique symbol };
```

This is non-breaking to add (existing `string` values pass through) but
would require factory functions or type assertions at boundaries.

**When to address:** When building data ingestion pipelines where date
format validation is a recurring source of bugs.

---

## 5. CrossReferences Not Composed Into Observation — RESOLVED (Phase 3)

`CrossReferences` (now at `@disclosureos/records/extensions/identifiers`)
attaches to `Observation` through the optional `identifiers` slot. The orphan
is closed; this item is retained only for historical context.

---

## 6. YAGNI cuts parked in Phase 3

The following were removed from the records schema during the slim-core pass.
They are recorded here so the rationale isn't lost if a real need surfaces:

- **`DigitalSignature` / PKI** (`publicKeyRef`, signature verification): PKI-based
  attestation is speculative for UAP records today. Authenticity is captured via
  `DigitalProvenance.hash` + `ThirdPartyVerification`. Re-add as a dedicated
  extension if a signing workflow is adopted.
- **`VerificationMethod: 'blockchain_anchor'`**: dropped from the enum — no
  consumer anchors media hashes on-chain. Re-add the literal if that changes.
- **`CaptureMetadata.cameraSettings`** (aperture/shutter/ISO/focalLength):
  fine-grained EXIF photography fields beyond what UAP triage needs. Device/model
  and GPS are retained. Re-add if forensic image analysis tooling requires it.
- **`GeoPoint`** (+ `createGeoPoint` / `formatGeoPoint` / `isValidGeoPoint`):
  redundant with `LocationData` coordinates. The qualitative `CoordinatePrecision`
  scale was folded onto `LocationData.coordinatePrecision`.

**When to address:** Only when a concrete consumer need appears — these are
deliberate omissions, not oversights.
