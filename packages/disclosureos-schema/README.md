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

## Experimental v2 documentary support

`@disclosureos/schema/experimental/v2` exports `evaluateAssessmentDocumentation` for records-owned claim histories. See the [profile contract and runnable synthetic example](../../docs/experimental/assessment-documentation.md). It checks declared support and supplied byte hashes, not scientific adequacy; existing v1 APIs and artifacts remain unchanged.

`evaluateAcquisitionBindings` additionally checks explicit raw-product/source mappings to instrument acquisition context and verifies supplied artifact hashes and lengths. See the [binding contract and local example](../../docs/experimental/acquisition-bindings.md). This is independent of assessment-documentation eligibility and does not authenticate physical instruments.

The experimental v2 entry point also exports `evaluateMeasurementBindings` and
`MeasurementBindingsSchema`. The single-channel profile links measurements to
acquisition-bound raw products, captured channels, and explicit nominal capture
times, then runs local acquisition artifact checks. It does not verify clock
uncertainty, artifact contents, or scientific eligibility. See the
[measurement bindings guide](../../docs/experimental/measurement-bindings.md).

`evaluateInstrumentResearchPrerequisites` composes the experimental documentary
and measurement profiles with declared calibration-use and timing reviews. Passing
means reviewed input documentation is present and consistent, not scientific
eligibility. See the [research prerequisites guide](../../docs/experimental/research-prerequisites.md).

`evaluateReproductionPacket` verifies exact-byte input inventories before composing
research prerequisites. It never executes bundled methods. See the
[reproduction packet guide](../../docs/experimental/reproduction-packet.md) for the
fixed TypeScript/Python synthetic control and the independent consumer's limits.

`evaluateDatasetRelease` groups pinned reproduction packets into explicit sessions,
checking membership, context identity, and nominal temporal containment. This first
profile requires member packet prerequisites and does not authorize publication.
See the [dataset release guide](../../docs/experimental/dataset-release.md).

`evaluateSourceIntake` and `SourceIntakeSchema` accept unassessed source-file
receipts with explicit unknown context. Identity validation does not establish
research eligibility. See the [source intake guide](../../docs/experimental/source-intake.md).

`evaluateDocumentationCompletion` explains the existing documentary profile with
per-assessment applicability, requirement status, blocked prerequisites and next
actions. It preserves validator diagnostics and computes no aggregate score.
See the [documentation completion guide](../../docs/experimental/documentation-completion.md).

The opt-in `evaluateInstrumentResearchCompletion` adds six required phase statuses and source-based next actions while preserving the research validator result. See the [research completion guide](../../docs/experimental/research-completion.md).

The experimental `evaluateResearchEvaluation` pins local packet/dependency bytes and hashes its computed research results. See [evaluation provenance](../../docs/experimental/evaluation-provenance.md) for unsigned receipt semantics and execution limits.

The experimental [released-document provenance profile](../../docs/experimental/released-documents.md) checks selected documentary sources and direct extractions with required and recommended groups, without imposing sensor requirements.

Experimental [historical-testimony provenance](../../docs/experimental/historical-testimony.md) checks selected account bytes, recording citations and direct extraction attribution without assigning credibility or requiring sensor data.

Experimental [physical-sample provenance](../../docs/experimental/physical-samples.md) checks collected-specimen declarations, custody continuity and cited record bytes without certifying material identity, composition or origin.

Experimental [provenance-profile receipts and replay](../../docs/experimental/profile-evaluation.md) pin inputs and reproduce the full released-document, testimony or collected-specimen result, including failed and unchecked outcomes.

Experimental [profile preparation](../../docs/experimental/profile-preparation.md) assembles exact existing inputs into a new private evaluation bundle, calculates byte pins and preserves failing or unchecked profile outcomes.
