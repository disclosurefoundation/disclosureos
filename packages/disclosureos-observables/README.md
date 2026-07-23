# @disclosureos/observables

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Anomaly-detection criteria for the [DisclosureOS](https://github.com/disclosurefoundation)
ecosystem — the **Observables** layer. It answers *"what anomalous characteristics did
the observation show?"* across two domains:

- **Technology** — the six AATIP-derived characteristics (`antigravity_lift`,
  `instantaneous_acceleration`, `hypersonic_no_signatures`, `low_observability`,
  `transmedium_travel`, `biological_effects`).
- **Biologics** — six indicators for non-human biology (`molecular_complexity`,
  `isotopic_provenance`, `non_standard_biochemistry`, `non_phylogenetic_genetics`,
  `anomalous_morphology`, `anomalous_bio_interaction`).

## The DisclosureOS model

DisclosureOS is a **six-part standard**. Each part answers one question about an
observation; `@disclosureos/schema` binds the package-owned pieces into one portable
contract (a single TS type + JSON Schema + non-stripping parse).

| Part | Package surface | Question it answers |
|---|---|---|
| **Records** | `@disclosureos/records` | *What was observed?* |
| **Observables** | `@disclosureos/observables` | *What anomalous characteristics did it show?* |
| **Origins** | `@disclosureos/origins` | *What might explain it?* |
| **Claims** | `@disclosureos/records/shared` | *Who assessed it, why, and on what evidence?* |
| **Scoring** | `@disclosureos/scoring` | *How complete / compelling is the case?* |
| **Instruments** | `@disclosureos/instruments` | *What hardware produced the data?* |

Supporting packages: **`@disclosureos/schema`** (the portable contract that composes the
package-owned pieces), **`@disclosureos/cli`** (tooling), and **`@disclosureos/examples`**
(the runnable golden path). *(You are here: **Observables**.)*

## Built on records

This package depends on [`@disclosureos/records`](../disclosureos-records), the shared
substrate — it reuses its confidence scales, attribution, and claim primitives rather
than re-defining them. Importing this package **augments** the `Observation` type with
the `observableAssessments` slot:

```typescript
import '@disclosureos/observables'; // `observation.observableAssessments` is now typed
```

> **See it end to end.** [`examples/golden-path.ts`](../../examples/golden-path.ts)
> takes one observation through every layer — records → observables → origins → scoring,
> validated as a whole by `@disclosureos/schema` — in a single type-checked file. Run it
> with `pnpm --filter @disclosureos/examples golden-path`.
>
> **Migrating an existing dataset?** See [`examples/migration-path.ts`](../../examples/migration-path.ts)
> and the [onboarding workspace](https://os.disclosure.org/onboard).

## Install

```bash
pnpm add @disclosureos/observables @disclosureos/records zod
```

## Quick start

```typescript
import { createObservableClaim } from '@disclosureos/observables';
import type { Observation } from '@disclosureos/records';

const observation: Observation = {
  // ...records core fields...
  observableAssessments: {
    technology: {
      antigravity_lift: [{ level: 'confirmed', confidence: 1, evaluatedBy: 'AATIP' }],
    },
  },
};
```

Each observable maps to an **array of claims** — multiple evaluators can assess the
same characteristic, and disagreement is first-class rather than overwritten.

> ⚠️ A raw `ObservationSchema.parse()` strips this slot. Validate enriched records with
> `validateObservableAssessments()` (this package) or `parseEnrichedObservation()` from
> [`@disclosureos/schema`](../disclosureos-schema).

## Subpath exports

| Subpath | Contents |
|---|---|
| `@disclosureos/observables` | `ObservableAssessmentMap`, `createObservableClaim`, `validateObservableAssessments` |
| `@disclosureos/observables/technology` · `/biologics` | Per-domain observable definitions |
| `@disclosureos/observables/assessment` | Assessment levels + claim types |
| `@disclosureos/observables/{labels,constants,guards,factories,formatters}` | The DX quintet |
| `@disclosureos/observables/schema` | The committed JSON Schema (`observables.schema.json`) |

## Standard Schema

The Zod schemas here implement [Standard Schema v1](https://standardschema.dev) via
their `~standard` property — a guarantee of Zod 4. Any Standard-Schema-compatible
validator or framework can consume them directly, with no DisclosureOS-specific adapter.

## License

MIT © [Disclosure Foundation](https://disclosure.org)
