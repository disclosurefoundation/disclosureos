# Experimental dataset releases and sessions

This experiment composes existing reproduction packets into a versioned release with explicit acquisition-session membership. It is a metadata layer over pinned packet inventories, not a raw telemetry format or a streaming platform.

Contract: `urn:disclosureos:experimental:dataset-release:0.1.0`.
Profile: `urn:disclosureos:experimental:profile:dataset-release`, version `0.1.0`, scope `pinned_packets_and_nominal_session_membership`.

This first profile requires every member reproduction packet to pass its own research-prerequisite profile. It is therefore a collection of reviewed observation packets, not yet a universal intake contract for raw, unassessed datasets. Incomplete inputs can be represented and diagnosed without receiving a passing profile. Direct raw-session intake and native adapters remain future work.

## Release and session rules

A release declares its ID, version, creation timestamp, title, description, access state, license declaration or explicit unknown, and a packet inventory. Each inventory entry supplies a local entry ID, the expected packet's own ID, SHA-256 of its exact manifest bytes, and byte length. Packet entry IDs and packet IDs must each be unique within the release.

Sessions have IDs, titles, a known half-open UTC interval or explicit unknown, and members identified by `packetRef` plus `acquisitionRef`. The acquisition reference is scoped to that packet's verified acquisition context. Every acquisition in each included context must be assigned, including acquisitions not selected by the packet's main measurement. Membership cannot be inferred from filenames, titles, proximity, or a convenience label.

The whole nominal acquisition interval must fit within its session. An acquisition interval can equal the session interval; an acquisition instant at the session's end is outside. Calendar validity and arbitrary fractional timestamp precision use the records UTC comparator. Unknown session time leaves its membership check unchecked. Session membership is not a simultaneity claim and does not propagate clock error or establish cross-instrument synchronization.

Cross-packet rules:

- One context ID must identify the same exact pinned context bytes throughout a release. Matching parsed values with differently serialized bytes do not satisfy this exact-byte rule.
- Observation IDs cannot be repeated through multiple packet entries in one release. This prevents duplicate inclusion; it is not scientific deduplication across differently named records.
- Distinct observations may share an identical context and acquisition. That shared acquisition must belong to the same session wherever referenced.
- Instrument, calibration, and other local IDs remain scoped to their context. Matching instrument labels in different contexts do not authenticate or merge physical instruments.
- Background and known-control classifications are carried from acquisitions without converting them into anomaly support.

Access and license fields record declarations. Unknowns do not become public access or permission. The evaluator does not determine redistribution rights, and a passing profile does not authorize publication.

## Library API

```ts
import { evaluateDatasetRelease } from '@disclosureos/schema/experimental/v2';

const result = await evaluateDatasetRelease(release, {
  packets: new Map([
    ['entry-id', {
      manifest: packetManifestBytes,
      files: new Map<string, Uint8Array>(/* packet file ID and complete bytes */),
    }],
  ]),
});
```

Every supplied byte buffer is snapshotted before asynchronous hashing. Each packet manifest must match its pin before its document is parsed. The evaluator then invokes `evaluateReproductionPacket` itself, retaining the full nested result. Missing packets, missing files, or unavailable hashing remain unchecked; integrity failures or known membership contradictions fail. Nested diagnostics remain under the corresponding packet result. If a context cannot be verified, dependent membership checks remain unchecked rather than guessing whether an acquisition exists.

`packets` reports manifest identity checks and nested validation. `sessions` reports per-member status and available acquisition classifications. `issues` separates structural, semantic, profile, and external diagnostics. A malformed release skips dependent checks; known local reference contradictions fail semantic validation. No empty release or empty session can pass structurally.

`scientificEligibility`, `authorization`, and `crossInstrumentIdentity` always remain `not_checked`. There is no scoring, automatic method execution, reviewer authentication, or implicit retrieval. Release ID/version labels do not themselves enforce immutability across calls; freeze or authenticate the release-manifest hash through distribution, just as with packet manifests.

JSON Schema exports: `@disclosureos/schema/experimental/v2/dataset/schema` and `/dataset/schema/0.1.0`. Existing schema identities and packet contracts remain unchanged. Ownership stays in `schema` while the independent dataset boundary is experimental; this increment does not introduce a datasets npm package.

## Try the two-session example

The supplied release is entirely synthetic, with one background session and one known-control session. These labels describe the fixture; they do not claim a real conventional-target observation. License metadata is explicitly unknown.

```sh
pnpm install --frozen-lockfile
pnpm --filter '@disclosureos/cli...' build
node packages/disclosureos-cli/dist/index.js dataset inspect examples/v2/dataset-demo/dataset.json
node packages/disclosureos-cli/dist/index.js dataset validate examples/v2/dataset-demo/dataset.json --json
node packages/disclosureos-cli/dist/index.js packet reproduce examples/v2/dataset-demo/packets/background/packet.json
```

The source commands are experimental and unreleased. Once installed from a local package build, use `disclosureos dataset inspect|validate <dataset.json> [--json]`.

Local layout:

```text
dataset.json
packets/
  <packet entry ID>/
    packet.json
    files/
      <packet file ID>
```

Inspection reads only the release manifest and leaves identity and membership unchecked. Validation preserves the library's full result in `validation`, with local read errors separately in `issues`. Human-readable output includes nested packet diagnostics. Exit codes are 0 for success, 1 for a failed/incomplete check, and 2 for usage or release-manifest reading errors.

The CLI rejects symlinked directories and files, caps the release and member manifests at 8 MiB each, and limits a run to 128 packets, 4096 total packet files, and 256 MiB total member-manifest/file bytes. These are input-size limits, not a bound on total process memory. No dataset-wide reproduction is implied; use the packet command for its supported synthetic control.

## Conformance and next work

`pnpm test:v2-dataset` covers shared context, conflicting revisions, duplicate observations, complete membership, UTC boundaries, packet integrity, unknowns, snapshot isolation, offline evaluation, and CLI parity. `pnpm emit:v2-dataset` emits the versioned schema.

Next: test this boundary against a representative ELDÆON native-file inventory, clarify session and clock semantics, and design raw/unassessed intake without forcing fabricated reviews. Full Python dataset conformance, physical identity reconciliation, general native format adapters, public projections, and scientific review remain open.
