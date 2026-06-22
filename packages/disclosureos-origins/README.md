# @disclosureos/origins

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Classification taxonomy for the [DisclosureOS](https://github.com/disclosurefoundation)
ecosystem — the **Origins** layer. It answers *"what might explain the observation?"*
via the **Origin Classification System (OCS)**: a tree of origin hypotheses across the
Physical, Psychosocial, and Metaphysical domains, plus typed mappings to the reference
systems researchers already use (Hynek, Vallée, AARO, GEIPAN).

## The DisclosureOS model

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
package-owned pieces), **`@disclosureos/cli`** (tooling), and **`@disclosureos/examples`**
(the runnable golden path). *(You are here: **Origins**.)*

## Built on records

This package depends on [`@disclosureos/records`](../disclosureos-records), the shared
substrate — it reuses its confidence and claim primitives. Importing this package
**augments** the `Observation` type with the `origin` slot:

```typescript
import '@disclosureos/origins'; // `observation.origin` is now typed
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
pnpm add @disclosureos/origins @disclosureos/records zod
```

## Quick start

```typescript
import { createOriginClaim, getNode } from '@disclosureos/origins';
import type { Observation } from '@disclosureos/records';

const observation: Observation = {
  // ...records core fields...
  origin: [
    { primaryHypothesis: '1.1.3', confidence: 0.9, evaluatedBy: 'analyst-a' },
  ],
};

getNode('1.1.3'); // resolve an OCS node by id
```

The `origin` slot is an **array of competing claims** (one per evaluator/verdict), so
contested classifications are represented directly. Every `primaryHypothesis` /
`alternativeHypotheses` node id is validated against the live taxonomy.

> ⚠️ A raw `ObservationSchema.parse()` strips this slot. Validate enriched records with
> `validateOriginClassification()` (this package) or `parseEnrichedObservation()` from
> [`@disclosureos/schema`](../disclosureos-schema).

## Subpath exports

| Subpath | Contents |
|---|---|
| `@disclosureos/origins` | `OriginClaim`, `createOriginClaim`, `getNode`, `validateOriginClassification` |
| `@disclosureos/origins/taxonomy` (+ `/physical`, `/psychosocial`, `/metaphysical`) | The OCS tree + traversal |
| `@disclosureos/origins/reference/*` | Hynek · Vallée · AARO · GEIPAN reference systems |
| `@disclosureos/origins/{classification,labels,constants,guards,factories,formatters}` | Claims + the DX quintet |
| `@disclosureos/origins/schema` | The committed JSON Schema (`origins.schema.json`) |

## Standard Schema

The Zod schemas here implement [Standard Schema v1](https://standardschema.dev) via
their `~standard` property — a guarantee of Zod 4. Any Standard-Schema-compatible
validator or framework can consume them directly, with no DisclosureOS-specific adapter.

## License

MIT © [Disclosure Foundation](https://disclosure.org)
