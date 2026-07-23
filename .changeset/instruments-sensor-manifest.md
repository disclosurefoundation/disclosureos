---
'@disclosureos/records': minor
'@disclosureos/schema': minor
'@disclosureos/cli': minor
---

Add the instruments layer: the UAP Sensor Manifest standard
(`@disclosureos/instruments@1.0.0`, first published alongside this release —
see its own changelog).

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
