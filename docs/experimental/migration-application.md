# WP09 checkpoint 6: resumable local application

Local application materializes selected v2 claim histories in a private store, retains
the entire historical ledger and publishes a completion receipt. It does not write
to the Disclosure Index database, activate a read path, publish data or establish
scientific/profile validity.

```sh
node packages/disclosureos-cli/dist/index.js migrate apply \
  /path/to/ledger /path/to/resolution.json --out /path/to/local-store --json
node packages/disclosureos-cli/dist/index.js migrate apply-verify \
  /path/to/local-store --json
```

Use a verified [ledger](migration-ledger.md) and an explicit
[resolution plan](migration-resolution.md). Every identity must have a selected
revision. Deferred/unresolved identities, pending/quarantined source rows or an empty
selection block application before any output directory is created. Remaining source
field uncertainties stay represented in the candidates; selection is not scientific
approval. Candidate content and publication status are copied without alteration.

## Stored artifacts and receipt

- `ledger/`: the full verified snapshot, including selected and unselected revisions,
  original source/review bytes, legacy evaluations and staging receipts.
- `resolution.json`: the exact supplied decisions, with their pinned ledger reference.
- `resolution-report.json`: recomputed row accounting and selected candidate references.
- `candidates/<identity>.json`: exact selected claim histories, one per identity.
- `intent.json`: deterministic operation identity pinning ledger, resolution and expected
  completion receipt. A destination cannot be reused with a different intent.
- `receipt.json`: published last, only after candidate/archive files have been written
  and checked. It pins the stored artifacts and records scope `private_local_candidate_store`,
  input/selected/historical row counts and distinct `appliedCandidates`.
- `.pending/`: private temporary files used for atomic publication. Recognizable bounded
  leftovers from interrupted writes are not application records or receipt inputs.

The receipt retains `indexImported: 0`, `readPath: not_activated`, unauthenticated
reviewer identity and unchecked scientific validity. Locally applied candidates are
not live Index records. Rows excluded by the explicit selection remain in the archived
ledger rather than being deleted or presented as scientifically false.

## Resume and conflict rules

Re-run the same `apply` command after an interruption. After the intent is committed,
missing files can be filled using the original pinned ledger and decisions. Existing
files must match their expected bytes before any resume writes start. Identical
completed stores return `reused` without rewriting files. A completed store with
missing or altered artifacts is an integrity failure, not an automatic repair request.

Each file is written to a new private temporary file, flushed, and published with an
exclusive hard link. Final artifact names never expose a partial write and cannot
overwrite another writer's file. Concurrent identical retries either publish or verify
the same bytes. Different intents fail before application writes. The completion
receipt is published only after the other artifacts; consumers must verify it before
using the store.

Interrupted temporary files are accepted only when their names identify expected
content and their bytes are an exact prefix of that content. They remain in `.pending`
to avoid deleting another identical writer's temporary file. They do not become
candidates. Unknown or conflicting temporary contents block the operation. At most
64 staging files totaling 256 MiB are accepted. Successfully owned temporary files are
removed by the writer after publication.

There is a small initialization window before `intent.json` is committed. A directory
without a valid intent cannot safely be identified as this operation and is rejected;
use a new path or inspect that directory manually. Original ledger/decision inputs are
required to resume an incomplete store. Once complete, verification is self-contained.
No existing unrecognized destination is overwritten or removed. After a valid intent
exists, failures intentionally preserve progress rather than deleting the store.

The local filesystem must support same-volume hard links. File contents are flushed
before publication, but this is not a claim of transaction durability across every
filesystem or power-loss scenario. Verification detects missing or conflicting artifacts.

## Verification, limits and exits

`apply-verify` reconstructs the expected application from the retained ledger and
decisions, checks intent/receipt pins and compares the complete expected inventory.
Source paths are derived from verified inputs, not an untrusted receipt. Private real
directories and regular files are required; symlinks, unexpected entries, public
permissions and byte conflicts are rejected. The operation is read-only.

Verification is unsigned current-code replay, not independent scientific verification
or authentication of the original runtime. All private data remains local. No network
access or live database operation occurs.

Existing ledger and 2 MiB resolution-plan limits apply. The store's expected artifacts
are capped at 256 MiB and 30000 files, including its intent and receipt. Directories
are created privately (`0700`) and files privately (`0600`). The destination parent
must already exist.

Exit 0 reports `applied`, `resumed`, `reused` or `verified`, scoped to this local store.
Exit 2 reports input, integrity, intent, usage, budget or write failure. No partial
application is labeled complete. Incomplete stores are resumed with `apply`; verification
requires a complete store and does not repair one.

## Next WP09 work

The [local read-path selector](migration-read-path.md) adds explicit activation and
rollback while retaining completed stores and all imported candidate/history bytes. The Index adapter, deployment and public projection
remain separate consumer work. Remaining field-family/sensor mappings, legacy evaluation
adapters and full application compatibility remain open WP09 gates.
