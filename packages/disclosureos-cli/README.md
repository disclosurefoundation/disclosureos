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
disclosureos completeness   Measure how fully observations populate the schema
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
disclosureos completeness ./out/ --recursive
disclosureos completeness ./out/ --recursive --json
disclosureos registry origins --id 1.1.3
disclosureos info observable TO-3
```

`validate` also warns on **dangling evidence references** — `evidenceRefs` on a claim
that don't point to any evidence (`media:`, `sensor:`, …) present in the record.

## License

MIT © [Disclosure Foundation](https://disclosure.org)
