# Changelog

All notable changes to `@disclosureos/records` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.1.0

### Minor Changes

- e6ff99c: Add the instruments layer: the UAP Sensor Manifest standard
  (`@disclosureos/instruments@1.0.0`, first published alongside this release —
  see its own changelog).

  - **`@disclosureos/records`** — `SensorReading` gains optional `sensorRef`
    (`"<org-slug>:<sensor-id>"`, with `sensorRef`/`isSensorRef`/`parseSensorRef`
    helpers in `records/shared`); `SensorType` gains 18 instrument classes
    (infrasonic/ultrasonic sensors, ADS-B receiver, RF spectrum analyzer, passive
    radar, particle detector, atomic clock, GNSS receiver, fluxgate magnetometer,
    air-quality sensor, barometer, lightning detector, IMU, EEG, GSR, pulse
    oximeter, pupillometer, hardware RNG); `DetectionMethod` gains 7 methods
    (particle, gnss, time_reference, chemical, inertial, physiological, pressure).
    Records schema artifact bumped to `1.1.0`.
  - **`@disclosureos/schema`** — composed enriched-observation artifact re-emitted
    at `1.1.0` to carry the records changes.
  - **`@disclosureos/cli`** — new `disclosureos manifest validate <path...>`
    command (`--recursive`, `--json`) delegating to `validateSensorManifest`.

## 1.0.0

Initial public release — the core of the DisclosureOS standard.

### Added

- `Observation` — the primary record type — with `ObservationSchema` (Zod 4) and the
  non-stripping `validateObservation` validator.
- `@disclosureos/records/shared`: the cross-package substrate (`Confidence`,
  `Attribution`, `Claim` + `evidenceRef` helpers, `validateWith`, `schemaId`,
  `jsonSchemaEnvelope`, enum guards, branded ids).
- The `ObservationExtensions` extension point for satellite slots.
- The DX quintet (labels, constants, guards, factories, formatters, validators) and
  temporal / geo / media / extension subpaths.
- Committed JSON Schema artifact (`schema/records.schema.json`, draft 2020-12).
