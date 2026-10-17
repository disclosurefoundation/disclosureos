# @disclosureos/scoring

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Reference scoring for the [DisclosureOS](https://github.com/disclosurefoundation)
ecosystem — the **Scoring** layer. Its legacy `Observation` APIs provide:

- **Population coverage** — the fraction of legacy schema field paths carrying a value.
  Presence does not establish documentation quality or analytical readiness.
- **Origin-only reference scoring** — a declared weighting of origin hypotheses. It is separate from V2 research summaries and does not establish scientific validity.

**Descriptive observable support does not measure anomaly strength.** `score()` and `rankByCompellingness()` reject an observation containing any nonempty observable claim list, including `not_indicated`. They do not substitute zero, infer absence, or allow a weighting override to bypass this boundary. Use V2 attributed assessments and profile evaluation for research results.

## The DisclosureOS model

DisclosureOS is a **six-part standard**. Each part answers one question about an
observation; `@disclosureos/schema` binds the package-owned pieces into one portable
contract (a single TS type + JSON Schema + non-stripping parse).

| Part | Package surface | Question it answers |
|---|---|---|
| **Records** | `@disclosureos/records` | *What was observed?* |
| **Observables** | `@disclosureos/observables` | *Which characteristics were described or investigated?* |
| **Origins** | `@disclosureos/origins` | *What might explain it?* |
| **Claims** | `@disclosureos/records/shared` | *Who assessed it, why, and on what evidence?* |
| **Scoring** | `@disclosureos/scoring` | *How complete / compelling is the case?* |
| **Instruments** | `@disclosureos/instruments` | *What hardware produced the data?* |

Supporting packages: **`@disclosureos/schema`** (the portable contract that composes the
package-owned pieces), **`@disclosureos/cli`** (tooling), and **`@disclosureos/examples`**
(the runnable golden path). *(You are here: **Scoring**.)*

## Consumes the foundation (does not augment it)

Unlike `observables` and `origins`, scoring **only consumes** the foundation — it
reads `observableAssessments` and `origin` but adds no slot to `Observation`. It
depends on `@disclosureos/records`, `@disclosureos/observables`,
`@disclosureos/origins`, and `@disclosureos/instruments`, so importing it gives
you those slots typed automatically.

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

## Population coverage

```typescript
import { getPopulationCoverage } from '@disclosureos/scoring';

const coverage = getPopulationCoverage(observation);
// { percentage, requiredPercentage, missing, ... }
```

Coverage counts populated fields. It does not certify documentation quality, anomalous behavior or readiness for an analysis. The `getPopulationCoverage` name requires this checkout or a release containing it; `getCompleteness` is the older name for the same counter.

## Origin-only reference scorer

`score()` remains available for observations without descriptive observable claims. It evaluates declared origin hypotheses under explicit weights and reports the spread across competing classifications. `rankByCompellingness()` applies the same restriction to every input and fails the batch if a descriptive claim would be interpreted as anomaly strength.

Do not remove descriptive claims merely to obtain a score. A characteristic such as apparent hover can describe an ordinary observation; its support tier cannot answer whether the event is anomalous. This implementation retires that automatic inference. It does not introduce a replacement anomaly-scoring methodology.

## Instrument trust (calibration provenance)

`calibrationTrust` turns published sensor manifests
([`@disclosureos/instruments`](../disclosureos-instruments)) into a scoring
input. It builds an `evaluatorWeight` policy that credits claims whose sensor
evidence resolves — via `SensorReading.sensorRef` — to a manifest entry with
real calibration provenance (`in_practice` / `documented` earn the most; see
`CALIBRATION_TRUST_WEIGHTS`).

```typescript
import { score, calibrationTrust } from '@disclosureos/scoring';

// This observation must contain no descriptive observable claim lists.
const result = score(originOnlyObservation, {
  evaluatorWeight: calibrationTrust(originOnlyObservation, [sensorManifest]),
});
```

The default gradient is deliberately conservative: unresolved sensors keep the
1.0 baseline (records that predate manifests are never penalized), and like
every `evaluatorWeight` policy it shifts only the consensus point — `range` and
`contested` still report the honest spread of what evaluators asserted.

## Subpath exports

| Subpath | Contents |
|---|---|
| `@disclosureos/scoring` | `score`, `rankByCompellingness`, `getPopulationCoverage`, legacy `getCompleteness`, `DEFAULT_WEIGHTS` |
| `@disclosureos/scoring/population-coverage` | Field-presence counter and `deriveFieldPaths` |
| `@disclosureos/scoring/completeness` | Legacy field-presence counter + `deriveFieldPaths` |
| `@disclosureos/scoring/compellingness` | Compellingness scoring + weights |
| `@disclosureos/scoring/schema` | The committed JSON Schema (`scoring.schema.json`) |

## Standard Schema

The Zod schemas here (`ScoreResultSchema`, `CompletenessResultSchema`, …) implement
[Standard Schema v1](https://standardschema.dev) via their `~standard` property — a
guarantee of Zod 4. Any Standard-Schema-compatible validator or framework can consume
them directly, with no DisclosureOS-specific adapter.

## License

MIT © [Disclosure Foundation](https://disclosure.org)

## Experimental v2 assessment summaries (unreleased)

`summarizeClaimHistory` from `@disclosureos/scoring/experimental/v2` groups current
attributed declarations by topic and subject, collapses exact copies, and discloses
shared inputs and differing outcome labels. It computes no aggregate score or
confidence interval and does not certify scientific eligibility. See the
[assessment summary guide](../../docs/experimental/assessment-summary.md).

The additive population-coverage names are unreleased. See the [coverage guide](../../docs/experimental/population-coverage.md) for retained counting rules, denominator limits and compatibility. Origin-only reference scoring is separate from experimental V2 assessment summaries and profile completion. Descriptive observable claims are never converted into anomaly strength.

[Assessment-summary provenance and replay](../../docs/experimental/summary-provenance.md) now pin the declared history and computed summary without verifying referenced source artifacts.

## Experimental v2 provider-authored scores (unreleased)

`ProviderScorePolicySchema` and `ProviderScoreResultSchema` retain a provider's
question, exact method revision, scale, source basis and separate derivation.
`evaluateProviderScore` validates declarations and supplied bytes without running
the method. `compareProviderScores` conservatively identifies results with the
same exact policy and source basis; it does not compute consensus or endorse a
provider. Numeric grades and ordinal levels are declared by each policy, not
universal DisclosureOS case grades.

See the [provider scoring guide](../../docs/experimental/provider-scoring.md)
and [reproducible fictional example](../../examples/provider-scoring/README.md).
