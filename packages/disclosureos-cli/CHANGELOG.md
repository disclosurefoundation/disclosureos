# Changelog

All notable changes to `@disclosureos/cli` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- c351793: `disclosureos validate` now warns when a `SensorReading.sensorRef` does not
  match the `"<org-slug>:<sensor-id>"` manifest convention — mirroring the
  existing malformed/dangling warnings for claim `evidenceRefs`.
- Updated dependencies [b373962]
- Updated dependencies [e6ff99c]
- Updated dependencies [19bad3d]
  - @disclosureos/instruments@1.0.0
  - @disclosureos/records@1.1.0
  - @disclosureos/schema@1.1.0
  - @disclosureos/scoring@1.1.0
  - @disclosureos/observables@1.0.1
  - @disclosureos/origins@1.0.1

## 1.0.0

Initial public release — developer tools for the DisclosureOS ecosystem.

### Added

- `scaffold` — generate typed observation/data-structure templates.
- `validate` — validate observation JSON files through `parseEnrichedObservation`;
  warns on dangling `evidenceRefs`.
- `completeness` — measure how fully observations populate the DisclosureOS schema.
- `registry` — introspect the field, observable, and origin registries.
- `info` — quick reference for types and definitions.
