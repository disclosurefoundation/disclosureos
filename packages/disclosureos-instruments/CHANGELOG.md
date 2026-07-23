# @disclosureos/instruments

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
