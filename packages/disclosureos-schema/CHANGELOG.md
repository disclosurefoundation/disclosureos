# Changelog

All notable changes to `@disclosureos/schema` are documented here. The format is
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

### Patch Changes

- Updated dependencies [e6ff99c]
  - @disclosureos/records@1.1.0
  - @disclosureos/observables@1.0.1
  - @disclosureos/origins@1.0.1

## 1.0.0

Initial public release — the portable contract.

### Added

- `composeObservationSchema()` — merges the records core and every registered slot
  schema into one enriched `Observation` JSON Schema, tightening the root to
  `additionalProperties: false` while preserving the `extensions` bag.
- `parseEnrichedObservation()` — non-stripping validation of core + slots in one call,
  closing the strip hazard at the integration layer.
- `ExtensionRegistry` / `defaultRegistry` — the runtime mirror of the TS augmentation.
- `EnrichedObservation` convenience type and the committed composed schema
  (`schema/enriched-observation.schema.json`, draft 2020-12).
- ESM-only distribution.
