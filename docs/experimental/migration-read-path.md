# WP09 checkpoint 7: local read-path activation and rollback

A private local selector chooses between a legacy fallback and a completed migration
store. `read-path --json` returns the current selection and verified candidate content
for local consumers. This does not switch the Disclosure Index database or website.
The legacy fallback is a routing signal to a consumer's existing legacy reader; the
CLI does not load or verify that reader's data.

```sh
# Create a new private selector. Save the returned head hash as INITIAL_HEAD.
disclosureos migrate read-init --out /private/selector --json
# Inspect the current head and selected data.
disclosureos migrate read-path /private/selector --json
# Supply the exact current head hash, not the literal placeholder below.
disclosureos migrate read-activate /private/selector /private/completed-store \
  --id CURRENT_HEAD --json
# Restore an earlier recorded selection by its head hash.
disclosureos migrate read-rollback /private/selector INITIAL_HEAD \
  --id CURRENT_HEAD --json
```

Activation requires a fully verified [local application](migration-application.md).
It records the absolute store directory and completion receipt pin. Every subsequent
read reconstructs that application from its archived inputs, verifies its complete
inventory and activation pin, and returns candidate objects from the verified memory
snapshot. A missing, incomplete or changed store causes exit 2 without successful
candidate output. If the journal itself verified, failure output includes its current
`head` so that an explicit legacy rollback remains possible. Legacy mode returns an empty candidate list and `target.kind: legacy`.
Consumers must honor `target.kind`; an empty list alone is not a fallback instruction.

## Append-only transitions

The selector contains canonical `000000.json`, `000001.json`, and successive transition
files plus a private `.pending/` directory. The first transition selects legacy mode.
Each transition includes its sequence, previous transition hash, action, target and,
for rollback, the earlier transition hash being restored. The command returns the
current `head` hash and full transition history.

Activation and rollback require `--id` with the expected current head. A stale value
fails before publication. Writers flush a private temporary file and use an exclusive
hard link at the next sequence number. Two commands acting on the same head cannot
both commit. Readers see only complete committed transitions; staging files are never
read heads. A reader may see the prior head when an append happens concurrently.

Rollback appends a new transition restoring an earlier target. It never rewinds or
removes journal entries, modifies completion receipts, or deletes store/history bytes.
Restoring a store rechecks it and its original receipt pin. Restoring legacy mode does
not depend on the current store being healthy, so it remains available when that store
is missing or corrupt. An unknown or current-head rollback target is rejected.
An application receipt continues to say `readPath: not_activated`: it describes the
immutable application operation. The separate selector records subsequent activation.

## Recovery and trust limits

After a command is interrupted, inspect `read-path` to determine whether its transition
committed. Before publication, the previous head remains active and the command can
be retried with that head. After publication, the new head is committed and retrying
the old head is rejected. A failure after publication can likewise leave a committed
transition; always inspect before retrying. A failed first initialization may leave an
unrecognized directory: inspect it manually or use a new path. Initialization never
adopts or overwrites an existing directory.

Temporary leftovers remain local and are ignored as data. At most 64 UUID-named
private staging files, each at most 16 KiB, are accepted. Transitions are capped at
1024 entries and 16 KiB each. Unknown entries, gaps, noncanonical or inconsistent
transitions, symlink artifacts and nonprivate permissions fail verification. Directories
are created with mode 0700 and files with mode 0600. Parents must already exist. Keep
selector and store directories separate; absolute store paths must remain available.

These unsigned local hashes detect inconsistencies against retained pins, not malicious
rewriting or truncation of the entire journal by someone with filesystem access. Final
path components are checked; this is not protection against hostile ancestor-path
replacement or concurrent external mutation. Use a trusted private filesystem and keep
completed stores immutable. Publication requires same-volume hard links; it is not a
power-loss durability guarantee. The returned data is a verified snapshot, not a promise
that the selected files cannot change later. No identity authentication, scientific
validation, network access, public projection or live Index cutover occurs.

Exit 0 means the selected local state verified. Exit 2 covers usage, stale head,
integrity, budget or I/O failure. Capture JSON privately: it includes selected candidate
data and local paths.

## Remaining WP09 gates

Local application and rollback plumbing are now available. Other field-family/sensor
mappings, legacy evaluation adapters and application compatibility closeout remain.
The actual Index reader adapter, deployment and public projection belong to consumer
integration; this checkpoint does not certify those paths.
