# Experimental profile bundle preparation

`disclosureos profile prepare <plan.json> --out <new-directory>` builds a private,
reproducible evaluation bundle from explicitly mapped existing inputs. It calculates
byte pins, copies exact files, runs the selected fixed profile and saves its unsigned
receipt. It never fills in release citations, speaker identities, collection metadata
or custody history.

Preparation requires an existing history and profile selection. It guides file assembly
and pin calculation, not record extraction or scientific interpretation. Guided authoring
of selection declarations remains separate work.

## Start with the source records

1. Use `disclosureos profile list` to choose the applicable domain path. This command
   supports the three provenance workflows; instrument research retains its packet path.
2. Prepare the history and matching explicit selection using the existing profile
   contracts. Keep unavailable declarations unknown with their actual reasons.
3. Place the history, selection, available source records and declared dependency files
   in a local directory tree, then write a preparation plan that maps them explicitly.
4. Run preparation into a new directory. Inspect and check the resulting `evaluation.json`
   to review requirements and next actions, then use the existing replay command.

## Preparation plan

The strict `profile_preparation` contract has version `0.1.0`. It supplies an evaluation
`id`, an explicit `workflow`, relative `history` and `selection` paths, an `assets`
array and `dependencies`. The plan contains no byte pins; the CLI calculates them from
the actual files it reads.

```json
{
  "kind": "profile_preparation",
  "schemaVersion": "0.1.0",
  "id": "local-document-evaluation",
  "workflow": "released-documents:0.1.0",
  "history": "history.json",
  "selection": "selection.json",
  "assets": [
    { "ref": "source:report", "fileRef": "record", "path": "sources/report.pdf" }
  ],
  "dependencies": {
    "vocabularies": [
      { "ref": "vocabulary", "id": "REPLACE_WITH_ACTUAL_VOCABULARY_ID", "version": "REPLACE_WITH_ACTUAL_VERSION", "path": "dependencies/vocabulary.json" }
    ],
    "implementation": { "ref": "implementation", "id": "REPLACE_WITH_ACTUAL_IMPLEMENTATION_ID", "version": "REPLACE_WITH_ACTUAL_VERSION", "path": "dependencies/implementation.js" },
    "environment": { "ref": "environment", "id": "REPLACE_WITH_ACTUAL_ENVIRONMENT_ID", "version": "REPLACE_WITH_ACTUAL_VERSION", "path": "dependencies/environment.json" }
  }
}
```

The example above is a shape guide, not a real dependency declaration. Replace the
marked identities/versions with those of the supplied artifacts; do not claim that an
arbitrary file was the implementation or runtime used. Preparation preserves declarations
but does not authenticate them or execute supplied dependencies. It cannot establish a
complete software/runtime dependency closure automatically.

Paths are relative to the plan's directory. They can include nested folders, ASCII
letters/digits, dots, underscores, hyphens and spaces; each component must start with
an ASCII letter or digit. Absolute paths, URLs, dotfiles, `.`/`..` components and other
characters are rejected. For unsupported filenames, explicitly stage a byte-identical
copy under an accepted name and retain its original provenance in the history. Paths
are local instructions and are not copied into the evaluation manifest.

An asset's `ref` is its source reference in the profile, and `fileRef` is the generated
bundle's local file name. Source/file references must each be unique. Dependency refs
are unique and each vocabulary ID declares one version. Multiple input paths can name
the same original record if the explicit declarations need separate copies.

An empty asset list deliberately supplies no source bytes. An unavailable file must
not be listed as though it were present. Preparation never deletes or edits a source
reference in the history to match the supplied asset list. The resulting profile may
remain unchecked or fail, and its receipt preserves that outcome.

The schema and type are exported as `ProfilePreparationSchema`, `ProfilePreparation`
and `profilePreparationJsonSchema` from `@disclosureos/schema/experimental/v2`. JSON
Schema exports are `/experimental/v2/profile-preparation/schema` and its `/0.1.0` alias
on the schema package. Schema ID:
`urn:disclosureos:experimental:profile-preparation:0.1.0`. These additions are unreleased.

## Outputs and interpretation

```sh
disclosureos profile prepare ./input/plan.json --out ./new-bundle --json
disclosureos profile inspect ./new-bundle/evaluation.json
disclosureos profile check ./new-bundle/evaluation.json
node scripts/replay-profile-evaluation.mjs ./new-bundle
```

The new bundle contains `evaluation.json`, `receipt.json`, exact `history.json` and
`selection.json`, plus `assets/<fileRef>` and `dependencies/<ref>`. No existing output
directory is overwritten. Directories are created with mode `0700`, files with `0600`.
All inputs are read, pinned and evaluated before creating the destination. If a write
fails, the command removes only the new directory it created. Source files are unchanged.

Preparation's exit `0` means a bundle and receipt were created. It does **not** mean
the profile passed. JSON separates `success`, `profileStatus`, `profileSuccess` and
`receiptCreated`; `profile check` still exits `1` for failed/unchecked results.
Invalid plan structure exits `1`; invalid usage, file operations, duplicate references,
limits or malformed input JSON exit `2`. Failed preparation leaves no new bundle.

Well-formed histories/selections that fail a profile contract can be preserved with a
receipt of failure. Invalid UTF-8/JSON, BOM-prefixed JSON, missing listed files and empty
files are rejected. A record that disagrees with a history's declared source digest is
copied exactly and receives a failed profile result; preparation does not rewrite the
history's pin to make the mismatch disappear.

Metadata is bounded at 8 MiB, input count at 4,096, and input/generated bundle bytes at
256 MiB. Each relative path's intermediate directories and leaf file are checked against
symlinks. The plan directory and immediate output parent must be real directories.
These are bounded local operations, not a sandbox against concurrent filesystem changes
or hostile ancestors. Supplied dependency files are never run and URLs are never fetched.

Private permissions do not make the contents safe for publication. The bundle contains
full source metadata and potentially restricted records. Apply access policy before
sharing. Scientific eligibility, source authenticity and original execution attestation
remain unchanged from the [profile evaluation](profile-evaluation.md) limits.

## Run a fully synthetic preparation

Use Node 22 and Python 3 after building. Choose new directories:

```sh
pnpm build
node examples/v2/profile-evaluation-demo.mjs released-documents:0.1.0 /tmp/preparation-input
node packages/disclosureos-cli/dist/index.js profile prepare /tmp/preparation-input/preparation.json --out /tmp/prepared-output --json
node packages/disclosureos-cli/dist/index.js profile inspect /tmp/prepared-output/evaluation.json
node packages/disclosureos-cli/dist/index.js profile check /tmp/prepared-output/evaluation.json
node scripts/replay-profile-evaluation.mjs /tmp/prepared-output
```

The same demo accepts `historical-testimony:0.1.0` and `physical-samples:0.1.0`; each now
writes an explicit `preparation.json` alongside its synthetic inputs. No real partner
record, witness, specimen or scientific result is introduced. Existing profile and
receipt contracts remain unchanged.
