---
"@disclosureos/scoring": minor
---

Add `calibrationTrust` — calibration provenance from published sensor manifests
(`@disclosureos/instruments`) as a scoring input. Builds an `evaluatorWeight`
policy that credits claims whose sensor evidence resolves (via
`SensorReading.sensorRef`) to a manifest entry with real calibration
provenance, under an overridable `CALIBRATION_TRUST_WEIGHTS` gradient
(`unresolved`/`none` 1.0 baseline → `documented` 1.25). Conservative by
default: unresolved sensors are never penalized, and only the consensus point
shifts — `range` and `contested` still report the honest spread across claims.
