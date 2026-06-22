# Changelog

All notable changes to `@disclosureos/schema` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
