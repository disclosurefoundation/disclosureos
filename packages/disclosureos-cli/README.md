# @disclosureos/cli

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Developer tools for the [DisclosureOS](https://github.com/disclosurefoundation)
ecosystem — scaffold, validate, and inspect observations from the command line. It is
a **dev tool**, not a library. `validate` delegates to
[`@disclosureos/schema`](../disclosureos-schema)'s `parseEnrichedObservation` — the same
canonical enriched-validation contract library consumers use (core + every registered
slot, with unknown top-level keys rejected) — then layers on CLI-only niceties like
dangling-evidence-reference warnings, so it never re-implements or drifts from the
foundation's checks.

> **See it end to end.** [`examples/golden-path.ts`](../../examples/golden-path.ts)
> takes one observation through every layer — records → observables → origins → scoring,
> validated as a whole by `@disclosureos/schema` — in a single type-checked file. Run it
> with `pnpm --filter @disclosureos/examples golden-path`.
>
> **Migrating an existing dataset?** The [onboarding workspace](https://os.disclosure.org/onboard)
> provides a guided workflow. See also [`examples/migration-path.ts`](../../examples/migration-path.ts)
> and [`examples/migration-csv-path.ts`](../../examples/migration-csv-path.ts).

## Install

```bash
pnpm add -D @disclosureos/cli
# or run ad hoc
pnpm dlx @disclosureos/cli --help
```

## Commands

```text
disclosureos scaffold       Generate typed data structure templates
disclosureos validate       Validate observation JSON files
disclosureos population-coverage   Count populated legacy observation fields
disclosureos completeness          Legacy name for population coverage
disclosureos registry       Introspect field, observable, and origin registries
disclosureos info           Quick reference for types and definitions
disclosureos help           Show help
disclosureos version        Print version
```

## Examples

```bash
disclosureos scaffold observation --full
disclosureos validate ./data/ --recursive
disclosureos validate ./data/ --recursive --json
disclosureos population-coverage ./out/ --recursive
disclosureos population-coverage ./out/ --recursive --json
disclosureos registry origins --id 1.1.3
disclosureos info observable TO-3
```

`validate` also warns on **dangling evidence references** — `evidenceRefs` on a claim
that don't point to any evidence (`media:`, `sensor:`, …) present in the record.

## License

MIT © [Disclosure Foundation](https://disclosure.org)

## Experimental v2 packets (unreleased)

The source CLI adds `packet inspect`, `packet validate`, and `packet reproduce`.
These commands operate on local reproduction packets, preserve shared validation
diagnostics with `--json`, and never execute packet-supplied code. Reproduction is
limited to the built-in synthetic mean control; scientific eligibility remains
unchecked. Follow the [complete local workflow](../../docs/experimental/packet-cli.md)
for build commands, the supplied example, exit codes, and input-size limits.

`dataset inspect` and `dataset validate` extend that local workflow to releases of
multiple pinned packets. See the [two-session walkthrough](../../docs/experimental/dataset-release.md).

`intake create`, `intake inspect`, and `intake validate` receive unassessed local
source files with explicit unknown context. See the [source intake guide](../../docs/experimental/source-intake.md) for byte preservation, missingness, and limits.

The new population-coverage command is unreleased. It counts field presence, not analytical readiness. Its JSON and exit behavior match the legacy completeness command. See the [coverage guide](../../docs/experimental/population-coverage.md).

## Experimental profile selection

Use `disclosureos profile list` to compare the four domain paths,
`profile inspect <evaluation.json>` to inspect explicit selection without reading input
files, and `profile check <evaluation.json>` to run a pinned provenance profile.
Human output separates input integrity, profile outcome, receipt status and next actions;
`--json` preserves the full evaluator result. Instrument research retains `packet validate`.
See [profile CLI documentation](../../docs/experimental/profile-cli.md) for input layout,
exit codes and synthetic examples. This command does not choose profiles automatically
or publish results.

Experimental [profile preparation](../../docs/experimental/profile-preparation.md) assembles exact existing inputs into a new private evaluation bundle, calculates byte pins and preserves failing or unchecked profile outcomes.

## Experimental legacy migration dry run

`disclosureos migrate dry-run legacy.json --id source-namespace [--json]` prepares
review drafts and accounts for every input. Exact source bytes and historical fields
are retained in JSON output; scores and assessments are not promoted into v2 claims.
No imports or file writes occur. Exit 0 means candidates prepared, 1 means quarantined
rows, and 2 means an input/usage failure. See the
[mapping and compatibility checkpoint](../../docs/experimental/migration-dry-run.md)
for limits and remaining WP09 work.

### Explicit migration review

`disclosureos migrate review legacy.json review.json [--json]` checks a pinned review
plan and applies explicit time/position decisions to draft candidates. Source bytes,
review rationale and unresolved fields are retained; invalid rows are quarantined
without partial mappings. No imports occur. See the
[review contract and synthetic walkthrough](../../docs/experimental/migration-review.md).

### Private migration bundles

`disclosureos migrate export legacy.json review.json --out bundle [--json]` saves
reviewed candidates separately with pinned inputs and complete row accounting. Exact
reruns reuse a verified destination; conflicting contents are never overwritten.
`disclosureos migrate verify bundle [--json]` recomputes and checks every artifact.
These operations do not import records. See the
[bundle contract and walkthrough](../../docs/experimental/migration-export.md).

### Cross-batch migration ledger

`disclosureos migrate ledger bundle-a bundle-b --out ledger [--json]` records
verified bundles in a private snapshot, deduplicates exact batches and marks differing
revisions of a stable identity as conflicts. `migrate ledger-verify ledger [--json]`
recomputes the snapshot from retained inputs. These are staging receipts, not imports.
See the [ledger policy](../../docs/experimental/migration-ledger.md).

### Explicit revision resolution

`disclosureos migrate resolve ledger decisions.json [--json]` checks a ledger-pinned
select/defer plan and emits complete row dispositions and selected candidate pins.
Unmentioned identities stay unresolved. No candidates are changed or imported. See
the [resolution contract](../../docs/experimental/migration-resolution.md).

### Resumable local application

`disclosureos migrate apply ledger decisions.json --out store [--json]` materializes
explicitly selected candidates in a private local store, retains the full historical
ledger and publishes a completion receipt. Repeating the same operation resumes missing
files or reuses an exact completed store. `migrate apply-verify store [--json]` checks
the completed store. No Index database or read path is changed. See the
[local application contract](../../docs/experimental/migration-application.md).

### Local read-path activation and rollback

`migrate read-init --out selector --json` starts a private selector in legacy fallback
mode. `migrate read-activate selector store --id CURRENT_HEAD --json` selects a verified
completed store. `migrate read-path selector --json` returns the selected mode and
verified candidates. `migrate read-rollback selector EARLIER_HEAD --id CURRENT_HEAD
--json` restores an earlier selection without deleting stores or transition history.
The expected current head prevents conflicting concurrent changes. This is local
consumer plumbing; the Index website and database remain unchanged. See the
[read-path contract](../../docs/experimental/migration-read-path.md) for recovery and limits.

### Preserve standalone historical scores

`migrate legacy-scores scores.json plan.json --json` preserves explicitly declared
legacy completeness/compellingness outputs, their methodology versions and observation
associations. Every input row is retained as historical, pending review or quarantined.
The report preserves exact input bytes and excludes historical scores from v2 rankings;
it neither recalculates scores nor imports v2 evaluations. See the
[adapter contract](../../docs/experimental/migration-legacy-scores.md).

### Migration field dispositions and sensor revision review

`migrate compatibility legacy.json [sensor-review.json] --id namespace --json`
inventories mapped, retained-without-conversion and unresolved fields. Optional explicit
review pins an acquisition's manifest and supplied provenance without inferring
calibration or converting measurements. The review plan is exposed as
`MigrationCompatibilitySchema`, `MigrationCompatibility` and
`migrationCompatibilityJsonSchema` from `@disclosureos/schema/experimental/v2`.
See the [compatibility inventory contract](../../docs/experimental/migration-compatibility.md).

## Experimental v2 migration and compatibility

Start with the [developer compatibility guide](../../docs/experimental/migration-guide.md)
for breaking changes, parser/version boundaries, supported migration workflows,
exit handling, profile differences and non-destructive local rollback. This is an
experimental checkout workflow; merging package changes does not deploy the Index.
