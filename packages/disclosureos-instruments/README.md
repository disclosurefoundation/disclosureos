# @disclosureos/instruments

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

The **UAP Sensor Manifest** — a per-sensor specification standard for detection
hardware in the [DisclosureOS](https://github.com/disclosurefoundation) ecosystem.
DisclosureOS records describe *what was observed*; a sensor manifest describes
*the hardware that produced the data*, so field missions and data drops from
different organizations are comparable, replicable, and verifiable.

Proposed by [ELDÆON](https://github.com/disclosurefoundation/disclosureos/pull/5)
and promoted into the framework as a foundation package.

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
package-owned pieces), **`@disclosureos/cli`** (tooling), and
**`@disclosureos/examples`** (the runnable golden path). *(You are here: **Instruments**.)*

> **See it end to end.** [`examples/golden-path.ts`](../../examples/golden-path.ts)
> takes one observation through every part — including a sensor manifest cited via
> `SensorReading.sensorRef` — in a single type-checked file. Run it with
> `pnpm --filter @disclosureos/examples golden-path`.

## The manifest is a standalone document

Unlike `observables` and `origins`, this package does not add a slot to
`Observation`. A `SensorManifest` is the standard's first standalone document
type: each organization publishes its own manifest (a catalog of its sensors),
and observations point at manifest entries from sensor readings:

```ts
import { createSensorReading } from '@disclosureos/records/factories';
import { sensorRef } from '@disclosureos/records/shared';

const reading = createSensorReading('passive_radar', 'radio_frequency', {
  id: 'r1',
  sensorRef: sensorRef('eldaeon', 'dionysus-passive-radar'), // "<org-slug>:<sensor-id>"
});
```

## What each sensor entry captures

The functional hardware context `SensorReading` deliberately does not carry:

- **Type mapping** — `recordsMapping` bridges each sensor to the
  `@disclosureos/records` `SensorType`/`DetectionMethod` enums; values outside
  those enums must carry a `proposedSensorType`/`proposedDetectionMethod` flag.
- **Timing provenance** — clock source (`atomic_clock`, `gps_disciplined`, …) and
  timestamp uncertainty. Multi-station correlation requires declared, not
  assumed, timing.
- **Measurements + uncertainty** — measured quantities with UCUM-style units and
  GUM uncertainty (`u_c`, `U`, `k`, type A/B).
- **Raw-data locators** — format and path convention, supporting a
  metadata-first architecture (circulate manifests widely, pull raw data on
  demand).
- **Calibration provenance** — the package's centerpiece. `currentMethod` (what
  the operator actually does today) is separated from `traceableReference` +
  `referenceInUse` (the reference it has identified, and whether it is used),
  under a maturity gradient:

  `none → candidate_identified → in_practice → documented`

  Declaring "no calibration" is valid and *useful* — the degree of calibration
  is known, which is the scientific requirement. Honest nulls are first-class
  throughout the calibration block.

## Install

```bash
pnpm add @disclosureos/instruments zod
```

## Usage

```ts
import {
  createSensorEntry,
  createSensorManifest,
  validateSensorManifest,
  formatSensorManifest,
} from '@disclosureos/instruments';

const radar = createSensorEntry('dionysus-passive-radar', 'Passive Bistatic Radar', 'radio_frequency', {
  recordsMapping: { sensorType: 'passive_radar', detectionMethod: 'radio_frequency' },
  timing: { timeSource: 'gps_disciplined' },
  calibration: {
    status: 'in_practice',
    currentMethod: 'continuous ADS-B truth association with match residuals recorded',
    traceableReference: 'ADS-B Exchange',
    referenceInUse: true,
  },
});

const manifest = createSensorManifest('ELDÆON', 'eldaeon', [radar]);

validateSensorManifest(manifest); // [] when valid — flat ValidationIssue[] otherwise
formatSensorManifest(manifest);   // "ELDÆON — 1 sensor across 1 modality"
```

Validate manifest files from the command line:

```bash
pnpm dlx @disclosureos/cli manifest validate ./manifests/eldaeon-sensors.json
```

## JSON Schema

The package emits a committed, drift-tested JSON Schema artifact
(`schema/sensor-manifest.schema.json`) hosted at:

```
https://os.disclosure.org/schema/instruments/1.0.0/sensor-manifest.json
```

Non-TS toolchains validate manifests against that `$id` directly.

## License

MIT © Disclosure Foundation
