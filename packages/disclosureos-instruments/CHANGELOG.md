# @disclosureos/instruments

## 2.0.0-beta.2

### Patch Changes

- Updated dependencies [25d01be]
  - @disclosureos/records@2.0.0-beta.2

## 2.0.0-beta.1

### Patch Changes

- Updated dependencies [9e7c76a]
  - @disclosureos/records@2.0.0-beta.1

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

All notable changes to `@disclosureos/instruments` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

### Major Changes

- b373962: Initial release: the **UAP Sensor Manifest** standard — the DisclosureOS
  standard's first standalone document type besides `Observation`.

  A `SensorManifest` catalogs one organization's detection hardware per sensor:
  modality, records-enum mapping, timing provenance, measurements with GUM
  uncertainty, raw-data locators, and calibration provenance under a
  `none → candidate_identified → in_practice → documented` maturity gradient.

  Ships the full DX quintet (labels, constants, guards, factories, formatters),
  `validateSensorManifest` (schema + unique-id + unflagged-mapping invariants),
  and a drift-tested JSON Schema artifact at
  `https://os.disclosure.org/schema/instruments/1.0.0/sensor-manifest.json`.

  Sensor readings in `@disclosureos/records` cite manifest entries through
  `SensorReading.sensorRef` (`"<org-slug>:<sensor-id>"`), and
  `@disclosureos/scoring` consumes manifests through the `calibrationTrust`
  evaluator-weight hook.

  Proposed by [ELDÆON](https://eldaeon.com/)
  ([#5](https://github.com/disclosurefoundation/disclosureos/pull/5)), the
  standard's first external contribution, and promoted into the framework as a
  foundation package.

### Patch Changes

- Updated dependencies [e6ff99c]
  - @disclosureos/records@1.1.0
