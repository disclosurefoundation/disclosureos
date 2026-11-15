# @disclosureos/instruments

Describe the equipment and capture context behind a measurement, including exact manifest revisions, instrument instances, deployments, timing and calibration context.

This README describes the published **2.0.0-beta.6** package. Use this exact version
for all DisclosureOS packages in an application and commit your lockfile. The npm
`beta` tag selects V2; `latest` still selects V1. See the
[installation guide](https://os.disclosure.org/v2/docs/installation) and
[release notes](https://github.com/disclosurefoundation/disclosureos/blob/main/docs/releases/2.0.0-beta.6.md).

Beta 6 includes Zod 4.6.6 directly. New installations do not need a separate Zod
dependency or an override. The packages use ESM; the guides use Node.js 22.
Published beta APIs under `/experimental/v2` remain experimental. Document schema
versions and catalog revisions are separate from the npm package version.

## V2 entry point

Use `parseAcquisitionContext` from `@disclosureos/instruments/experimental/v2` for V2 captures. Sensor manifests remain available from the package root. Radar, sonar, lidar and satellite product profiles and readers live in `@disclosureos/schema/experimental/v2`. The Sensor Manifest originated with a contribution from ELDÆON.

[Implementation guide](https://os.disclosure.org/v2/docs/instruments) · [Availability](https://os.disclosure.org/v2/docs/installation) · [Example viewer](https://os.disclosure.org/showcase)

## Choose a package version

Install the published package:

```sh
npm install --save-exact @disclosureos/instruments@2.0.0-beta.6
```

Add other packages only when the implementation guide calls for them, using the
same exact release.

## Additional API reference

<details>
<summary>Earlier composition APIs and detailed source-workflow reference</summary>

This reference includes earlier root APIs and V2 APIs at their documented import
paths. They are available in the package version above. Repository examples that
use `pnpm --filter` require a source checkout; start with the linked implementation
guide for an installed-package workflow.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

The **UAP Sensor Manifest** — a per-sensor specification standard for detection
hardware in the [DisclosureOS](https://github.com/disclosurefoundation) ecosystem.
DisclosureOS records describe *what was observed*; a sensor manifest describes
*the hardware that produced the data*, so field missions and data drops from
different organizations are comparable, replicable, and verifiable.

Proposed by [ELDÆON](https://github.com/disclosurefoundation/disclosureos/pull/5)
and promoted into the framework as a foundation package.


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
pnpm add @disclosureos/instruments@2.0.0-beta.6
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
pnpm dlx @disclosureos/cli@2.0.0-beta.6 manifest validate ./manifests/eldaeon-sensors.json
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

## Experimental acquisition context

`@disclosureos/instruments/experimental/v2` adds pinned manifest, deployment, and channel-calibration history with explicit unresolved states. See the [contract and synthetic example](../../docs/experimental/acquisition-context.md). This additive metadata contract does not change the v1 manifest or certify scientific validity.

</details>
