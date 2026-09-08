# ELDÆON source mapping and partner handoff

The first partner mapper inventories a verified source export and identifies what
is needed to describe acquisitions. It produces a reviewable mapping report;
it does not create an Observation, acquisition context, session, or assessment.
This is repository tooling for the experimental partner pilot, not a published
package API or a general native-file importer.

## Keep the two public sources separate

The [downloadable sample](https://eldaeon.com/data/sample-dataset.json) declares a
July 1 export window. The [July 28 mission page](https://eldaeon.com/missions/2026-07-28/)
is a separate published analysis and states that its raw archive and technical
analysis are held separately. Its event times are presented as local time.
Neither source establishes membership in the other's sessions.

The sample is useful for developing field mappings and missingness diagnostics.
It is insufficient by itself for a reviewed, independently reproducible
acquisition exchange. The mission page provides additional context, not a native
file inventory. Request a representative native subset with its supporting
metadata before treating either as a research-ready dataset.

## Run the mapper

Use Node 22 and build the existing schema/CLI dependencies:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@disclosureos/cli...' build
node packages/disclosureos-cli/dist/index.js intake create /path/to/sample-dataset.json --out /path/to/new-receipt --json
pnpm map:eldaeon-intake /path/to/new-receipt/intake.json file-1
```

For a JSON file without pnpm's script banner, invoke Node directly and redirect
stdout to a new report path:

```sh
node scripts/partner/map-eldaeon-intake.mjs /path/to/new-receipt/intake.json file-1 > /path/to/new-report.json
```

The script reads local files only. It verifies the selected artifact's SHA-256
and byte length through `evaluateSourceIntake` before parsing the export. The
receipt must pass semantic checks. Other receipt artifacts are not loaded; their
unchecked status remains visible in `intakeValidation`. The report pins the
selected artifact and, in the CLI, the exact intake-manifest hash. Input receipts
and source files remain unchanged. Shell output redirection is controlled by the
caller; choose a new path to preserve existing reports.

Exit 0 means the report was generated, with `status: "needs_context"`. It is not
an eligibility result. Exit 2 returns a JSON error for unreadable, malformed,
corrupt, unsupported-envelope, or oversized input. Maximums: 8 MiB receipt,
32 MiB source export, 128 modality groups, 100,000 records, two million visited
JSON values, depth 32, and 20,000 distinct field paths per group. Input size is not
a bound on process memory. Final-component file symlinks and a symlinked `files`
directory are rejected; ancestor directories must be trusted.

## Read the report

- `declarations` retains parsed source metadata with JSON pointers and an explicit
  `source_declared` status. An empty `_missing` list is only a source declaration.
  It does not override the six unresolved acquisition requirements.
- `modalities` inventories every group's parsed records, source count and metadata.
  A count mismatch is reported rather than repaired. Unknown modality names remain
  visible. This envelope recognition does not authenticate an ELDÆON publisher.
- `fields` inventories all parsed record variants, including nulls, nested objects
  and arrays. `path` uses `null` as an array-index placeholder; string segments are
  literal object keys. `firstPointer` is a concrete RFC 6901 pointer into the pinned
  source. `occurrences` counts visited values, not distinct records; missing fields
  are not counted as null. Empty arrays remain visible without invented elements.
- `mapping` supplies tentative target categories, source-field meanings, unit
  hints and required clarification. These are not validated channels, standardized
  quantity identifiers, type validation or unit conversions. Unknown fields remain
  unmapped. A negative number is not rejected merely for being negative.
- `windowDiagnostic` reuses the existing partner audit: numeric timestamps are
  conditionally interpreted as Unix seconds; ISO timestamps use `Date.parse` and
  a 1 ms boundary tolerance. Only record-level `timestamp` fields are checked.
  Nested histories, integration windows and clock uncertainty are not evaluated.
  These inclusive export-window diagnostics do not define v2 half-open acquisitions.
- `contextNeeds` lists the missing information needed to proceed. Acquisition
  context and observations remain `not_created`; scientific eligibility and
  authorization remain `not_checked`.

The report is a parsed-JSON view, not a lossless replacement for the source.
JavaScript numeric precision and duplicate-key parsing rules apply; original
bytes and their hash remain authoritative. Nonfinite parsed values are rejected
rather than being serialized to null. Do not use report values to reconstruct the
source or as automatically accepted measurements.

## Mapping decisions

| Source feature | Treatment | Required clarification |
|---|---|---|
| `generatedAt`, export `window`, record timestamps | Retain distinct source declarations | Export creation versus acquisition time; epoch, time scale, start/center/end meaning, integration bounds |
| Compute `node` | Provenance label | Pseudonymous stable device IDs and channel-to-device mapping; one compute unit may host multiple instruments |
| Spectra, spectrograms, IQ-derived arrays | Retain in pinned source | Native samples, axes, reference levels, processing/window definitions and versions |
| RF average | Tentative power field | Averaging domain, reference impedance/power, detector mode and bandwidth |
| Radar track velocity and `raw.bistatic_velocity_mps` | Separate candidate fields | Geometry, path-rate/sign convention and transformation; no automatic equivalence |
| Radar range | Source-defined quantity pending review | Bistatic path-length convention and transmitter/receiver geometry; do not assume ordinary slant range |
| CO₂, equivalent CO₂ and eCO₂ | Separate candidate fields | Device output definitions, measurement versus estimator, calibration and estimator inputs |
| Count rates and muon totals | Preserve counts and duration labels | Channel relationships, thresholds, integration alignment, normalization and dead time |
| Provider confidence, category and ADS-B correlation | Unreviewed source assertions | Method and attribution; no automatic DisclosureOS score, confirmed observable or anomaly label |
| Coordinates | Preserve supplied precision | Datum, deidentification transforms and usable uncertainty; never reconstruct removed precision |

These decisions follow from the current acquisition and claim boundaries. The
mapper cannot resolve them from field names. Additional fields and native formats
should be added against documented partner examples, with synthetic regression
fixtures and reviewed semantics.

## Partner handoff checklist

For the first exchange, request one representative background or known-control
acquisition, plus a candidate only if the partner has explicitly labeled one.
Keep calibration and clock gaps visible if some materials are unavailable.

| Needed material | Minimum useful response | Unblocks |
|---|---|---|
| Native file inventory | Pseudonymous device/channel IDs, filenames, formats, hashes, byte lengths; distinguish native and derived products | Stable source and product bindings |
| Manifest and configuration | Exact manifest revisions, sensor/channel definitions, hardware/firmware configuration and deployment intervals | Instrument identity and manifest/deployment pins |
| Timing and session definitions | Timestamp epoch/time scale, timestamp event meaning, synchronization history and uncertainty, integration windows, explicit session/acquisition IDs | Capture boundaries and session membership |
| Calibration and uncertainty | Reports, methods, dates, validity, uncertainty model and units; describe absent or unreviewed material explicitly | Measurement interpretation and purpose-specific review |
| Processing and correlation | Source-to-derived lineage, algorithm/configuration versions, geometry, detector settings and correlation methods | Reproducible processing and attributed claims |
| Sharing terms and controls | Permitted uses, attribution, restrictions, deidentification notes, control/background labels | Appropriate distribution and evaluation scope |

This checklist is prepared for review; no partner message has been sent. An export
license declaration does not establish permissions for a separately supplied
native archive or biometric data.

## Verification checkpoint

The public sample snapshot recorded in the [intake guide](source-intake.md) was
mapped locally: 10 modality groups, 163 records and 168 distinct field paths across
groups. All source group counts matched. Under the audit's conditional timestamp
interpretation, 42 radar, 58 air-quality and one IQ-spectrum record were outside
the declared export window. These diagnostics identify clarification needs;
they do not establish invalid sensing or explain the discrepancy. Partner bytes
and generated reports remain outside the repository.

`pnpm test:partner-mapping` uses synthetic data to cover exact source pins,
concrete pointers, unknown/null fields, distinct radar and CO₂ meanings, incomplete
receipts, offline operation, input limits and deterministic CLI output. The
existing schema contracts and package versions are unchanged.

Next: obtain the representative native inventory and timing definitions, then add
one documented acquisition mapping with verified provenance. Full Python partner
conformance, scientific review, scoring, migration and application adoption remain
separate roadmap work.
