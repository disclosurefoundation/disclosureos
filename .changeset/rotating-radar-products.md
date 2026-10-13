---
"@disclosureos/schema": minor
---

Add an optional V2 rotating-radar profile over existing observation, acquisition
and source-selection contracts. Validate source bytes, scan/dwell semantics,
threshold detections, declared localization, track associations, position
covariance and separation from synthetic truth. Include a dependency-free reader,
portable JSON Schema and deterministic fixed, airborne and shipborne scanning examples.
Moving platforms retain one pose per dwell, declare beam reference and optional
slant-to-plane projection, and validate motion compensation and conditional uncertainty. Passing validation does
not establish physical calibration or tracking performance. Publication remains
deferred to the coordinated V2 release.
