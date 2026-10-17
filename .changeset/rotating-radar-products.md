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

Add separate optional steered-radar and cooperative secondary-radar profiles,
public dependency-free readers, package-exported portable schemas and complete
reproducible examples. Steered arrays retain arbitrary beam schedules and
per-dwell processing availability. Secondary reports preserve Mode A codes,
nullable Mode C pressure altitude, invalid receptions and exact reply lineage
without inventing reflected power, geometric height or verified identity.

Allow retained header-only CSV layouts for legitimate empty outcomes while
rejecting row selection, partition and sample mappings into empty tables.

Add optional fixed-site preprocessing with independently retained reference power,
reproducible background means and residual arrays, and explicit detector-policy
exclusions that preserve the raw capture. Add source-backed local site geometry
and complete ground and civilian airport surface examples. Validate acquisition
identity, time, axes, arithmetic, detector inputs and synthetic-truth separation.
These declarations do not imply physical coverage or identify detected objects.
