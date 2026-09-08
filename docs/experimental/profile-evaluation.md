# Experimental provenance-profile receipts and replay

`evaluateProfileEvaluation` reproduces one fixed provenance profile from pinned local
inputs and emits an unsigned receipt of its exact request and computed output. It
supports released documents, historical testimony and collected physical specimens.
Existing profile rules and results are preserved, including failure and missingness.

Policy: `urn:disclosureos:experimental:policy:profile-evaluation`, version `0.1.0`.
Manifest schema: `urn:disclosureos:experimental:profile-evaluation:0.1.0`.
Receipt format: `disclosureos-profile-evaluation-receipt:0.1.0`.

## Three fixed workflows

| Manifest `workflow` | Existing evaluator |
| --- | --- |
| `released-documents:0.1.0` | `evaluateReleasedDocuments` |
| `historical-testimony:0.1.0` | `evaluateHistoricalTestimony` |
| `physical-samples:0.1.0` | `evaluatePhysicalSamples` |

No custom callback, arbitrary module, result override or cached success flag is
accepted. The selected evaluator runs from the installed package. Supplied implementation,
environment and vocabulary artifacts are pinned inputs, never fetched or executed.
Their presence does not attest which code/runtime previously ran or establish vocabulary
membership. Each profile's existing scientific and authenticity limits remain intact.

## Manifest and public API

Import from `@disclosureos/schema/experimental/v2`. Public exports include
`ProfileEvaluationSchema`, `ProfileEvaluation`, `ProfileEvaluationOptions`,
`ProfileEvaluationResult`, `ProfileEvaluationReceipt`, `profileEvaluationJsonSchema`
and `evaluateProfileEvaluation`. JSON Schema exports are
`@disclosureos/schema/experimental/v2/profile-evaluation/schema` and its `/0.1.0` alias.
These additions are unreleased; existing schemas and package versions are unchanged.

The strict manifest contains `kind: profile_evaluation`, `schemaVersion: 0.1.0`,
a local `id`, one workflow above, `history` and `selection` pins, an `assets` array
and `dependencies`. Every pin specifies lowercase SHA-256 and positive safe-integer
`byteLength`. History and selection are separately pinned exact UTF-8 JSON files.

Each asset contains `ref` (an existing-profile-style `source:...` reference), a local
`fileRef`, and its exact byte pin. Source references and file references must each be
unique within `assets`. Only these manifest entries are supplied to the profile.
Unlisted map entries are ignored; they cannot silently fill a missing source record.
An empty asset array deliberately supplies no source bytes and may reproduce an
unchecked or failing profile. A listed file that is unavailable or mismatched prevents
a receipt because the declared input set cannot be reproduced.

Dependencies contain a nonempty `vocabularies` array plus `implementation` and
`environment`. Each declares `ref`, `id`, `version` and a byte pin. Dependency references
are unique; each vocabulary identity declares one version. Asset and dependency file
namespaces are separate. IDs/versions are recorded declarations, not authenticated
registration or executed-code claims.

```ts
const result = await evaluateProfileEvaluation(manifest, {
  historyBytes,
  selectionBytes,
  assetFiles,      // ReadonlyMap<fileRef, Uint8Array>
  dependencyFiles // ReadonlyMap<dependency ref, Uint8Array>
});
```

The parsed manifest and all supplied byte namespaces are snapshotted before asynchronous
hashing. Library callers must bound untrusted input sizes before loading them. The
underlying full profile result is retained in `result.profile`; the workflow does not
remove declared assessments or change a failed/unchecked check to passing.

## Receipt meaning

The request payload contains the parsed manifest, generated evaluation/profile rule
identities and explicit execution/interpretation limits. The output payload is
`{ profile: <full computed profile result> }`. Sorted object keys, preserved array order
and standard JSON encoding produce the exact `requestJson` and `outputJson` strings.
Each is pinned as UTF-8 with no appended newline. This is the existing project
`sorted-json-utf8:0.1.0` convention, not a claim of an external canonical-JSON standard.

The source history/selection byte pins still distinguish whitespace changes even if
the decoded profile result is unchanged. Supplied source bytes are checked against the
manifest pin first, then against the existing profile's source digest. A manifest can
faithfully preserve bytes that fail the source digest, producing a receipt of failure.

| Check | Meaning |
| --- | --- |
| `structural` | Manifest shape |
| `semantic` | Manifest reference uniqueness and decodable history/selection |
| `external` | All manifest-declared inputs match their exact byte pins |
| `profile` | Existing profile outcome, including structural/semantic failures inside that profile |
| `receipt` | Exact request and computed-output strings were hashed successfully |

Wrapper `external: passed` does not mean the nested profile's artifact checks passed.
`success` requires both a passing profile and a produced receipt. A well-formed JSON
history or selection that fails its profile contract can still produce a receipt of
that failure. Invalid UTF-8, BOM-prefixed JSON, malformed JSON, missing declared inputs
or mismatched manifest pins produce no receipt. Unknown hashing capability never passes.

Receipts are unsigned and can be fabricated or recomputed by anyone. Integrity proves
only agreement with the saved payload pins. It does not establish authorship, source
truth, scientific eligibility or independent semantic implementation.

## Create and replay the synthetic bundles

Use Node 22 and Python 3 after building the repository packages:

```sh
pnpm build
node examples/v2/profile-evaluation-demo.mjs released-documents:0.1.0 /tmp/document-profile-bundle
node examples/v2/profile-evaluation-demo.mjs historical-testimony:0.1.0 /tmp/testimony-profile-bundle
node examples/v2/profile-evaluation-demo.mjs physical-samples:0.1.0 /tmp/sample-profile-bundle
python3 scripts/verify-research-receipt.py /tmp/document-profile-bundle/receipt.json
node scripts/replay-profile-evaluation.mjs /tmp/document-profile-bundle
node scripts/replay-profile-evaluation.mjs /tmp/testimony-profile-bundle
node scripts/replay-profile-evaluation.mjs /tmp/sample-profile-bundle
```

Use new output directories: the demos refuse to overwrite an existing bundle. They use
only the existing synthetic source fixtures. Their vocabulary is explicitly synthetic.
The implementation artifact is the local schema entry bundle; the environment declaration
records Node/platform/architecture and lockfile text. These do not attest a complete
executed dependency closure or reproduce the runtime itself.

Bundles contain `receipt.json`, `history.json`, `selection.json`, `assets/<fileRef>`
and `dependencies/<ref>`. Keep both directories present even if no assets are listed.
The Python verifier retains its historical filename and now recognizes all three receipt
formats. It checks exact payload hashes and rejects duplicate JSON keys, but does not
read inputs or reproduce profile semantics.

Replay first runs that independent integrity check, then loads the pinned inputs and
runs the current fixed TypeScript workflow. Both exact request and output payloads must
match. Rehashed changes to rules or output fail this replay even when integrity passes.
A reproduced failed/unchecked profile gives replay `success: true`, with separate
`profileStatus` and `profileSuccess` (`null` when unchecked). Replay success is not a
passing profile, source authentication or evidence of scientific validity.

The local replay reader permits regular files only, rejects symlink leaf files and
symlink bundle/assets/dependency directories, bounds metadata files at 8 MiB, limits
input count to 4,096, and enforces a 256 MiB aggregate budget. It performs no network
fetch and never loads dependency artifacts as executable code. This is a bounded local
reader, not an OS sandbox against concurrent filesystem mutation or hostile ancestors.

Full profile output may contain restricted source metadata, attributions and sample
custodians. Receipts are not public projections; apply access policy before sharing them.
The wrapper leaves unselected artifact integrity, vocabulary membership, statistical
independence and scientific eligibility unchecked, and implementation/environment
execution unattested. See the [evaluation checkpoint](evaluation-checkpoint.md) for
remaining methodology review and consumer-selection work.
