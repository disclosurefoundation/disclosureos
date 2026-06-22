# @disclosureos/examples

Runnable, type-checked examples for the [DisclosureOS](https://github.com/disclosurefoundation)
foundation packages. Not published — this package exists so the examples stay honest
(they type-check and run against the real packages in CI).

## Golden path

[`golden-path.ts`](./golden-path.ts) takes one observation (the 2004 USS Nimitz
"Tic Tac" encounter) through every part of the standard:

| Step | Part | What it does |
|---|---|---|
| 1 | **records** | `createObservation` + `createSensorReading` — the core record and the sensor evidence its claims cite |
| 2 | **observables** | `createObservableClaim` → `observableAssessments` — anomalous traits |
| 3 | **origins** | `createOriginClaim` → `origin` — competing explanations |
| 4 | **claims** | Shared attribution and evidence references inside observable and origin assessments |
| 5 | **schema** | `parseEnrichedObservation` — validate core + slots in one call, **without stripping** |
| 6 | **scoring** | `getCompleteness` + `score` — how documented / how compelling |

Schema is the portable contract that validates the enriched record. It is a supporting package, not another part of the standard.

Run it:

```bash
pnpm --filter @disclosureos/examples golden-path
```

## Migration path

[`migration-path.ts`](./migration-path.ts) demonstrates how to migrate an existing
dataset onto the standard. It reads a small JSON fixture
([`migration-fixture.json`](./migration-fixture.json)), maps each row to an
`Observation`, validates the output, and scores completeness.

| Step | What it does |
|---|---|
| 1 | Define the source row shape |
| 2 | Map dates with honest precision (`dateCertainty`, `dateGranularity`) |
| 3 | Convert rows with guarded enums, stable IDs, `dataSourceId`, and `extensions.rawRow` |
| 4 | Quarantine rows that fail instead of dropping them |
| 5 | Validate with `parseEnrichedObservation` as a second gate |
| 6 | Score completeness to see what enrichment should target next |

This is the runnable companion to the [Data Migration guide](https://os.disclosure.org/docs/platform/guides/data-migration).

Run it:

```bash
pnpm --filter @disclosureos/examples migration-path
```

## CSV migration path

[`migration-csv-path.ts`](./migration-csv-path.ts) demonstrates the same migration
workflow but starts from a CSV file ([`migration-csv-fixture.csv`](./migration-csv-fixture.csv))
parsed with `csv-parse`. All CSV values arrive as strings, so the mapper handles
numeric parsing, empty-string guards, and composite location names.

Run it:

```bash
pnpm --filter @disclosureos/examples migration-csv-path
```

## Type-checking

All examples are type-checked in CI:

```bash
pnpm --filter @disclosureos/examples type-check
```
