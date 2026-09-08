# Experimental CLI profile selection

The CLI lists the available domain paths and runs an explicitly selected provenance
workflow. It does not guess a profile, grade a record or combine domain results.

## Choose the applicable path

```sh
disclosureos profile list
disclosureos profile list --json
```

The catalog describes applicability, limitations, command and rule identity for:

| Path | Use | Command |
| --- | --- | --- |
| Instrument research | Acquisition, timing, calibration and measurement records | `disclosureos packet validate <packet.json>` |
| Released documents | Selected public documents and direct extractions | `disclosureos profile check <evaluation.json>` |
| Historical testimony | Selected testimony accounts and extraction attribution | `disclosureos profile check <evaluation.json>` |
| Physical samples | Declared collected specimens and their custody records | `disclosureos profile check <evaluation.json>` |

These are experimental paths. The instrument path retains its existing packet contract;
it is not silently converted into a document or sample profile. Derived physical samples
and mixtures remain outside the collected-specimen profile. All paths retain their
existing unchecked scientific and authenticity limits.

For the three provenance profiles, the evaluation manifest's `workflow` must explicitly
name `released-documents:0.1.0`, `historical-testimony:0.1.0` or
`physical-samples:0.1.0`. The paired selection file identifies which sources or specimens
are checked. Do not change source kinds, access restrictions or lineage just to make a
chosen profile pass. Use the original records to determine applicability.

## Inspect before checking

```sh
disclosureos profile inspect /path/to/bundle/evaluation.json
disclosureos profile inspect /path/to/bundle/evaluation.json --json
```

Inspection checks manifest shape and reference uniqueness and reports its selected
workflow, rule identity, file counts and declared input size. It reads no history,
selection, source files or dependencies. A successful inspection does not mean those
inputs exist, match their pins, or meet a profile. Output explicitly retains
`inputIntegrity: not_checked`, `profileOutcome: not_checked` and `receipt: not_created`.

## Run the selected profile

```sh
disclosureos profile check /path/to/bundle/evaluation.json
disclosureos profile check /path/to/bundle/evaluation.json --json
```

Files are resolved beside the manifest, using the existing receipt-bundle layout:

```text
bundle/
  evaluation.json
  history.json
  selection.json
  assets/<fileRef>
  dependencies/<ref>
```

Keep both directories present, including an empty `assets` directory when no source
files are declared. Each file is matched to the manifest's exact byte pin. The CLI does
not follow URLs, load supplied dependencies as code, or substitute undeclared files.
The manifest controls which local files are passed to the existing evaluator.

Human output separates input integrity, profile outcome and receipt creation. Each
selected record or specimen has required/recommended statuses, reasons, blocked
prerequisites and next actions. No aggregate score is shown. A missing recommendation
can coexist with a passing profile; required gaps and failed checks cannot.

JSON output contains `selectedWorkflow`, the exact manifest hash, any local-read issues,
and the complete unmodified `evaluation` result from the public API, including its full
profile output and unsigned receipt. Local-read errors can prevent overall CLI success
even when a partial evaluator result exists. The check command performs no writes; it does not
save a receipt automatically. If needed, extract `evaluation.receipt` from the JSON
result and preserve the corresponding original inputs for the existing replay tool.
Do not treat the CLI's full JSON result envelope as a standalone receipt.

A manifest-declared file that is missing prevents receipt creation. Intentionally
omitting a source from the manifest's asset list supplies no bytes for that source and
can produce a receipt of an unchecked profile. This distinction preserves what was
actually evaluated. Receipt creation never upgrades a failed or unchecked outcome.
See [profile evaluation](profile-evaluation.md) for exact receipt and replay semantics.

## Exit codes and input limits

| Exit | Meaning |
| --- | --- |
| `0` | Catalog listed, manifest inspected, or selected profile passed with a receipt and no local-read errors |
| `1` | Invalid manifest contract, failed/unchecked profile, input-read problem or bounded-input limit |
| `2` | Invalid command usage, or unreadable/malformed manifest JSON |

The command accepts `--json`/`-j` and `--help`/`-h`. Unknown flags and extra positional
arguments are rejected. There is no `--auto` or `--profile` override: the manifest is
explicit. Metadata files are limited to 8 MiB, declared input files to 4,096, and total
manifest/input bytes to 256 MiB. Check requires real bundle and input directories and
regular leaf files; it rejects symlinks at those locations. These are local input
protections, not a sandbox against concurrent filesystem changes or hostile ancestors.
Human output escapes control characters; JSON preserves exact data.

The full result may include restricted source metadata, witness attribution and custody
labels. It is not a public projection. Apply access policy before sharing. Source
truth, scientific eligibility and original runtime attestation are not established.

## Try all three synthetic examples

Build with Node 22, then use new output directories:

```sh
pnpm build
node examples/v2/profile-evaluation-demo.mjs released-documents:0.1.0 /tmp/document-profile-cli
node examples/v2/profile-evaluation-demo.mjs historical-testimony:0.1.0 /tmp/testimony-profile-cli
node examples/v2/profile-evaluation-demo.mjs physical-samples:0.1.0 /tmp/sample-profile-cli
node packages/disclosureos-cli/dist/index.js profile list
node packages/disclosureos-cli/dist/index.js profile inspect /tmp/document-profile-cli/evaluation.json
node packages/disclosureos-cli/dist/index.js profile check /tmp/document-profile-cli/evaluation.json
node packages/disclosureos-cli/dist/index.js profile check /tmp/testimony-profile-cli/evaluation.json
node packages/disclosureos-cli/dist/index.js profile check /tmp/sample-profile-cli/evaluation.json
```

The demo now writes the explicit `evaluation.json` alongside its existing receipt and
inputs. Older bundles can recover that same manifest from `receipt.requestJson`'s
`manifest` member. Their receipt identities and replay format are unchanged. No real
partner record, witness account or specimen is used in these examples.

The [preparation command](profile-preparation.md) now assembles existing input files
and calculates evaluation pins. Guided selection authoring, web/Index integration and
access-aware public projection remain separate work.
Qualified methodology review and independent scientific validation also remain open;
see the [evaluation checkpoint](evaluation-checkpoint.md).
