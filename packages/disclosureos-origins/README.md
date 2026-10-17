# @disclosureos/origins

Describe origin hypotheses using the Origin Classification System, retaining definitions, hierarchy, qualifications and attribution. A listed hypothesis is not an established explanation.

This README describes the **2.0.0-beta.4** API. Use one exact package version
throughout an application. Check [availability](https://os.disclosure.org/v2/docs/installation)
before installing; a source branch or packed candidate is not proof of npm
publication. For a candidate that is not yet published, use the verified local
tarballs. See the [release notes](https://github.com/disclosurefoundation/disclosureos/blob/codex/beta4-release-closure/docs/releases/2.0.0-beta.4.md)
for scope and verification. Avoid unversioned installs, which can select a different
API generation through `latest`.

## V2 entry point

Use the catalog exports from the package root with the shared vocabulary-reference contract in `@disclosureos/records/experimental/v2`. Evaluate the reference through `@disclosureos/schema/experimental/v2`. Scientific-testability labels describe the framework and are not a validation of a particular claim. Physical, psychosocial and metaphysical categories remain distinguishable.

[Implementation guide](https://os.disclosure.org/v2/docs/origins) · [Availability](https://os.disclosure.org/v2/docs/installation) · [Example viewer](https://os.disclosure.org/showcase)

## Choose a package version

Once this version is available in the registry, install it explicitly:

```sh
npm install --save-exact @disclosureos/origins@2.0.0-beta.4
```

Use the same exact release for all DisclosureOS packages. Before publication,
review a verified source checkout or its locally packed artifacts. Packages are
ESM; Node.js 22 is the documented getting-started runtime.

## Additional API reference

<details>
<summary>Earlier composition APIs and detailed source-workflow reference</summary>

The following reference retains earlier APIs and source checkpoints. It is not the
V2 first-record tutorial. Installation commands here describe the candidate API
set; use the availability guidance above until that version is published.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Classification taxonomy for the [DisclosureOS](https://github.com/disclosurefoundation)
ecosystem — the **Origins** layer. It answers *"what might explain the observation?"*
via the **Origin Classification System (OCS)**: a tree of origin hypotheses across the
Physical, Psychosocial, and Metaphysical domains, plus typed mappings to the reference
systems researchers already use (Hynek, Vallée, AARO, GEIPAN).

## The DisclosureOS model


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
> and the [onboarding workspace](https://os.disclosure.org/v2/inspect).

## Install

```bash
pnpm add @disclosureos/origins@2.0.0-beta.4 @disclosureos/records@2.0.0-beta.4 zod
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

## Shared V2 vocabulary references

`createOriginCatalog({ id, revision, publishedBy, publishedAt })` exports the full OCS taxonomy in the records-owned `VocabularyCatalog` envelope. It retains node hierarchy, aliases and qualifications in `extensions["org.disclosureos.origins"]`, and records OCS attribution on the catalog. `readOriginTermDefinition(term)` validates and returns the complete node, or `undefined` for an unrelated or malformed term.

Retain and hash the serialized catalog before creating a reference. Catalog membership identifies a hypothesis; it does not select that hypothesis or establish an origin. The vocabulary reference remains separate from the reviewed subject and supporting sources. See [RFC 0007](../../docs/rfcs/0007-vocabulary-references.md) for the shared binding contract.

</details>
