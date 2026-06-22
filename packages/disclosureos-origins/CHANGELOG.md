# Changelog

All notable changes to `@disclosureos/origins` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
