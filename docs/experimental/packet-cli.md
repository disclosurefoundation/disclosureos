# A complete local packet workflow

The experimental CLI now provides one path from a supplied reproduction packet to inspection, validation, and a synthetic reproduction result. This is unreleased source functionality; the existing published CLI version does not yet include these commands.

## Try the supplied packet

Use Node 22 for the repository example. From a clean checkout of the canonical DisclosureOS repository:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@disclosureos/cli...' build
node packages/disclosureos-cli/dist/index.js packet inspect examples/v2/reproduction-demo/packet.json
node packages/disclosureos-cli/dist/index.js packet validate examples/v2/reproduction-demo/packet.json
node packages/disclosureos-cli/dist/index.js packet reproduce examples/v2/reproduction-demo/packet.json
```

Inspection reports the declared files and method without reading assets or claiming that their hashes match. Validation verifies the exact file bytes and invokes the shared research-prerequisite profile. Reproduction first requires validation to pass, then computes the supplied synthetic mean of −3 m/s with the declared tolerance of zero.

Once installed from a locally packed CLI, the equivalent command prefix is `disclosureos packet`.

## Inputs and output

Each command accepts exactly one manifest path. Files live in `files/<file ID>` beside that manifest, as in the supplied example. Paths resolve from the manifest location, independent of the current working directory. No output files are created or overwritten, and no network requests are made.

Add `--json` for machine-readable output:

```sh
node packages/disclosureos-cli/dist/index.js packet validate examples/v2/reproduction-demo/packet.json --json > validation.json
```

The CLI's `validation` field contains the unmodified public `evaluateReproductionPacket` result. It preserves profile and contract versions, all diagnostic codes and pointers, nested results, and unchecked statuses. Local file-reading problems appear separately in `issues`. Human-readable output includes the same validator diagnostic codes and messages.

| Command | Passing means |
| --- | --- |
| `inspect` | The manifest structure is readable and valid. File identity and research prerequisites remain unchecked. |
| `validate` | All required local files and the composed research-prerequisite checks pass. |
| `reproduce` | Validation passes and the built-in synthetic calculation matches both expected output and mapped measurement within the explicit tolerance. |

Exit status is `0` for success, `1` for a failed or incomplete check, and `2` for invalid command usage or an unreadable/malformed manifest. In particular, `not_checked` validation is not a successful CI run. A structurally invalid parsed manifest exits `1`. `--help` exits `0`.

The commands reject unknown flags and extra paths. The existing v1 `validate`, `manifest`, and `completeness` commands retain their previous behavior.

## Reproduction limits

The command implements only `synthetic-radial-velocity-mean`, version `1`, using the supplied control's explicit data mappings and m/s unit. Other method IDs or versions produce an unchecked reproduction result and exit `1`. There is no plugin loader or execution of code stored in a packet.

This is a third, built-in executor of the fixed synthetic algorithm. It is distinct from the pinned TypeScript and Python source implementations in the packet. Its result records the actual CLI executor ID/version, SHA-256 of the running bundled CLI, Node runtime, computed value, expected value, unit, and tolerance. It does not claim to have run either packet-supplied implementation or its environment. The library's `methodExecution` field remains unchanged; the separate `reproduction` field describes this CLI execution.

The manifest SHA-256 identifies the exact evaluated packet. Scientific eligibility remains unchecked even when validation and reproduction pass. Accepted review declarations are not automatically scientific approval. See [reproduction packet semantics](reproduction-packet.md) for the full limits and the independent Python runner.

## Local read limits

The CLI accepts regular files, rejects symlinked assets and a symlinked `files` directory, and does not recursively discover files. Manifest input is capped at 8 MiB. Validation/reproduction are capped at 4096 declared files and 256 MiB of combined file bytes, with limits checked against both declarations and actual reads. These are input-size limits, not a guarantee of total process memory usage; validators also retain parsed and copied data.

This bounded command is intended for small review packets. Streaming large native telemetry is future adapter work. A missing file remains an explicit unavailable input; the command does not download a substitute.

## Verification

`pnpm test:v2-packet-cli` exercises the built CLI as a subprocess, compares JSON validation with the library API, and checks exit codes, missing/corrupt files, local read limits, symlinks, unsupported methods, inert bundled code, and failed reproduction comparisons. The existing TypeScript/Python reproduction and v1 conformance suites continue to run separately.
