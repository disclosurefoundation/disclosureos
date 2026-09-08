# WP09 checkpoint 3: private candidate bundles

For the current adoption sequence and compatibility limits, start with the
[developer migration guide](migration-guide.md). This page documents the individual
checkpoint contract; its historical next-step notes are not the current roadmap.


Export turns a pinned review into local files that another tool can inspect. It does
not import records or decide that unresolved mappings are ready for publication.

```sh
node examples/v2/migration-review-demo.mjs /tmp/disclosureos-export-demo
node packages/disclosureos-cli/dist/index.js migrate export \
  /tmp/disclosureos-export-demo/legacy.json \
  /tmp/disclosureos-export-demo/review.json \
  --out /tmp/disclosureos-export-bundle --json
node packages/disclosureos-cli/dist/index.js migrate verify \
  /tmp/disclosureos-export-bundle --json
```

Use new paths for the synthetic demo and first export. The source and review files
follow the [review contract](migration-review.md). The source-byte pin, ambiguity
checks and v2 semantic validation are rerun before any directory is created.

## Bundle contents

- `source.json` and `review.json`: exact original bytes, not JSON reserialization.
- `report.json`: the complete recomputed review report, including every legacy row,
  decisions, rationale, unresolved fields and quarantines.
- `candidates/<stable-observation-id>.json`: a separate claim history only for a
  candidate whose review status is `applied`. Original IDs never become file paths.
- `manifest.json`: experimental `legacy_migration_export` format, schema version
  `0.1.0`, policy `legacy-migration-export:0.1.0`, namespace, row inventory, counts and
  SHA-256/byte-length pins for every other file. The command result supplies a pin
  for the manifest itself; no circular self-hash is embedded.

Every row is accounted for as `exported`, `pending_review` or `quarantined`, with
`input = exported + pendingReview + quarantined` and `migrated = 0`. A report can be
exported even when no row is eligible for a separate candidate file. Unreviewed
candidates remain in the report as pending; quarantined rows retain their reasons.

Exported candidates may still have unresolved fields and retain
`candidate_requires_review` in the report. Export is not completion of migration,
scientific/profile success, or authentication of reviewer identity. Legacy scores
and assessments remain historical data and never enter a new ranking.

## Exact reruns and conflicts

New bundles use private `0700` directories and `0600` files with exclusive creation.
The parent directory must already exist. Files are prepared and size-checked before
writing. A caught write/verification failure removes only the newly created bundle;
an existing destination is never overwritten or cleaned up.

Rerunning export against an existing destination recomputes the expected bundle and
compares its complete inventory and every file byte. An exact match returns
`action: reused` without rewriting files. Changed inputs/reviews, altered or missing
files, unexpected files, symlinks and group/other permissions cause a conflict. Choose
a new destination for a different revision; this checkpoint never silently replaces
an earlier review artifact.

This is idempotence for one exact bundle, not cross-batch database conflict handling.
A process crash can leave a partial directory; it will be rejected on the next run.
There is no automatic repair, interrupted-write resumption or application rollback yet.

## Verification and limits

`migrate verify` reads the saved source and review inputs, recomputes the review and
expected export with the current code, and compares every expected byte and directory
entry. It does not trust manifest-provided paths or hashes. Candidate names are derived
from the current planner; unexpected paths are rejected without being traversed.
The root and candidate directory must be real private directories; artifacts must be
real private regular files. No verification step fetches dependencies or contacts a
server.

A successful verification is `current_code_replay`. It is not an independent semantic
implementation, signed receipt, authenticated source or proof of the original runtime.
Changing the implementation can require a deliberate new policy/version and bundle.
SHA-256 pins detect byte differences relative to the supplied inputs; a party able to
replace all inputs and outputs can create a different internally consistent bundle.

Source and review limits remain 8 MiB and 2 MiB, with the existing depth/row/decision
bounds. The generated bundle is capped at 256 MiB before writes. Verification uses
expected file lengths as read bounds; no external manifest can increase those budgets.
Reports and bundles retain private source data and reviewer attribution. They are
local review artifacts, not public projections.

Exit 0: complete export/reuse/verification with no pending or quarantined rows.
Exit 1: bundle operation succeeded, but some rows remain pending or quarantined;
`success: true` describes artifact creation/verification, not migration completion.
Exit 2: invalid input, conflicting destination or failed integrity/write check.
`action` is `created`, `reused` or `verified` on successful operations.

## Next WP09 checkpoint

The [cross-batch staging ledger](migration-ledger.md) now records persistent local
receipts and conservative identity/revision conflicts. Next, define explicit conflict
resolution and resumable/idempotent application receipts. Rollback must restore the previous read path
without deleting imported v2 data. Other field mappings, sensor revision resolution,
legacy score adapters and full application compatibility remain open WP09 gates.
