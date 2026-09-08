# Changelog

All notable changes to `@disclosureos/cli` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased compatibility additions

- Add descriptive population-coverage naming while preserving legacy completeness results and schema identities.

## Unreleased experimental work

- Add exact-ledger-pinned revision resolution plans with explicit select/defer decisions, preserved competing revisions and complete non-destructive planning reports.

- Add immutable cross-batch staging ledgers with pinned receipts, exact batch deduplication, conservative candidate revision conflicts and self-contained verification.

- Add private reviewed-candidate export bundles, exact rerun reuse, destination conflict rejection and current-code verification with complete exported/pending/quarantine accounting.

- Add pinned migration review plans for explicit time/position mappings, preserved reviewer declarations and shared v2 validation. Reviewed candidates remain separate from imports and legacy evaluations.

- Add bounded v1 migration dry runs with exact input preservation, validated review drafts, per-field unresolved mappings and complete candidate/quarantine accounting.

- Add explicit profile-preparation plans and private bundle assembly from exact existing inputs, retaining profile failures and missingness without inventing source metadata.

- Add explicit profile listing, manifest inspection and bounded local evaluation with readable required/recommended checks, preserved full JSON results and separate receipt/profile status.

- Add experimental source intake with exact-byte local receipts, explicit unknown context and actionable gaps; CLI create, inspect and validate require no fabricated measurements or reviews.

- Add experimental dataset/session composition for pinned reproduction packets, with explicit membership, context conflict checks, and local dataset inspection/validation.

- Add `packet inspect`, `packet validate`, and `packet reproduce` for local v2 reproduction packets, with shared validator diagnostics and a fixed synthetic mean executor. Existing v1 commands and package versions remain unchanged.

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
