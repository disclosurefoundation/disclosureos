# Changelog

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

All notable changes to `@disclosureos/origins` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.1

### Patch Changes

- Updated dependencies [e6ff99c]
  - @disclosureos/records@1.1.0

## 1.0.0

Initial public release — the Origins layer.

### Added

- The Origin Classification System (OCS) taxonomy across the Physical, Psychosocial,
  and Metaphysical domains, with traversal utilities (`getNode`, …).
- `OriginClaim` + `createOriginClaim`; the `origin` slot is an array of competing
  claims, with every node id validated against the live taxonomy.
- Typed reference systems: Hynek, Vallée, AARO, GEIPAN.
- `validateOriginClassification` and the `origin` augmentation of `Observation`.
- The DX quintet; committed JSON Schema artifact (`schema/origins.schema.json`,
  draft 2020-12).
