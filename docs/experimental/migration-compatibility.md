# WP09 closeout checkpoint 1: field dispositions and sensor revisions

For the current adoption sequence and compatibility limits, start with the
[developer migration guide](migration-guide.md). This page documents the individual
checkpoint contract; its historical next-step notes are not the current roadmap.


This read-only inventory makes the supported migration boundary explicit. It builds
on the original dry-run planner without changing its output, old review contracts,
export receipts, or completed stores.

```sh
disclosureos migrate compatibility legacy.json --id collection-name --json
disclosureos migrate compatibility legacy.json sensor-review.json --id collection-name --json
```

Every traversable source leaf receives one disposition. Empty containers count as
leaves. Quarantined rows remain represented; if traversal limits prevent an inventory,
`mappingComplete: false` and the retained source bytes expose that limitation.

| Fields | Supported treatment |
| --- | --- |
| ID, creation/update timestamps, summary | Existing dry-run mapping into draft candidates; IDs are namespaced hashes. |
| Time and position | Unresolved in this inventory. Existing `migrate review` supports explicit time/frame decisions; zero coordinates and historical dates are not erased. |
| Sensor references | Unresolved by default. Optional review can record an explicit acquisition/manifest pin as described below. |
| Sensor readings, timing, calibration booleans and related fields | Unresolved for measurement conversion. A revision pin alone does not supply units, frames, uncertainty, acquisition timing or measurement provenance. |
| Narrative, object/movement/environment and other descriptive domains | Retained without automatic conversion into v2 measurements or assertions. |
| Witnesses, testimony, documents, physical material and media | Retained without automatic v2 source/product/claim conversion. |
| Assessments, origin, investigation and legacy scores | Retained separately; no promotion into supported assessments or comparable v2 evaluations. The standalone score adapter is separate. |
| Publication status, schema version, identifiers, source metadata, extensions and private notes | Retained without conversion. No public projection is produced. |
| Any unrecognized field family | Unresolved, with original bytes retained. |

`retained_without_conversion` is an explicit compatibility boundary, not a claim that
the information is irrelevant or that a v2 mapping cannot be added later. `mapped`
reflects the base planner's proposed draft mapping, not an applied import. Counts
reconcile rows and field dispositions separately. Sensor-reference review has its own
counts; the field remains unresolved for full measurement conversion.

## Optional sensor revision review

`MigrationCompatibilitySchema` and its type/emitter are exported from
`@disclosureos/schema/experimental/v2`. JSON Schema is exported at
`@disclosureos/schema/experimental/v2/migration-compatibility/schema` and `/0.1.0`.

The review document has `kind: legacy_sensor_revision_review`, `schemaVersion: 0.1.0`,
matching `namespace`, the exact legacy `source` SHA-256/byte length, `reviewedBy`, and
an offset-qualified whole-second `reviewedAt`. It embeds `context` and `decisions`.

Every embedded artifact uses `{sha256, byteLength, bytes}`, where `bytes` is canonical
base64 of the exact file. The context must pass the existing acquisition-context
structural and semantic validator. Each decision supplies:

- `sourceId` and row-relative `sensorPointer`, such as `/sensorEvidence/sensors/0/sensorRef`;
- `legacyRef`, exactly matching the retained source string;
- `acquisitionRef`, naming a specific acquisition in the supplied context;
- `manifest`, containing the exact bytes pinned by that acquisition's manifest revision;
- `provenance`, containing a supplied association record, plus `provenanceLocator` and
  `rationale` explaining the reviewer's association;

The selected acquisition must explicitly pin a manifest. There is no search by name,
latest-version fallback, date-based guess or first-match selection. The context validator
checks reference uniqueness and instrument relationships. The CLI checks manifest and
provenance bytes against their pins, and the manifest against the context's digest and
length. Only the selected manifest and supplied association artifact receive these byte
checks. Calibration reports, raw products and other context artifacts remain unchecked.

A successful reference review is labeled `reviewed_revision_pin`, with
`associationSupport: reviewer_declared_not_verified`, `calibration: not_checked`, and
`measurementConversion: not_performed`. The reviewer's identity, evidence interpretation,
locator accuracy and actual instrument identity are not authenticated. A text declaration
is not automatically proof that the hardware was deployed or calibrated. This is an
explicit reviewed association with byte integrity, not scientific validation.

Invalid selected references or artifact conflicts leave the sensor unresolved with a
reason. Duplicate decisions, unknown source pointers, ambiguous/quarantined source IDs,
invalid context, or mismatched top-level pins reject the entire review. An omitted
sensor decision stays unresolved even if only one manifest is available.

## Preservation and limits

The report embeds original source bytes and, when supplied, exact review bytes. It
retains all inventory rows and reference outcomes. It does not modify candidates,
materialize an acquisition, write files, import records, or change the application read
path. Keep this report alongside the other private migration artifacts. Existing stores
and their receipt verification are unchanged; this supplementary report is not implicitly
incorporated into those receipts. Consumer integration must explicitly consume a reviewed
association if it later constructs acquisition bindings.

Limits: 8 MiB source / 10000 rows, 2 MiB review / 10000 decisions, JSON depth 64,
and the base planner's per-row traversal budget. Embedded files must be nonempty with
exact pins; base64 contributes to the total review size. No external file is fetched.
Final symlinks and nonregular input files are rejected. Reports contain private legacy
notes and supporting artifacts; this command is not a public-data exporter.

Exit 0 means the inventory has no unresolved fields/references or quarantined rows.
Exit 1 emits a usable report with remaining issues; it does not mean the report was lost.
Exit 2 rejects usage or the whole input/review. No application changes occur at any exit.

## Closeout sequence

The [developer compatibility guide](migration-guide.md) and
[end-to-end acceptance record](migration-closeout.md) complete the agreed bounded
WP09 closeout. Additional field conversions and native-file adapters should now be
driven by actual consumer or partner inputs as integration proceeds.
