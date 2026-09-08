# Assessment-summary provenance and replay

`evaluateAssessmentSummaryEvaluation` binds the existing declaration summary to
its exact claim-history bytes, supplied dependency snapshots and fixed rule versions.
It invokes `summarizeClaimHistory` itself and preserves the entire summary result.
No custom callback, cached result, origin boost or aggregate score is accepted.

This unreleased WP08 increment belongs to `@disclosureos/scoring/experimental/v2`.
The summary algorithm is unchanged. It still separates source assertions from
assessments, follows revisions, groups duplicate declarations, preserves omitted
confidence and exposes shared support without assuming statistical independence.

## Try the synthetic flow

Use Node 22 and Python 3.11 after installing repository dependencies:

```sh
pnpm --filter '@disclosureos/scoring...' build
node examples/v2/summary-evaluation-demo.mjs /tmp/disclosureos-summary-demo
python3 scripts/verify-research-receipt.py /tmp/disclosureos-summary-demo/receipt.json
node scripts/replay-assessment-summary.mjs /tmp/disclosureos-summary-demo
```

Choose a new export directory. Existing directories are never overwritten; an
interrupted write can leave a partial export, so use a fresh path for a retry.
Omit the directory argument to print the full result without exporting. The example
uses the existing synthetic claim history, a labeled synthetic topic vocabulary,
the actual local scoring bundle, and Node/platform/architecture plus workspace
lockfile text. These are recorded artifacts, not proof of a complete executable
closure or of what ran in a different environment. No partner files are involved.

The bundle contains `receipt.json`, the exact `history.json`, and
`dependencies/<ref>`. It contains no downloaded source documents. Root script aliases
are `pnpm verify:evaluation-receipt <receipt.json>` and
`pnpm replay:assessment-summary <bundle-directory>`. The Python verifier retains its
original filename and accepts both research and summary receipt formats explicitly.
These replay tools are repository tools, not new published CLI commands.

## Package API and contract

```ts
import { evaluateAssessmentSummaryEvaluation } from '@disclosureos/scoring/experimental/v2';
const result = await evaluateAssessmentSummaryEvaluation(manifest, {
  historyBytes,
  dependencyFiles, // ReadonlyMap<string, Uint8Array>
});
```

Contract: `urn:disclosureos:experimental:assessment-summary-evaluation:0.1.0`.
Workflow: `assessment-summary:0.1.0`.
Policy: `urn:disclosureos:experimental:policy:assessment-summary-evaluation`, version `0.1.0`.

The strict manifest contains `kind: assessment_summary_evaluation`, `schemaVersion`,
a local `id`, `workflow`, a SHA-256/byte-length `history` pin, and `dependencies`.
Dependencies require at least one vocabulary snapshot, an implementation artifact,
and an environment artifact. Each declares `ref`, `id`, `version`, SHA-256 and
byte length. Refs must be unique across roles; a vocabulary identity has only one
version within a manifest. IDs and versions are supplied declarations, while their
local artifact bytes are checked. Their contents and completeness are not interpreted.

`AssessmentSummaryEvaluationSchema` and `assessmentSummaryEvaluationJsonSchema`
expose this input contract. Package schema exports are
`@disclosureos/scoring/experimental/v2/summary-evaluation/schema` and its `/0.1.0`
versioned alias. Package versions and hosted schema publication are unchanged.

The evaluator copies the manifest and byte inputs before asynchronous hashing.
Missing bytes, corrupt pins, unavailable hashing, or unreadable UTF-8/JSON prevent
a receipt. A well-formed JSON history that fails the claim-history validator can
still have its failed summary recorded after its bytes are verified. Nested
validation diagnostics remain under `summary`; wrapper diagnostics use separate
`SUMMARY_EVALUATION.*` codes.

## Exact scope of the receipt

Format `disclosureos-assessment-summary-receipt:0.1.0` uses the same explicit
`sorted-json-utf8:0.1.0` serialization as the [research receipt](evaluation-provenance.md).
Its `requestJson` contains the manifest, generated evaluator/summary rule identities,
the returned claim-history contract identity, and limits. Its `outputJson` contains
`{ summary: ... }`. Both exact strings carry UTF-8 byte lengths and SHA-256 pins.
The saved strings allow Python to verify hashes without reproducing JavaScript's
number/string serialization. They form an unsigned receipt, not an authorship or
execution attestation.

The verified source for this computation is the **claim-history document**. That
history may contain method references, version declarations and source/product
digests, all preserved in the pinned bytes. This does not verify the artifacts those
references describe. Source/product hashes still have their original declared-only
meaning; unknown digests remain unknown. `sourceArtifactIntegrity`, vocabulary
membership, statistical independence and scientific eligibility stay unchecked.
Implementation and environment execution remain unattested. The nested summary's
`artifactIntegrity` and `reproducibility` limits are unchanged.

This distinction allows source-only or unresolved histories to be summarized without
inventing missing evidence or claiming that their assessments are correct. A summary
pass means the declared history could be summarized, not that a research profile
passed or that competing claims were adjudicated.

## Verification, replay and status

`checks.structural` and `checks.semantic` describe the wrapper's manifest/ref and
JSON checks. `checks.external` covers only history/dependency byte identity.
`checks.summary` reflects the underlying summary's validation result.
`checks.receipt` passes only after both payloads are hashed. Overall `success`
requires summary and receipt success; final hash failure retains the computed summary
without issuing a partial receipt.

The independent Python checker checks both supported envelope formats, exact payload
strings and hashes. It does not check source files, canonical serialization or
summary semantics. The Node replay tool verifies a captured receipt through Python,
loads bounded local history/dependency bytes, reruns the fixed evaluator and compares
both exact strings and pins. Rule changes and output changes are separate mismatches.

Replay `success: true` means the saved computation was reproduced. An invalid history
can reproduce with `summaryStatus: failed` and `summarySuccess: false`; this remains
a failed summary even though the replay exits zero. Rehashed fabricated output can
pass integrity but cannot pass replay against unchanged inputs. Missing Python leaves
integrity unchecked and stops replay. Supplied code is never executed or fetched.

Replay metadata is limited to 8 MiB per receipt/history file, total captured bytes
to 256 MiB, and history/dependency inventory to 4096 files. Schema-validated local
IDs, regular-file checks and symlink rejection use the same bounded file reader as
research replay on macOS/Linux. Neither tool is a sandbox for executing data-supplied
programs. Library callers must apply their own size bounds before loading bytes.

The [evaluation checkpoint](evaluation-checkpoint.md) separates demonstrated
capabilities from the reviewed profiles and integration work still outstanding.
