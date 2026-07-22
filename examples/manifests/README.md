# Sensor manifests

Worked examples of the [`@disclosureos/instruments`](../../packages/disclosureos-instruments) Sensor Manifest — the standalone document type an operating organization publishes to catalog its sensors (hardware specs, timing provenance, measurement uncertainty, raw-data locators, calibration status). Observations cite manifest entries via `SensorReading.sensorRef` (`"<org-slug>:<sensor-id>"`).

- [`eldaeon-sensors.json`](./eldaeon-sensors.json) — the standard's first manifest, contributed by [ELDÆON](https://eldaeon.com) ([#5](https://github.com/disclosurefoundation/disclosureos/pull/5)): 28 sensors across all six modalities on the Dionysus platform, including a passive radar and a full biometric suite.
- [`registry.json`](./registry.json) — the community index mapping org slugs to published manifest URLs. Organizations host their own manifests; add yours via pull request.

Validate a manifest with the CLI:

```sh
pnpm --filter @disclosureos/cli build
node packages/disclosureos-cli/dist/index.js manifest validate examples/manifests/eldaeon-sensors.json
```

These files are validated in CI on every change.
