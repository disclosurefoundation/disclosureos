# @disclosureos/scoring

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Reference scoring for the [DisclosureOS](https://github.com/disclosurefoundation)
ecosystem — the **Scoring** layer. It turns an enriched `Observation` into two
orthogonal measures:

- **Completeness** — *is it well-documented?* What fraction of the record's fields are
  present.
- **Compellingness** — *is it anomalous / non-mundane?* Derived from the observable
  assessments and origin classification.

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
(the runnable golden path). *(You are here: **Scoring**.)*

## Consumes the foundation (does not augment it)

Unlike `observables` and `origins`, scoring **only consumes** the foundation — it
reads `observableAssessments` and `origin` but adds no slot to `Observation`. It
depends on `@disclosureos/records`, `@disclosureos/observables`, and
`@disclosureos/origins`, so importing it gives you those slots typed automatically.

> **See it end to end.** [`examples/golden-path.ts`](../../examples/golden-path.ts)
> takes one observation through every layer — records → observables → origins → scoring,
> validated as a whole by `@disclosureos/schema` — in a single type-checked file. Run it
> with `pnpm --filter @disclosureos/examples golden-path`.
>
> **Migrating an existing dataset?** See [`examples/migration-path.ts`](../../examples/migration-path.ts)
> and the [onboarding workspace](https://os.disclosure.org/onboard).

## Install

```bash
pnpm add @disclosureos/scoring @disclosureos/records @disclosureos/observables @disclosureos/origins zod
```

## Quick start

```typescript
import { score, getCompleteness, rankByCompellingness } from '@disclosureos/scoring';

const result = score(observation);
// { score, range: { low, high }, contested, ... }

const completeness = getCompleteness(observation);
// { percentage, requiredPercentage, missing, ... }

const ranked = rankByCompellingness([obsA, obsB, obsC]); // most-compelling first
```

Because evaluative slots hold **arrays of competing claims**, `score()` reports a
`range` (the spread across claims) and a `contested` flag when evaluators disagree —
not just a single point estimate.

## Subpath exports

| Subpath | Contents |
|---|---|
| `@disclosureos/scoring` | `score`, `rankByCompellingness`, `getCompleteness`, `DEFAULT_WEIGHTS` |
| `@disclosureos/scoring/completeness` | Completeness scoring + `deriveFieldPaths` |
| `@disclosureos/scoring/compellingness` | Compellingness scoring + weights |
| `@disclosureos/scoring/schema` | The committed JSON Schema (`scoring.schema.json`) |

## Standard Schema

The Zod schemas here (`ScoreResultSchema`, `CompletenessResultSchema`, …) implement
[Standard Schema v1](https://standardschema.dev) via their `~standard` property — a
guarantee of Zod 4. Any Standard-Schema-compatible validator or framework can consume
them directly, with no DisclosureOS-specific adapter.

## License

MIT © [Disclosure Foundation](https://disclosure.org)
