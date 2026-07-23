---
'@disclosureos/cli': patch
---

`disclosureos validate` now warns when a `SensorReading.sensorRef` does not
match the `"<org-slug>:<sensor-id>"` manifest convention — mirroring the
existing malformed/dangling warnings for claim `evidenceRefs`.
