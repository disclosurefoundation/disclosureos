# Ground-site and civilian surface-surveillance radar

Two fictional captures demonstrate optional reference-background preprocessing in the rotating radar profile. The ground example concerns fixed-site surveillance. The civilian example concerns airport surface traffic in an authored horizontal frame, not airborne approach, landing guidance or a certified airport system.

## Reproduce

```sh
node examples/radar-site/build.mjs
node --test examples/radar-site/model.test.mjs
node examples/radar-site/verify.mjs
```

The packet retains `model.mjs` and `radar-scanning-model.mjs` so its complete numerical model also runs independently:

```js
import { simulate, scenarioConfigs } from "./model.mjs";
const ground = simulate(scenarioConfigs.ground);
const civilian = simulate(scenarioConfigs.civilian);
```

Source bytes and every declared selection are verified. Scientific validity, physical calibration and operational performance are not established by these checks.

## Source and processing sequence

1. An independent target-free reference acquisition contains eight complete rotations. Its own acquisition interval precedes the main capture.
2. The background map is the arithmetic mean of those retained samples at each azimuth/range cell, rounded once to float32.
3. The main raw capture remains intact. A separate processed array contains `float32(max(0, raw - background))`.
4. A retained byte map identifies eligible detector cells. Zero means excluded by declared processing policy. It never means no reception, no object, terrain blockage or missing data.
5. Thresholds and detections use the processed array and the eligibility map. Exact peak cells provide horizontal positions. Neighboring azimuth processing requires scan completion.
6. A constant-velocity Kalman filter receives only detections. Source truth, target labels and the site geometry do not enter the estimator.

The reference is imperfect because of independent noise and texture. A temporary clutter change in the main capture is absent from the reference and can survive subtraction. The example does not hide that return or label it as a target using generator truth.

## Ground example

Two moving returns cross the fixed site. Authored stationary structures contribute background power. A small rectangular detector exclusion intersects one path. Raw reception remains visible in that region, while the detection pipeline deliberately omits eligible output there. A second return undergoes prescribed fading, producing prediction intervals and later recovery.

## Civilian surface example

The retained site-feature table provides a fictional runway, taxiway, apron and structures. Three surface trajectories include straight motion and a turn. All are modeled in the same horizontal plane. The source does not classify a detected return as an aircraft or vehicle and does not attach identity, transponder code or geometric altitude.

The apron detector exclusion is an explanatory processing example, not a recommendation for operational airport surveillance. No real airport layout or procedure is represented.

## Interpretation boundaries

Relative power is not watts or dBm. The background map is an estimate from retained reference samples, not generator truth. Site features are authored reference geometry, not measured radar contours. The detector policy is separate from physical visibility. Track uncertainty is conditional on declared filter assumptions and is not validated hardware accuracy.

Each packet includes observation, acquisition, source-selection and radar-profile documents, all numerical inputs and outputs, full filter states, methods, standalone model code and SHA-256 fingerprints.
