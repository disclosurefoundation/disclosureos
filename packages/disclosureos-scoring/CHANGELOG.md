# Changelog

All notable changes to `@disclosureos/scoring` are documented here. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

Initial public release — the Scoring layer.

### Added
- `getCompleteness` (how well-documented a record is) and `score` /
  `rankByCompellingness` (how anomalous a case is).
- Scoring over arrays of competing claims: results include a `range` (spread across
  claims) and a `contested` flag when evaluators disagree.
- `DEFAULT_WEIGHTS` and configurable evaluator weighting.
- Committed JSON Schema artifact (`schema/scoring.schema.json`, draft 2020-12).
