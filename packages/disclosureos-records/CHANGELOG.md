# Changelog

All notable changes to `@disclosureos/records` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

Initial public release — the core of the DisclosureOS standard.

### Added
- `Observation` — the primary record type — with `ObservationSchema` (Zod 4) and the
  non-stripping `validateObservation` validator.
- `@disclosureos/records/shared`: the cross-package substrate (`Confidence`,
  `Attribution`, `Claim` + `evidenceRef` helpers, `validateWith`, `schemaId`,
  `jsonSchemaEnvelope`, enum guards, branded ids).
- The `ObservationExtensions` extension point for satellite slots.
- The DX quintet (labels, constants, guards, factories, formatters, validators) and
  temporal / geo / media / extension subpaths.
- Committed JSON Schema artifact (`schema/records.schema.json`, draft 2020-12).
