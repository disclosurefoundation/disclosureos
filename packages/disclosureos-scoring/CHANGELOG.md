# Changelog

## 2.0.0-beta.1

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

All notable changes to `@disclosureos/scoring` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased compatibility additions

- Add descriptive population-coverage naming while preserving legacy completeness results and schema identities.

## Unreleased experimental work

- Add exact-byte assessment-summary provenance, versioned input schema, and unsigned computed-result receipts; existing declaration summary behavior and source-verification limits are preserved.

- Add opt-in assessment summaries with current revision filtering, exact declaration deduplication, explicit shared lineage, and distinct outcome labels. Missing confidence stays omitted; existing scoring APIs and package versions are unchanged.

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
