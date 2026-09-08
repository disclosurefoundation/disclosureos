# Experimental research evaluation provenance

`evaluateResearchEvaluation` runs a fixed research-completion workflow over an
exact-byte reproduction packet and produces an unsigned, digest-bound receipt.
It binds the supplied packet, declared vocabulary snapshots, implementation and
environment artifacts, built-in rule versions, and computed packet/checklist results.
It accepts neither caller-supplied results nor executable custom policies.

This is a bounded WP08 increment in `@disclosureos/schema/experimental/v2`.
It covers the research prerequisite path. It does not combine assessment summaries,
legacy population coverage or arbitrary domain profiles into a single score.

Contract: `urn:disclosureos:experimental:research-evaluation:0.1.0`.
Policy: `urn:disclosureos:experimental:policy:research-evaluation`, version `0.1.0`.
Workflow: `research-completion:0.1.0`.

## Run the synthetic example

Use Node 22 from this repository after installing dependencies:

```sh
pnpm --filter '@disclosureos/schema...' build
node examples/v2/evaluation-provenance-demo.mjs > /tmp/research-evaluation.json
pnpm test:v2-evaluation
```

The example uses the existing synthetic reproduction packet, a clearly labeled
synthetic vocabulary, the local built schema bundle, and an environment description
containing Node/platform/architecture and the exact workspace lockfile text. It
generates pins from those actual local bytes. Different builds or environments can
therefore change the request identity. It is not a partner dataset or a scientific
reference vocabulary. The supplied bundle and lockfile are useful provenance
artifacts; this evaluator does not establish a complete executable dependency closure.

```ts
import { evaluateResearchEvaluation } from '@disclosureos/schema/experimental/v2';
const result = await evaluateResearchEvaluation(manifest, {
  packetBytes,       // exact UTF-8 reproduction-packet JSON bytes
  files,             // Map<packet file ID, Uint8Array>
  dependencyFiles,   // Map<dependency ref, Uint8Array>
});
```

The input JSON Schema is exported at `/experimental/v2/evaluation/schema` and
`/experimental/v2/evaluation/schema/0.1.0` on the schema package. These additions
are unreleased; no hosted schema URL or package publication is implied.

## Required identities and local bytes

The manifest declares `kind`, `schemaVersion`, a local `id`, the fixed `workflow`,
the packet's SHA-256 and byte length, and `dependencies`:

- `vocabularies`: one or more snapshots, each with `ref`, stable `id`, `version`,
  SHA-256 and byte length. A vocabulary identity can occur only once per manifest.
- `implementation`: the same identity and byte-pin fields for a supplied evaluator
  implementation artifact.
- `environment`: the same fields for its supplied environment description.

Dependency refs must be unique across these three roles. The packet and dependency
byte namespaces are separate from the packet's file namespace. Unreferenced entries
in caller maps are ignored and are not part of the evaluated record. The underlying
packet still enforces its own exhaustive referenced-file inventory.

All referenced packet files, including source documents, raw inputs, supporting
reports, analysis implementation and environment files, are checked using the
existing [reproduction packet](reproduction-packet.md) contract. Missing bytes,
length/digest mismatch, unsupported hashing or an unreadable packet prevent a
receipt. Supplied documents and all byte maps are copied before asynchronous work.
No URL is fetched and no supplied code is executed.

The dependency IDs and versions are declarations. Byte checks cannot establish
that a snapshot contains the declared vocabulary, that all used vocabularies were
supplied, or that the supplied implementation/environment matches the running
process. The result therefore reports `vocabularyMembership: not_checked`,
`implementationExecution: not_attested` and `environmentExecution: not_attested`.
Version strings alone cannot substitute for supplied pinned bytes.

## Computed results and receipts

The evaluator invokes the built-in packet validator and the research-completion
API itself. `packetValidation` preserves the invoked packet validator even when
it cannot reach the research checks. Once pinned documents can be decoded and the
research validator is reached, `output.packet` and `output.completion` preserve
both computed results. The checklist retains blocked phases and original review
outcomes. Nested diagnostics remain available without reducing them to a grade.

The receipt contains two exact JSON strings and their UTF-8 SHA-256/byte-length
pairs:

- `requestJson` includes the parsed manifest, generated rule identities and explicit
  limits. The manifest's packet digest transitively pins the packet inventory,
  methods and every referenced file. Its dependency entries pin supplied vocabulary,
  implementation and environment artifacts. Rule identities come from the running
  built-in evaluation, packet, research, completion, documentation, acquisition and
  measurement validators; callers cannot override them.
- `outputJson` includes the full computed packet and completion results, including
  expected/actual input pins, versioned contracts, diagnostics and unchecked fields.

Serialization `sorted-json-utf8:0.1.0` recursively sorts object keys with JavaScript's
standard string ordering, preserves array order, and uses standard `JSON.stringify`
string/number encoding. UTF-8 encoding adds no BOM or trailing newline. This is a
local explicitly versioned serialization, not a claim of RFC 8785 conformance.
The receipt carries the exact strings to avoid requiring another language to
reconstruct that serialization merely to check the hashes. Whitespace in source
packet/document files still matters because their original bytes are pinned.

A receipt is a reproducibility aid, not a signature, trusted timestamp, authorship
attestation or certification. Store both request and output identities together.
For independent checking, hash the exact supplied strings, inspect their pins and
rule versions, then rerun with the preserved bytes and compatible implementation.
Replacing an output changes its output digest; repinning changed inputs changes
the request identity. Neither operation proves that the new content is true.

## Status interpretation

| Field | Meaning |
| --- | --- |
| `checks.structural` | The evaluation manifest has the supported shape |
| `checks.semantic` | Manifest identity/ref checks and packet parsing checks attempted by the wrapper |
| `checks.external` | Required packet/dependency bytes and packet file pins were verified |
| `checks.evaluation` | The composed packet and research-completion prerequisite results |
| `checks.receipt` | Both exact serialized payloads were hashed and a receipt was produced |
| `success` | The evaluation prerequisites passed and a receipt was produced |

Read the nested validator checks for document/profile details; manifest-level
checks do not replace those results. A rejected review can produce
`evaluation: failed`, `receipt: passed`, and `success: false`: preserving that
failure is an intended auditable result. A structural/semantic failure inside a
decodable research input can likewise be recorded once the underlying research
validator runs. Unknown prerequisites remain unchecked. A receipt never promotes
these states to success. If final receipt hashing fails, the computed output is
retained but `receipt` is null.

Scientific eligibility stays unchecked. Analysis execution and environment execution
inside the packet are also unchecked. This workflow does not perform analysis,
validate vocabulary membership, authenticate reviewers, or establish calibration
and timing-model adequacy. Those are independent scientific/reproduction tasks.

## Coverage and remaining work

Tests exercise exact validator parity, schema/runtime agreement, stable receipts,
version/source changes, rejected reviews, malformed/missing/corrupt bytes, snapshot
isolation, offline behavior and hash failures. Legacy schemas and validators are
unchanged. Reviewed recommendation policies, additional domain profiles, assessment
summary/research consumer integration and CLI/Index presentation remain
separate increments; this contract does not mark all of WP08 complete.

The [independent integrity checker and local replay tools](receipt-replay.md) verify saved receipt bytes and compare them with the current fixed evaluator.
