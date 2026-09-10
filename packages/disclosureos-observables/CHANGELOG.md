# Changelog

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

All notable changes to `@disclosureos/observables` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.1

### Patch Changes

- Updated dependencies [e6ff99c]
  - @disclosureos/records@1.1.0

## 1.0.0

Initial public release — the Observables layer.

### Added

- Technology (six AATIP-derived characteristics) and Biologics (six NHI indicators)
  observable frameworks.
- `ObservableAssessmentMap` + `createObservableClaim`; each observable holds an array
  of competing, attributed claims with evidentiary `level` and `confidence`.
- `validateObservableAssessments` and the `observableAssessments` augmentation of
  `Observation`.
- The DX quintet and per-domain subpaths; committed JSON Schema artifact
  (`schema/observables.schema.json`, draft 2020-12).
