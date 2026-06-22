# Changelog

All notable changes to `@disclosureos/cli` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

Initial public release — developer tools for the DisclosureOS ecosystem.

### Added
- `scaffold` — generate typed observation/data-structure templates.
- `validate` — validate observation JSON files through `parseEnrichedObservation`;
  warns on dangling `evidenceRefs`.
- `completeness` — measure how fully observations populate the DisclosureOS schema.
- `registry` — introspect the field, observable, and origin registries.
- `info` — quick reference for types and definitions.
