# @disclosureos/schema

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

The **portable contract** for DisclosureOS. It composes the slot-bearing packages —
[`@disclosureos/records`](../disclosureos-records) (the core),
[`@disclosureos/observables`](../disclosureos-observables) (the
`observableAssessments` slot), and [`@disclosureos/origins`](../disclosureos-origins)
(the `origin` slot) — into one **enriched `Observation`** that means the same thing
in TypeScript, JSON Schema, and any other language.

DisclosureOS is a **six-part standard** (records → observables → origins → claims → scoring → instruments).
`schema` is the contract that *binds* records and the package-owned slots into one
portable artifact. It is a supporting package, not another part of the standard. (Scoring
consumes the enriched record, so it is not part of the composed schema.)

> ESM-only. CommonJS consumers can load it with a dynamic `import()`.

## Why this package exists

In TypeScript, importing the satellite packages augments `Observation` with their
slots. That augmentation is compile-time only — invisible to JSON Schema or Python,
and `ObservationSchema.parse()` silently **drops** the slots. This package closes
that gap with three things:

- **`composeObservationSchema()`** — merges the records core and every registered
  slot into one `enriched-observation.schema.json` (draft 2020-12). The root is
  tightened to `additionalProperties: false`, so unknown top-level keys are
  rejected while the `extensions` bag still carries third-party data.
- **`parseEnrichedObservation(value)`** — validates core + slots in one call
  **without stripping** them (it delegates to each package's own validator).
- **`ExtensionRegistry` / `defaultRegistry`** — the runtime mirror of the TS
  augmentation: a map of `slot → { owner, schemaId, version, jsonSchema, validate }`.
  Importing this package registers the first-party slots. The registry drives **both**
  `composeObservationSchema()` (JSON Schema) and `parseEnrichedObservation()`
  (validation), so registering a slot once wires it into both — nothing is hard-coded.

> **See it end to end.** [`examples/golden-path.ts`](../../examples/golden-path.ts)
> takes one observation through every part — records → observables → origins → claims → scoring,
> validated as a whole by `@disclosureos/schema` — in a single type-checked file. Run it
> with `pnpm --filter @disclosureos/examples golden-path`.
>
> **Migrating an existing dataset?** See [`examples/migration-path.ts`](../../examples/migration-path.ts)
> and the [onboarding workspace](https://os.disclosure.org/onboard).

## Install

```bash
pnpm add @disclosureos/schema @disclosureos/records @disclosureos/observables @disclosureos/origins zod
```

## Quickstart

```ts
import { parseEnrichedObservation, type EnrichedObservation } from '@disclosureos/schema';

const observation: EnrichedObservation = {
  id: 'nimitz-2004',
  temporal: { date: '2004-11-14', dateCertainty: 'exact' },
  location: { id: 'l', name: 'Pacific', country: 'US', longitude: -117, latitude: 32, siteType: 'ocean' },
  status: 'published',
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2020-01-01T00:00:00Z',
  observableAssessments: { technology: { antigravity_lift: [{ level: 'confirmed', confidence: 1 }] } },
  origin: [{ primaryHypothesis: '1.1.3', confidence: 0.9 }],
};

const result = parseEnrichedObservation(observation);
if (!result.success) console.error(result.issues);
// result.data still has observableAssessments + origin — nothing stripped.
```

## The composed JSON Schema

`schema/enriched-observation.schema.json` is the committed, versioned artifact
(`$id` at `https://os.disclosure.org/schema/schema/<version>/enriched-observation.json`).
Regenerate it after any layer-schema change:

```bash
pnpm --filter @disclosureos/schema emit:schema
```

A drift test fails if the committed file diverges from the emitted one. Because the
composed schema depends on three layer schemas, bumping a layer schema may bump this
artifact too.

## Standard Schema

`parseEnrichedObservation` delegates to each layer's own Zod validator, and those
schemas implement [Standard Schema v1](https://standardschema.dev) via their
`~standard` property (a guarantee of Zod 4). So the slot validators this package
composes are consumable directly by any Standard-Schema-compatible tool, with no
DisclosureOS-specific adapter.

## License

MIT © [Disclosure Foundation](https://disclosure.org)
