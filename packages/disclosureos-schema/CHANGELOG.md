# Changelog

## 2.0.0-beta.4

### Major Changes

- Revise the V2 observable definitions and support vocabulary directly, and add shared catalog, immutable revision and term references with supplied-byte validation. Keep the chosen term separate from the subject under review and its supporting sources. Export full observable and attributed OCS origin catalogs with retained methodological context. Update enriched-observation and scoring consumers to the revised definitions. This breaks earlier beta definition and support assumptions; it does not establish an anomalous origin or turn a reported characteristic into a confirmed assessment.

### Minor Changes

- ebec21d: Add a versioned archival-case presentation and approved public projection preserving edition-specific pages, release/declassification declarations, selected custody links and gaps, legacy hash scope, and attributed edition review. Reuse internal snapshot capture without changing the testimony contract. No source authenticity or publication authorization is inferred from hashes.
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
- 0b30518: Add the experimental product source selection contract, JSON Schema, byte-verified
  evaluator and dependency-free reference reader for contiguous numerical arrays,
  CSV row partitions and declared constant-rate video frame intervals. Preserve
  separate calibration, scientific and media-decoding status. Publication remains
  deferred to the coordinated V2 release.
- 559eac9: Add an unreleased case-record contract for pinned observation scope, sourced
  chronology and grouping, investigation reports and response declarations.
  Check local graph cycles and supplied observation references without inferring
  object identity, scientific corroboration, source authenticity or publication
  permission. Hold npm publication and version bumps for coordinated V2 completion.
- 0370447: Add a versioned context-case presentation envelope and approved public projection linking selected context fields, ambient measurements, separate products and contextual assessments. Preserve the existing case-presentation contract. The new public payload is version 0.2.0. Publication and real-data activation remain application responsibilities.
- 5a686c1: Add unreleased laboratory analysis and result entities with explicit specimen,
  measurement and report references, and attributable material-review claims.
  Validate supplied entity and specimen-selection snapshots without inferring
  scientific validity, source-report authenticity or physical custody completeness.
  Hold npm publication and version bumps for the coordinated V2 completion release.
- 3b75904: Add an optional static lidar point-cloud profile with reusable source reader, strict acquisition bindings, complete pulse availability and return groups, declared local coordinates, normalized intensity and attributed classifications. Include a deterministic fictional source packet, portable JSON Schema, conformance tests and documentation. No LAS decoder or physical-accuracy certification is implied.
- c894a08: Add an explicitly approved public material and laboratory case presentation with specimen-scoped results, declared lineage and custody, attributed review inputs, and consistent public outputs. Capture referenced specimen-selection snapshots before asynchronous validation.
- 11bf318: Add an optional single-hydrophone pressure and reproducible spectral-density profile. Public schemas, source readers and evaluation bind pressure and retention masks to exact acquisition products and derived Hann-windowed spectra, preserving unavailable samples separately from zero. The synthetic source packet demonstrates source-window selection, spectral units, complete processing lineage and numerical reproduction without claiming physical calibration or localization.
- 0319e40: Add an unreleased case presentation contract and an explicitly approved public
  projection for narrative, citations, selected case assessments and attachments.
  Generate renderer data, JSON, Markdown, search and metadata from the same allowlist.
  Application authorization, asset delivery and revocation remain integration requirements.
  Hold package version bumps and npm publication for coordinated V2 completion.
- 4ace4ea: Add an optional V2 rotating-radar profile over existing observation, acquisition
  and source-selection contracts. Validate source bytes, scan/dwell semantics,
  threshold detections, declared localization, track associations, position
  covariance and separation from synthetic truth. Include a dependency-free reader,
  portable JSON Schema and deterministic fixed, airborne and shipborne scanning examples.
  Moving platforms retain one pose per dwell, declare beam reference and optional
  slant-to-plane projection, and validate motion compensation and conditional uncertainty. Passing validation does
  not establish physical calibration or tracking performance. Publication remains
  deferred to the coordinated V2 release.

  Add separate optional steered-radar and cooperative secondary-radar profiles,
  public dependency-free readers, package-exported portable schemas and complete
  reproducible examples. Steered arrays retain arbitrary beam schedules and
  per-dwell processing availability. Secondary reports preserve Mode A codes,
  nullable Mode C pressure altitude, invalid receptions and exact reply lineage
  without inventing reflected power, geometric height or verified identity.

  Allow retained header-only CSV layouts for legitimate empty outcomes while
  rejecting row selection, partition and sample mappings into empty tables.

  Add optional fixed-site preprocessing with independently retained reference power,
  reproducible background means and residual arrays, and explicit detector-policy
  exclusions that preserve the raw capture. Add source-backed local site geometry
  and complete ground and civilian airport surface examples. Validate acquisition
  identity, time, axes, arithmetic, detector inputs and synthetic-truth separation.
  These declarations do not imply physical coverage or identify detected objects.

- e19a897: Add an optional multispectral satellite raster profile with explicit projected pixel geometry, per-band scaling and missing values, attributed pixel quality, exact retained source selections and quality-gated NDVI. Include a dependency-free reader, strict acquisition and byte-integrity evaluation, portable schema, deterministic fictional packet and conformance tests. This does not certify physical calibration or decode GeoTIFF/COG products.
- 6f74e57: Add an optional monostatic active-sonar envelope profile with a portable schema, dependency-free source reader, exact cell selection and a validator over existing observation, acquisition and source-layout contracts. The profile declares assumed sound speed and two-way distance conversion, preserves receive availability separately from zero amplitude, and includes a reproducible synthetic example. Validation does not certify propagation accuracy, physical calibration, bathymetry or object identity.
- e7c3d0f: Add an explicitly approved testimony-case public projection for selected pseudonym, event quarter, recorded accounts and attributed qualification review. Keep recording dates, missing wording and unknown independence distinct. No raw research entities, private identities, source URIs or review notes enter public outputs. Existing presentation contracts remain unchanged.

### Patch Changes

- Updated dependencies [0b00be3]
- Updated dependencies [9580e62]
- Updated dependencies [559eac9]
- Updated dependencies [5a686c1]
- Updated dependencies [813ee2c]
- Updated dependencies
  - @disclosureos/records@2.0.0-beta.4
  - @disclosureos/observables@2.0.0-beta.4
  - @disclosureos/origins@2.0.0-beta.4
  - @disclosureos/instruments@2.0.0-beta.4

## 2.0.0-beta.3

### Minor Changes

- 4f80b20: Add research-entities 0.2.0 and claim-history 0.4.0 with exact document editions, digital artifact custody, scoped identifiers and attributable artifact reviews. Validate supplied snapshot references and edition-specific citations without inferring source authenticity or complete custody. Keep existing contract schemas and explicit entry points unchanged.

### Patch Changes

- Updated dependencies [4f80b20]
  - @disclosureos/records@2.0.0-beta.3
  - @disclosureos/instruments@2.0.0-beta.3
  - @disclosureos/observables@2.0.0-beta.3
  - @disclosureos/origins@2.0.0-beta.3

## 2.0.0-beta.2

### Minor Changes

- 25d01be: Add versioned public witness/account/procedure declarations and entity-addressed claim history with supplied-snapshot review. Preserve sourced qualifications, historical precision, missingness and attributable credibility vocabulary without calculating credibility scores. Existing contracts and profile dispatch remain unchanged.

### Patch Changes

- Updated dependencies [25d01be]
  - @disclosureos/records@2.0.0-beta.2
  - @disclosureos/instruments@2.0.0-beta.2
  - @disclosureos/observables@2.0.0-beta.2
  - @disclosureos/origins@2.0.0-beta.2

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
