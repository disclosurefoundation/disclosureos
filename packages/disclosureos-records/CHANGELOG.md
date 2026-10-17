# Changelog

## 2.0.0-beta.4

### Major Changes

- Revise the V2 observable definitions and support vocabulary directly, and add shared catalog, immutable revision and term references with supplied-byte validation. Keep the chosen term separate from the subject under review and its supporting sources. Export full observable and attributed OCS origin catalogs with retained methodological context. Update enriched-observation and scoring consumers to the revised definitions. This breaks earlier beta definition and support assumptions; it does not establish an anomalous origin or turn a reported characteristic into a confirmed assessment.

### Minor Changes

- 0b00be3: Add an unreleased case-claim-history contract with exact case/entity/field and
  directed relationship subjects, scoped assertion and observation inputs, and
  attributable revision history. Resolve supplied case and observation snapshots
  without inferring scientific truth, a preferred reviewer or lifecycle changes.
  Hold npm publication and version bumps for coordinated V2 completion.
- 9580e62: Add an unreleased case-links contract for attributable context, research-entity
  and source-intake associations. Resolve exact case/observation/document snapshots
  and optional entity/field or inventory targets without inferring full supplement
  conformance, raw-artifact authenticity or publication authorization.
  Hold npm publication and version bumps for coordinated V2 completion.
- 559eac9: Add an unreleased case-record contract for pinned observation scope, sourced
  chronology and grouping, investigation reports and response declarations.
  Check local graph cycles and supplied observation references without inferring
  object identity, scientific corroboration, source authenticity or publication
  permission. Hold npm publication and version bumps for coordinated V2 completion.
- 5a686c1: Add unreleased laboratory analysis and result entities with explicit specimen,
  measurement and report references, and attributable material-review claims.
  Validate supplied entity and specimen-selection snapshots without inferring
  scientific validity, source-report authenticity or physical custody completeness.
  Hold npm publication and version bumps for the coordinated V2 completion release.
- 813ee2c: Add an unreleased research-entities 0.3.0 material foundation with physical specimens,
  uncollected traces, preparation lineage and specimen custody. Keep declared quality
  and analysis wording distinct from laboratory results or independent review. Reuse
  archival local-link validation without changing published schema contracts.

## 2.0.0-beta.3

### Minor Changes

- 4f80b20: Add research-entities 0.2.0 and claim-history 0.4.0 with exact document editions, digital artifact custody, scoped identifiers and attributable artifact reviews. Validate supplied snapshot references and edition-specific citations without inferring source authenticity or complete custody. Keep existing contract schemas and explicit entry points unchanged.

## 2.0.0-beta.2

### Minor Changes

- 25d01be: Add versioned public witness/account/procedure declarations and entity-addressed claim history with supplied-snapshot review. Preserve sourced qualifications, historical precision, missingness and attributable credibility vocabulary without calculating credibility scores. Existing contracts and profile dispatch remain unchanged.

## 2.0.0-beta.1

### Minor Changes

- 9e7c76a: Add experimental observation-context 0.1.0 and an explicit claim-history 0.2.0 parser for typed context entity/field subjects and assertion inputs. Resolve caller-supplied exact document snapshots, preserve descriptive vocabularies and missingness, and link contextual quantities to existing measurements. Existing schema identities and claim-history 0.1.0 remain unchanged. No source authentication, time normalization or sensor-fusion validation is implied.

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
