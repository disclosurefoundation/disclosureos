# WP09 checkpoint 4: cross-batch staging ledger

The ledger receives verified migration export bundles into an immutable private
snapshot. It records which exact candidates were received, their batch membership,
and conflicts between reviewed revisions. These are staging receipts, not receipts
for application or database imports.

```sh
node packages/disclosureos-cli/dist/index.js migrate ledger \
  /path/to/bundle-a /path/to/bundle-b --out /path/to/new-ledger --json
node packages/disclosureos-cli/dist/index.js migrate ledger-verify \
  /path/to/new-ledger --json
```

A single bundle works too. Create one with the
[synthetic export walkthrough](migration-export.md). Commands are available in a
built checkout; no new package release has been published by this checkpoint.

## Receipt and conflict policy

Every input bundle is recomputed and verified before it can enter the ledger. Its
exact manifest SHA-256 identifies the batch. Identical bundles deduplicate; repeated
command arguments do not multiply receipt or row counts. Batch order is sorted by
that identity, so reversing arguments yields the same ledger bytes.

Candidate identities are the existing namespace/original-ID-derived observation IDs.
Each revision is identified by the SHA-256 of its exact candidate bytes. The ledger
retains every reviewed revision and its occurrences:

- One exact candidate revision: `ready_for_import_review`, with receipt rows marked
  `staged`. This is not approval to import or proof that all field mappings are resolved.
- More than one revision for the same identity: `conflict`. Every corresponding
  exported row is marked conflicting. The ledger never selects a first or last winner.
- Unreviewed rows remain `pending_review`; invalid rows remain `quarantined`. Neither
  creates an accepted revision or disappears from the receipt.

The comparison is deliberately byte-based. Changed reviewer rationale, source batch
context, source pins or other provenance can make different revisions even when the
visible measurements match. No semantic equivalence, automatic merge or scientific
preference is inferred. Different source namespaces yield different identities.

Across unique bundles:

`input = stagedRows + conflictRows + pendingReview + quarantined`

`migrated` is always zero. Counts describe receipt rows; `identities` and
`conflictingIdentities` separately describe distinct observation identities. Pending
rows do not resolve or overwrite a reviewed revision, and must be addressed before
future application gates can claim a complete migration.

## Files and reproducibility

`ledger.json` contains policy `legacy-migration-ledger:0.1.0`, row receipts, the
identity/revision inventory and pins for every retained input artifact. The command
result pins the ledger file itself. Original verified bundles are copied beneath
`inputs/<bundle-manifest-sha256>/`, preserving their exact source, review, report,
manifest and candidate files. Conflicting versions remain available for inspection.
The original export directories are no longer required for verification.

The snapshot uses private directories and files, exclusive creation and a fixed
inventory. An exact rerun returns `reused` without rewriting files. Changed batch
membership or contents conflict with an existing destination; create a new snapshot
for a different input set. Existing destinations are not modified or removed. Caught
write failures clean up only a directory created by the current operation. Crash
recovery and resuming a partial directory are not implemented.

`ledger-verify` validates each embedded bundle, recomputes receipts and conflict
outcomes with current code, and compares the complete inventory and every file byte.
It does not follow paths supplied by `ledger.json`. Input directory names must be
64 lowercase hex characters; reconstructed manifest identities determine expected
locations. Symlinks, nonregular files, nonprivate permissions, unexpected entries and
missing or changed artifacts are rejected.

Verification is unsigned current-code replay. It neither authenticates the reviewer
nor independently certifies source truth, scientific interpretation or the original
runtime. Replacing an entire snapshot and its inputs can produce a different internally
consistent snapshot. Store the returned ledger pin separately when an external trust
anchor is needed. No network or application writes occur during verification.

## Limits and exits

Accept 1–16 bundle arguments. Existing per-bundle limits apply; aggregate input and
output budgets are 256 MiB and 20000 files (including ledger output). Repeated input
arguments still consume verification budget before deduplication. The destination's
parent directory must exist. Snapshots retain private source data, historical scores
and reviewer attribution and are not public projections.

Exit 0: snapshot created/reused/verified with no conflicts, pending or quarantined rows.
Exit 1: operation succeeded but unresolved rows remain; inspect the receipts.
Exit 2: invalid input, failed verification, budget failure or destination conflict.
`success: true` refers to the snapshot operation, never application migration.

## Next WP09 work

[Explicit pinned resolution](migration-resolution.md) now records select/defer
decisions without changing the snapshot. Next: resumable/idempotent application receipts
that consume the verified ledger and resolution plan. Application read-path switching and
rollback must retain imported v2 data. Other field families, unversioned sensor
resolution, standalone legacy evaluation adapters and full application compatibility
remain open; this checkpoint does not close WP09.
