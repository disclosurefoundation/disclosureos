# WP09 checkpoint 2: explicit time and position review

For the current adoption sequence and compatibility limits, start with the
[developer migration guide](migration-guide.md). This page documents the individual
checkpoint contract; its historical next-step notes are not the current roadmap.


`migrate review` applies a supplied review plan to the same candidates produced by
`migrate dry-run`. It emits a report, not imported records. Legacy fields, scores,
assessments and exact input bytes remain separate from the revised v2 drafts.

```sh
node examples/v2/migration-review-demo.mjs /tmp/disclosureos-review-demo
node packages/disclosureos-cli/dist/index.js migrate review \
  /tmp/disclosureos-review-demo/legacy.json \
  /tmp/disclosureos-review-demo/review.json --json
```

Use a new directory for the demo. All values and review declarations are synthetic;
its deliberate zero coordinates and 1900 date demonstrate literal-value preservation,
not defaults for real records. The command is available from a built checkout and
has not yet been published as a package release.

## Review plan

The public `MigrationReviewSchema`, `MigrationReview` type and
`migrationReviewJsonSchema()` are exported from `@disclosureos/schema/experimental/v2`.
JSON Schema is exported at `@disclosureos/schema/experimental/v2/migration-review/schema`
and its `/0.1.0` alias. This schema validates plan structure; it does not establish that
target values or their semantics are correct. The CLI validates the resulting history
through `parseExperimentalClaimHistory` after applying all decisions for a row.

A plan contains:

- `kind: legacy_migration_review`, `schemaVersion: 0.1.0`, and the stable source
  collection `namespace` used by the dry run.
- `source.sha256` and `source.byteLength`, copied from the dry-run report's exact
  input pin. Any source-byte change, including formatting, requires a new pin and
  review. Candidate identity still depends on namespace and original ID.
- `reviewedBy` and `reviewedAt`: supplied attribution, not authenticated identity or
  proof of when review happened. The timestamp requires an offset and whole-second precision (no fractional seconds).
- `decisions`: at most one decision per source ID and target field. Each includes
  `sourceId`, `field`, `sourcePointers`, `rationale` and the full target envelope
  as `value`. Position decisions also include the complete `frames` array.

Supported fields are `eventTime` and `position`. Source pointers are row-relative
JSON Pointers to existing leaves or empty containers under `/temporal/` or `/location/`
respectively. Only cited fields are marked mapped; remaining fields stay unresolved.
Mapping a field to an explicit unknown envelope is a recorded decision, not absence.

For known or approximate values, use `sourceRefs: ["source:legacy-input"]` to cite
the pinned original file. The row locator and reviewed field pointers are retained
in the audit metadata. Time scale and calendar precision must be explicit in the
chosen v2 value. Position frames must be explicitly supplied; no datum is inferred
from bare coordinates. Approximate envelopes require their precision description.
Local references, interval order, frame types and target structures are checked by
the existing v2 validator. A structurally valid mapping is still a reviewer declaration,
not proof that the source supports the chosen precision, frame or interpretation.

The command does not infer assertions, add source files or methods, resolve sensor
revisions, change record publication status, or convert legacy evaluations into v2
claims. Scientific/profile validity remains unchecked.

## Report and failure behavior

The result includes the exact source and review-plan bytes, hashes and lengths.
Each revised candidate carries a `disclosureos.migration` extension with the review
hash, reviewer declarations, original row locator and decisions. No unsigned audit
metadata is presented as authenticated provenance or a certified receipt.

All decisions for a row are validated together. If any target or source pointer is
invalid, that whole row is quarantined and no partial candidate is emitted. A review
cannot rescue a row already quarantined by the base planner, including duplicated
source IDs. Unmentioned rows retain their dry-run candidates and `not_requested`
review status. Every row remains in the report; `input = candidates + quarantined`
and `migrated = 0`. Even a row with `review.status: applied` remains
`candidate_requires_review`, since other fields and future import gates remain open.

Exit 0 means no rows were quarantined. Exit 1 means the report includes quarantined
rows. Exit 2 rejects usage or the entire review input: invalid schema, duplicate
plan decisions, unknown source IDs, repeated pointers, pin mismatch or ambiguous JSON.
No migration report is emitted on exit 2. The existing dry-run command retains its
previous behavior and can still preserve raw inputs that need normalization.

Both files require valid UTF-8 JSON. Review rejects duplicate object keys (including
escaped equivalents), unsafe integers, nonfinite/underflowed numbers, negative zero,
and decimal spellings that round to a different shortest round-trip decimal value.
Ordinary representable decimals are supported; trailing zeros and formatting remain
in the pinned bytes. This is not arbitrary-precision numerical support. Resolve
ambiguity explicitly in a separate source copy before pinning and reviewing it;
retain the original dry-run report as history.

Limits: source 8 MiB, review plan 2 MiB, depth 64 for both, and at most 10000 input
rows / 20000 decisions. The original per-row traversal limit also applies. Final
symlinks and nonregular files are rejected. The CLI performs no network access,
imports, file writes or publication. JSON reports contain all original private data
and reviewer attribution; keep them local until a separate public projection exists.

## Next WP09 work

This checkpoint covers explicit time/frame decisions and their declared provenance,
with rejection of ambiguous JSON. Unversioned sensor resolution and other field
families remain unresolved. Legacy evaluations remain in their original versioned
input envelope; separate score-export adapters are still future work.

[Private candidate export](migration-export.md) now provides exact file pins,
verified reruns and destination conflicts. Next: cross-batch import conflicts and
resumable/idempotent application with rollback preserving imported v2 data. A completed
compatibility/profile guide and end-to-end application fixtures remain WP09 gates.
