# Independent receipt verification and local replay

The [research evaluation receipt](evaluation-provenance.md) now has two repository
tools: an independent Python integrity checker and a Node replay tool. They check
different things. Neither authenticates the receipt's author or certifies science.
The Python checker uses only the Python standard library and does not import or
invoke DisclosureOS JavaScript. Replay uses the current built-in TypeScript evaluator.

## Try the complete synthetic flow

Use Node 22 and Python 3.11 after installing repository dependencies:

```sh
pnpm --filter '@disclosureos/schema...' build
node examples/v2/export-evaluation-replay-demo.mjs /tmp/disclosureos-replay-demo
python3 scripts/verify-research-receipt.py /tmp/disclosureos-replay-demo/receipt.json
node scripts/replay-research-evaluation.mjs /tmp/disclosureos-replay-demo
```

Choose a new export path. The exporter creates its destination exclusively and
refuses to overwrite an existing directory. A write failure may leave a partial
export; use a fresh path for a retry. It exports only the supplied synthetic fixture,
its synthetic vocabulary, and the local implementation/environment artifacts used
by the example. It does not retrieve or publish partner data.

Equivalent root scripts are `pnpm verify:research-receipt <receipt.json>` and
`pnpm replay:research-evaluation <bundle-directory>`. These are repository tools;
this increment does not add published `disclosureos` CLI commands or package APIs.

## Preserved bundle layout

```text
bundle/
  receipt.json          # the receipt object, not the entire evaluation result
  packet.json           # exact reproduction-packet bytes pinned by the request
  files/<packet-id>     # exact bytes for each packet inventory entry
  dependencies/<ref>    # vocabulary, implementation and environment artifacts
```

Keep the original bytes. Reformatting packet JSON changes its identity. The outer
`receipt.json` formatting can change because its exact `requestJson` and `outputJson`
string values are what the receipt hashes. The receipt's manifest identifies the
packet and dependency pins; the packet identifies its sources, documents, methods
and other files. Replay reads this fixed layout using schema-validated local IDs;
no path or executable command from a supplied artifact is followed.

## Python integrity check

`verify-research-receipt.py` accepts a regular file or `-` for standard input. It
checks the supported envelope/serialization identifiers, exact envelope and payload
section names, SHA-256/byte-length pin shapes, and the exact UTF-8 bytes of both
saved JSON strings. It rejects duplicate JSON keys, invalid JSON constants, malformed
UTF-8, invalid pin types and mismatched hashes. The process emits one JSON result;
exit zero means both payload identities passed, and exit one means verification failed.

Its scope is `receipt_payload_integrity`. It explicitly leaves canonical serialization,
input files, evaluation semantics and replay unchecked. It does not reconstruct JSON
in Python or assume Python's number/string serialization matches JavaScript. It
checks the preserved strings directly. Hashes are unsigned: anyone can edit content
and compute new hashes. Such a receipt can pass integrity without describing a
correct evaluation. Replay is the next check.

## Replay and comparison

The Node tool captures the receipt bytes once and sends that same snapshot to the
Python verifier. If integrity fails or Python is unavailable, it stops with a nonzero
exit code. Unavailable or interrupted verification remains unchecked. It then loads the manifest, packet and declared local file namespaces,
invokes `evaluateResearchEvaluation`, and compares both exact serialized payloads
and their pins with the saved receipt. Changed rules, serialized requests or computed
outputs are reported separately as `REPLAY.REQUEST_MISMATCH` and
`REPLAY.OUTPUT_MISMATCH`. Missing or corrupt inputs cannot produce a successful replay.

Replay computes its own current result; it does not trust a saved `success` field.
It does not update the receipt, regenerate pins to make a mismatch disappear, execute
supplied code, fetch URLs or install dependencies. Unknown workflow IDs fail instead
of loading a custom implementation. The caller supplies the locally installed build
of the fixed evaluator that performs the replay.

| Result | Interpretation |
| --- | --- |
| `success: true` | Both preserved payloads match the rerun exactly |
| `checks.receiptIntegrity` | Python verified the saved strings and pins |
| `checks.requestReplay` | Current fixed workflow/request matches the saved request |
| `checks.outputReplay` | Computed result matches the saved output |
| `evaluationStatus` | The rerun prerequisite evaluation is passed, failed or unchecked |
| `evaluationSuccess` | True/false for a checked evaluation; null while unchecked |

Exit zero means replay matched. A faithfully reproduced rejected review therefore
returns `success: true`, `evaluationStatus: failed`, and `evaluationSuccess: false`.
That is a successful reproduction of a failure, not scientific approval. A receipt
with fabricated output and newly computed valid hashes can pass Python integrity
but fails output replay. A changed rule identity likewise fails request replay.

The tools do not establish that the declared implementation or environment artifacts
match the running process. A replay can match across environments, but that is not
execution attestation. Scientific eligibility and vocabulary membership remain
unchecked. Analysis code inside the packet remains unexecuted; the existing separate
synthetic arithmetic consumers have a different scope. This is not an independent
Python implementation of the research semantics or a partner scientific reproduction.

## Bounds and verification

The Python checker and replay tool limit receipt metadata to 8 MiB. Replay also
limits packet metadata to 8 MiB, packet/dependency inventories to 4096 files, and
combined receipt, packet and referenced file bytes to 256 MiB. It checks declared
sizes before loading data and enforces an actual-byte budget while reading. It
requires regular files and rejects symlinked bundle roots, data directories and
leaf files on the supported macOS/Linux execution path. These safeguards are for
bounded local inspection, not a sandbox for executing supplied programs.

`pnpm test:v2-replay` exercises the two real processes, complete and failed-result
replay, rehashed fabricated output, rule changes, duplicate keys, missing/corrupt
files, symlinks, invalid refs, size limits and exclusive example export. Existing
package contracts and receipt serialization are unchanged. Broader profile coverage,
independently implemented research semantics, reviewed partner reproduction and
Index integration remain separate work.

The same Python checker also supports the distinct [assessment-summary receipt](summary-provenance.md) format; its corresponding replay tool preserves summary-specific verification limits.
