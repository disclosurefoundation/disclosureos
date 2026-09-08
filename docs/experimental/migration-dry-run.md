# WP09 checkpoint 1: legacy migration dry run

The experimental CLI prepares review candidates from one v1 observation or an array
of v1 observations. It does not import, publish, modify inputs or write output files.
Run the built CLI from this checkout; this command is not yet a published release.

```sh
node packages/disclosureos-cli/dist/index.js migrate dry-run legacy.json --id archive-a
# Save the complete report locally when ready to review its contents:
(umask 077; node packages/disclosureos-cli/dist/index.js migrate dry-run legacy.json --id archive-a --json > migration-review.json)
```

Choose a stable namespace identifying the source collection. Use the same namespace
on reruns; do not reuse it for unrelated collections. Identity is `legacy-` plus
SHA-256 of the JSON array `[namespace, originalId]`. Formatting, row order and record
revisions do not change that identity. Every repeated original ID in a batch is
quarantined, including identical copies. Cross-file identity conflicts and resumable
imports are later checkpoints, not implemented by this command.

## What the report preserves

- Exact original file bytes as base64, SHA-256 and byte length, once per report.
- Every input row, source JSON Pointer, original ID, legacy JSON and validation state.
  `format: disclosureos-v1-input` identifies the legacy family, not an invented
  original package version. Any original `schemaVersion` remains untouched.
- A deterministic experimental claim-history candidate for accepted rows, validated
  through the public v2 parser. It includes copied record timestamps/summary, a
  draft status and an exact-file source digest with unknown access. Claims are empty.
- A mapping entry for every parsed leaf, null or empty container. JSON Pointer keys
  are escaped. Every unmapped field explicitly requires review. Bounds failures
  quarantine the row with `mappingComplete: false` and `legacy.retainedIn: source.bytes`.
  The exact file bytes and row pointer retain its source without re-serializing an
  over-depth tree. Other rows are still processed.

Temporal and location fields remain in legacy data. The draft's unknown envelopes
mean that a supported v2 mapping is unavailable; they do not assert that the original
observer failed to record the values. Time scales, precision, frames and source
provenance need explicit mapping decisions. `0,0` and `1900-01-01` are retained
literally and require review, not automatically treated as missing or accepted as
precise measurements. Unversioned sensor references remain unresolved historical data.

Legacy origin claims, assessments and scores stay in the legacy section. No confidence
is filled in, no assessment is translated into a new claim, and no score is admitted
to a v2 ranking. Standalone score exports and non-v1 source formats need a later
explicit adapter; unsupported rows are retained and quarantined.

The report contains the full original input, including any private fields. Keep it
local; it is not a public projection. Parsed values follow JavaScript JSON semantics;
the exact bytes are authoritative for original number spelling, key duplication and
formatting. This dry run does not establish lossless parsed-value equivalence for
ambiguous JSON or authorize importing it. Review raw input before application.

## Accounting and exits

For a readable batch, `input = candidates + quarantined` and `migrated = 0`.
`candidate_requires_review` is not migration success or profile success. Exit 0 means
all rows produced review candidates; exit 1 means some rows were quarantined (the
complete report is still emitted). Exit 2 is a usage/read/JSON/batch failure, with no
migration report. JSON error output identifies the input stage.

Bounds: one regular file, 8 MiB, 1–10000 rows, 100000 nodes and depth 64 per row.
Final-component symlinks are rejected. No assets are fetched or dependencies executed.
The ordinary text view summarizes decisions; `--json` includes candidates and mappings.

## Remaining WP09 checkpoints

1. [Time and position review](migration-review.md) now supports explicit frame/precision
   decisions, declared review provenance and ambiguity rejection. Other field families,
   sensor revision resolution and separate legacy evaluation adapters remain open.
2. Separate candidate emission/application, stable import receipts, cross-batch
   idempotence, resumability, conflict handling and migrated/quarantined reconciliation.
3. Application read-path compatibility and rollback that retains imported v2 data.
4. Full breaking-change/profile guide and end-to-end migration fixtures before WP10
   consumer adoption. This bounded dry run does not close WP09.
