# WP09 checkpoint 8: standalone historical score preservation

`migrate legacy-scores` handles historical score files stored separately from observation
records. It preserves exact source bytes, original values, declared methodology versions
and observation associations. It does not recalculate scores, turn them into v2 claims
or profile evaluations, modify local application stores, or import Index data.

```sh
node examples/v2/migration-legacy-scores-demo.mjs /tmp/new-synthetic-scores
node packages/disclosureos-cli/dist/index.js migrate legacy-scores \
  /tmp/new-synthetic-scores/scores.json /tmp/new-synthetic-scores/plan.json --json
```

The fixture and its reviewer declarations are synthetic. The demo creates a new private
directory; the adapter itself writes only to stdout. Capture reports privately because
they include original score data and attribution. The command is experimental and has
not yet been published as a package release.

## Explicit declarations

The source is one complete historical score object, or a nonempty array of such rows.
A separate `legacy_score_preservation_plan` contains:

- `schemaVersion: 0.1.0`, the observation migration `namespace`, and the exact source
  SHA-256/byte-length pin.
- Supplied `reviewedBy` and `reviewedAt` declarations. The timestamp needs an offset and
  whole-second precision. These fields do not authenticate the reviewer or review time.
- Decisions with `sourcePointer`, `sourceId`, `resultKind`, `outputContractVersion`,
  `methodologyVersion` and `rationale`.

A pointer names the entire input row: `""` for a single object, or `/0`, `/1`, etc. for
an array. Nested/wrapper formats need a separate adapter or an explicitly prepared
source copy with its own pin; no field is guessed or silently extracted. Each row can
have at most one decision. Multiple rows for the same observation remain distinct
historical outputs and are never averaged, deduplicated or ranked.

`sourceId` is the original observation ID. Together with `namespace`, it produces the
same deterministic `legacy-...` identity used by the record migration. This is a
**declared association**, not verification that an observation exists or that the score
was calculated from it. No observation file is loaded. Preserve the original export
and supporting association records outside this adapter as appropriate.

The public `MigrationLegacyScoresSchema`, type and JSON Schema exports validate the
plan structure. Unknown row pointers, duplicate decisions, pin mismatches and invalid
plan structure reject the entire operation before producing a migration report.

## Supported historical contracts

| Result kind | Output contract | Methodology treatment |
| --- | --- | --- |
| `completeness` | `@disclosureos/scoring` output schema `2.0.0`, `CompletenessResult` | Explicit reviewer-supplied version required because this output has no embedded version. |
| `compellingness` | `@disclosureos/scoring` output schema `2.0.0`, `ScoreResult` | Explicit version must exactly match the stored `scoringVersion`. |

The scoring output schema's `2.0.0` is a historical package contract, not the new
experimental v2 evaluation framework. The adapter checks the owning package's result
shape. It does not replay the original methodology, check arithmetic, prove parameter
provenance, or certify scientific validity. Additional fields are retained unchanged
but are not validated by these result shapes. Original zero values, ranges, weights,
missing-field lists and annotations remain intact. Parsed/stripped values never replace
the original JSON data.

An unsupported output contract, malformed result or conflicting embedded methodology
version quarantines that row while preserving its original data. Missing declarations
leave a row pending. Do not invent a methodology version to clear a pending row. A
contract update requires an explicit adapter change rather than silently adopting a
future installed result shape.

## Report and consumer boundary

The report pins and embeds exact source and plan bytes, retains every input row, and
reconciles `input = preservedHistorical + pendingReview + quarantined`. Every preserved
output carries its original value, declared versions and association, a deterministic
revision ID pinned to source/row/plan, and these explicit limits:

- `validation: historical_output_shape_only`
- `calculation: not_recomputed`
- `scientificValidity: not_checked`
- `comparableToV2: false`
- `rankingEligibility: excluded`

`v2Evaluations` and `indexImported` remain zero. This is historical preservation, not
conversion or scoring. A consumer must keep these outputs in a separate historical
view and honor the exclusion metadata; the CLI cannot enforce a downstream ranking
implementation. Matching output versions alone do not establish comparability even
between historical scores because inputs and options may differ.

## Exits and limits

Exit 0 means every row has a shape-valid preserved historical output. Exit 1 means
pending or quarantined rows remain in the report. Exit 2 covers input/usage errors,
including an invalid entire plan. No partial report is emitted on exit 2.

Source files are capped at 8 MiB / 10000 rows, plans at 2 MiB / 10000 decisions, and
both at JSON depth 64. Existing reviewed-JSON checks reject ambiguous duplicate keys,
unsafe numbers, negative zero and invalid UTF-8. Final symlinks and nonregular files
are rejected. This performs no network access or database writes.

## Remaining WP09 work

This checkpoint covers standalone completeness and compellingness outputs. Embedded
legacy assessments and scores remain preserved by the record migration's original
versioned input envelope. Other standalone evaluation formats, explicit sensor revision
resolution, remaining observation field mappings and compatibility closeout are still
open. Index storage, public projection and actual reader integration are consumer work.
