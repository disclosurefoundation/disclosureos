# @disclosureos/observables

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Descriptive characteristics for the [DisclosureOS](https://github.com/disclosurefoundation) ecosystem. An observable names something reported or investigated. The term does not establish that the characteristic occurred, that it is anomalous, or what caused it. Sources and measurements document the observation; attributed claims evaluate it.

The catalog has twelve terms in two editorial groups:

- **Technology-related characteristics:** apparent hover, abrupt motion, hypersonic motion and signature discrepancy, sensor detection discrepancy, apparent medium transition, and biological changes around an event.
- **Biological and material characteristics:** molecular complexity pattern, isotope ratio departure, molecular composition difference, unresolved sequence relationship, unresolved morphological characteristics, and reported biological interaction.

The category names do not establish a technological or biological origin. Each definition includes relevant observations, methods, interpretation limits and methodological references. This DisclosureOS vocabulary is not a reproduction of the original ATIP framework.

## The DisclosureOS model

DisclosureOS is a **six-part standard**. Each part answers one question about an
observation; `@disclosureos/schema` binds the package-owned pieces into one portable
contract (a single TS type + JSON Schema + non-stripping parse).

| Part | Package surface | Question it answers |
|---|---|---|
| **Records** | `@disclosureos/records` | *What was observed?* |
| **Instruments** | `@disclosureos/instruments` | *What hardware produced the data?* |
| **Observables** | `@disclosureos/observables` | *Which reported or investigated characteristics are being described?* |
| **Claims** | `@disclosureos/records/shared` | *Who assessed it, why, and on what information?* |
| **Origins** | `@disclosureos/origins` | *What might explain it?* |
| **Scoring** | `@disclosureos/scoring` | *How complete / compelling is the case?* |

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

## Install

```bash
pnpm add @disclosureos/observables @disclosureos/records zod
```

## Assessments in an enriched observation

```typescript
import { createObservableClaim } from '@disclosureos/observables';
import type { Observation } from '@disclosureos/records';

const observation: Observation = {
  // ...records core fields...
  observableAssessments: {
    technology: {
      apparent_hover: [{ level: 'reported', evaluatedBy: 'Example reviewer', rationale: 'The account describes apparent station keeping; range and support are unresolved.' }],
    },
  },
};
```

Each observable maps to an **array of claims** — multiple evaluators can assess the
same characteristic, and disagreement is first-class rather than overwritten.

> ⚠️ A raw `ObservationSchema.parse()` strips this slot. Validate enriched records with
> `validateObservableAssessments()` (this package) or `parseEnrichedObservation()` from
> [`@disclosureos/schema`](../disclosureos-schema).

## Shared V2 vocabulary references

Export a complete catalog using the shared records-owned envelope:

```typescript
import { createObservableCatalog, readObservableTermDefinition } from '@disclosureos/observables';

const catalog = createObservableCatalog({
  id: 'observables-v2-baseline',
  revision: '2026-10-13.1',
  publishedBy: 'Disclosure Foundation',
  publishedAt: '2026-10-13T00:00:00Z',
});
const definition = readObservableTermDefinition(catalog.terms[0]!);
```

Retain the serialized catalog bytes and hash them before creating a shared reference. A reference identifies the catalog, exact revision, retained bytes and term. It is separate from the subject under review and from supporting source references. See [RFC 0007](../../docs/rfcs/0007-vocabulary-references.md) for the shared contract and binding examples.

Core term fields are `id`, `label`, `description`, `code` and `category`. Methodological metadata is retained in the `org.disclosureos.observables` extension. `readObservableTermDefinition()` validates that metadata using the package-owned definition schema and returns `undefined` for unrelated or malformed terms. The shared catalog parser validates generic structure and membership; it does not endorse scientific claims in a third-party extension.

The support tiers in the enriched-observation map describe the available information. They are distinct from V2 claim outcomes such as `confirmed`, `absent` and `inconclusive`; there is no automatic conversion between them. Use the shared V2 reference when a definition must be reproducibly identified.

## Subpath exports

| Subpath | Contents |
|---|---|
| `@disclosureos/observables` | `ObservableAssessmentMap`, `createObservableClaim`, `validateObservableAssessments`, `createObservableCatalog`, `readObservableTermDefinition` |
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
