# @disclosureos/records

Describe observations and retain their source relationships, missing information, accounts, documents, specimens and connected cases. Keep attributed assessments separate from the observation.

This README describes the **2.0.0-beta.4** API. Use one exact package version
throughout an application. Check [availability](https://os.disclosure.org/v2/docs/installation)
before installing; a source branch or packed candidate is not proof of npm
publication. For a candidate that is not yet published, use the verified local
tarballs. See the [release notes](https://github.com/disclosurefoundation/disclosureos/blob/codex/beta4-release-closure/docs/releases/2.0.0-beta.4.md)
for scope and verification. Avoid unversioned installs, which can select a different
API generation through `latest`.

## V2 entry point

Start with `parseExperimentalObservation` from `@disclosureos/records/experimental/v2`. Additional parsers cover context, research entities, claim histories and cases. The ordinary package root retains the earlier Observation API.

[Implementation guide](https://os.disclosure.org/v2/docs/records) · [Availability](https://os.disclosure.org/v2/docs/installation) · [Example viewer](https://os.disclosure.org/showcase)

## Install and try it

Once this version is available in the registry:

```sh
npm install --save-exact @disclosureos/records@2.0.0-beta.4
```

Save this as `first-record.mjs`, then run `node first-record.mjs` with Node.js 22:

```js
import { parseExperimentalObservation } from '@disclosureos/records/experimental/v2';

const observation = {
  kind: 'observation', schemaVersion: '0.1.0', id: 'first-observation',
  status: 'draft', createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z',
  eventTime: { state: 'unknown', reason: 'not_recorded' },
  position: { state: 'unknown', reason: 'not_collected' },
  sources: [], products: [], methods: [], frames: [], assertions: [],
  measurements: [], processing: [],
};

const result = parseExperimentalObservation(observation);
console.log(JSON.stringify({ success: result.success, checks: result.checks }, null, 2));
```

The result has `success: true`, structural and semantic checks `passed`, and
profile and external checks `not_checked`. An empty draft is structurally valid;
it is not a complete research record or a verified observation. Change the status
to `finished` to see a failed structural check, then inspect `result.issues`.

The document's `schemaVersion` and each schema identifier are independent of the
npm package version. The `/experimental/v2` import path is intentional in this beta.

## Additional API reference

<details>
<summary>Earlier composition APIs and detailed source-workflow reference</summary>

The following reference retains earlier APIs and source checkpoints. It is not the
V2 first-record tutorial. Installation commands here describe the candidate API
set; use the availability guidance above until that version is published.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Structured vocabulary for describing UAP observations — the **data dictionary** of
the [DisclosureOS](https://github.com/disclosurefoundation) ecosystem. Its primary
type, `Observation`, is the core unit every other package builds on.


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
> and the [onboarding workspace](https://os.disclosure.org/v2/inspect).

## Install

```bash
pnpm add @disclosureos/records@2.0.0-beta.4 zod
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

## Experimental v2 value primitives

The source tree includes an isolated `@disclosureos/records/experimental/v2` entry point for explicit missingness, typed time/position values, and source-value provenance. It is under development for v2 and is not available in the published package yet. Existing v1 entry points and schemas remain unchanged. See the [scope, examples, and limitations](https://github.com/disclosurefoundation/disclosureos/blob/main/docs/experimental/records-v2-primitives.md).


The same experimental entry point now exposes `ExperimentalObservationSchema` and `parseExperimentalObservation` for the integrated factual record, including uncertainty, frames, source selections, and processing lineage. See the [Observation contract and synthetic example](https://github.com/disclosurefoundation/disclosureos/blob/main/docs/experimental/observation-contract.md). External verification and research profiles remain explicitly unchecked.

Experimental source statements, attributed assessments, and revision history are documented in [Claim history](../../docs/experimental/claim-history.md). This additive contract remains separate from v1 and does not certify scientific support.


## Witnesses and accounts: C2a

The source tree adds public witness/account/procedure declarations, entity-addressed
claim history 0.3.0 and supplied-snapshot review, published in 2.0.0-beta.2.
See the [contract, worked example and
verification boundaries](../../docs/c2/README.md). Qualifications and reviewer
judgments remain separate; no credibility score is calculated.

## Document editions and digital custody: C2b candidate

The source tree adds research-entities 0.2.0 and claim-history 0.4.0 with exact
edition citations, digital custody actions, scoped identifiers and attributable
artifact reviews. These additions are not in published 2.0.0-beta.2. Existing
contract schemas and versioned entry points remain unchanged.

Use `parseArchivalEntities` / `parseArchivalClaimHistory` from records and
`evaluateArchivalClaimHistory` from schema through their `/experimental/v2`
entries. A successful supplied-document check does not authenticate source
artifacts, complete custody or certify a scientific profile.
See the [contract guide](../../docs/c2/archival.md) and
[worked example](../../examples/v2/archival-editions-demo/README.md).

</details>
