# WP09 checkpoint 5: explicit revision resolution

`migrate resolve <ledger> <decisions.json> [--json]` produces an application planning
report from a verified ledger and explicit select/defer decisions. It does not write
files, change the ledger, merge candidate contents, authenticate a reviewer or import
records. All original revisions remain in the ledger and in the report inventory.

## Prepare decisions

First verify the [staging ledger](migration-ledger.md). The resolution plan must pin
its exact `ledger.json` SHA-256 and byte length. The creation/verification command's
`ledger` output already supplies this pin.

The following creates a private plan that explicitly defers every identity. Supply
your reviewer attribution and a new output path. It selects no revisions. Edit only
the decisions you have reviewed, recording the reason for each choice.

```sh
python3 - /path/to/ledger/ledger.json 'Reviewer name' resolution.json <<'PYTHON'
import datetime, hashlib, json, os, sys
raw = open(sys.argv[1], 'rb').read()
ledger = json.loads(raw)
plan = {
    'kind': 'legacy_migration_resolution', 'schemaVersion': '0.1.0',
    'ledger': {'sha256': hashlib.sha256(raw).hexdigest(), 'byteLength': len(raw)},
    'decidedBy': sys.argv[2],
    'decidedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
    'decisions': [
        {'identity': item['identity'], 'action': 'defer',
         'rationale': 'No revision selected; awaiting review.'}
        for item in ledger['identities']
    ],
}
fd = os.open(sys.argv[3], os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    json.dump(plan, output, indent=2)
    output.write('\n')
PYTHON
node packages/disclosureos-cli/dist/index.js migrate resolve \
  /path/to/ledger resolution.json --json
```

To select a revision, set that identity's `action` to `select`, add `revision` with
an exact hash from its `ledger.json` `identities[].revisions[].sha256`, and replace
`rationale` with the reason for the application choice. For `defer`, omit `revision`.
Update attribution and decision time to describe the decisions actually made. The
whole-second timestamp requires an offset; it is a declaration, not authenticated time.

The experimental public `MigrationResolutionSchema`, `MigrationResolution` type and
`migrationResolutionJsonSchema()` are exported from `@disclosureos/schema/experimental/v2`.
JSON Schema is exported at `/experimental/v2/migration-resolution/schema` and its
`/0.1.0` alias. Schema validation covers structure; the CLI additionally checks exact
snapshot pins, unique decisions, identity membership and revision membership.

## Selection semantics

Every decision is bound to one identity and the entire verified snapshot. A changed
ledger, stale pin, repeated identity, unknown identity or revision belonging outside
that identity rejects the whole plan. Invalid plans produce no partial resolution.

An explicit `select` chooses one exact revision for future application planning.
Other revisions become `not_selected` receipt rows; they are retained, not deleted,
scientifically rejected or silently marked as false. `defer` leaves every occurrence
of the identity deferred. Unmentioned identities remain unresolved, including those
with only one staged revision. There is no default first/latest/highest-score choice.
An empty decisions array is valid and leaves all staged identities unresolved.

Pending-review and quarantined rows keep those states and remain in the report.
Choices cannot rescue them or resolve missing source fields, sensor revisions or
scientific/profile requirements. Those remain separate gates.

## Result and accounting

The result includes the ledger pin, exact plan bytes/hash/length, declared attribution,
complete identity/revision inventory and batch receipts. Original receipt/identity
states are retained as `ledgerStatus`. Selected entries include the exact candidate
path within the verified ledger, its hash/length and all matching occurrences. The
CLI derives these paths from recomputation, not from user-supplied plan paths.

For every unique input batch's rows:

`input = selectedRows + notSelectedRows + deferredRows + unresolvedRows + pendingReview + quarantined`

`selectedCandidates` counts distinct selected identities; `migrated` remains zero.
Selection changes planning disposition only. Legacy assessments, scores, observations
and provenance are not rewritten or mixed into a new ranking.

Repeated resolution with identical inputs produces identical JSON content. Save the
report locally if needed; it includes private source identifiers and reviewer details.
Keep both the pinned ledger and decision file for later application. A future importer
must verify them again rather than trusting a detached report. No application receipt
or rollback state exists at this checkpoint.

Exit 0: all available identities explicitly selected and no pending/quarantined rows.
This is planning completeness, not permission or scientific readiness to import.
Exit 1: deferred, unresolved, pending or quarantined rows remain; the full report is
still emitted. Exit 2: invalid usage, plan, snapshot or membership/pin check.

Resolution plans are limited to 2 MiB, depth 64 and 20000 decisions. Duplicate JSON
keys and unsafe numeric representations are rejected using the existing review-input
checks. Ledger verification retains its existing bounded private-file requirements.
Verification is unsigned current-code replay; reviewer identity and scientific validity
remain unchecked. The operation performs no network access or application writes.

## Next WP09 work

[Resumable local application](migration-application.md) now consumes the pinned ledger
and decisions, preserving selected and unselected revisions with a completion receipt.
Next: explicit read-path activation and rollback retaining completed stores. Remaining
field-family/sensor mappings, legacy evaluation adapters and application compatibility
continue to be WP09 gates. This checkpoint does not complete migration or close WP09.
