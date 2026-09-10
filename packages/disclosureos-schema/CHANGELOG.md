# Changelog

## 2.0.0-beta.1

### Minor Changes

- 9e7c76a: Add experimental observation-context 0.1.0 and an explicit claim-history 0.2.0 parser for typed context entity/field subjects and assertion inputs. Resolve caller-supplied exact document snapshots, preserve descriptive vocabularies and missingness, and link contextual quantities to existing measurements. Existing schema identities and claim-history 0.1.0 remain unchanged. No source authentication, time normalization or sensor-fusion validation is implied.

### Patch Changes

- Updated dependencies [9e7c76a]
  - @disclosureos/records@2.0.0-beta.1
  - @disclosureos/instruments@2.0.0-beta.1
  - @disclosureos/observables@2.0.0-beta.1
  - @disclosureos/origins@2.0.0-beta.1

## 2.0.0-beta.0

### Major Changes

- Prepare the coordinated v2 beta package set. This prerelease packages the merged
  experimental observation and claim contracts, acquisition and dataset exchange,
  versioned evaluation, and bounded migration tooling for external consumer testing.
  Existing root APIs and schema identities remain available; the new contracts keep
  explicit `/experimental/v2` imports. Observables and origins retain their existing
  catalogs within the pinned beta dependency graph. This is not a stable v2 release,
  scientific certification, or publication of partner data. See
  `docs/releases/2.0.0-beta.0.md` for package-specific scope and validation boundaries.

### Patch Changes

- Updated dependencies
  - @disclosureos/records@2.0.0-beta.0
  - @disclosureos/observables@2.0.0-beta.0
  - @disclosureos/origins@2.0.0-beta.0
  - @disclosureos/instruments@2.0.0-beta.0

All notable changes to `@disclosureos/schema` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased experimental work

- Add a bounded compatibility inventory and explicit, artifact-pinned sensor revision review without automatic measurement conversion.

- Add explicit standalone legacy score preservation plans and adapters, retaining historical versions and values separately from v2 evaluations.

- Add exact-ledger-pinned revision resolution plans with explicit select/defer decisions, preserved competing revisions and complete non-destructive planning reports.

- Add pinned migration review plans for explicit time/position mappings, preserved reviewer declarations and shared v2 validation. Reviewed candidates remain separate from imports and legacy evaluations.

- Add explicit profile-preparation plans and private bundle assembly from exact existing inputs, retaining profile failures and missingness without inventing source metadata.

- Add fixed provenance-profile evaluation receipts over exact history, selection, asset and dependency pins, with bounded local replay and independent payload-integrity checks. Failed and unchecked profile outcomes remain distinct from replay success.

- Add experimental collected-specimen provenance checks, explicit custody gaps, versioned selection schema and synthetic record fixture. Record hashes do not authenticate specimens, custody, composition or origin.

- Add experimental historical-testimony provenance checks, versioned selection schema, speaker/extractor traceability and non-blocking citation recommendations. Speaker identity, account accuracy and witness independence remain unchecked.

- Add selected released-document provenance with explicit release gaps, required byte/extraction checks and non-blocking citation recommendations. Assessment support and scientific eligibility remain unchecked.

- Add a fixed research-evaluation workflow with versioned input schema, exact-byte dependency pins and digest-bound computed-result receipts; failures remain failures and supplied implementation/environment execution remains unattested.

- Add opt-in research-completion guidance with required phase statuses, preserved early exits, and distinct missing versus rejected reviews and corrupt report bytes.

- Add opt-in documentation-completion checklists with explicit applicability, blocked prerequisites and actionable diagnostics, delegating to the unchanged documentary profile.

- Add experimental source intake with exact-byte local receipts, explicit unknown context and actionable gaps; CLI create, inspect and validate require no fabricated measurements or reviews.

- Add experimental dataset/session composition for pinned reproduction packets, with explicit membership, context conflict checks, and local dataset inspection/validation.

- Add exact-byte reproduction packets and independent TypeScript/Python synthetic control runners. Packet verification does not execute bundled code or certify scientific eligibility.

- Add the opt-in instrument research prerequisites profile, with purpose-specific calibration-use reviews, explicitly interpreted timing intervals, local report verification, and composed documentary and acquisition checks. Scientific eligibility remains unchecked.

- Add the opt-in v2 measurement bindings contract and single-channel capture profile, with local acquisition artifact verification. Existing contracts and package versions remain unchanged; scientific eligibility is not established by this profile.

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
