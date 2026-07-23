---
'@disclosureos/instruments': major
---

Initial release: the **UAP Sensor Manifest** standard — the DisclosureOS
standard's first standalone document type besides `Observation`.

A `SensorManifest` catalogs one organization's detection hardware per sensor:
modality, records-enum mapping, timing provenance, measurements with GUM
uncertainty, raw-data locators, and calibration provenance under a
`none → candidate_identified → in_practice → documented` maturity gradient.

Ships the full DX quintet (labels, constants, guards, factories, formatters),
`validateSensorManifest` (schema + unique-id + unflagged-mapping invariants),
and a drift-tested JSON Schema artifact at
`https://os.disclosure.org/schema/instruments/1.0.0/sensor-manifest.json`.

Sensor readings in `@disclosureos/records` cite manifest entries through
`SensorReading.sensorRef` (`"<org-slug>:<sensor-id>"`), and
`@disclosureos/scoring` consumes manifests through the `calibrationTrust`
evaluator-weight hook.

Proposed by [ELDÆON](https://eldaeon.com/)
([#5](https://github.com/disclosurefoundation/disclosureos/pull/5)), the
standard's first external contribution, and promoted into the framework as a
foundation package.
