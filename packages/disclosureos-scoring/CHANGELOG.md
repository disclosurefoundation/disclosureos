# Changelog

All notable changes to `@disclosureos/scoring` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.1.0

### Minor Changes

- 19bad3d: Add `calibrationTrust` — calibration provenance from published sensor manifests
  (`@disclosureos/instruments`) as a scoring input. Builds an `evaluatorWeight`
  policy that credits claims whose sensor evidence resolves (via
  `SensorReading.sensorRef`) to a manifest entry with real calibration
  provenance, under an overridable `CALIBRATION_TRUST_WEIGHTS` gradient
  (`unresolved`/`none` 1.0 baseline → `documented` 1.25). Conservative by
  default: unresolved sensors are never penalized, and only the consensus point
  shifts — `range` and `contested` still report the honest spread across claims.

### Patch Changes

- Updated dependencies [b373962]
- Updated dependencies [e6ff99c]
  - @disclosureos/instruments@1.0.0
  - @disclosureos/records@1.1.0
  - @disclosureos/observables@1.0.1
  - @disclosureos/origins@1.0.1

## 1.0.0

Initial public release — the Scoring layer.

### Added

- `getCompleteness` (how well-documented a record is) and `score` /
  `rankByCompellingness` (how anomalous a case is).
- Scoring over arrays of competing claims: results include a `range` (spread across
  claims) and a `contested` flag when evaluators disagree.
- `DEFAULT_WEIGHTS` and configurable evaluator weighting.
- Committed JSON Schema artifact (`schema/scoring.schema.json`, draft 2020-12).
