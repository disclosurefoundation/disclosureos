---
'@disclosureos/instruments': minor
'@disclosureos/records': minor
'@disclosureos/schema': minor
'@disclosureos/cli': minor
---

Add the instruments layer: the UAP Sensor Manifest standard.

- **New `@disclosureos/instruments` package** — the standard's first standalone
  document type besides `Observation`. A `SensorManifest` catalogs one
  organization's detection hardware per sensor: modality, records-enum mapping,
  timing provenance, measurements with GUM uncertainty, raw-data locators, and
  calibration provenance under a `none → candidate_identified → in_practice →
  documented` maturity gradient. Ships the full DX quintet, `validateSensorManifest`
  (schema + unique-id + unflagged-mapping invariants), and a drift-tested JSON
  Schema artifact at `https://os.disclosure.org/schema/instruments/1.0.0/sensor-manifest.json`.
  Proposed by ELDÆON (#5).
- **`@disclosureos/records`** — `SensorReading` gains optional `sensorRef`
  (`"<org-slug>:<sensor-id>"`, with `sensorRef`/`isSensorRef`/`parseSensorRef`
  helpers in `records/shared`); `SensorType` gains 18 instrument classes
  (infrasonic/ultrasonic sensors, ADS-B receiver, RF spectrum analyzer, passive
  radar, particle detector, atomic clock, GNSS receiver, fluxgate magnetometer,
  air-quality sensor, barometer, lightning detector, IMU, EEG, GSR, pulse
  oximeter, pupillometer, hardware RNG); `DetectionMethod` gains 7 methods
  (particle, gnss, time_reference, chemical, inertial, physiological, pressure).
  Records schema artifact bumped to `1.1.0`.
- **`@disclosureos/schema`** — composed enriched-observation artifact re-emitted
  at `1.1.0` to carry the records changes.
- **`@disclosureos/cli`** — new `disclosureos manifest validate <path...>`
  command (`--recursive`, `--json`) delegating to `validateSensorManifest`.
