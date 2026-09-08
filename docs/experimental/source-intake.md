# Experimental source intake

A source file can arrive before its capture times, instrument history, calibration,
license, or scientific interpretation are established. Intake preserves that file
and records what is missing. It requires no Observation, measurement, claim, or
review. The contract is experimental and unreleased.

The `local_file_receipt_identity` profile checks that supplied local bytes match
an intake manifest. Passing does not establish research eligibility, artifact
contents, source authenticity, or permission to share. Unknown context remains
valid and produces actionable `gaps`, including for an empty file. A zero-byte
file can have a verified identity but supplies no measurement content.

## Receive files locally

Build the source CLI, then supply existing local files and a new destination:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@disclosureos/cli...' build
node packages/disclosureos-cli/dist/index.js intake create /path/to/source.bin /path/to/notes.txt --out /path/to/new-receipt --json
node packages/disclosureos-cli/dist/index.js intake inspect /path/to/new-receipt/intake.json --json
node packages/disclosureos-cli/dist/index.js intake validate /path/to/new-receipt/intake.json --json
```

An installed local package exposes the same `disclosureos intake` commands.
Creation reads the source bytes, assigns local artifact IDs, computes SHA-256 and
byte length, and writes copies under `files/<artifact ID>` alongside `intake.json`.
Original basenames are retained as metadata; absolute source paths are omitted.
Identical basenames receive distinct IDs. Source files are unchanged, destination
creation is exclusive, and existing directories are never overwritten. Files are
created with mode 0600 and directories with 0700, subject to the host filesystem.

Creation records `receivedAt` from the local machine clock. This is receipt time,
not acquisition time or a verified timestamp authority. Role, format, publisher,
access, license, instrument, calibration, clock, and acquisition time start as
explicitly unknown. No parsing, extension-based format inference, metadata
extraction, or source URI retrieval takes place.

Inspection reads only the manifest, checks its structure, and reports
`fileIdentity: "not_checked"`; semantic and file checks require validation.
Validation preserves the full public evaluator result under `validation`, with
CLI file-operation errors separately under `issues`. Exit codes: 0 success,
1 failed or incomplete validation, 2 usage or file-operation error.

Limits are 4096 files, 256 MiB combined source bytes, and an 8 MiB manifest.
These bound input size, not total memory use. The reader requires regular files,
rejects final-component symlinks, and validation rejects a symlinked `files`
directory. Paths must be in a trusted local directory; ancestor directories are
not a sandbox boundary. Intake performs no network operations.

## Declare context without altering source bytes

`SourceIntakeSchema` records `unknown` values with a nonblank reason or `declared`
values with text. `source.uri` optionally holds an HTTPS attribution link.
Access is `public`, `restricted`, or `unknown`; license is a declaration, not an
inferred permission. Artifact roles distinguish `native_raw`, `derived`,
`source_export`, `documentation`, and `unknown`. A JSON export combining multiple
feeds and computed summaries should not be relabeled as native raw telemetry.

Acquisition time may remain unknown or be declared as a UTC instant or nonempty
half-open interval. Semantic validation uses the existing precise UTC comparison
rules. Instrument, clock, and calibration declarations are descriptive intake
notes, not references to validated acquisition context. A declaration removes its
missingness prompt; it does not become independent verification.

If context becomes available, retain the original receipt and create a revised
manifest while preserving source bytes and artifact hashes. Save or authenticate
the manifest hash outside the receipt when distributing it. IDs alone do not
enforce immutability or authenticate a publisher. Do not publish restricted data
merely because integrity validation passes.

## Shared API and portable contract

```ts
import { evaluateSourceIntake } from '@disclosureos/schema/experimental/v2';

const result = await evaluateSourceIntake(manifest, {
  files: new Map([['file-1', sourceBytes]]),
});
```

The evaluator snapshots supplied byte buffers before asynchronous hashing. Invalid
structure or contradictory metadata skips dependent checks. Missing bytes or
unavailable hashing leaves identity unchecked; known length or hash mismatches
fail. Extra supplied buffers do not become part of the receipt. `issues` uses
stable codes and JSON pointers; `gaps` contains missingness reasons and next
steps. `researchEligibility`, `artifactContents`, and `authorization` remain
`not_checked`. The external stage does not claim authenticity after local hashes
match. Unknown metadata does not prevent the file identity profile passing.

The schema ID is `urn:disclosureos:experimental:source-intake:0.1.0`. JSON Schema
exports are `@disclosureos/schema/experimental/v2/intake/schema` and
`@disclosureos/schema/experimental/v2/intake/schema/0.1.0`. JSON Schema checks
structure; the evaluator additionally checks dates, uniqueness, and bytes.

Run `pnpm test:v2-intake` for independent JSON Schema/runtime parity, byte
integrity, unknown context, hashing failure, offline operation, and CLI tests.
`pnpm emit:v2-intake` regenerates the versioned artifact.

## Progression to analysis

Intake precedes the [reviewed packet workflow](reproduction-packet.md) and
[dataset/session composition](dataset-release.md). There is no automatic
promotion. The next step is to map documented source fields and native files to
acquisition context, preserving ambiguous clock and session interpretations.
Measurements and assessments can follow only when their supporting data and
meaning are established. General native-format adapters, full Python validation,
real partner review, scoring, and application adoption remain later work.

## Public-source smoke check

On September 7, 2026, local create and validate commands passed on the
[public ELDÆON JSON sample](https://eldaeon.com/data/sample-dataset.json):
1,724,578 bytes, SHA-256
`68d431e880ea31c559254ae0b9b2968912fcc73419c9a92b451e945786508795`.
The generated receipt retained nine unknown-context gaps. The sample and receipt
were kept outside the repository. This proves receipt integrity for that fetched
snapshot; it does not verify timing interpretation, calibration, or scientific
eligibility. The remote sample may change. Native-file mapping remains open.
