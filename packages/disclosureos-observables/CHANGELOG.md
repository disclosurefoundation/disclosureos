# Changelog

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
