---
"@disclosureos/records": major
"@disclosureos/observables": major
"@disclosureos/origins": major
"@disclosureos/instruments": major
"@disclosureos/scoring": major
"@disclosureos/schema": major
"@disclosureos/cli": major
---

Prepare the coordinated v2 beta package set. This prerelease packages the merged
experimental observation and claim contracts, acquisition and dataset exchange,
versioned evaluation, and bounded migration tooling for external consumer testing.
Existing root APIs and schema identities remain available; the new contracts keep
explicit `/experimental/v2` imports. Observables and origins retain their existing
catalogs within the pinned beta dependency graph. This is not a stable v2 release,
scientific certification, or publication of partner data. See
`docs/releases/2.0.0-beta.0.md` for package-specific scope and validation boundaries.
