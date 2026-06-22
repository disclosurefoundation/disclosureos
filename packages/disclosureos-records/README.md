# @disclosureos/records

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Structured vocabulary for describing UAP observations — the **data dictionary** of
the [DisclosureOS](https://github.com/disclosurefoundation) ecosystem. Its primary
type, `Observation`, is the core unit every other package builds on.

DisclosureOS is a **five-part standard**. Each part answers one question about an
observation; `@disclosureos/schema` binds the package-owned pieces into one portable
contract (a single TS type + JSON Schema + non-stripping parse).

| Part | Package surface | Question it answers |
|---|---|---|
| **Records** | `@disclosureos/records` | *What was observed?* |
| **Observables** | `@disclosureos/observables` | *What anomalous characteristics did it show?* |
| **Origins** | `@disclosureos/origins` | *What might explain it?* |
| **Claims** | `@disclosureos/records/shared` | *Who assessed it, why, and on what evidence?* |
| **Scoring** | `@disclosureos/scoring` | *How complete / compelling is the case?* |

Supporting packages: **`@disclosureos/schema`** (the portable contract that composes the
package-owned pieces), **`@disclosureos/cli`** (tooling), and
**`@disclosureos/examples`** (the runnable golden path). *(You are here: **Records**.)*

## records is the shared vocabulary

`records` has no DisclosureOS dependencies — it depends only on [Zod](https://zod.dev).
The other layers depend on **it**: they import shared primitives (confidence scales,
attribution, claims, validation, JSON-Schema helpers) from `@disclosureos/records/shared`
instead of re-inventing them. Import a layer package and its slot is automatically
typed on `Observation` (see [The extension point](#the-extension-point)).

New to the vocabulary? The [glossary](../../docs/disclosureos-glossary.md) defines the
terms that are easy to conflate — Attribution vs Claim vs Assessment, `confidence` vs
`ConfidenceLevel` vs `SourceCredibility`, and `alternativeHypotheses` vs `contested`.

> **See it end to end.** [`examples/golden-path.ts`](../../examples/golden-path.ts)
> takes one observation through every part — records → observables → origins → claims → scoring,
> validated as a whole by `@disclosureos/schema` — in a single type-checked file. Run it
> with `pnpm --filter @disclosureos/examples golden-path`.
>
> **Migrating an existing dataset?** See [`examples/migration-path.ts`](../../examples/migration-path.ts)
> and the [onboarding workspace](https://os.disclosure.org/onboard).

## Install

```bash
pnpm add @disclosureos/records zod
```

## Quick start

```typescript
import { ObservationSchema, validateObservation, type Observation } from '@disclosureos/records';

const observation: Observation = {
  id: 'nimitz-2004',
  temporal: { date: '2004-11-14', dateCertainty: 'exact' },
  location: { id: 'l', name: 'Pacific', country: 'US', longitude: -117, latitude: 32, siteType: 'ocean' },
  status: 'published',
  createdAt: '2004-11-14T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const issues = validateObservation(observation); // [] when valid
```

## The extension point

The satellite slots (`observableAssessments`, `origin`) are **not** part of
`ObservationSchema` — `records` cannot import its own satellites. Instead each layer
package augments the `Observation` type via `declare module '@disclosureos/records'`,
so simply importing the package types its slot:

```typescript
import '@disclosureos/observables'; // adds `observableAssessments` to Observation
import '@disclosureos/origins';     // adds `origin` to Observation
```

> ⚠️ **Strip hazard.** Because those slots aren't in the `z.object`, a raw
> `ObservationSchema.parse(record)` **silently drops** `observableAssessments` and
> `origin` (Zod strips unknown keys). To validate an enriched record:
> - use **`validateObservation(record)`** here — it returns issues *without* stripping
>   your object, or
> - use **`parseEnrichedObservation()`** from [`@disclosureos/schema`](../disclosureos-schema),
>   the non-stripping composed parse that validates core + slots in one call.
>
> Do not use a raw `.parse()` round-trip to "clean" an enriched record.

## Subpath exports

Each surface is independently importable (tree-shakeable):

| Subpath | Contents |
|---|---|
| `@disclosureos/records` | `Observation`, `ObservationSchema`, `validateObservation` |
| `@disclosureos/records/shared` | Shared primitives: `Confidence`, `Attribution`, `Claim`, `validateWith`, `schemaId`, … |
| `@disclosureos/records/temporal` · `/geo` · `/media` | Temporal, geographic, and media primitives |
| `@disclosureos/records/extensions/*` | Off-the-hot-path slots: `provenance`, `identifiers`, `testimony`, `physical`, `document` |
| `@disclosureos/records/{labels,constants,guards,factories,formatters,validators}` | The DX quintet |
| `@disclosureos/records/schema` | The committed JSON Schema (`records.schema.json`) |

## JSON Schema

A committed, versioned JSON Schema (draft 2020-12) ships at
`@disclosureos/records/schema`, `$id` hosted at `os.disclosure.org`. The core
`Observation` root is intentionally **open** so satellite slots compose in at the
all-packages step ([`@disclosureos/schema`](../disclosureos-schema)). Regenerate with
`pnpm --filter @disclosureos/records emit:schema`; a drift test keeps it honest.

## Standard Schema

The Zod schemas here (`ObservationSchema`, …) implement
[Standard Schema v1](https://standardschema.dev) via their `~standard` property —
a guarantee of Zod 4. Any Standard-Schema-compatible validator or framework
(`tRPC`, `TanStack Form`, …) can consume them directly, with no DisclosureOS-specific
adapter.

## License

MIT © [Disclosure Foundation](https://disclosure.org)
